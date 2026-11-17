export function PageSkeleton() {
  return (
    <div className="animate-pulse" aria-busy="true" aria-label="Carregando">
      <div className="h-14 border-b border-line" />
      <main className="mx-auto w-full max-w-6xl px-4 py-8">
        <div className="mb-6 h-8 w-48 rounded bg-surface-2" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="card h-56" />
          ))}
        </div>
      </main>
    </div>
  );
}
