import { calculateVesting } from './math';
import {
  CreateStreamParams,
  BatchStreamItem,
  SoroStreamClientConfig,
  StreamDetail,
  StreamRecord,
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
}
