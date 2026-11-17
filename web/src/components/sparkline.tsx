const W = 300;
const H = 40;

/** Minigráfico: verde se o período subiu, vermelho se caiu; área com 10% de opacidade. */
export function Sparkline({ values, height = 40 }: { values: number[]; height?: number }) {
  if (values.length < 2) return <div style={{ height }} />;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => [
    (i / (values.length - 1)) * W,
    H - 3 - ((v - min) / span) * (H - 6),
  ]);
  const line = pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const color = values[values.length - 1] >= values[0] ? "#10b981" : "#ef4444";
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      width="100%"
      height={height}
      className="block"
      aria-hidden
    >
      <path d={`M0,${H} L${line.replaceAll(" ", " L")} L${W},${H} Z`} fill={color} fillOpacity={0.1} />
      <polyline points={line} fill="none" stroke={color} strokeWidth={1.6} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
