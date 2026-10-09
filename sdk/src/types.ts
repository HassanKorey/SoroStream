/**
 * SoroStream Protocol TypeScript Types.
 */

export type StreamStatus = 'active' | 'cliff_pending' | 'completed' | 'cancelled';

export interface StreamRecord {
  id: number;
  sender: string;
  recipient: string;
  token: string;
  tokenSymbol: string;
  tokenDecimals: number;
  totalAmount: bigint;
  claimedAmount: bigint;
  startTime: number;
  cliffTime: number;
  endTime: number;
  revocable: boolean;
  isCancelled: boolean;
  createdAt: number;
}

export interface StreamCalculation {
  currentTime: number;
  unlockedAmount: bigint;
  claimableAmount: bigint;
  unlockedPercentage: number;
  claimedPercentage: number;
  ratePerSecond: number;
  ratePerDay: number;
  status: StreamStatus;
}

export interface StreamDetail extends StreamRecord, StreamCalculation {}

export interface CreateStreamParams {
  sender: string;
  recipient: string;
  token: string;
  amount: bigint;
  startTime: number;
  cliffTime: number;
  endTime: number;
  revocable: boolean;
}

export interface BatchStreamItem {
  recipient: string;
  amount: bigint;
  startTime: number;
  cliffTime: number;
  endTime: number;
  revocable: boolean;
}

export interface SoroStreamClientConfig {
  indexerUrl?: string;
  rpcUrl?: string;
  contractId?: string;
}
