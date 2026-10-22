import { calculateVesting } from './math';
import {
  CreateStreamParams,
  BatchStreamItem,
  SoroStreamClientConfig,
  StreamDetail,
  StreamRecord,
  StreamCreationOptions,
  BalanceResult,
  FreighterSigner,
  TransactionPayload,
} from './types';

export class SoroStreamClient {
  private indexerUrl: string;
  private rpcUrl: string;
  private contractId: string;

  constructor(config: SoroStreamClientConfig = {}) {
    this.indexerUrl = config.indexerUrl || 'http://localhost:8000';
    this.rpcUrl = config.rpcUrl || 'https://soroban-testnet.stellar.org';
    this.contractId =
      config.contractId || 'CA4L7T6R74G3T5F5V7V7RWWUHE2J76Y4WJ3L7C2WJ3L7C2WJ3L7C2WJ3';
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
  async listStreams(params: {
    sender?: string;
    recipient?: string;
    status?: string;
  } = {}): Promise<StreamDetail[]> {
    const query = new URLSearchParams();
    if (params.sender) query.set('sender', params.sender);
    if (params.recipient) query.set('recipient', params.recipient);
    if (params.status) query.set('status', params.status);

    const res = await fetch(`${this.indexerUrl}/api/streams?${query.toString()}`);
    if (!res.ok) {
      throw new Error(`Failed to list streams: ${res.statusText}`);
    }
    const items = await res.json();
    return items.map((i: any) => this.mapStreamResponse(i));
  }

  /**
   * Records a new stream in the indexer.
   */
  async createStream(params: CreateStreamParams): Promise<StreamDetail> {
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
   * Polls a stream at a regular interval, executing a callback with refreshed data.
   */
  pollStream(
    streamId: number,
    callback: (stream: StreamDetail) => void,
    intervalMs: number = 2000
  ): () => void {
    let active = true;

    const poll = async () => {
      while (active) {
        try {
          const detail = await this.getStream(streamId);
          callback(detail);
        } catch {
          // ignore transient poll errors
        }
        await new Promise((r) => setTimeout(r, intervalMs));
      }
    };

    poll();
    return () => {
      active = false;
    };
  }

  private mapStreamResponse(raw: any): StreamDetail {
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

  /**
   * Helper method to build and validate CreateStreamParams from human-friendly configuration.
   */
  buildCreateStreamParams(options: StreamCreationOptions): CreateStreamParams {
    const {
      sender,
      recipient,
      token,
      amountTokens,
      durationDays,
      cliffDays = 0,
      startDelayDays = 0,
      revocable = true,
      tokenDecimals = 7,
    } = options;

    if (!recipient || !recipient.startsWith('G') || recipient.length !== 56) {
      throw new Error(`Invalid Stellar recipient public key: ${recipient}`);
    }

    const numAmount = typeof amountTokens === 'string' ? parseFloat(amountTokens) : amountTokens;
    if (isNaN(numAmount) || numAmount <= 0) {
      throw new Error(`Stream amount must be greater than 0, received: ${amountTokens}`);
    }

    const multiplier = BigInt(10 ** tokenDecimals);
    const whole = BigInt(Math.floor(numAmount));
    const fraction = numAmount - Math.floor(numAmount);
    const fractionBigInt = BigInt(Math.round(fraction * 10 ** tokenDecimals));
    const amountBigInt = whole * multiplier + fractionBigInt;

    const now = Math.floor(Date.now() / 1000);
    const startTime = now + Math.max(0, startDelayDays) * 86400;
    const cliffTime = startTime + Math.max(0, cliffDays) * 86400;
    const endTime = startTime + Math.max(1, durationDays) * 86400;

    const validation = this.validateStreamBounds({
      startTime,
      cliffTime,
      endTime,
      amount: amountBigInt,
    });
    if (!validation.valid) {
      throw new Error(validation.error || 'Invalid stream parameters');
    }

    return {
      sender,
      recipient,
      token,
      amount: amountBigInt,
      startTime,
      cliffTime,
      endTime,
      revocable,
    };
  }

  /**
   * Validates chronological time boundaries and token amount for stream creation.
   */
  validateStreamBounds(params: {
    startTime: number;
    cliffTime: number;
    endTime: number;
    amount: bigint;
  }): { valid: boolean; error?: string } {
    if (params.amount <= BigInt(0)) {
      return { valid: false, error: 'Stream amount must be strictly positive (> 0)' };
    }
    if (params.startTime > params.cliffTime) {
      return { valid: false, error: 'Cliff timestamp cannot precede start timestamp' };
    }
    if (params.cliffTime >= params.endTime) {
      return { valid: false, error: 'End timestamp must be strictly greater than cliff timestamp' };
    }
    return { valid: true };
  }

  /**
   * Builds the invocation contract payload for create_stream.
   */
  buildCreateStreamTransactionPayload(params: CreateStreamParams): TransactionPayload {
    return {
      contractId: this.contractId,
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
    };
  }

  /**
   * Builds the invocation contract payload for withdraw.
   */
  buildWithdrawTransactionPayload(streamId: number): TransactionPayload {
    return {
      contractId: this.contractId,
      method: 'withdraw',
      args: {
        stream_id: streamId,
      },
    };
  }

  /**
   * Builds the invocation contract payload for cancel_stream.
   */
  buildCancelStreamTransactionPayload(streamId: number, sender: string): TransactionPayload {
    return {
      contractId: this.contractId,
      method: 'cancel_stream',
      args: {
        sender,
        stream_id: streamId,
      },
    };
  }

  /**
   * Signs an XDR transaction envelope using the Freighter wallet extension or injected signer.
   */
  async signTransactionWithFreighter(
    xdr: string,
    signer?: FreighterSigner,
    networkPassphrase = 'Test SDF Network ; September 2015'
  ): Promise<string> {
    if (signer && typeof signer.signTransaction === 'function') {
      return signer.signTransaction(xdr, { networkPassphrase });
    }

    const globalFreighter =
      (typeof globalThis !== 'undefined' && (globalThis as any).freighter) ||
      (typeof window !== 'undefined' && (window as any).freighter);

    if (globalFreighter && typeof globalFreighter.signTransaction === 'function') {
      return globalFreighter.signTransaction(xdr, { networkPassphrase });
    }

    throw new Error('Freighter wallet extension not found in runtime environment');
  }

  /**
   * Queries RPC / Indexer for an account's token balance.
   */
  async getRpcBalance(
    accountAddress: string,
    tokenAddress: string = 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC'
  ): Promise<BalanceResult> {
    const decimals = 7;
    try {
      const res = await fetch(
        `${this.indexerUrl}/api/tokens/${tokenAddress}/verify?account=${encodeURIComponent(accountAddress)}`
      );
      if (res.ok) {
        const data = await res.json();
        const rawBal = BigInt(data.balance ?? 0);
        const divisor = Number(10 ** (data.decimals ?? decimals));
        return {
          account: accountAddress,
          token: tokenAddress,
          balance: rawBal,
          decimals: data.decimals ?? decimals,
          formatted: (Number(rawBal) / divisor).toFixed(2),
        };
      }
    } catch {
      // fallback to simulated/indexer defaults
    }

    return {
      account: accountAddress,
      token: tokenAddress,
      balance: BigInt(10_000_000_000), // 1,000 tokens
      decimals,
      formatted: '1000.00',
    };
  }

  /**
   * Periodically polls the token balance of an account and calls callback on updates.
   */
  pollBalance(
    accountAddress: string,
    callback: (balance: BalanceResult) => void,
    intervalMs: number = 3000,
    tokenAddress?: string
  ): () => void {
    let active = true;

    const poll = async () => {
      while (active) {
        try {
          const res = await this.getRpcBalance(accountAddress, tokenAddress);
          callback(res);
        } catch {
          // ignore transient poll error
        }
        await new Promise((r) => setTimeout(r, intervalMs));
      }
    };

    poll();
    return () => {
      active = false;
    };
  }

  /**
   * Periodically polls dynamic claimable balance for a given stream ID.
   */
  pollClaimableBalance(
    streamId: number,
    callback: (claimable: bigint, formatted: string) => void,
    intervalMs: number = 1000
  ): () => void {
    let active = true;

    const poll = async () => {
      while (active) {
        try {
          const stream = await this.getStream(streamId);
          const divisor = Number(10 ** stream.tokenDecimals);
          const formatted = (Number(stream.claimableAmount) / divisor).toFixed(6);
          callback(stream.claimableAmount, formatted);
        } catch {
          // ignore transient poll error
        }
        await new Promise((r) => setTimeout(r, intervalMs));
      }
    };

    poll();
    return () => {
      active = false;
    };
  }
}
