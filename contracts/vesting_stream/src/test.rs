#![cfg(test)]

use super::*;
use soroban_sdk::{
    testutils::{Address as _, Ledger},
    token::Client as TokenClient,
    token::StellarAssetClient,
    Address, Env,
};

fn create_token_contract<'a>(e: &Env, admin: &Address) -> (TokenClient<'a>, StellarAssetClient<'a>) {
    let sac = e.register_stellar_asset_contract_v2(admin.clone());
    (
        TokenClient::new(e, &sac.address()),
        StellarAssetClient::new(e, &sac.address()),
    )
}

struct TestSetup<'a> {
    env: Env,
    admin: Address,
    sender: Address,
    recipient: Address,
    token_client: TokenClient<'a>,
    _sac_client: StellarAssetClient<'a>,
    contract_client: VestingStreamContractClient<'a>,
    contract_id: Address,
}

fn setup_test<'a>() -> TestSetup<'a> {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let sender = Address::generate(&env);
    let recipient = Address::generate(&env);

    let (token_client, sac_client) = create_token_contract(&env, &admin);
    sac_client.mint(&sender, &1_000_000_000); // 100 XLM

    let contract_id = env.register_contract(None, VestingStreamContract);
    let contract_client = VestingStreamContractClient::new(&env, &contract_id);

    contract_client.initialize(&admin);

    TestSetup {
        env,
        admin,
        sender,
        recipient,
        token_client,
        _sac_client: sac_client,
        contract_client,
        contract_id,
    }
}

#[test]
fn test_initialization() {
    let setup = setup_test();
    assert_eq!(setup.contract_client.get_admin(), setup.admin);
    assert_eq!(setup.contract_client.get_stream_count(), 0);

    // Double initialization should fail
    let res = setup.contract_client.try_initialize(&setup.admin);
    assert!(res.is_err());
}

#[test]
fn test_create_stream_validation() {
    let setup = setup_test();

    // Invalid amount <= 0
    let res = setup.contract_client.try_create_stream(
        &setup.sender,
        &setup.recipient,
        &setup.token_client.address,
        &0,
        &100,
        &200,
        &300,
        &true,
    );
    assert!(res.is_err());

    // Invalid time bounds: cliff < start
    let res = setup.contract_client.try_create_stream(
        &setup.sender,
        &setup.recipient,
        &setup.token_client.address,
        &10_000,
        &200,
        &100,
        &300,
        &true,
    );
    assert!(res.is_err());

    // Invalid time bounds: end <= cliff
    let res = setup.contract_client.try_create_stream(
        &setup.sender,
        &setup.recipient,
        &setup.token_client.address,
        &10_000,
        &100,
        &300,
        &300,
        &true,
    );
    assert!(res.is_err());
}

#[test]
fn test_create_and_linear_vesting() {
    let setup = setup_test();

    let start = 1_000u64;
    let cliff = 2_000u64;
    let end = 5_000u64; // Duration 4,000s
    let amount = 40_000_000i128; // 40 tokens

    setup.env.ledger().set_timestamp(start);

    let stream_id = setup.contract_client.create_stream(
        &setup.sender,
        &setup.recipient,
        &setup.token_client.address,
        &amount,
        &start,
        &cliff,
        &end,
        &true,
    );
    assert_eq!(stream_id, 1);
    assert_eq!(setup.contract_client.get_stream_count(), 1);

    // Contract received escrow
    assert_eq!(
        setup.token_client.balance(&setup.contract_id),
        amount
    );

    // 1. Before cliff (t = 1500): 0 unlocked, 0 claimable
    setup.env.ledger().set_timestamp(1_500);
    let info = setup.contract_client.get_stream(&stream_id);
    assert_eq!(info.unlocked_amount, 0);
    assert_eq!(info.claimable_amount, 0);

    // Attempting withdrawal before cliff fails
    let res = setup.contract_client.try_withdraw(&stream_id);
    assert!(res.is_err());

    // 2. Exactly at cliff (t = 2000): (2000 - 1000) / 4000 = 25% unlocked = 10_000_000
    setup.env.ledger().set_timestamp(2_000);
    let info = setup.contract_client.get_stream(&stream_id);
    assert_eq!(info.unlocked_amount, 10_000_000);
    assert_eq!(info.claimable_amount, 10_000_000);

    // 3. At midpoint (t = 3000): (3000 - 1000) / 4000 = 50% unlocked = 20_000_000
    setup.env.ledger().set_timestamp(3_000);
    let info = setup.contract_client.get_stream(&stream_id);
    assert_eq!(info.unlocked_amount, 20_000_000);
    assert_eq!(info.claimable_amount, 20_000_000);

    // Recipient withdraws at t = 3000
    let claimed = setup.contract_client.withdraw(&stream_id);
    assert_eq!(claimed, 20_000_000);
    assert_eq!(setup.token_client.balance(&setup.recipient), 20_000_000);

    // After withdraw, claimable is 0, claimed is 20_000_000
    let info = setup.contract_client.get_stream(&stream_id);
    assert_eq!(info.record.claimed_amount, 20_000_000);
    assert_eq!(info.claimable_amount, 0);

    // Immediate second withdraw fails
    let res = setup.contract_client.try_withdraw(&stream_id);
    assert!(res.is_err());

    // 4. Past end (t = 6000): 100% unlocked = 40_000_000, claimable delta = 20_000_000
    setup.env.ledger().set_timestamp(6_000);
    let info = setup.contract_client.get_stream(&stream_id);
    assert_eq!(info.unlocked_amount, 40_000_000);
    assert_eq!(info.claimable_amount, 20_000_000);

    let claimed_final = setup.contract_client.withdraw(&stream_id);
    assert_eq!(claimed_final, 20_000_000);
    assert_eq!(setup.token_client.balance(&setup.recipient), 40_000_000);
    assert_eq!(setup.token_client.balance(&setup.contract_id), 0);
}

#[test]
fn test_cancel_revocable_stream() {
    let setup = setup_test();

    let start = 1_000u64;
    let cliff = 1_500u64;
    let end = 5_000u64;
    let amount = 100_000_000i128;

    let initial_sender_balance = setup.token_client.balance(&setup.sender);

    let stream_id = setup.contract_client.create_stream(
        &setup.sender,
        &setup.recipient,
        &setup.token_client.address,
        &amount,
        &start,
        &cliff,
        &end,
        &true, // revocable
    );

    // Cancel halfway at t = 3000 (50% unlocked)
    setup.env.ledger().set_timestamp(3_000);
    setup.contract_client.cancel_stream(&setup.sender, &stream_id);

    // Recipient received 50% = 50_000_000
    assert_eq!(setup.token_client.balance(&setup.recipient), 50_000_000);

    // Sender refunded remaining 50% = 50_000_000
    assert_eq!(
        setup.token_client.balance(&setup.sender),
        initial_sender_balance - 50_000_000
    );

    // Stream marked cancelled
    let info = setup.contract_client.get_stream(&stream_id);
    assert!(info.record.is_cancelled);
    assert_eq!(info.claimable_amount, 0);

    // Subsequent cancel or withdraw fails
    let res_cancel = setup.contract_client.try_cancel_stream(&setup.sender, &stream_id);
    assert!(res_cancel.is_err());

    let res_withdraw = setup.contract_client.try_withdraw(&stream_id);
    assert!(res_withdraw.is_err());
}

#[test]
fn test_non_revocable_stream_cannot_be_cancelled() {
    let setup = setup_test();

    let stream_id = setup.contract_client.create_stream(
        &setup.sender,
        &setup.recipient,
        &setup.token_client.address,
        &50_000_000,
        &1_000,
        &2_000,
        &4_000,
        &false, // NOT revocable
    );

    setup.env.ledger().set_timestamp(2_500);
    let res = setup.contract_client.try_cancel_stream(&setup.sender, &stream_id);
    assert!(res.is_err());
}

#[test]
fn test_getter_functions_and_invalid_id() {
    let setup = setup_test();

    // Invalid ID panic/error handling (Issue #2)
    let res = setup.contract_client.try_get_stream(&999);
    assert!(res.is_err());

    // Create stream and verify exact record data accuracy (Issue #2)
    let stream_id = setup.contract_client.create_stream(
        &setup.sender,
        &setup.recipient,
        &setup.token_client.address,
        &30_000_000,
        &100,
        &200,
        &500,
        &true,
    );

    let info = setup.contract_client.get_stream(&stream_id);
    assert_eq!(info.record.id, stream_id);
    assert_eq!(info.record.sender, setup.sender);
    assert_eq!(info.record.recipient, setup.recipient);
    assert_eq!(info.record.total_amount, 30_000_000);
    assert_eq!(info.record.claimed_amount, 0);
    assert_eq!(info.record.start_time, 100);
    assert_eq!(info.record.cliff_time, 200);
    assert_eq!(info.record.end_time, 500);
    assert!(info.record.revocable);
    assert!(!info.record.is_cancelled);
}

#[test]
fn test_batch_stream_creation() {
    let setup = setup_test();

    let rec1 = Address::generate(&setup.env);
    let rec2 = Address::generate(&setup.env);

    let mut batch = soroban_sdk::Vec::new(&setup.env);
    batch.push_back(CreateStreamArgs {
        recipient: rec1.clone(),
        token: setup.token_client.address.clone(),
        amount: 10_000_000,
        start: 1_000,
        cliff: 1_500,
        end: 3_000,
        revocable: true,
    });
    batch.push_back(CreateStreamArgs {
        recipient: rec2.clone(),
        token: setup.token_client.address.clone(),
        amount: 20_000_000,
        start: 1_000,
        cliff: 2_000,
        end: 4_000,
        revocable: false,
    });

    let ids = setup.contract_client.create_stream_batch(&setup.sender, &batch);
    assert_eq!(ids.len(), 2);
    assert_eq!(ids.get(0).unwrap(), 1);
    assert_eq!(ids.get(1).unwrap(), 2);
    assert_eq!(setup.contract_client.get_stream_count(), 2);

    let info1 = setup.contract_client.get_stream(&1);
    assert_eq!(info1.record.recipient, rec1);
    assert_eq!(info1.record.total_amount, 10_000_000);

    let info2 = setup.contract_client.get_stream(&2);
    assert_eq!(info2.record.recipient, rec2);
    assert_eq!(info2.record.total_amount, 20_000_000);
}
