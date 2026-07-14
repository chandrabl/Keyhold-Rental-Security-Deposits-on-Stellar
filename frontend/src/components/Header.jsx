export default function Header({ wallet }) {
  const short = (addr) => (addr ? `${addr.slice(0, 4)}…${addr.slice(-4)}` : '')

  return (
    <header className="border-b border-blueprint-line bg-blueprint/80 backdrop-blur sticky top-0 z-30">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded border border-brass/50 flex items-center justify-center">
            <span className="font-display font-bold text-brass text-sm leading-none">K</span>
          </div>
          <div>
            <h1 className="font-display font-bold text-lg sm:text-xl tracking-tight text-cyanline leading-none">
              Keyhold
            </h1>
            <p className="font-mono text-[10px] uppercase tracking-widest2 text-cyanline-dim/60 leading-none mt-1">
              Rental Deposits · Soroban
            </p>
          </div>
        </div>

        <div>
          {wallet.address ? (
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs text-cyanline-dim/70 bg-blueprint-soft px-2 py-1.5 rounded border border-blueprint-line">
                {wallet.balance} XLM
              </span>
              <button
                onClick={wallet.disconnect}
                className="font-mono text-xs sm:text-sm px-3 py-1.5 rounded border border-brass/40 text-brass hover:bg-brass/10 transition-colors"
                title="Click to disconnect"
              >
                {short(wallet.address)}
              </button>
            </div>
          ) : (
            <button
              onClick={wallet.connect}
              disabled={wallet.connecting}
              className="font-mono text-xs sm:text-sm px-3 sm:px-4 py-2 rounded bg-brass text-blueprint font-medium hover:bg-brass-bright transition-colors disabled:opacity-50"
            >
              {wallet.connecting ? 'Connecting…' : 'Connect Wallet'}
            </button>
          )}
        </div>
      </div>
      {!wallet.installed && (
        <div className="bg-signal-stop/10 border-t border-signal-stop/30 text-signal-stop text-xs sm:text-sm text-center py-2 px-4">
          Freighter wallet extension not detected —{' '}
          <a href="https://freighter.app" target="_blank" rel="noreferrer" className="underline">
            install it
          </a>{' '}
          to interact with contracts.
        </div>
      )}
    </header>
  )
}
