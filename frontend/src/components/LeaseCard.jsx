import { useState } from 'react'
import KeyStatus from './KeyStatus'
import LeaseTimeline from './LeaseTimeline'
import { EXPLORER_TX_URL } from '../lib/config'

export default function LeaseCard({
  lease,
  walletAddress,
  onFundDeposit,
  onFileClaim,
  onReleaseDeposit,
  onSettleClaim,
  lastTxHash,
}) {
  const [showClaimForm, setShowClaimForm] = useState(false)
  const [claimAmount, setClaimAmount] = useState('')
  const [claimReason, setClaimReason] = useState('')
  const [busy, setBusy] = useState(false)

  const isLandlord = walletAddress && lease.landlord?.trim() === walletAddress?.trim()
  const isTenant = walletAddress && lease.tenant?.trim() === walletAddress?.trim()
  const short = (addr) => (addr ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : '—')

  const now = Math.floor(Date.now() / 1000)
  const windowClosed = now > lease.leaseEnd + lease.claimWindowSeconds;
  const leaseEnded = now >= lease.leaseEnd;

  let actualStatus = lease.status;
  if (Array.isArray(actualStatus)) actualStatus = actualStatus[0];
  if (typeof actualStatus === 'object') actualStatus = Object.keys(actualStatus)[0];
  const statusLower = String(actualStatus || 'draft').toLowerCase();

  const wrap = (fn) => async (...args) => {
    setBusy(true)
    try {
      await fn(...args)
    } finally {
      setBusy(false)
    }
  }

  const handleClaimSubmit = wrap(async () => {
    if (!claimAmount || !claimReason.trim()) return
    await onFileClaim(lease.id, Number(claimAmount), claimReason.trim())
    setShowClaimForm(false)
    setClaimAmount('')
    setClaimReason('')
  })

  return (
    <article className="relative bg-blueprint-soft border border-blueprint-line rounded-lg shadow-blueprint p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-widest2 text-cyanline-dim/50">
            Lease #{String(lease.id).padStart(4, '0')}
          </p>
          <h3 className="font-display font-bold text-lg text-cyanline mt-0.5">
            {lease.depositAmount} deposit
          </h3>
        </div>
        <KeyStatus status={lease.status} />
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4 text-xs font-mono">
        <div>
          <p className="text-cyanline-dim/50 uppercase tracking-wide text-[10px] mb-0.5">Landlord</p>
          <p className="text-cyanline-dim">{short(lease.landlord)}</p>
        </div>
        <div>
          <p className="text-cyanline-dim/50 uppercase tracking-wide text-[10px] mb-0.5">Tenant</p>
          <p className="text-cyanline-dim">{short(lease.tenant)}</p>
        </div>
      </div>

      <div className="mb-4">
        <LeaseTimeline
          leaseEnd={lease.leaseEnd}
          claimWindowSeconds={lease.claimWindowSeconds}
          status={lease.status}
        />
      </div>

      <div className="flex flex-wrap gap-2 pt-3 border-t border-blueprint-line/70">
        {statusLower === 'draft' && walletAddress && !isTenant && !isLandlord && (
          <div className="w-full text-[10px] sm:text-xs font-mono text-signal-stop bg-signal-stop/10 px-3 py-2 rounded mb-2 border border-signal-stop/30">
            Cannot fund deposit: You are connected as <span className="font-bold">{short(walletAddress)}</span> but the tenant is <span className="font-bold">{short(lease.tenant)}</span>. Switch to the Tenant account in Freighter!
          </div>
        )}

        {statusLower === 'draft' && isTenant && (
          <button
            onClick={wrap(() => onFundDeposit(lease.id))}
            disabled={busy}
            className="font-mono text-xs px-3 py-2 rounded bg-brass text-blueprint font-medium hover:bg-brass-bright disabled:opacity-40 transition-colors"
          >
            Fund deposit
          </button>
        )}

        {statusLower === 'funded' && isLandlord && leaseEnded && !windowClosed && !showClaimForm && (
          <button
            onClick={() => setShowClaimForm(true)}
            className="font-mono text-xs px-3 py-2 rounded border border-signal-stop/50 text-signal-stop hover:bg-signal-stop/10 transition-colors"
          >
            File damage claim
          </button>
        )}

        {statusLower === 'funded' && windowClosed && (
          <button
            onClick={wrap(() => onReleaseDeposit(lease.id))}
            disabled={busy}
            className="font-mono text-xs px-3 py-2 rounded bg-signal-go text-blueprint font-medium hover:brightness-110 disabled:opacity-40 transition-colors"
          >
            Release deposit to tenant
          </button>
        )}

        {statusLower === 'disputed' && (
          <button
            onClick={wrap(() => onSettleClaim(lease.id))}
            disabled={busy}
            className="font-mono text-xs px-3 py-2 rounded border border-signal-hold/50 text-signal-hold hover:bg-signal-hold/10 disabled:opacity-40 transition-colors"
          >
            Check ruling &amp; settle
          </button>
        )}
      </div>

      {showClaimForm && (
        <div className="mt-3 p-3 bg-signal-stop/5 border border-signal-stop/30 rounded">
          <label className="font-mono text-[10px] uppercase tracking-widest2 text-signal-stop block mb-2">
            Claim details
          </label>
          <input
            value={claimAmount}
            onChange={(e) => setClaimAmount(e.target.value)}
            type="number"
            min="0"
            max={lease.depositAmount}
            placeholder="Amount claimed"
            className="w-full mb-2 bg-blueprint border border-blueprint-line rounded p-2 text-sm font-mono text-cyanline placeholder:text-cyanline-dim/40 focus:border-signal-stop/60 outline-none"
          />
          <textarea
            value={claimReason}
            onChange={(e) => setClaimReason(e.target.value)}
            rows={2}
            className="w-full bg-blueprint border border-blueprint-line rounded p-2 text-sm text-cyanline placeholder:text-cyanline-dim/40 focus:border-signal-stop/60 outline-none resize-none"
            placeholder="Describe the damage…"
          />
          <div className="flex gap-2 mt-2">
            <button
              onClick={handleClaimSubmit}
              disabled={busy || !claimAmount || !claimReason.trim()}
              className="font-mono text-[11px] px-3 py-1.5 rounded bg-signal-stop text-cyanline font-medium disabled:opacity-40"
            >
              File with inspector
            </button>
            <button
              onClick={() => setShowClaimForm(false)}
              className="font-mono text-[11px] px-3 py-1.5 rounded border border-blueprint-line text-cyanline-dim"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {lastTxHash && (
        <a
          href={EXPLORER_TX_URL(lastTxHash)}
          target="_blank"
          rel="noreferrer"
          className="block mt-3 font-mono text-[10px] text-cyanline-dim/40 hover:text-brass truncate transition-colors"
        >
          last tx: {lastTxHash}
        </a>
      )}
    </article>
  )
}
