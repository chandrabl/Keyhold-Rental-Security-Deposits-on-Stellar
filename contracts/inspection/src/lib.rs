//! Inspection Contract
//!
//! A standalone damage-claim arbitration contract. The Deposit contract
//! calls into this contract when a landlord files a claim against a
//! tenant's security deposit, and calls back in to read the ruling once a
//! trusted inspector has decided how much of the claimed amount is
//! justified. Kept separate from Deposit so one inspector panel can rule on
//! claims across many independent leases / Deposit contract deployments,
//! and so the fund-holding contract never has to embed claim-adjudication
//! logic itself.

#![no_std]

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, symbol_short, Address, Env, String, Vec,
};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum ClaimStatus {
    Open,
    Ruled,
}

#[contracttype]
#[derive(Clone, Debug)]
pub struct Claim {
    pub deposit_contract: Address,
    pub lease_id: u64,
    pub landlord: Address,
    pub tenant: Address,
    pub claimed_amount: i128,
    pub reason: String,
    pub status: ClaimStatus,
    pub forfeit_amount: i128,
    pub ruled_by: Option<Address>,
}

#[contracttype]
pub enum DataKey {
    Admin,
    InspectorPanel,
    Claim(Address, u64), // (deposit_contract, lease_id) -> Claim
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum InspectionError {
    NotInitialized = 1,
    AlreadyInitialized = 2,
    Unauthorized = 3,
    NotAnInspector = 4,
    ClaimAlreadyOpen = 5,
    ClaimNotFound = 6,
    ClaimAlreadyRuled = 7,
    ForfeitExceedsClaim = 8,
    InvalidClaimAmount = 9,
}

#[contract]
pub struct InspectionContract;

#[contractimpl]
impl InspectionContract {
    /// One-time setup. `admin` becomes the first trusted inspector.
    pub fn initialize(env: Env, admin: Address) -> Result<(), InspectionError> {
        if env.storage().instance().has(&DataKey::Admin) {
            return Err(InspectionError::AlreadyInitialized);
        }
        admin.require_auth();
        env.storage().instance().set(&DataKey::Admin, &admin);
        let mut panel: Vec<Address> = Vec::new(&env);
        panel.push_back(admin.clone());
        env.storage().instance().set(&DataKey::InspectorPanel, &panel);
        Ok(())
    }

    /// Admin adds a new trusted inspector to the panel.
    pub fn add_inspector(env: Env, admin: Address, new_inspector: Address) -> Result<(), InspectionError> {
        admin.require_auth();
        let stored_admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(InspectionError::NotInitialized)?;
        if stored_admin != admin {
            return Err(InspectionError::Unauthorized);
        }
        let mut panel: Vec<Address> = env
            .storage()
            .instance()
            .get(&DataKey::InspectorPanel)
            .unwrap_or(Vec::new(&env));
        if !panel.contains(&new_inspector) {
            panel.push_back(new_inspector.clone());
        }
        env.storage().instance().set(&DataKey::InspectorPanel, &panel);

        env.events()
            .publish((symbol_short!("inspect"), symbol_short!("added")), new_inspector);
        Ok(())
    }

    /// Called by the Deposit contract when a landlord files a damage claim
    /// against a lease's deposit.
    pub fn file_claim(
        env: Env,
        deposit_contract: Address,
        lease_id: u64,
        landlord: Address,
        tenant: Address,
        claimed_amount: i128,
        reason: String,
    ) -> Result<(), InspectionError> {
        landlord.require_auth();

        if claimed_amount <= 0 {
            return Err(InspectionError::InvalidClaimAmount);
        }

        let key = DataKey::Claim(deposit_contract.clone(), lease_id);
        if let Some(existing) = env.storage().persistent().get::<_, Claim>(&key) {
            if existing.status == ClaimStatus::Open {
                return Err(InspectionError::ClaimAlreadyOpen);
            }
        }

        let claim = Claim {
            deposit_contract: deposit_contract.clone(),
            lease_id,
            landlord: landlord.clone(),
            tenant: tenant.clone(),
            claimed_amount,
            reason: reason.clone(),
            status: ClaimStatus::Open,
            forfeit_amount: 0,
            ruled_by: None,
        };
        env.storage().persistent().set(&key, &claim);

        env.events().publish(
            (symbol_short!("claim"), symbol_short!("filed"), deposit_contract),
            (lease_id, landlord, claimed_amount),
        );
        Ok(())
    }

    /// A panel inspector rules on an open claim, deciding how much of the
    /// claimed amount is actually forfeited to the landlord. The rest
    /// returns to the tenant once the Deposit contract settles.
    pub fn resolve_claim(
        env: Env,
        inspector: Address,
        deposit_contract: Address,
        lease_id: u64,
        forfeit_amount: i128,
    ) -> Result<i128, InspectionError> {
        inspector.require_auth();

        let panel: Vec<Address> = env
            .storage()
            .instance()
            .get(&DataKey::InspectorPanel)
            .ok_or(InspectionError::NotInitialized)?;
        if !panel.contains(&inspector) {
            return Err(InspectionError::NotAnInspector);
        }

        let key = DataKey::Claim(deposit_contract.clone(), lease_id);
        let mut claim: Claim = env
            .storage()
            .persistent()
            .get(&key)
            .ok_or(InspectionError::ClaimNotFound)?;

        if claim.status != ClaimStatus::Open {
            return Err(InspectionError::ClaimAlreadyRuled);
        }
        if forfeit_amount < 0 || forfeit_amount > claim.claimed_amount {
            return Err(InspectionError::ForfeitExceedsClaim);
        }

        claim.status = ClaimStatus::Ruled;
        claim.forfeit_amount = forfeit_amount;
        claim.ruled_by = Some(inspector.clone());
        env.storage().persistent().set(&key, &claim);

        env.events().publish(
            (symbol_short!("claim"), symbol_short!("resolved"), deposit_contract),
            (lease_id, inspector, forfeit_amount),
        );

        Ok(forfeit_amount)
    }

    pub fn get_claim(env: Env, deposit_contract: Address, lease_id: u64) -> Option<Claim> {
        env.storage()
            .persistent()
            .get(&DataKey::Claim(deposit_contract, lease_id))
    }

    pub fn is_inspector(env: Env, address: Address) -> bool {
        let panel: Vec<Address> = env
            .storage()
            .instance()
            .get(&DataKey::InspectorPanel)
            .unwrap_or(Vec::new(&env));
        panel.contains(&address)
    }
}

mod test;
