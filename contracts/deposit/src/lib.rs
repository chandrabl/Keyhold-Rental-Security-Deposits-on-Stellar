//! Deposit Contract
//!
//! A landlord drafts a lease (tenant, token, deposit amount, lease end
//! date, claim window). The tenant reviews the terms and funds the deposit,
//! activating the lease. At lease end, if the landlord files no damage
//! claim within the claim window, anyone can trigger `release_deposit` to
//! return the full deposit to the tenant. If the landlord does file a
//! claim, it escalates to the separate Inspection contract; once a trusted
//! inspector rules on how much is forfeited, `settle_claim` reads that
//! ruling back and splits the deposit accordingly. All due-ness and
//! window logic is driven by Soroban's on-chain ledger timestamp.

#![no_std]

use inspection::InspectionContractClient;
use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, symbol_short, token, Address, Env, String,
};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum LeaseStatus {
    Draft,
    Funded,
    Disputed,
    Released,
    Settled,
    Cancelled,
}

#[contracttype]
#[derive(Clone, Debug)]
pub struct Lease {
    pub landlord: Address,
    pub tenant: Address,
    pub token: Address,
    pub deposit_amount: i128,
    pub lease_end: u64,
    pub claim_window_seconds: u64,
    pub status: LeaseStatus,
    pub funded_at: u64,
}

#[contracttype]
pub enum DataKey {
    Admin,
    InspectionContract,
    NextLeaseId,
    Lease(u64),
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum DepositError {
    NotInitialized = 1,
    AlreadyInitialized = 2,
    LeaseNotFound = 3,
    Unauthorized = 4,
    InvalidAmount = 5,
    InvalidLeaseEnd = 6,
    LeaseNotDraft = 7,
    LeaseNotFunded = 8,
    LeaseNotDisputed = 9,
    ClaimWindowClosed = 10,
    ClaimWindowStillOpen = 11,
    LeaseNotYetEnded = 12,
}

#[contract]
pub struct DepositContract;

#[contractimpl]
impl DepositContract {
    pub fn initialize(env: Env, admin: Address, inspection_contract: Address) -> Result<(), DepositError> {
        if env.storage().instance().has(&DataKey::Admin) {
            return Err(DepositError::AlreadyInitialized);
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage()
            .instance()
            .set(&DataKey::InspectionContract, &inspection_contract);
        env.storage().instance().set(&DataKey::NextLeaseId, &0u64);
        Ok(())
    }

    /// Landlord drafts lease terms. No funds move yet.
    pub fn create_lease(
        env: Env,
        landlord: Address,
        tenant: Address,
        token: Address,
        deposit_amount: i128,
        lease_end: u64,
        claim_window_seconds: u64,
    ) -> Result<u64, DepositError> {
        landlord.require_auth();
        if deposit_amount <= 0 {
            return Err(DepositError::InvalidAmount);
        }
        if lease_end <= env.ledger().timestamp() {
            return Err(DepositError::InvalidLeaseEnd);
        }

        let lease_id: u64 = env.storage().instance().get(&DataKey::NextLeaseId).unwrap_or(0);
        let lease = Lease {
            landlord: landlord.clone(),
            tenant: tenant.clone(),
            token,
            deposit_amount,
            lease_end,
            claim_window_seconds,
            status: LeaseStatus::Draft,
            funded_at: 0,
        };
        env.storage().persistent().set(&DataKey::Lease(lease_id), &lease);
        env.storage()
            .instance()
            .set(&DataKey::NextLeaseId, &(lease_id + 1));

        env.events()
            .publish((symbol_short!("lease"), symbol_short!("created"), lease_id), (landlord, tenant));

        Ok(lease_id)
    }

    /// Landlord withdraws an unfunded draft lease.
    pub fn cancel_lease(env: Env, landlord: Address, lease_id: u64) -> Result<(), DepositError> {
        landlord.require_auth();
        let mut lease = Self::load_lease(&env, lease_id)?;
        if lease.landlord != landlord {
            return Err(DepositError::Unauthorized);
        }
        if lease.status != LeaseStatus::Draft {
            return Err(DepositError::LeaseNotDraft);
        }
        lease.status = LeaseStatus::Cancelled;
        env.storage().persistent().set(&DataKey::Lease(lease_id), &lease);

        env.events()
            .publish((symbol_short!("lease"), symbol_short!("cancel"), lease_id), landlord);
        Ok(())
    }

    /// Tenant funds the deposit, activating the lease.
    pub fn fund_deposit(env: Env, tenant: Address, lease_id: u64) -> Result<(), DepositError> {
        tenant.require_auth();
        let mut lease = Self::load_lease(&env, lease_id)?;
        if lease.tenant != tenant {
            return Err(DepositError::Unauthorized);
        }
        if lease.status != LeaseStatus::Draft {
            return Err(DepositError::LeaseNotDraft);
        }

        let token_client = token::Client::new(&env, &lease.token);
        token_client.transfer(&tenant, &env.current_contract_address(), &lease.deposit_amount);

        lease.status = LeaseStatus::Funded;
        lease.funded_at = env.ledger().timestamp();
        env.storage().persistent().set(&DataKey::Lease(lease_id), &lease);

        env.events()
            .publish((symbol_short!("lease"), symbol_short!("funded"), lease_id), tenant);
        Ok(())
    }

    /// Landlord files a damage claim. Only allowed at/after lease end and
    /// within the claim window. Escalates to the Inspection contract.
    pub fn file_claim(
        env: Env,
        landlord: Address,
        lease_id: u64,
        claimed_amount: i128,
        reason: String,
    ) -> Result<(), DepositError> {
        landlord.require_auth();
        let mut lease = Self::load_lease(&env, lease_id)?;
        if lease.landlord != landlord {
            return Err(DepositError::Unauthorized);
        }
        if lease.status != LeaseStatus::Funded {
            return Err(DepositError::LeaseNotFunded);
        }

        let now = env.ledger().timestamp();
        if now < lease.lease_end {
            return Err(DepositError::LeaseNotYetEnded);
        }
        if now > lease.lease_end + lease.claim_window_seconds {
            return Err(DepositError::ClaimWindowClosed);
        }
        if claimed_amount <= 0 || claimed_amount > lease.deposit_amount {
            return Err(DepositError::InvalidAmount);
        }

        let inspection_address: Address = env
            .storage()
            .instance()
            .get(&DataKey::InspectionContract)
            .ok_or(DepositError::NotInitialized)?;

        // Cross-contract call out to the Inspection contract.
        let inspection_client = InspectionContractClient::new(&env, &inspection_address);
        inspection_client.file_claim(
            &env.current_contract_address(),
            &lease_id,
            &landlord,
            &lease.tenant,
            &claimed_amount,
            &reason,
        );

        lease.status = LeaseStatus::Disputed;
        env.storage().persistent().set(&DataKey::Lease(lease_id), &lease);

        env.events()
            .publish((symbol_short!("lease"), symbol_short!("claimed"), lease_id), claimed_amount);
        Ok(())
    }

    /// Anyone can call this once the claim window has closed with no claim
    /// filed — releases the full deposit back to the tenant.
    pub fn release_deposit(env: Env, lease_id: u64) -> Result<(), DepositError> {
        let mut lease = Self::load_lease(&env, lease_id)?;
        if lease.status != LeaseStatus::Funded {
            return Err(DepositError::LeaseNotFunded);
        }

        let now = env.ledger().timestamp();
        if now <= lease.lease_end + lease.claim_window_seconds {
            return Err(DepositError::ClaimWindowStillOpen);
        }

        let token_client = token::Client::new(&env, &lease.token);
        token_client.transfer(&env.current_contract_address(), &lease.tenant, &lease.deposit_amount);

        lease.status = LeaseStatus::Released;
        env.storage().persistent().set(&DataKey::Lease(lease_id), &lease);

        env.events()
            .publish((symbol_short!("lease"), symbol_short!("released"), lease_id), lease.tenant);
        Ok(())
    }

    /// Anyone can call this once the Inspection contract has ruled on the
    /// claim; splits the deposit between landlord (forfeit_amount) and
    /// tenant (the remainder) accordingly.
    pub fn settle_claim(env: Env, lease_id: u64) -> Result<i128, DepositError> {
        let mut lease = Self::load_lease(&env, lease_id)?;
        if lease.status != LeaseStatus::Disputed {
            return Err(DepositError::LeaseNotDisputed);
        }

        let inspection_address: Address = env
            .storage()
            .instance()
            .get(&DataKey::InspectionContract)
            .ok_or(DepositError::NotInitialized)?;
        let inspection_client = InspectionContractClient::new(&env, &inspection_address);
        let claim = inspection_client
            .get_claim(&env.current_contract_address(), &lease_id)
            .ok_or(DepositError::LeaseNotDisputed)?;

        if claim.status == inspection::ClaimStatus::Open {
            // Still awaiting a ruling; nothing to settle yet.
            return Ok(-1);
        }

        let forfeit = claim.forfeit_amount;
        let refund = lease.deposit_amount - forfeit;

        let token_client = token::Client::new(&env, &lease.token);
        if forfeit > 0 {
            token_client.transfer(&env.current_contract_address(), &lease.landlord, &forfeit);
        }
        if refund > 0 {
            token_client.transfer(&env.current_contract_address(), &lease.tenant, &refund);
        }

        lease.status = LeaseStatus::Settled;
        env.storage().persistent().set(&DataKey::Lease(lease_id), &lease);

        env.events()
            .publish((symbol_short!("lease"), symbol_short!("settled"), lease_id), forfeit);

        Ok(forfeit)
    }

    pub fn get_lease(env: Env, lease_id: u64) -> Result<Lease, DepositError> {
        Self::load_lease(&env, lease_id)
    }

    fn load_lease(env: &Env, lease_id: u64) -> Result<Lease, DepositError> {
        env.storage()
            .persistent()
            .get(&DataKey::Lease(lease_id))
            .ok_or(DepositError::LeaseNotFound)
    }
}

mod test;
