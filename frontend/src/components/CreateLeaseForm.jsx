import { useState } from 'react'

export default function CreateLeaseForm({ onCreate, disabled }) {
  const [open, setOpen] = useState(false)
  const [tenant, setTenant] = useState('')
  const [token, setToken] = useState('')
  const [amount, setAmount] = useState('')
  const [leaseDays, setLeaseDays] = useState('40')
  const [claimWindowDays, setClaimWindowDays] = useState('20')
  const [busy, setBusy] = useState(false)

  const valid =
    tenant.trim() && token.trim() && Number(amount) > 0 && Number(leaseDays) > 0 && Number(claimWindowDays) > 0

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!valid) return
    setBusy(true)
    try {
      const leaseEnd = Math.floor(Date.now() / 1000) + Number(leaseDays)
      await onCreate({
        tenant: tenant.trim(),
        token: token.trim(),
        depositAmount: Math.floor(Number(amount) * 1e7),
        leaseEnd,
        claimWindowSeconds: Number(claimWindowDays),
      })
      setTenant('')
      setToken('')
      setAmount('')
      setLeaseDays('40')
      setClaimWindowDays('20')
      setOpen(false)
    } finally {
      setBusy(false)
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        disabled={disabled}
        className="w-full py-4 border-2 border-dashed border-blueprint-line rounded-lg text-cyanline-dim/60 hover:border-brass/50 hover:text-brass transition-colors font-mono text-sm disabled:opacity-40 disabled:cursor-not-allowed"
      >
        + Draft a new lease
      </button>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="bg-blueprint-soft border border-brass/30 rounded-lg p-4 sm:p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-display font-bold text-lg text-cyanline">New Lease Draft</h3>
        <button type="button" onClick={() => setOpen(false)} className="font-mono text-xs text-cyanline-dim/50 hover:text-cyanline">
          cancel
        </button>
      </div>

      <div>
        <label className="font-mono text-[10px] uppercase tracking-widest2 text-cyanline-dim/60 block mb-1.5">
          Tenant address
        </label>
        <input
          value={tenant}
          onChange={(e) => setTenant(e.target.value)}
          placeholder="G..."
          className="w-full bg-blueprint border border-blueprint-line rounded p-2.5 text-sm font-mono text-cyanline placeholder:text-cyanline-dim/30 focus:border-brass/60 outline-none"
        />
      </div>

      <div>
        <label className="font-mono text-[10px] uppercase tracking-widest2 text-cyanline-dim/60 block mb-1.5">
          Payment token contract
        </label>
        <input
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="C..."
          className="w-full bg-blueprint border border-blueprint-line rounded p-2.5 text-sm font-mono text-cyanline placeholder:text-cyanline-dim/30 focus:border-brass/60 outline-none"
        />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="font-mono text-[10px] uppercase tracking-widest2 text-cyanline-dim/60 block mb-1.5">
            Deposit amount
          </label>
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            type="number"
            min="0"
            placeholder="100"
            className="w-full bg-blueprint border border-blueprint-line rounded p-2.5 text-sm font-mono text-cyanline placeholder:text-cyanline-dim/30 focus:border-brass/60 outline-none"
          />
        </div>
        <div>
          <label className="font-mono text-[10px] uppercase tracking-widest2 text-cyanline-dim/60 block mb-1.5">
            Lease length (sec)
          </label>
          <input
            value={leaseDays}
            onChange={(e) => setLeaseDays(e.target.value)}
            type="number"
            min="1"
            className="w-full bg-blueprint border border-blueprint-line rounded p-2.5 text-sm font-mono text-cyanline placeholder:text-cyanline-dim/30 focus:border-brass/60 outline-none"
          />
        </div>
        <div>
          <label className="font-mono text-[10px] uppercase tracking-widest2 text-cyanline-dim/60 block mb-1.5">
            Claim window (sec)
          </label>
          <input
            value={claimWindowDays}
            onChange={(e) => setClaimWindowDays(e.target.value)}
            type="number"
            min="1"
            className="w-full bg-blueprint border border-blueprint-line rounded p-2.5 text-sm font-mono text-cyanline placeholder:text-cyanline-dim/30 focus:border-brass/60 outline-none"
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={!valid || busy || disabled}
        className="w-full font-mono text-sm px-4 py-2.5 rounded bg-brass text-blueprint font-medium hover:bg-brass-bright disabled:opacity-40 transition-colors"
      >
        {busy ? 'Drafting…' : 'Draft lease'}
      </button>
    </form>
  )
}
