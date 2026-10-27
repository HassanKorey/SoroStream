const assert = require('assert');
const {
  SoroStreamClient,
  isValidStellarAddress,
  validateStreamBounds,
  buildCreateStreamParams,
  buildCreateStreamTx,
  buildWithdrawTx,
  buildCancelStreamTx,
  signTransactionWithFreighter,
} = require('../dist');

const VALID_SENDER = 'GA2C5RFILRUKMQDUZDIIXGPOABGWNESHSQYDCJZRA3W563O7QDZ3U4NO';
const VALID_RECIPIENT = 'GBZKPZX3574Y5N4Q3EZZZKVH7Y2E3K4F6F6J6Z7L5C6O2Q4K2D3F4G5H';
const VALID_TOKEN = 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC';

async function runTests() {
  console.log('Testing @sorostream/sdk client, builders, Freighter signing, and polling...');

  // 1. Address and bounds validation
  assert.strictEqual(isValidStellarAddress(VALID_SENDER, 'G'), true);
  assert.strictEqual(isValidStellarAddress(VALID_TOKEN, 'C'), true);
  assert.strictEqual(isValidStellarAddress(VALID_SENDER, 'C'), false);
  assert.strictEqual(isValidStellarAddress('GSHORT', 'G'), false);

  const builtParams = buildCreateStreamParams({
    sender: VALID_SENDER,
    recipient: VALID_RECIPIENT,
    token: VALID_TOKEN,
    amount: '50000000',
    startTime: 1000,
    cliffTime: 2000,
    endTime: 5000,
  });
  assert.strictEqual(builtParams.amount, BigInt(50_000_000));
  assert.strictEqual(builtParams.revocable, true);

  // Invalid bounds should throw
  assert.throws(() => {
    validateStreamBounds({
      sender: 'INVALID_ADDR',
      recipient: VALID_RECIPIENT,
      token: VALID_TOKEN,
      amount: BigInt(1000),
      startTime: 100,
      cliffTime: 200,
      endTime: 300,
    });
  }, /Invalid sender address/);

  assert.throws(() => {
    validateStreamBounds({
      sender: VALID_SENDER,
      recipient: VALID_RECIPIENT,
      token: VALID_TOKEN,
      amount: BigInt(0),
      startTime: 100,
      cliffTime: 200,
      endTime: 300,
    });
  }, /Invalid amount/);

  assert.throws(() => {
    validateStreamBounds({
      sender: VALID_SENDER,
      recipient: VALID_RECIPIENT,
      token: VALID_TOKEN,
      amount: BigInt(1000),
      startTime: 300,
      cliffTime: 200,
      endTime: 400,
    });
  }, /Invalid bounds/);

  assert.throws(() => {
    validateStreamBounds({
      sender: VALID_SENDER,
      recipient: VALID_RECIPIENT,
      token: VALID_TOKEN,
      amount: BigInt(1000),
      startTime: 100,
      cliffTime: 400,
      endTime: 400,
    });
  }, /Invalid bounds/);

  // 2. Transaction payload generators
  const createTx = buildCreateStreamTx(builtParams);
  assert.strictEqual(createTx.method, 'create_stream');
  assert.strictEqual(createTx.args.amount, '50000000');
  assert.strictEqual(createTx.signer, VALID_SENDER);

  const withdrawTx = buildWithdrawTx(12, VALID_RECIPIENT);
  assert.strictEqual(withdrawTx.method, 'withdraw');
  assert.strictEqual(withdrawTx.args.stream_id, 12);
  assert.strictEqual(withdrawTx.signer, VALID_RECIPIENT);

  const cancelTx = buildCancelStreamTx(12, VALID_SENDER);
  assert.strictEqual(cancelTx.method, 'cancel_stream');
  assert.strictEqual(cancelTx.args.stream_id, 12);
  assert.strictEqual(cancelTx.signer, VALID_SENDER);

  // 3. Freighter wallet signing helper
  const mockFreighter = {
    isConnected: async () => true,
    getPublicKey: async () => VALID_SENDER,
    signTransaction: async (xdr, opts) => ({
      signedTxXdr: `SIGNED:${xdr}:${opts.accountToSign}`,
    }),
  };

  const signedResult = await signTransactionWithFreighter(createTx, {
    provider: mockFreighter,
  });
  assert.ok(signedResult.signedXdr.startsWith('SIGNED:'));
  assert.strictEqual(signedResult.signerAddress, VALID_SENDER);

  await assert.rejects(
    async () => {
      await signTransactionWithFreighter('UNSIGNED_XDR', {
        provider: {
          isConnected: async () => false,
          signTransaction: async () => 'NEVER',
        },
      });
    },
    /Freighter wallet is not connected/
  );

  // 4. SoroStreamClient API methods & polling engines with mocked fetch
  const originalFetch = globalThis.fetch;
  let fetchCount = 0;

  globalThis.fetch = async (url, options = {}) => {
    fetchCount += 1;
    const urlStr = String(url);
    const mockRawStream = {
      id: 1,
      sender: VALID_SENDER,
      recipient: VALID_RECIPIENT,
      token: VALID_TOKEN,
      token_symbol: 'USDC',
      token_decimals: 7,
      total_amount: 100_000_000,
      claimed_amount: 20_000_000,
      start_time: 1000,
      cliff_time: 2000,
      end_time: 6000,
      revocable: true,
      is_cancelled: false,
      current_time: 3500,
    };

    if (urlStr.includes('/api/streams/batch')) {
      return {
        ok: true,
        json: async () => [mockRawStream],
      };
    }
    if (urlStr.includes('/api/streams?')) {
      return {
        ok: true,
        json: async () => [mockRawStream],
      };
    }
    return {
      ok: true,
      json: async () => mockRawStream,
    };
  };

  try {
    const client = new SoroStreamClient({ indexerUrl: 'http://indexer.test' });

    const created = await client.createStream(builtParams);
    assert.strictEqual(created.id, 1);
    assert.strictEqual(created.unlockedAmount, BigInt(50_000_000));
    assert.strictEqual(created.claimableAmount, BigInt(30_000_000));

    const batchCreated = await client.createStreamBatch(VALID_SENDER, VALID_TOKEN, [
      {
        recipient: VALID_RECIPIENT,
        amount: BigInt(10_000_000),
        startTime: 1000,
        cliffTime: 2000,
        endTime: 5000,
        revocable: true,
      },
    ]);
    assert.strictEqual(batchCreated.length, 1);

    const withdrawn = await client.withdraw(1, VALID_RECIPIENT);
    assert.strictEqual(withdrawn.id, 1);

    const cancelled = await client.cancelStream(1, VALID_SENDER);
    assert.strictEqual(cancelled.id, 1);

    const balance = await client.getAccountBalance(VALID_RECIPIENT, VALID_TOKEN);
    // claimed (20_000_000) + claimable (30_000_000) = 50_000_000
    assert.strictEqual(balance, BigInt(50_000_000));

    // Poll stream and test clean teardown
    const polledStreams = [];
    const streamPollHandle = client.pollStream(
      1,
      (detail) => {
        polledStreams.push(detail);
      },
      25
    );
    await new Promise((r) => setTimeout(r, 40));
    streamPollHandle.stop();
    assert.ok(polledStreams.length >= 1);

    // Poll account balance and test callable teardown
    const polledBalances = [];
    const balancePollHandle = client.pollAccountBalance(
      VALID_RECIPIENT,
      (bal) => {
        polledBalances.push(bal);
      },
      25,
      VALID_TOKEN
    );
    await new Promise((r) => setTimeout(r, 40));
    balancePollHandle();
    assert.ok(polledBalances.length >= 1);
    assert.strictEqual(polledBalances[0], BigInt(50_000_000));
  } finally {
    globalThis.fetch = originalFetch;
  }

  console.log('All @sorostream/sdk client unit tests passed!');
}

runTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
