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

export interface StreamCreationOptions {
  sender: string;
  recipient: string;
  token: string;
  amountTokens: number | string;
  durationDays: number;
  cliffDays?: number;
  startDelayDays?: number;
  revocable?: boolean;
  tokenDecimals?: number;
}

export interface BalanceResult {
  account: string;
  token: string;
  balance: bigint;
  decimals: number;
  formatted: string;
}

export interface FreighterSigner {
  signTransaction(
    xdr: string,
    opts?: { networkPassphrase?: string; accountToSign?: string }
  ): Promise<string>;
  getUserInfo?(): Promise<{ publicKey?: string }>;
  isConnected?(): Promise<boolean>;
}

export interface TransactionPayload {
  contractId: string;
  method: string;
  args: Record<string, any>;
}
