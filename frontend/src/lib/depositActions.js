import {
  invokeContract,
  readContract,
  addressToScVal,
  stringToScVal,
  i128ToScVal,
  u64ToScVal,
} from './sorobanClient'
import { DEPOSIT_CONTRACT_ID } from './config'

export async function createLease({ landlord, tenant, token, depositAmount, leaseEnd, claimWindowSeconds }) {
  const args = [
    addressToScVal(landlord),
    addressToScVal(tenant),
    addressToScVal(token),
    i128ToScVal(depositAmount),
    u64ToScVal(leaseEnd),
    u64ToScVal(claimWindowSeconds),
  ]
  return invokeContract({
    contractId: DEPOSIT_CONTRACT_ID,
    method: 'create_lease',
    args,
    sourcePublicKey: landlord,
  })
}

export async function fundDeposit({ tenant, leaseId }) {
  const args = [addressToScVal(tenant), u64ToScVal(leaseId)]
  return invokeContract({
    contractId: DEPOSIT_CONTRACT_ID,
    method: 'fund_deposit',
    args,
    sourcePublicKey: tenant,
  })
}

export async function fileClaim({ landlord, leaseId, claimedAmount, reason }) {
  const args = [addressToScVal(landlord), u64ToScVal(leaseId), i128ToScVal(claimedAmount), stringToScVal(reason)]
  return invokeContract({
    contractId: DEPOSIT_CONTRACT_ID,
    method: 'file_claim',
    args,
    sourcePublicKey: landlord,
  })
}

export async function releaseDeposit({ caller, leaseId }) {
  const args = [u64ToScVal(leaseId)]
  return invokeContract({
    contractId: DEPOSIT_CONTRACT_ID,
    method: 'release_deposit',
    args,
    sourcePublicKey: caller,
  })
}

export async function settleClaim({ caller, leaseId }) {
  const args = [u64ToScVal(leaseId)]
  return invokeContract({
    contractId: DEPOSIT_CONTRACT_ID,
    method: 'settle_claim',
    args,
    sourcePublicKey: caller,
  })
}

export async function getLease({ leaseId, sourcePublicKey }) {
  return readContract({
    contractId: DEPOSIT_CONTRACT_ID,
    method: 'get_lease',
    args: [u64ToScVal(leaseId)],
    sourcePublicKey,
  })
}

export function normalizeLease(leaseId, raw) {
  if (!raw) return null
  return {
    id: leaseId,
    landlord: raw.landlord,
    tenant: raw.tenant,
    token: raw.token,
    depositAmount: (Number(raw.deposit_amount?.toString?.() ?? String(raw.deposit_amount)) / 1e7).toString(),
    leaseEnd: Number(raw.lease_end),
    claimWindowSeconds: Number(raw.claim_window_seconds),
    status: typeof raw.status === 'string' ? raw.status : Object.keys(raw.status)[0],
    fundedAt: Number(raw.funded_at),
  }
}
