import { useCountdown } from '../hooks/useCountdown'

export default function LeaseTimeline({ leaseEnd, claimWindowSeconds, status }) {
  const endCountdown = useCountdown(leaseEnd)
  const windowClose = leaseEnd + claimWindowSeconds
  const windowCountdown = useCountdown(windowClose)

  if (status !== 'Funded') return null

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5">
        <span className={`w-1.5 h-1.5 rounded-full ${endCountdown.passed ? 'bg-signal-go' : 'bg-brass'}`} />
        <span className="font-mono text-xs text-cyanline-dim/70">
          {endCountdown.passed ? 'Lease term ended' : `Lease ends in ${endCountdown.label}`}
        </span>
      </div>
      <div className="flex items-center gap-1.5">
        <span
          className={`w-1.5 h-1.5 rounded-full ${windowCountdown.passed ? 'bg-signal-go' : 'bg-signal-hold animate-pulse'}`}
        />
        <span className="font-mono text-xs text-cyanline-dim/70">
          {windowCountdown.passed
            ? 'Claim window closed — releasable'
            : `Claim window closes in ${windowCountdown.label}`}
        </span>
      </div>
    </div>
  )
}
