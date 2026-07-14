#![cfg(test)]

use super::*;
use soroban_sdk::testutils::Address as _;
use soroban_sdk::{Env, String};

fn setup(env: &Env) -> (InspectionContractClient<'static>, Address) {
    let contract_id = env.register(InspectionContract, ());
    let client = InspectionContractClient::new(env, &contract_id);
    let admin = Address::generate(env);
    client.init_inspection(&admin);
    (client, admin)
}

#[test]
fn test_initialize_sets_admin_as_inspector() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, admin) = setup(&env);
    assert!(client.is_inspector(&admin));
}

#[test]
fn test_cannot_initialize_twice() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, admin) = setup(&env);
    let result = client.try_init_inspection(&admin);
    assert_eq!(result, Err(Ok(InspectionError::AlreadyInitialized)));
}

#[test]
fn test_add_inspector() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, admin) = setup(&env);
    let new_inspector = Address::generate(&env);

    assert!(!client.is_inspector(&new_inspector));
    client.add_inspector(&admin, &new_inspector);
    assert!(client.is_inspector(&new_inspector));
}

#[test]
fn test_non_admin_cannot_add_inspector() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _admin) = setup(&env);
    let impostor = Address::generate(&env);
    let new_inspector = Address::generate(&env);

    let result = client.try_add_inspector(&impostor, &new_inspector);
    assert_eq!(result, Err(Ok(InspectionError::Unauthorized)));
}

#[test]
fn test_file_and_resolve_claim_flow() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, admin) = setup(&env);

    let deposit_contract = Address::generate(&env);
    let landlord = Address::generate(&env);
    let tenant = Address::generate(&env);
    let lease_id: u64 = 1;
    let reason = String::from_str(&env, "Broken window and stained carpet");

    client.file_claim(&deposit_contract, &lease_id, &landlord, &tenant, &400, &reason);

    let claim = client.get_claim(&deposit_contract, &lease_id).unwrap();
    assert_eq!(claim.status, ClaimStatus::Open);
    assert_eq!(claim.claimed_amount, 400);

    let forfeit = client.resolve_claim(&admin, &deposit_contract, &lease_id, &250);
    assert_eq!(forfeit, 250);

    let resolved = client.get_claim(&deposit_contract, &lease_id).unwrap();
    assert_eq!(resolved.status, ClaimStatus::Ruled);
    assert_eq!(resolved.forfeit_amount, 250);
    assert_eq!(resolved.ruled_by, Some(admin));
}

#[test]
fn test_cannot_file_claim_twice_while_open() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _admin) = setup(&env);

    let deposit_contract = Address::generate(&env);
    let landlord = Address::generate(&env);
    let tenant = Address::generate(&env);
    let reason = String::from_str(&env, "Damage claim");

    client.file_claim(&deposit_contract, &7, &landlord, &tenant, &100, &reason);
    let result = client.try_file_claim(&deposit_contract, &7, &landlord, &tenant, &100, &reason);
    assert_eq!(result, Err(Ok(InspectionError::ClaimAlreadyOpen)));
}

#[test]
fn test_file_claim_rejects_non_positive_amount() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _admin) = setup(&env);

    let deposit_contract = Address::generate(&env);
    let landlord = Address::generate(&env);
    let tenant = Address::generate(&env);
    let reason = String::from_str(&env, "No real damage");

    let result = client.try_file_claim(&deposit_contract, &1, &landlord, &tenant, &0, &reason);
    assert_eq!(result, Err(Ok(InspectionError::InvalidClaimAmount)));
}

#[test]
fn test_non_inspector_cannot_resolve() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _admin) = setup(&env);

    let deposit_contract = Address::generate(&env);
    let landlord = Address::generate(&env);
    let tenant = Address::generate(&env);
    let impostor = Address::generate(&env);
    let reason = String::from_str(&env, "Damage claim");

    client.file_claim(&deposit_contract, &3, &landlord, &tenant, &500, &reason);
    let result = client.try_resolve_claim(&impostor, &deposit_contract, &3, &200);
    assert_eq!(result, Err(Ok(InspectionError::NotAnInspector)));
}

#[test]
fn test_cannot_resolve_already_resolved_claim() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, admin) = setup(&env);

    let deposit_contract = Address::generate(&env);
    let landlord = Address::generate(&env);
    let tenant = Address::generate(&env);
    let reason = String::from_str(&env, "Damage claim");

    client.file_claim(&deposit_contract, &9, &landlord, &tenant, &300, &reason);
    client.resolve_claim(&admin, &deposit_contract, &9, &100);

    let result = client.try_resolve_claim(&admin, &deposit_contract, &9, &50);
    assert_eq!(result, Err(Ok(InspectionError::ClaimAlreadyRuled)));
}

#[test]
fn test_forfeit_cannot_exceed_claimed_amount() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, admin) = setup(&env);

    let deposit_contract = Address::generate(&env);
    let landlord = Address::generate(&env);
    let tenant = Address::generate(&env);
    let reason = String::from_str(&env, "Damage claim");

    client.file_claim(&deposit_contract, &2, &landlord, &tenant, &300, &reason);
    let result = client.try_resolve_claim(&admin, &deposit_contract, &2, &400);
    assert_eq!(result, Err(Ok(InspectionError::ForfeitExceedsClaim)));
}

#[test]
fn test_get_claim_returns_none_when_missing() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _admin) = setup(&env);
    let deposit_contract = Address::generate(&env);
    assert!(client.get_claim(&deposit_contract, &42).is_none());
}
