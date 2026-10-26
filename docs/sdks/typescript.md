# TypeScript Client SDK: @sorostream/sdk

The `@sorostream/sdk` library provides typed abstractions for interacting with SoroStream smart contracts, executing client-side vesting calculations, polling RPC states, and signing transactions via Freighter wallet.

---

## Installation

```bash
npm install @sorostream/sdk
```

---

## Quick Start

```typescript
import { SoroStreamClient, calculateVesting } from "@sorostream/sdk";

// Initialize SDK client
const client = new SoroStreamClient({
  indexerUrl: "https://soro-stream.vercel.app", // or http://localhost:8000
  rpcUrl: "https://soroban-testnet.stellar.org",
  contractId: "CA4L7T6R74G3T5F5V7V7RWWUHE2J76Y4WJ3L7C2WJ3L7C2WJ3L7C2WJ3",
});

// Fetch stream and live calculation
const stream = await client.getStream(1);
console.log(`Stream #${stream.id} Status: ${stream.status}`);
console.log(`Claimable: ${stream.claimableTokensFormatted} ${stream.tokenSymbol}`);
```

---

## Client Methods Reference

### `getStream(streamId: number): Promise<StreamDetail>`
Fetches on-chain stream data and applies synchronous linear unlock calculation.

### `listStreams(params?: { sender?: string; recipient?: string; status?: string }): Promise<StreamDetail[]>`
Queries all streams filtered by creator, beneficiary, or status.

### `createStream(params: CreateStreamParams): Promise<StreamDetail>`
Validates parameters ($t_{\text{start}} \le t_{\text{cliff}} < t_{\text{end}}$ and `amount > 0`) and submits creation.

### `withdraw(streamId: number, actor?: string): Promise<StreamDetail>`
Claims all currently unlocked tokens for the beneficiary.

### `cancelStream(streamId: number, sender: string): Promise<StreamDetail>`
Revokes a revocable stream, paying claimable tokens to recipient and refunding unvested escrow to sender.

### `pollClaimableBalance(streamId: number, callback: (claimable: bigint, formatted: string) => void, intervalMs?: number): () => void`
Sets up a high-frequency polling subscription executing `callback` every second for real-time live ticker components. Returns an unsubscribe function.

### `pollBalance(accountAddress: string, callback: (balance: BalanceResult) => void, intervalMs?: number): () => void`
Monitors an account's token balance on-chain and triggers updates upon balance changes.

### `signTransactionWithFreighter(xdr: string, signer?: FreighterSigner): Promise<string>`
Passes an XDR transaction envelope to Freighter extension for cryptographic signing.

---

## Pure Mathematical Vesting Helpers

```typescript
import { calculateVesting } from "@sorostream/sdk";

const result = calculateVesting({
  totalAmount: BigInt(100_000_0000000), // 100 tokens
  claimedAmount: BigInt(0),
  startTime: 1700000000,
  cliffTime: 1700050000,
  endTime: 1700200000,
  isCancelled: false,
  currentTime: 1700100000,
});

console.log(`Unlocked: ${result.unlockedAmount}`);
console.log(`Claimable: ${result.claimableAmount}`);
console.log(`Percent Vested: ${result.percentVested}%`);
```

---

## SDK Verification & Test Suite

Run the unit tests:
```bash
npm test
```
Outputs:
```
Testing @sorostream/sdk vesting math...
All @sorostream/sdk math unit tests passed!
Testing @sorostream/sdk SoroStreamClient helper methods...
All @sorostream/sdk SoroStreamClient tests passed!
✔ All @sorostream/sdk test suites completed successfully!
```
