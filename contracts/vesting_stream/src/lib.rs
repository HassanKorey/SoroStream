#![no_std]
#![allow(clippy::too_many_arguments)]

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, symbol_short, Address, Env, Vec,
};
use soroban_sdk::token;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    InvalidTimeBounds = 3,
    InvalidAmount = 4,
    StreamNotFound = 5,
    StreamAlreadyCancelled = 6,
    StreamNotRevocable = 7,
    NothingToWithdraw = 8,
    Unauthorized = 9,
}

#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    Admin,                      // Contract administrator address
    StreamCounter,              // Auto-incrementing u64 stream ID counter
    Stream(u64),                // Persistent storage key for stream records
}

#[derive(Clone, Debug, PartialEq)]
#[contracttype]
pub struct StreamRecord {
    pub id: u64,                // Unique stream identifier
    pub sender: Address,        // Stream creator / funding address
    pub recipient: Address,     // Beneficiary address entitled to claim funds
    pub token: Address,         // Soroban Asset Contract (SAC) address
    pub total_amount: i128,     // Total tokens locked in stroops (1 XLM = 10^7 stroops)
    pub claimed_amount: i128,   // Accumulated tokens already withdrawn
    pub start_time: u64,        // Stream commencement timestamp (seconds)
    pub cliff_time: u64,        // Timestamp prior to which 0 tokens are claimable
    pub end_time: u64,          // Timestamp at which 100% of tokens are unlocked
    pub revocable: bool,        // Flag indicating whether sender can cancel stream
    pub is_cancelled: bool,     // Stream cancellation status flag
}

#[derive(Clone, Debug, PartialEq)]
#[contracttype]
pub struct StreamInfo {
    pub record: StreamRecord,
    pub unlocked_amount: i128,
    pub claimable_amount: i128,
}

#[derive(Clone, Debug, PartialEq)]
#[contracttype]
pub struct CreateStreamArgs {
    pub recipient: Address,
    pub token: Address,
    pub amount: i128,
    pub start: u64,
    pub cliff: u64,
    pub end: u64,
    pub revocable: bool,
}

#[contract]
pub struct VestingStreamContract;

#[contractimpl]
impl VestingStreamContract {
    /// Initialize the contract with an admin and reset stream counter
    pub fn initialize(env: Env, admin: Address) -> Result<(), Error> {
        if env.storage().persistent().has(&DataKey::Admin) {
            return Err(Error::AlreadyInitialized);
        }
        env.storage().persistent().set(&DataKey::Admin, &admin);
        env.storage().persistent().set(&DataKey::StreamCounter, &0u64);
        Ok(())
    }

    /// Read contract administrator
    pub fn get_admin(env: Env) -> Result<Address, Error> {
        env.storage()
            .persistent()
            .get(&DataKey::Admin)
            .ok_or(Error::NotInitialized)
    }

    /// Read total count of streams created so far
    pub fn get_stream_count(env: Env) -> u64 {
        env.storage()
            .persistent()
            .get(&DataKey::StreamCounter)
            .unwrap_or(0u64)
    }

    /// Create a single linear vesting stream
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
    ) -> Result<u64, Error> {
        sender.require_auth();

        if amount <= 0 {
            return Err(Error::InvalidAmount);
        }
        // Validation: start <= cliff < end
        if !(start <= cliff && cliff < end) {
            return Err(Error::InvalidTimeBounds);
        }

        // Transfer tokens from sender to contract escrow
        let token_client = token::Client::new(&env, &token);
        token_client.transfer(&sender, &env.current_contract_address(), &amount);

        // Fetch and increment stream counter
        let mut count: u64 = env
            .storage()
            .persistent()
            .get(&DataKey::StreamCounter)
            .unwrap_or(0u64);
        count += 1;
        env.storage().persistent().set(&DataKey::StreamCounter, &count);

        let stream_id = count;
        let record = StreamRecord {
            id: stream_id,
            sender: sender.clone(),
            recipient: recipient.clone(),
            token: token.clone(),
            total_amount: amount,
            claimed_amount: 0,
            start_time: start,
            cliff_time: cliff,
            end_time: end,
            revocable,
            is_cancelled: false,
        };

        env.storage().persistent().set(&DataKey::Stream(stream_id), &record);

        // Emit creation event
        env.events().publish(
            (symbol_short!("created"), sender, recipient),
            (stream_id, amount, token),
        );

        Ok(stream_id)
    }

    /// Batch stream creation for rosters / DAOs (Issue #12)
    pub fn create_stream_batch(
        env: Env,
        sender: Address,
        streams: Vec<CreateStreamArgs>,
    ) -> Result<Vec<u64>, Error> {
        sender.require_auth();
        let mut created_ids = Vec::new(&env);

        for stream in streams.into_iter() {
            if stream.amount <= 0 {
                return Err(Error::InvalidAmount);
            }
            if !(stream.start <= stream.cliff && stream.cliff < stream.end) {
                return Err(Error::InvalidTimeBounds);
            }

            let token_client = token::Client::new(&env, &stream.token);
            token_client.transfer(&sender, &env.current_contract_address(), &stream.amount);

            let mut count: u64 = env
                .storage()
                .persistent()
                .get(&DataKey::StreamCounter)
                .unwrap_or(0u64);
            count += 1;
            env.storage().persistent().set(&DataKey::StreamCounter, &count);

            let stream_id = count;
            let record = StreamRecord {
                id: stream_id,
                sender: sender.clone(),
                recipient: stream.recipient.clone(),
                token: stream.token.clone(),
                total_amount: stream.amount,
                claimed_amount: 0,
                start_time: stream.start,
                cliff_time: stream.cliff,
                end_time: stream.end,
                revocable: stream.revocable,
                is_cancelled: false,
            };

            env.storage().persistent().set(&DataKey::Stream(stream_id), &record);

            env.events().publish(
                (symbol_short!("created"), sender.clone(), stream.recipient.clone()),
                (stream_id, stream.amount, stream.token.clone()),
            );

            created_ids.push_back(stream_id);
        }

        Ok(created_ids)
    }

    /// Withdraw claimable unlocked tokens to recipient
    /// Open invocation / recipient can withdraw to their address
    pub fn withdraw(env: Env, stream_id: u64) -> Result<i128, Error> {
        let mut record: StreamRecord = env
            .storage()
            .persistent()
            .get(&DataKey::Stream(stream_id))
            .ok_or(Error::StreamNotFound)?;

        let current_time = env.ledger().timestamp();
        let unlocked = Self::compute_unlocked_amount(&record, current_time);
        let claimable = unlocked - record.claimed_amount;

        if claimable <= 0 {
            return Err(Error::NothingToWithdraw);
        }

        record.claimed_amount += claimable;
        env.storage().persistent().set(&DataKey::Stream(stream_id), &record);

        // Transfer claimable tokens to recipient
        let token_client = token::Client::new(&env, &record.token);
        token_client.transfer(&env.current_contract_address(), &record.recipient, &claimable);

        // Emit withdrawal event
        env.events().publish(
            (symbol_short!("withdraw"), record.recipient.clone()),
            (stream_id, claimable),
        );

        Ok(claimable)
    }

    /// Cancel a stream if revocable and not cancelled
    /// Sender pays out any claimable amount to recipient, and unvested balance is refunded to sender
    pub fn cancel_stream(env: Env, sender: Address, stream_id: u64) -> Result<(), Error> {
        sender.require_auth();

        let mut record: StreamRecord = env
            .storage()
            .persistent()
            .get(&DataKey::Stream(stream_id))
            .ok_or(Error::StreamNotFound)?;

        if record.sender != sender {
            return Err(Error::Unauthorized);
        }

        if !record.revocable {
            return Err(Error::StreamNotRevocable);
        }

        if record.is_cancelled {
            return Err(Error::StreamAlreadyCancelled);
        }

        let current_time = env.ledger().timestamp();
        let unlocked = Self::compute_unlocked_amount(&record, current_time);
        let claimable_to_recipient = unlocked - record.claimed_amount;
        let refund_to_sender = record.total_amount - unlocked;

        record.claimed_amount = unlocked;
        record.is_cancelled = true;
        env.storage().persistent().set(&DataKey::Stream(stream_id), &record);

        let token_client = token::Client::new(&env, &record.token);

        // Payout claimable portion to recipient
        if claimable_to_recipient > 0 {
            token_client.transfer(
                &env.current_contract_address(),
                &record.recipient,
                &claimable_to_recipient,
            );
        }

        // Refund unvested tokens to sender
        if refund_to_sender > 0 {
            token_client.transfer(
                &env.current_contract_address(),
                &record.sender,
                &refund_to_sender,
            );
        }

        // Emit cancellation event
        env.events().publish(
            (symbol_short!("cancel"), sender.clone()),
            (stream_id, claimable_to_recipient, refund_to_sender),
        );

        Ok(())
    }

    /// Query stream details along with current dynamic unlocked and claimable amounts
    pub fn get_stream(env: Env, stream_id: u64) -> Result<StreamInfo, Error> {
        let record: StreamRecord = env
            .storage()
            .persistent()
            .get(&DataKey::Stream(stream_id))
            .ok_or(Error::StreamNotFound)?;

        let current_time = env.ledger().timestamp();
        let unlocked_amount = Self::compute_unlocked_amount(&record, current_time);
        let claimable_amount = if unlocked_amount > record.claimed_amount {
            unlocked_amount - record.claimed_amount
        } else {
            0
        };

        Ok(StreamInfo {
            record,
            unlocked_amount,
            claimable_amount,
        })
    }

    /// Helper math function: computes unlocked tokens at timestamp t
    fn compute_unlocked_amount(record: &StreamRecord, t: u64) -> i128 {
        if record.is_cancelled {
            return record.claimed_amount;
        }

        if t < record.cliff_time {
            return 0;
        }

        if t >= record.end_time {
            return record.total_amount;
        }

        // Linear formula: total_amount * (t - start_time) / (end_time - start_time)
        let elapsed = (t - record.start_time) as i128;
        let duration = (record.end_time - record.start_time) as i128;

        if duration <= 0 {
            return record.total_amount;
        }

        (record.total_amount * elapsed) / duration
    }
}

#[cfg(test)]
mod test;
