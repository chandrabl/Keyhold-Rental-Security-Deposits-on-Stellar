const STYLES = {
  error: 'border-signal-stop/40 bg-signal-stop/10 text-signal-stop',
  warning: 'border-signal-hold/40 bg-signal-hold/10 text-signal-hold',
  info: 'border-brass/30 bg-brass/5 text-brass',
}

export default function Banner({ type = 'info', children, onDismiss }) {
  return (
    <div className={`border rounded-lg px-4 py-3 text-sm flex items-start justify-between gap-3 ${STYLES[type]}`}>
      <p className="leading-relaxed">{children}</p>
      {onDismiss && (
        <button onClick={onDismiss} className="shrink-0 opacity-60 hover:opacity-100" aria-label="Dismiss">
          ×
        </button>
      )}
    </div>
  )
}
