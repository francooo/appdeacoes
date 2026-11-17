export function PageSkeleton() {
  return (
    <div aria-busy="true" aria-label="Carregando">
      <div className="h-[57px] border-b border-line bg-surface" />
      <main className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 py-8">
        <div className="skeleton h-8 w-48" />
        <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="skeleton h-24 rounded-xl" />
          ))}
        </div>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,340px),1fr))] gap-4">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="skeleton h-72 rounded-xl" />
          ))}
        </div>
      </main>
    </div>
  );
}
