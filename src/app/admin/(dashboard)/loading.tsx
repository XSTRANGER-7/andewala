export default function Loading() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading">
      <div className="h-8 w-1/3 animate-pulse rounded-xl bg-mint-100" />
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="h-28 animate-pulse rounded-2xl bg-mint-100/70" />
        <div className="h-28 animate-pulse rounded-2xl bg-mint-100/70" />
        <div className="h-28 animate-pulse rounded-2xl bg-mint-100/70" />
      </div>
      <div className="h-64 animate-pulse rounded-2xl bg-mint-100/50" />
    </div>
  );
}
