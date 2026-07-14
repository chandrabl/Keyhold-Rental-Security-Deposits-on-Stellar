export default function Hero() {
  return (
    <section className="max-w-5xl mx-auto px-4 sm:px-6 pt-10 sm:pt-16 pb-8 sm:pb-10">
      <p className="font-mono text-[11px] uppercase tracking-widest2 text-brass mb-4">
        No landlord holds the keys to the money
      </p>
      <h2 className="font-display font-bold text-3xl sm:text-5xl leading-[1.05] text-cyanline max-w-2xl">
        Security deposits that{' '}
        <span className="text-brass">release on schedule</span> — or go to
        an inspector, not a landlord&apos;s discretion.
      </h2>
      <p className="mt-5 text-cyanline-dim/80 max-w-xl text-sm sm:text-base leading-relaxed">
        A tenant funds a deposit for a fixed lease term. If the landlord
        files no damage claim within the claim window after move-out, the
        deposit releases automatically. If they do, a separate Inspection
        contract — not the landlord — decides how much is actually
        forfeited.
      </p>
    </section>
  )
}
