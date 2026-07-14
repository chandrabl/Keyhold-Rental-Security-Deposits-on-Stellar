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

export default function App() {
  const wallet = useWallet()
  const { feed, isPolling } = useEventStream()

  const [leases, setLeases] = useState({})
  const [knownLeaseIds, setKnownLeaseIds] = useState([])
  const [txByLease, setTxByLease] = useState({})
  const [errorMsg, setErrorMsg] = useState(null)

  const configured = isConfigured()

  const refreshLease = useCallback(
    async (leaseId) => {
      try {
        const raw = await getLease({ leaseId, sourcePublicKey: wallet.address })
        setLeases((prev) => ({ ...prev, [leaseId]: normalizeLease(leaseId, raw) }))
      } catch (err) {
        console.error(`Failed to load lease ${leaseId}:`, err)
      }
    },
    [wallet.address]
  )

  // Poll lease states every 5s to stay in sync with the blockchain
  useEffect(() => {
    if (!configured || knownLeaseIds.length === 0) return
    const interval = setInterval(() => {
      knownLeaseIds.forEach((id) => refreshLease(id))
    }, 5000)
    return () => clearInterval(interval)
  }, [knownLeaseIds, configured, refreshLease])

  useEffect(() => {
    if (!configured || feed.length === 0) return
    const leaseIds = new Set()
    feed.forEach((entry) => {
      const rawTopics = entry.raw?.topics || []
      const numericTopic = rawTopics.find((t) => typeof t === 'number' || typeof t === 'bigint')
      if (numericTopic !== undefined) leaseIds.add(Number(numericTopic))
    })
    leaseIds.forEach((id) => {
      refreshLease(id)
      setKnownLeaseIds((prev) => (prev.includes(id) ? prev : [...prev, id]))
    })
  }, [feed, configured, refreshLease])

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
      setTxByLease((prev) => ({ ...prev, [leaseId]: hash }))
      setKnownLeaseIds((prev) => [...prev, Number(leaseId)])
      await refreshLease(Number(leaseId))
      if (wallet.refreshBalance) await wallet.refreshBalance()
    } catch (err) {
      setErrorMsg(err.message || 'Failed to draft lease.')
    }
  }

  const withTxTracking = (leaseId, fn) => async (...args) => {
    try {
      const { hash } = await fn(...args)
      setTxByLease((prev) => ({ ...prev, [leaseId]: hash }))
      // Wait for the blockchain state to propagate before refreshing
      await new Promise((res) => setTimeout(res, 3000))
      await refreshLease(leaseId)
      if (wallet.refreshBalance) await wallet.refreshBalance()
    } catch (err) {
      setErrorMsg(err.message || 'Transaction failed.')
    }
  }

  const handleFundDeposit = (leaseId) =>
    withTxTracking(leaseId, () => fundDeposit({ tenant: wallet.address, leaseId }))()

  const handleFileClaim = (leaseId, claimedAmount, reason) =>
    withTxTracking(leaseId, () => fileClaim({ landlord: wallet.address, leaseId, claimedAmount, reason }))()

  const handleReleaseDeposit = (leaseId) =>
    withTxTracking(leaseId, () => releaseDeposit({ caller: wallet.address, leaseId }))()

  const handleSettleClaim = (leaseId) =>
    withTxTracking(leaseId, () => settleClaim({ caller: wallet.address, leaseId }))()

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
