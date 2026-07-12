export default function LeaseCardSkeleton() {
  return (
    <div className="bg-blueprint-soft border border-blueprint-line rounded-lg p-4 sm:p-5 animate-pulse">
      <div className="h-3 w-24 bg-blueprint-line rounded mb-3" />
      <div className="h-5 w-32 bg-blueprint-line rounded mb-4" />
      <div className="h-16 bg-blueprint-line/60 rounded" />
    </div>
  )
}
