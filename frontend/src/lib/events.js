import { rpc, scValToNative } from '@stellar/stellar-sdk'
import { RPC_URL, DEPOSIT_CONTRACT_ID, INSPECTION_CONTRACT_ID } from './config'

const server = new rpc.Server(RPC_URL, { allowHttp: RPC_URL.startsWith('http://') })

let lastLedger = null

function decodeEvent(raw) {
  const topics = raw.topic.map((t) => {
    try {
      return scValToNative(t)
    } catch {
      return null
    }
  })
  let value = null
  try {
    value = scValToNative(raw.value)
  } catch {
    value = null
  }
  return {
    id: raw.id,
    ledger: raw.ledger,
    contractId: raw.contractId,
    topics,
    value,
    txHash: raw.txHash,
    timestamp: raw.ledgerClosedAt,
  }
}

/**
 * Fetches events emitted since the last poll for both the deposit and
 * inspection contracts, powering the live case-log feed.
 */
export async function fetchNewEvents() {
  const latestLedger = await server.getLatestLedger()
  const currentLedger = latestLedger.sequence

  if (lastLedger === null) {
    lastLedger = Math.max(currentLedger - 100, 1)
  }

  if (lastLedger >= currentLedger) {
    return []
  }

  const contractIds = [DEPOSIT_CONTRACT_ID, INSPECTION_CONTRACT_ID].filter(Boolean)
  if (contractIds.length === 0) return []

  const response = await server.getEvents({
    startLedger: lastLedger + 1,
    filters: [
      {
        type: 'contract',
        contractIds,
      },
    ],
    limit: 100,
  })

  lastLedger = currentLedger
  return (response.events || []).map(decodeEvent)
}

export function resetEventCursor() {
  lastLedger = null
}
