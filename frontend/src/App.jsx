import { useState, useCallback, useEffect } from 'react'
import Header from './components/Header'
import Hero from './components/Hero'
import CreateLeaseForm from './components/CreateLeaseForm'
import LeaseCard from './components/LeaseCard'
import ActivityFeed from './components/ActivityFeed'
import Banner from './components/Banner'
import { useWallet } from './hooks/useWallet'
import { useEventStream } from './hooks/useEventStream'
import { isConfigured } from './lib/config'
import {
  createLease,
  fundDeposit,
  fileClaim,
  releaseDeposit,
  settleClaim,
  getLease,
  normalizeLease,
} from './lib/depositActions'

// Persist tx hashes and known lease IDs across page refreshes
const LS_TX = 'keyhold_tx'
const LS_IDS = 'keyhold_lease_ids'
const LS_STATUSES = 'keyhold_statuses' // persisted status overrides

const STATUS_ORDER = ['draft', 'funded', 'disputed', 'released']
const statusRank = (s) => STATUS_ORDER.indexOf((s || 'draft').toLowerCase())

function loadFromStorage(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback } catch (_e) { return fallback }
}
function saveToStorage(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)) } catch (_e) { /* ignore */ }
}

export default function App() {
  const wallet = useWallet()
  const { feed, isPolling } = useEventStream()

  const [leases, setLeases] = useState({})
  const [knownLeaseIds, setKnownLeaseIds] = useState(() => loadFromStorage(LS_IDS, []))
  const [txByLease, setTxByLease] = useState(() => loadFromStorage(LS_TX, {}))
  const [savedStatuses, setSavedStatuses] = useState(() => loadFromStorage(LS_STATUSES, {}))
  const [errorMsg, setErrorMsg] = useState(null)

  const configured = isConfigured()

  // Persist tx hashes
  useEffect(() => { saveToStorage(LS_TX, txByLease) }, [txByLease])
  useEffect(() => { saveToStorage(LS_IDS, knownLeaseIds) }, [knownLeaseIds])
  useEffect(() => { saveToStorage(LS_STATUSES, savedStatuses) }, [savedStatuses])

  const refreshLease = useCallback(
    async (leaseId) => {
      try {
        const raw = await getLease({ leaseId, sourcePublicKey: wallet.address })
        if (raw) {
          const normalized = normalizeLease(leaseId, raw)
          if (normalized) {
            // Read the persisted best-known status directly from localStorage
            const persisted = loadFromStorage(LS_STATUSES, {})
            const persistedStatus = persisted[leaseId] || persisted[String(leaseId)]
            const bestStatus = [normalized.status, persistedStatus].reduce(
              (best, s) => (s && statusRank(s) > statusRank(best) ? s : best),
              'draft'
            )
            setLeases((prev) => ({
              ...prev,
              [leaseId]: { ...normalized, status: bestStatus },
            }))
          }
        }
      } catch (err) {
        console.error(`Failed to load lease ${leaseId}:`, err)
      }
    },
    [wallet.address]
  )

  // Optimistically update a lease's status — also persist to localStorage
  const optimisticStatusUpdate = useCallback((leaseId, newStatus) => {
    setSavedStatuses((prev) => {
      const curr = prev[leaseId]
      if (curr && statusRank(curr) >= statusRank(newStatus)) return prev
      return { ...prev, [leaseId]: newStatus }
    })
    setLeases((prev) => {
      const existing = prev[leaseId]
      if (!existing) return prev
      if (statusRank(existing.status) >= statusRank(newStatus)) return prev
      return { ...prev, [leaseId]: { ...existing, status: newStatus } }
    })
  }, [])

  // Poll lease states every 8s to stay in sync with the blockchain
  useEffect(() => {
    if (!configured || knownLeaseIds.length === 0) return
    const interval = setInterval(() => {
      knownLeaseIds.forEach((id) => refreshLease(id))
    }, 8000)
    return () => clearInterval(interval)
  }, [knownLeaseIds, configured, refreshLease])

  useEffect(() => {
    if (!configured || feed.length === 0) return
    const leaseIds = new Set()
    feed.forEach((entry) => {
      const rawTopics = entry.raw?.topics || []
      const numericTopic = rawTopics.find((t) => typeof t === 'number' || typeof t === 'bigint')
      if (numericTopic !== undefined) {
        const id = Number(numericTopic)
        leaseIds.add(id)
        
        // Soroban RPC nodes often return stale data for `get_lease`.
        // If we see an event in the feed, we can trust the ledger actually advanced.
        const action = typeof rawTopics[1] === 'string' ? rawTopics[1].toLowerCase() : ''
        if (action === 'funded') optimisticStatusUpdate(id, 'Funded')
        if (action === 'claimed') optimisticStatusUpdate(id, 'Disputed')
        if (action === 'released' || action === 'settled') optimisticStatusUpdate(id, 'Released')
      }
    })
    leaseIds.forEach((id) => {
      refreshLease(id)
      setKnownLeaseIds((prev) => (prev.includes(id) ? prev : [...prev, id]))
    })
  }, [feed, configured, refreshLease, optimisticStatusUpdate])


  // Load all known leases on wallet connect
  useEffect(() => {
    if (!wallet.address || !configured || knownLeaseIds.length === 0) return
    knownLeaseIds.forEach((id) => refreshLease(id))
  }, [wallet.address]) // eslint-disable-line


  const handleCreateLease = async ({ tenant, token, depositAmount, leaseEnd, claimWindowSeconds }) => {
    if (!wallet.address) {
      setErrorMsg('Connect your wallet before drafting a lease.')
      return
    }
    setErrorMsg(null)
    try {
      const { result: leaseId, hash } = await createLease({
        landlord: wallet.address,
        tenant,
        token,
        depositAmount,
        leaseEnd,
        claimWindowSeconds,
      })
      const id = Number(leaseId)
      setTxByLease((prev) => ({ ...prev, [id]: hash }))
      setKnownLeaseIds((prev) => (prev.includes(id) ? prev : [...prev, id]))
      await refreshLease(id)
      if (wallet.refreshBalance) await wallet.refreshBalance()
    } catch (err) {
      setErrorMsg(err.message || 'Failed to draft lease.')
    }
  }

  const withTxTracking = (leaseId, fn, optimisticStatus) => async (...args) => {
    try {
      const { hash } = await fn(...args)
      setTxByLease((prev) => ({ ...prev, [leaseId]: hash }))
      if (optimisticStatus) optimisticStatusUpdate(leaseId, optimisticStatus)
      if (wallet.refreshBalance) await wallet.refreshBalance()
      setTimeout(() => refreshLease(leaseId), 5000)
    } catch (err) {
      // Error(Contract, #7) on fund_deposit = already funded — update UI silently
      if (err.message?.includes('Error(Contract, #7)') && optimisticStatus === 'Funded') {
        optimisticStatusUpdate(leaseId, 'Funded')
        return
      }
      setErrorMsg(err.message || 'Transaction failed.')
    }
  }

  const handleFundDeposit = (leaseId) =>
    withTxTracking(leaseId, () => fundDeposit({ tenant: wallet.address, leaseId }), 'Funded')()

  const handleFileClaim = (leaseId, claimedAmount, reason) =>
    withTxTracking(leaseId, () => fileClaim({ landlord: wallet.address, leaseId, claimedAmount, reason }), 'Disputed')()

  const handleReleaseDeposit = (leaseId) =>
    withTxTracking(leaseId, () => releaseDeposit({ caller: wallet.address, leaseId }), 'Released')()

  const handleSettleClaim = (leaseId) =>
    withTxTracking(leaseId, () => settleClaim({ caller: wallet.address, leaseId }), 'Released')()

  const leaseList = knownLeaseIds
    .map((id) => leases[id])
    .filter(Boolean)
    .sort((a, b) => b.id - a.id)

  return (
    <div className="min-h-screen flex flex-col">
      <Header wallet={wallet} />
      <Hero />

      <main className="max-w-5xl mx-auto w-full px-4 sm:px-6 pb-16 flex-1">
        {!configured && (
          <div className="mb-6">
            <Banner type="warning">
              Contract addresses aren&apos;t configured yet. Set{' '}
              <code className="font-mono">VITE_DEPOSIT_CONTRACT_ID</code>,{' '}
              <code className="font-mono">VITE_INSPECTION_CONTRACT_ID</code>, and{' '}
              <code className="font-mono">VITE_TOKEN_CONTRACT_ID</code> in your{' '}
              <code className="font-mono">.env</code> file after deploying — see DEPLOYMENT.md.
            </Banner>
          </div>
        )}

        {errorMsg && (
          <div className="mb-6">
            <Banner type="error" onDismiss={() => setErrorMsg(null)}>
              {errorMsg}
            </Banner>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
          <section className="space-y-4 min-w-0">
            <CreateLeaseForm onCreate={handleCreateLease} disabled={!wallet.address || !configured} />

            {leaseList.length === 0 && (
              <p className="font-mono text-xs text-cyanline-dim/40 text-center py-10">
                No leases yet. The first one drafted becomes Lease #0000.
              </p>
            )}

            {leaseList.map((lease) => (
              <LeaseCard
                key={lease.id}
                lease={lease}
                walletAddress={wallet.address}
                onFundDeposit={handleFundDeposit}
                onFileClaim={handleFileClaim}
                onReleaseDeposit={handleReleaseDeposit}
                onSettleClaim={handleSettleClaim}
                lastTxHash={txByLease[lease.id]}
              />
            ))}
          </section>

          <div className="lg:sticky lg:top-24 lg:self-start">
            <ActivityFeed feed={feed} isPolling={isPolling} />
          </div>
        </div>
      </main>

      <footer className="border-t border-blueprint-line py-6 text-center">
        <p className="font-mono text-[11px] text-cyanline-dim/30">Built on Soroban · Stellar Testnet</p>
      </footer>
    </div>
  )
}
