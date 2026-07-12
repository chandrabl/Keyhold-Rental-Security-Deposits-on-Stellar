#![cfg(test)]

use super::*;
use inspection::{InspectionContract, InspectionContractClient};
use soroban_sdk::testutils::{Address as _, Ledger};
use soroban_sdk::token::StellarAssetClient;
use soroban_sdk::{Address, Env, String};

const DAY: u64 = 86_400;

struct TestSetup {
    env: Env,
    deposit_id: Address,
    deposit: DepositContractClient<'static>,
    inspection_id: Address,
    inspection: InspectionContractClient<'static>,
    inspection_admin: Address,
    token: Address,
    token_admin: StellarAssetClient<'static>,
    landlord: Address,
    tenant: Address,
}

fn setup() -> TestSetup {
    let env = Env::default();
    env.mock_all_auths();
    // Start the ledger clock somewhere sane rather than at 0, so
    // lease_end > now checks aren't trivially satisfied by a zero clock.
    env.ledger().with_mut(|l| l.timestamp = 1_700_000_000);

    let token_admin_addr = Address::generate(&env);
    let sac = env.register_stellar_asset_contract_v2(token_admin_addr.clone());
    let token = sac.address();
    let token_admin = StellarAssetClient::new(&env, &token);

    let admin = Address::generate(&env);
    let inspection_admin = Address::generate(&env);
    let landlord = Address::generate(&env);
    let tenant = Address::generate(&env);
    token_admin.mint(&tenant, &10_000);

    let inspection_id = env.register(InspectionContract, ());
    let inspection = InspectionContractClient::new(&env, &inspection_id);
    inspection.initialize(&inspection_admin);

    let deposit_id = env.register(DepositContract, ());
    let deposit = DepositContractClient::new(&env, &deposit_id);
    deposit.initialize(&admin, &inspection_id);

    TestSetup {
        env,
        deposit_id,
        deposit,
        inspection_id,
        inspection,
        inspection_admin,
        token,
        token_admin,
        landlord,
        tenant,
    }
}

fn advance_time(env: &Env, seconds: u64) {
    env.ledger().with_mut(|l| l.timestamp += seconds);
}

fn now(env: &Env) -> u64 {
    env.ledger().timestamp()
}

#[test]
fn test_create_lease_as_draft() {
    let t = setup();
    let lease_end = now(&t.env) + 30 * DAY;
    let lease_id = t.deposit.create_lease(&t.landlord, &t.tenant, &t.token, &1000, &lease_end, &(7 * DAY));
    assert_eq!(lease_id, 0);

    let lease = t.deposit.get_lease(&lease_id);
    assert_eq!(lease.status, LeaseStatus::Draft);
    assert_eq!(lease.deposit_amount, 1000);
}

#[test]
fn test_create_lease_rejects_past_lease_end() {
    let t = setup();
    let past = now(&t.env) - 1;
    let result = t.deposit.try_create_lease(&t.landlord, &t.tenant, &t.token, &1000, &past, &(7 * DAY));
    assert_eq!(result, Err(Ok(DepositError::InvalidLeaseEnd)));
}

#[test]
fn test_create_lease_rejects_zero_amount() {
    let t = setup();
    let lease_end = now(&t.env) + 30 * DAY;
    let result = t.deposit.try_create_lease(&t.landlord, &t.tenant, &t.token, &0, &lease_end, &(7 * DAY));
    assert_eq!(result, Err(Ok(DepositError::InvalidAmount)));
}

#[test]
fn test_fund_deposit_transfers_funds_and_activates_lease() {
    let t = setup();
    let lease_end = now(&t.env) + 30 * DAY;
    let lease_id = t.deposit.create_lease(&t.landlord, &t.tenant, &t.token, &1000, &lease_end, &(7 * DAY));

    t.deposit.fund_deposit(&t.tenant, &lease_id);

    let token_client = token::Client::new(&t.env, &t.token);
    assert_eq!(token_client.balance(&t.deposit_id), 1000);
    assert_eq!(token_client.balance(&t.tenant), 9000);

    let lease = t.deposit.get_lease(&lease_id);
    assert_eq!(lease.status, LeaseStatus::Funded);
}

#[test]
fn test_only_tenant_can_fund_deposit() {
    let t = setup();
    let lease_end = now(&t.env) + 30 * DAY;
    let lease_id = t.deposit.create_lease(&t.landlord, &t.tenant, &t.token, &1000, &lease_end, &(7 * DAY));

    let impostor = Address::generate(&t.env);
    let result = t.deposit.try_fund_deposit(&impostor, &lease_id);
    assert_eq!(result, Err(Ok(DepositError::Unauthorized)));
}

#[test]
fn test_landlord_can_cancel_draft_lease() {
    let t = setup();
    let lease_end = now(&t.env) + 30 * DAY;
    let lease_id = t.deposit.create_lease(&t.landlord, &t.tenant, &t.token, &1000, &lease_end, &(7 * DAY));

    t.deposit.cancel_lease(&t.landlord, &lease_id);
    let lease = t.deposit.get_lease(&lease_id);
    assert_eq!(lease.status, LeaseStatus::Cancelled);
}

#[test]
fn test_cannot_cancel_funded_lease() {
    let t = setup();
    let lease_end = now(&t.env) + 30 * DAY;
    let lease_id = t.deposit.create_lease(&t.landlord, &t.tenant, &t.token, &1000, &lease_end, &(7 * DAY));
    t.deposit.fund_deposit(&t.tenant, &lease_id);

    let result = t.deposit.try_cancel_lease(&t.landlord, &lease_id);
    assert_eq!(result, Err(Ok(DepositError::LeaseNotDraft)));
}

#[test]
fn test_release_deposit_rejected_before_claim_window_closes() {
    let t = setup();
    let lease_end = now(&t.env) + 30 * DAY;
    let lease_id = t.deposit.create_lease(&t.landlord, &t.tenant, &t.token, &1000, &lease_end, &(7 * DAY));
    t.deposit.fund_deposit(&t.tenant, &lease_id);

    advance_time(&t.env, 30 * DAY); // lease ended, but claim window still open
    let result = t.deposit.try_release_deposit(&lease_id);
    assert_eq!(result, Err(Ok(DepositError::ClaimWindowStillOpen)));
}

#[test]
fn test_release_deposit_after_claim_window_closes_with_no_claim() {
    let t = setup();
    let lease_end = now(&t.env) + 30 * DAY;
    let lease_id = t.deposit.create_lease(&t.landlord, &t.tenant, &t.token, &1000, &lease_end, &(7 * DAY));
    t.deposit.fund_deposit(&t.tenant, &lease_id);

    advance_time(&t.env, 30 * DAY + 7 * DAY + 1);
    t.deposit.release_deposit(&lease_id);

    let token_client = token::Client::new(&t.env, &t.token);
    assert_eq!(token_client.balance(&t.tenant), 10_000); // fully refunded

    let lease = t.deposit.get_lease(&lease_id);
    assert_eq!(lease.status, LeaseStatus::Released);
}

#[test]
fn test_cannot_file_claim_before_lease_ends() {
    let t = setup();
    let lease_end = now(&t.env) + 30 * DAY;
    let lease_id = t.deposit.create_lease(&t.landlord, &t.tenant, &t.token, &1000, &lease_end, &(7 * DAY));
    t.deposit.fund_deposit(&t.tenant, &lease_id);

    let reason = String::from_str(&t.env, "Damage found early");
    let result = t.deposit.try_file_claim(&t.landlord, &lease_id, &300, &reason);
    assert_eq!(result, Err(Ok(DepositError::LeaseNotYetEnded)));
}

#[test]
fn test_cannot_file_claim_after_window_closes() {
    let t = setup();
    let lease_end = now(&t.env) + 30 * DAY;
    let lease_id = t.deposit.create_lease(&t.landlord, &t.tenant, &t.token, &1000, &lease_end, &(7 * DAY));
    t.deposit.fund_deposit(&t.tenant, &lease_id);

    advance_time(&t.env, 30 * DAY + 7 * DAY + 1);
    let reason = String::from_str(&t.env, "Too late");
    let result = t.deposit.try_file_claim(&t.landlord, &lease_id, &300, &reason);
    assert_eq!(result, Err(Ok(DepositError::ClaimWindowClosed)));
}

#[test]
fn test_full_claim_and_settlement_flow_partial_forfeit() {
    let t = setup();
    let lease_end = now(&t.env) + 30 * DAY;
    let lease_id = t.deposit.create_lease(&t.landlord, &t.tenant, &t.token, &1000, &lease_end, &(7 * DAY));
    t.deposit.fund_deposit(&t.tenant, &lease_id);

    advance_time(&t.env, 30 * DAY + 1); // lease ended, still within claim window

    let reason = String::from_str(&t.env, "Broken window and stained carpet");
    t.deposit.file_claim(&t.landlord, &lease_id, &400, &reason);

    let lease = t.deposit.get_lease(&lease_id);
    assert_eq!(lease.status, LeaseStatus::Disputed);

    t.inspection
        .resolve_claim(&t.inspection_admin, &t.deposit_id, &lease_id, &250);

    let forfeit = t.deposit.settle_claim(&lease_id);
    assert_eq!(forfeit, 250);

    let token_client = token::Client::new(&t.env, &t.token);
    assert_eq!(token_client.balance(&t.landlord), 250);
    assert_eq!(token_client.balance(&t.tenant), 9000 + 750); // 1000 - 250 refunded

    let lease = t.deposit.get_lease(&lease_id);
    assert_eq!(lease.status, LeaseStatus::Settled);
}

#[test]
fn test_settle_claim_before_ruling_returns_sentinel() {
    let t = setup();
    let lease_end = now(&t.env) + 30 * DAY;
    let lease_id = t.deposit.create_lease(&t.landlord, &t.tenant, &t.token, &1000, &lease_end, &(7 * DAY));
    t.deposit.fund_deposit(&t.tenant, &lease_id);
    advance_time(&t.env, 30 * DAY + 1);

    let reason = String::from_str(&t.env, "Pending review");
    t.deposit.file_claim(&t.landlord, &lease_id, &400, &reason);

    let result = t.deposit.settle_claim(&lease_id);
    assert_eq!(result, -1);

    let lease = t.deposit.get_lease(&lease_id);
    assert_eq!(lease.status, LeaseStatus::Disputed); // unchanged, still waiting
}

#[test]
fn test_get_lease_not_found() {
    let t = setup();
    let result = t.deposit.try_get_lease(&999);
    assert_eq!(result, Err(Ok(DepositError::LeaseNotFound)));
}

#[test]
fn test_only_landlord_can_file_claim() {
    let t = setup();
    let lease_end = now(&t.env) + 30 * DAY;
    let lease_id = t.deposit.create_lease(&t.landlord, &t.tenant, &t.token, &1000, &lease_end, &(7 * DAY));
    t.deposit.fund_deposit(&t.tenant, &lease_id);
    advance_time(&t.env, 30 * DAY + 1);

    let impostor = Address::generate(&t.env);
    let reason = String::from_str(&t.env, "Not my claim to make");
    let result = t.deposit.try_file_claim(&impostor, &lease_id, &100, &reason);
    assert_eq!(result, Err(Ok(DepositError::Unauthorized)));
}
