const assert = require('assert');
const { SoroStreamClient } = require('../dist/client');

console.log('Testing @sorostream/sdk SoroStreamClient helper methods...');

const client = new SoroStreamClient({
  contractId: 'C_SOROSTREAM_TEST_CONTRACT_ID_123456789012345678901234567890',
  indexerUrl: 'http://localhost:8000',
});

// 1. Test buildCreateStreamParams validation
const validOptions = {
  sender: 'GBZXN7PIRZGNMHGA728R374U10943892348GBZXN7PIRZGNMHGA728R374U'.slice(0, 56),
  recipient: 'GCH4X39385NMGHA728R374U10943892348GBZXN7PIRZGNMHGA728R374U'.slice(0, 56),
  token: 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC',
  amountTokens: '150.5',
  durationDays: 180,
  cliffDays: 30,
  startDelayDays: 0,
  revocable: true,
  tokenDecimals: 7,
};

const params = client.buildCreateStreamParams(validOptions);
assert.strictEqual(params.sender, validOptions.sender);
assert.strictEqual(params.recipient, validOptions.recipient);
assert.strictEqual(params.amount, BigInt(1_505_000_000)); // 150.5 * 10^7
assert.strictEqual(params.revocable, true);
assert(params.startTime <= params.cliffTime);
assert(params.cliffTime < params.endTime);

// 2. Test invalid recipient address
assert.throws(() => {
  client.buildCreateStreamParams({
    ...validOptions,
    recipient: 'INVALID_STELLAR_ADDRESS',
  });
}, /Invalid Stellar recipient public key/);

// 3. Test non-positive amount
assert.throws(() => {
  client.buildCreateStreamParams({
    ...validOptions,
    amountTokens: '-10',
  });
}, /Stream amount must be greater than 0/);

// 4. Test validateStreamBounds
const validBounds = client.validateStreamBounds({
  startTime: 1000,
  cliffTime: 2000,
  endTime: 3000,
  amount: BigInt(500),
});
assert.strictEqual(validBounds.valid, true);

const invalidAmount = client.validateStreamBounds({
  startTime: 1000,
  cliffTime: 2000,
  endTime: 3000,
  amount: BigInt(0),
});
assert.strictEqual(invalidAmount.valid, false);

const cliffBeforeStart = client.validateStreamBounds({
  startTime: 2000,
  cliffTime: 1000,
  endTime: 3000,
  amount: BigInt(500),
});
assert.strictEqual(cliffBeforeStart.valid, false);

const endBeforeCliff = client.validateStreamBounds({
  startTime: 1000,
  cliffTime: 3000,
  endTime: 2000,
  amount: BigInt(500),
});
assert.strictEqual(endBeforeCliff.valid, false);

// 5. Test transaction payload builders
const createPayload = client.buildCreateStreamTransactionPayload(params);
assert.strictEqual(createPayload.method, 'create_stream');
assert.strictEqual(createPayload.args.amount, '1505000000');
assert.strictEqual(createPayload.args.recipient, validOptions.recipient);

const withdrawPayload = client.buildWithdrawTransactionPayload(42);
assert.strictEqual(withdrawPayload.method, 'withdraw');
assert.strictEqual(withdrawPayload.args.stream_id, 42);

const cancelPayload = client.buildCancelStreamTransactionPayload(42, validOptions.sender);
assert.strictEqual(cancelPayload.method, 'cancel_stream');
assert.strictEqual(cancelPayload.args.stream_id, 42);
assert.strictEqual(cancelPayload.args.sender, validOptions.sender);

// 6. Test Freighter signing helper with mock signer
async function testFreighterSigning() {
  const mockSigner = {
    async signTransaction(xdr, opts) {
      assert(xdr.includes('MOCK_XDR'));
      assert.strictEqual(opts.networkPassphrase, 'Test SDF Network ; September 2015');
      return 'SIGNED_MOCK_XDR_RESULT';
    },
  };

  const signed = await client.signTransactionWithFreighter('MOCK_XDR_DATA', mockSigner);
  assert.strictEqual(signed, 'SIGNED_MOCK_XDR_RESULT');

  // Test error when signer is missing
  let threw = false;
  try {
    await client.signTransactionWithFreighter('MOCK_XDR_DATA', null);
  } catch (err) {
    threw = true;
    assert(err.message.includes('Freighter wallet extension not found'));
  }
  assert(threw, 'Should throw when Freighter is absent');
}

// 7. Test simulated RPC balance querying
async function testBalanceQuery() {
  const bal = await client.getRpcBalance(validOptions.recipient);
  assert.strictEqual(bal.account, validOptions.recipient);
  assert(typeof bal.balance === 'bigint');
  assert(typeof bal.formatted === 'string');

  // Test pollBalance returns a cancellation callback
  let pollCallCount = 0;
  const stopPoll = client.pollBalance(
    validOptions.recipient,
    (res) => {
      pollCallCount++;
    },
    100
  );
  assert.strictEqual(typeof stopPoll, 'function');
  stopPoll();
}

// 8. Test stream polling cancel handle
function testStreamPolling() {
  const stopPoll = client.pollClaimableBalance(1, () => {}, 100);
  assert.strictEqual(typeof stopPoll, 'function');
  stopPoll();
}

Promise.all([testFreighterSigning(), testBalanceQuery()])
  .then(() => {
    testStreamPolling();
    console.log('All @sorostream/sdk SoroStreamClient tests passed!');
  })
  .catch((err) => {
    console.error('Test failure:', err);
    process.exit(1);
  });
