# Smart Contract: vesting_stream

The core on-chain escrow protocol is implemented in `#![no_std]` Rust using `soroban-sdk` v21.0.0. It is located in `contracts/vesting_stream/`.

---

## State Keys & Data Structures

The contract utilizes Soroban persistent storage to maintain stream records and auto-incrementing stream counters:

```rust
#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    Admin,         // Address of contract admin
    StreamCounter, // Auto-incrementing u64 identifier
    Stream(u64),   // Persistent key mapped to StreamRecord
}

#[derive(Clone, Debug, PartialEq)]
#[contracttype]
pub struct StreamRecord {
    pub id: u64,              // Unique stream ID
    pub sender: Address,      // Stream funder
    pub recipient: Address,   // Beneficiary entitled to withdrawals
    pub token: Address,       // SAC token address (SEP-41)
    pub total_amount: i128,   // Total stroops deposited
    pub claimed_amount: i128, // Accumulated stroops withdrawn
    pub start_time: u64,      // Commencement timestamp (sec)
    pub cliff_time: u64,      // Cliff deadline (sec)
    pub end_time: u64,        // Vesting end timestamp (sec)
    pub revocable: bool,      // Whether sender can cancel stream
    pub is_cancelled: bool,   // Revocation state flag
}

#[derive(Clone, Debug, PartialEq)]
#[contracttype]
pub struct StreamInfo {
    pub record: StreamRecord,
    pub unlocked_amount: i128,
    pub claimable_amount: i128,
}
```

---

## Core Contract Interface

### `initialize`
```rust
pub fn initialize(env: Env, admin: Address) -> Result<(), Error>
```
Initializes the contract administrator and resets `StreamCounter` to 0. Can only be invoked once.

### `create_stream`
```rust
pub fn create_stream(
    env: Env,
    sender: Address,
    recipient: Address,
    token: Address,
    amount: i128,
    start: u64,
    cliff: u64,
    end: u64,
    revocable: bool,
) -> Result<u64, Error>
```
Locks `amount` tokens from `sender` into contract escrow via `TokenClient::transfer`. Validates $t_{\text{start}} \le t_{\text{cliff}} < t_{\text{end}}$ and `amount > 0`. Returns the newly generated unique `stream_id`.

### `create_stream_batch`
```rust
pub fn create_stream_batch(
    env: Env,
    sender: Address,
    streams: Vec<CreateStreamArgs>,
) -> Result<Vec<u64>, Error>
```
Atomic batch creation supporting corporate payroll and DAO contributor cohorts in a single transaction.

### `withdraw`
```rust
pub fn withdraw(env: Env, stream_id: u64) -> Result<i128, Error>
```
Calculates claimable unlocked tokens as of `env.ledger().timestamp()` and transfers the claimable balance to `recipient`.

### `cancel_stream`
```rust
pub fn cancel_stream(env: Env, sender: Address, stream_id: u64) -> Result<(), Error>
```
Requires `sender.require_auth()`. Validates that the stream is `revocable` and not previously cancelled. Payouts earned tokens to `recipient`, refunds unvested balance to `sender`, marks `is_cancelled = true`, and emits event `cancel`.

### `get_stream`
```rust
pub fn get_stream(env: Env, stream_id: u64) -> Result<StreamInfo, Error>
```
Read-only query returning the stream record along with real-time `unlocked_amount` and `claimable_amount`.

---

## Unit Testing & Verification

The contract includes a comprehensive test suite in `contracts/vesting_stream/src/test.rs` covering 16 distinct test scenarios:
- `test_initialization`: Proper setup and duplicate rejection
- `test_create_stream_validation`: Time bound rules and positive amount enforcement
- `test_zero_and_negative_amount_creation`: Rejection of zero or negative token values
- `test_cliff_boundary_exact_enforcement`: Strict zero claimable prior to cliff, exact unlock at cliff
- `test_create_and_linear_vesting`: Linear rate accuracy across ledger ticks
- `test_cancel_revocable_stream`: Sender refund and recipient claimable split
- `test_unauthorized_cancellation_attempt`: Non-sender cancellation rejection
- `test_double_cancellation_fails`: Duplicate cancellation rejection
- `test_non_revocable_stream_cannot_be_cancelled`: Rejection on immutable escrows
- `test_batch_stream_creation`: Multi-recipient atomic creation
- `test_getter_functions_and_invalid_id`: Query error handling and count validation

Run the test suite with:
```bash
cargo test
```
