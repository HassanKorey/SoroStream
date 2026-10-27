import { calculateVesting } from './math';
import {
  BatchStreamItem,
  CreateStreamInput,
  CreateStreamParams,
  FreighterProvider,
  PollHandle,
  SignedTransactionResult,
  SorobanTransactionPayload,
  SoroStreamClientConfig,
  StreamDetail,
  StreamRecord,
} from './types';

const DEFAULT_CONTRACT_ID = 'CA4L7T6R74G3T5F5V7V7RWWUHE2J76Y4WJ3L7C2WJ3L7C2WJ3L7C2WJ3';
const DEFAULT_NETWORK_PASSPHRASE = 'Test SDF Network ; September 2015';

/**
 * Validates a Stellar StrKey public key ('G...') or Soroban contract address ('C...').
 */
export function isValidStellarAddress(address: string, expectedPrefix?: 'G' | 'C'): boolean {
  if (typeof address !== 'string') {
    return false;
  }
  const trimmed = address.trim();
  if (trimmed.length !== 56) {
    return false;
  }
  if (expectedPrefix && !trimmed.startsWith(expectedPrefix)) {
    return false;
  }
  if (!trimmed.startsWith('G') && !trimmed.startsWith('C')) {
    return false;
  }
  return /^[GC][A-Z2-7]{55}$/.test(trimmed);
}

/**
 * Validates stream creation parameters: address formats, positive amount, and timeline bounds.
 * Throws a descriptive Error if any invariant is violated.
 */
export function validateStreamBounds(params: {
  amount: bigint | number;
  startTime: number;
  cliffTime: number;
  endTime: number;
  sender?: string;
  recipient?: string;
  token?: string;
}): void {
  if (params.sender !== undefined && !isValidStellarAddress(params.sender, 'G')) {
    throw new Error('Invalid sender address: must be a 56-character Stellar G... public key');
  }
  if (params.recipient !== undefined && !isValidStellarAddress(params.recipient, 'G')) {
    throw new Error(
      'Invalid recipient address: must be a 56-character Stellar G... public key'
    );
  }
  if (params.token !== undefined && !isValidStellarAddress(params.token, 'C')) {
    throw new Error(
      'Invalid token address: must be a 56-character Soroban C... contract address'
    );
  }
  if (params.sender && params.recipient && params.sender === params.recipient) {
    throw new Error('Invalid stream participants: sender and recipient cannot be identical');
  }

  const amountBigInt =
    typeof params.amount === 'bigint' ? params.amount : BigInt(Math.trunc(params.amount));
  if (amountBigInt <= BigInt(0)) {
    throw new Error('Invalid amount: stream amount must be strictly greater than 0 stroops');
  }

  if (
    !Number.isFinite(params.startTime) ||
    !Number.isFinite(params.cliffTime) ||
    !Number.isFinite(params.endTime) ||
    params.startTime < 0
  ) {
    throw new Error('Invalid timestamps: startTime, cliffTime, and endTime must be non-negative');
  }

  if (!(params.startTime <= params.cliffTime && params.cliffTime < params.endTime)) {
    throw new Error('Invalid bounds: startTime must be <= cliffTime and cliffTime < endTime');
  }
}

/**
 * Normalizes and validates raw input into a typed CreateStreamParams object.
 */
export function buildCreateStreamParams(input: CreateStreamInput): CreateStreamParams {
  const amount =
    typeof input.amount === 'bigint' ? input.amount : BigInt(String(input.amount));
  const startTime = Math.trunc(input.startTime);
  const cliffTime = Math.trunc(input.cliffTime);
  const endTime = Math.trunc(input.endTime);
  const revocable = input.revocable !== undefined ? Boolean(input.revocable) : true;

  validateStreamBounds({
    sender: input.sender,
    recipient: input.recipient,
    token: input.token,
    amount,
    startTime,
    cliffTime,
    endTime,
  });

  return {
    sender: input.sender.trim(),
    recipient: input.recipient.trim(),
    token: input.token.trim(),
    amount,
    startTime,
    cliffTime,
    endTime,
    revocable,
  };
}

/**
 * Builds a Soroban transaction payload for `create_stream`.
 */
export function buildCreateStreamTx(
  params: CreateStreamParams,
  contractId: string = DEFAULT_CONTRACT_ID,
  networkPassphrase: string = DEFAULT_NETWORK_PASSPHRASE
): SorobanTransactionPayload {
  validateStreamBounds(params);
  return {
    contractId,
    method: 'create_stream',
    args: {
      sender: params.sender,
      recipient: params.recipient,
      token: params.token,
      amount: params.amount.toString(),
      start: params.startTime,
      cliff: params.cliffTime,
      end: params.endTime,
      revocable: params.revocable,
    },
    signer: params.sender,
    networkPassphrase,
  };
}

/**
 * Builds a Soroban transaction payload for `withdraw`.
 */
export function buildWithdrawTx(
  streamId: number,
  recipient?: string,
  contractId: string = DEFAULT_CONTRACT_ID,
  networkPassphrase: string = DEFAULT_NETWORK_PASSPHRASE
): SorobanTransactionPayload {
  if (!Number.isInteger(streamId) || streamId <= 0) {
    throw new Error('Invalid streamId: must be a positive integer');
  }
  if (recipient !== undefined && !isValidStellarAddress(recipient, 'G')) {
    throw new Error(
      'Invalid recipient address: must be a 56-character Stellar G... public key'
    );
  }
  return {
    contractId,
    method: 'withdraw',
    args: {
      stream_id: streamId,
    },
    signer: recipient,
    networkPassphrase,
  };
}

/**
 * Builds a Soroban transaction payload for `cancel_stream`.
 */
export function buildCancelStreamTx(
  streamId: number,
  sender: string,
  contractId: string = DEFAULT_CONTRACT_ID,
  networkPassphrase: string = DEFAULT_NETWORK_PASSPHRASE
): SorobanTransactionPayload {
  if (!Number.isInteger(streamId) || streamId <= 0) {
    throw new Error('Invalid streamId: must be a positive integer');
  }
  if (!isValidStellarAddress(sender, 'G')) {
    throw new Error('Invalid sender address: must be a 56-character Stellar G... public key');
  }
  return {
    contractId,
    method: 'cancel_stream',
    args: {
      sender,
      stream_id: streamId,
    },
    signer: sender,
    networkPassphrase,
  };
}

/**
 * Signs a transaction XDR or payload using the Freighter wallet provider.
 */
export async function signTransactionWithFreighter(
  xdrOrPayload: string | SorobanTransactionPayload,
  options: {
    provider?: FreighterProvider;
    networkPassphrase?: string;
    accountToSign?: string;
  } = {}
): Promise<SignedTransactionResult> {
  const globalWindow = (globalThis as { window?: { freighterApi?: FreighterProvider } }).window;
  const provider = options.provider || globalWindow?.freighterApi;
  if (!provider || typeof provider.signTransaction !== 'function') {
    throw new Error('Freighter wallet provider is not available');
  }

  if (typeof provider.isConnected === 'function') {
    const connected = await provider.isConnected();
    if (!connected) {
      throw new Error('Freighter wallet is not connected');
    }
  }

  const networkPassphrase =
    options.networkPassphrase ||
    (typeof xdrOrPayload === 'object' ? xdrOrPayload.networkPassphrase : undefined) ||
    DEFAULT_NETWORK_PASSPHRASE;

  const accountToSign =
    options.accountToSign ||
    (typeof xdrOrPayload === 'object' ? xdrOrPayload.signer : undefined) ||
    (typeof provider.getPublicKey === 'function' ? await provider.getPublicKey() : undefined);

  const unsignedXdr =
    typeof xdrOrPayload === 'string'
      ? xdrOrPayload
      : Buffer.from(JSON.stringify(xdrOrPayload), 'utf-8').toString('base64');

  const response = await provider.signTransaction(unsignedXdr, {
    networkPassphrase,
    accountToSign,
  });

  if (typeof response === 'object' && response !== null) {
    if (response.error) {
      throw new Error(`Freighter signing failed: ${response.error}`);
    }
    return {
      signedXdr: response.signedTxXdr,
      signerAddress: accountToSign,
      networkPassphrase,
    };
  }

  return {
    signedXdr: String(response),
    signerAddress: accountToSign,
    networkPassphrase,
  };
}

function createPollHandle(stopFn: () => void): PollHandle {
  const handle = (() => {
    stopFn();
  }) as PollHandle;
  handle.stop = stopFn;
  return handle;
}

export class SoroStreamClient {
  private indexerUrl: string;
  private rpcUrl: string;
  private contractId: string;
  private networkPassphrase: string;

  constructor(config: SoroStreamClientConfig = {}) {
    this.indexerUrl = config.indexerUrl || 'http://localhost:8000';
    this.rpcUrl = config.rpcUrl || 'https://soroban-testnet.stellar.org';
    this.contractId = config.contractId || DEFAULT_CONTRACT_ID;
    this.networkPassphrase = config.networkPassphrase || DEFAULT_NETWORK_PASSPHRASE;
  }

  /**
   * Fetches stream details from the indexer API and computes live vesting state.
   */
  async getStream(streamId: number): Promise<StreamDetail> {
    const res = await fetch(`${this.indexerUrl}/api/streams/${streamId}`);
    if (!res.ok) {
      throw new Error(`Failed to fetch stream #${streamId}: ${res.statusText}`);
    }
    const data = await res.json();
    return this.mapStreamResponse(data);
  }

  /**
   * Fetches all streams matching query filters.
   */
  async listStreams(
    params: {
      sender?: string;
      recipient?: string;
      status?: string;
    } = {}
  ): Promise<StreamDetail[]> {
    const query = new URLSearchParams();
    if (params.sender) query.set('sender', params.sender);
    if (params.recipient) query.set('recipient', params.recipient);
    if (params.status) query.set('status', params.status);

    const res = await fetch(`${this.indexerUrl}/api/streams?${query.toString()}`);
    if (!res.ok) {
      throw new Error(`Failed to list streams: ${res.statusText}`);
    }
    const items = await res.json();
    return items.map((i: Record<string, unknown>) => this.mapStreamResponse(i));
  }

  /**
   * Records a new stream in the indexer after validating bounds.
   */
  async createStream(params: CreateStreamParams): Promise<StreamDetail> {
    validateStreamBounds(params);
    const payload = {
      sender: params.sender,
      recipient: params.recipient,
      token: params.token,
      amount: Number(params.amount),
      start_time: params.startTime,
      cliff_time: params.cliffTime,
      end_time: params.endTime,
      revocable: params.revocable,
    };
    const res = await fetch(`${this.indexerUrl}/api/streams`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to create stream');
    }
    return this.mapStreamResponse(await res.json());
  }

  /**
   * Records a batch of streams in the indexer.
   */
  async createStreamBatch(
    sender: string,
    token: string,
    items: BatchStreamItem[]
  ): Promise<StreamDetail[]> {
    if (!isValidStellarAddress(sender, 'G')) {
      throw new Error('Invalid sender address: must be a 56-character Stellar G... public key');
    }
    if (!isValidStellarAddress(token, 'C')) {
      throw new Error(
        'Invalid token address: must be a 56-character Soroban C... contract address'
      );
    }
    for (const item of items) {
      validateStreamBounds({
        sender,
        recipient: item.recipient,
        token,
        amount: item.amount,
        startTime: item.startTime,
        cliffTime: item.cliffTime,
        endTime: item.endTime,
      });
    }

    const res = await fetch(`${this.indexerUrl}/api/streams/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sender,
        token,
        items: items.map((item) => ({
          recipient: item.recipient,
          amount: Number(item.amount),
          start_time: item.startTime,
          cliff_time: item.cliffTime,
          end_time: item.endTime,
          revocable: item.revocable,
        })),
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to create batch streams');
    }
    const created = await res.json();
    return created.map((i: Record<string, unknown>) => this.mapStreamResponse(i));
  }

  /**
   * Triggers withdrawal for a stream.
   */
  async withdraw(streamId: number, actor?: string): Promise<StreamDetail> {
    const query = actor ? `?actor=${encodeURIComponent(actor)}` : '';
    const res = await fetch(`${this.indexerUrl}/api/streams/${streamId}/withdraw${query}`, {
      method: 'POST',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Withdrawal failed');
    }
    return this.mapStreamResponse(await res.json());
  }

  /**
   * Cancels a revocable stream.
   */
  async cancelStream(streamId: number, sender: string): Promise<StreamDetail> {
    const res = await fetch(
      `${this.indexerUrl}/api/streams/${streamId}/cancel?sender=${encodeURIComponent(sender)}`,
      { method: 'POST' }
    );
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Cancel failed');
    }
    return this.mapStreamResponse(await res.json());
  }

  /**
   * Queries aggregate claimed and claimable token balance for an account across streams.
   */
  async getAccountBalance(address: string, token?: string): Promise<bigint> {
    if (!isValidStellarAddress(address, 'G')) {
      throw new Error('Invalid account address: must be a 56-character Stellar G... public key');
    }
    const streams = await this.listStreams({ recipient: address });
    let total = BigInt(0);
    for (const s of streams) {
      if (token && s.token !== token) {
        continue;
      }
      total += s.claimedAmount + s.claimableAmount;
    }
    return total;
  }

  /**
   * Generates a transaction payload for `create_stream`.
   */
  buildCreateStreamTransaction(params: CreateStreamParams): SorobanTransactionPayload {
    return buildCreateStreamTx(params, this.contractId, this.networkPassphrase);
  }

  /**
   * Generates a transaction payload for `withdraw`.
   */
  buildWithdrawTransaction(streamId: number, recipient?: string): SorobanTransactionPayload {
    return buildWithdrawTx(streamId, recipient, this.contractId, this.networkPassphrase);
  }

  /**
   * Generates a transaction payload for `cancel_stream`.
   */
  buildCancelStreamTransaction(streamId: number, sender: string): SorobanTransactionPayload {
    return buildCancelStreamTx(streamId, sender, this.contractId, this.networkPassphrase);
  }

  /**
   * Signs a transaction payload or XDR via Freighter wallet.
   */
  async signWithFreighter(
    xdrOrPayload: string | SorobanTransactionPayload,
    provider?: FreighterProvider
  ): Promise<SignedTransactionResult> {
    return signTransactionWithFreighter(xdrOrPayload, {
      provider,
      networkPassphrase: this.networkPassphrase,
    });
  }

  /**
   * Polls a stream at a regular interval, executing a callback with refreshed data.
   * Returns a teardown handle (`stop()` or `handle.stop()`).
   */
  pollStream(
    streamId: number,
    callback: (stream: StreamDetail) => void,
    intervalMs: number = 2000
  ): PollHandle {
    let active = true;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const tick = async () => {
      if (!active) return;
      try {
        const detail = await this.getStream(streamId);
        if (active) {
          callback(detail);
        }
      } catch {
        // ignore transient poll errors
      }
      if (active) {
        timer = setTimeout(tick, intervalMs);
      }
    };

    void tick();

    return createPollHandle(() => {
      active = false;
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
    });
  }

  /**
   * Polls an account's dynamic token balance across active streams at a regular interval.
   * Returns a teardown handle (`stop()` or `handle.stop()`).
   */
  pollAccountBalance(
    address: string,
    callback: (balance: bigint) => void,
    intervalMs: number = 2000,
    token?: string
  ): PollHandle {
    let active = true;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const tick = async () => {
      if (!active) return;
      try {
        const balance = await this.getAccountBalance(address, token);
        if (active) {
          callback(balance);
        }
      } catch {
        // ignore transient poll errors
      }
      if (active) {
        timer = setTimeout(tick, intervalMs);
      }
    };

    void tick();

    return createPollHandle(() => {
      active = false;
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
    });
  }

  private mapStreamResponse(raw: Record<string, any>): StreamDetail {
    const record: StreamRecord = {
      id: raw.id,
      sender: raw.sender,
      recipient: raw.recipient,
      token: raw.token,
      tokenSymbol: raw.token_symbol || 'USDC',
      tokenDecimals: raw.token_decimals || 7,
      totalAmount: BigInt(raw.total_amount),
      claimedAmount: BigInt(raw.claimed_amount || 0),
      startTime: raw.start_time,
      cliffTime: raw.cliff_time,
      endTime: raw.end_time,
      revocable: Boolean(raw.revocable),
      isCancelled: Boolean(raw.is_cancelled),
      createdAt: raw.created_at || raw.start_time,
    };

    const calculation = calculateVesting(record, raw.current_time);
    return {
      ...record,
      ...calculation,
    };
  }
}
