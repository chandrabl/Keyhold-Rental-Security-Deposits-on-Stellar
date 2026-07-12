const STATUS_CONFIG = {
  Draft: { turned: false, color: 'text-cyanline-dim/50 border-cyanline-dim/30', label: 'DRAFT' },
  Funded: { turned: false, color: 'text-brass border-brass/60', label: 'HELD' },
  Disputed: { turned: false, color: 'text-signal-stop border-signal-stop/60', label: 'DISPUTED' },
  Released: { turned: true, color: 'text-signal-go border-signal-go/60', label: 'UNLOCKED' },
  Settled: { turned: true, color: 'text-signal-go border-signal-go/60', label: 'SETTLED' },
  Cancelled: { turned: false, color: 'text-cyanline-dim/40 border-cyanline-dim/20', label: 'CANCELLED' },
}

export default function KeyStatus({ status, size = 'md' }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.Draft
  const dims = size === 'sm' ? 'w-5 h-5' : 'w-7 h-7'

  return (
    <div className="flex items-center gap-2">
      <svg
        viewBox="0 0 24 24"
        className={`${dims} shrink-0 transition-transform duration-500 ${config.turned ? 'key-turn' : ''}`}
        style={{ transform: config.turned ? 'rotate(90deg)' : 'rotate(0deg)' }}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      >
        <circle cx="8" cy="8" r="4" className={config.color.split(' ')[0]} />
        <line x1="11" y1="11" x2="20" y2="20" className={config.color.split(' ')[0]} />
        <line x1="16" y1="16" x2="19" y2="13" className={config.color.split(' ')[0]} />
        <line x1="18" y1="18" x2="21" y2="15" className={config.color.split(' ')[0]} />
      </svg>
      <span
        className={`font-mono text-[10px] uppercase tracking-widest2 px-2 py-1 border-[1.5px] rounded-sm ${config.color}`}
      >
        {config.label}
      </span>
    </div>
  )
}
