import type { DailyBar } from "@/lib/db";
import { fmtIsoDay, fmtPrice } from "@/lib/format";

const W = 720;
const H = 240;
const PLOT_W = 672;
const TOP = 10;
const BOT = 210;

const SERIES = [
  { key: "ma20", label: "MM20", color: "#fbbf24", width: 1.5 },
  { key: "ma5", label: "MM5", color: "#38bdf8", width: 1.5 },
  { key: "close", label: "Fechamento", color: "#10b981", width: 2.2 },
] as const;

/** Legenda para o cabeçalho do cartão do gráfico. */
export function ChartLegend() {
  return (
    <div className="flex flex-wrap gap-3.5 text-xs text-muted">
      {[...SERIES].reverse().map((s) => (
        <span key={s.key} className="inline-flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-3.5 rounded" style={{ background: s.color }} />
          {s.label}
        </span>
      ))}
    </div>
  );
}

export function PriceChart({ bars }: { bars: DailyBar[] }) {
  const values = bars.flatMap((b) =>
    SERIES.map((s) => b[s.key]).filter((v): v is number => typeof v === "number"),
  );
  if (bars.length < 2 || values.length === 0) {
    return <p className="text-[13px] text-muted">Sem histórico de cotações suficiente.</p>;
  }

  const lo = Math.min(...values) * 0.995;
  const hi = Math.max(...values) * 1.005;
  const x = (i: number) => (i / (bars.length - 1)) * PLOT_W;
  const y = (v: number) => TOP + (1 - (v - lo) / (hi - lo)) * (BOT - TOP);
  const points = (key: (typeof SERIES)[number]["key"]) =>
    bars
      .map((b, i) => (typeof b[key] === "number" ? `${x(i).toFixed(1)},${y(b[key] as number).toFixed(1)}` : null))
      .filter(Boolean)
      .join(" ");

  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const ticks = [rawMax * 0.998, (rawMax + rawMin) / 2, rawMin * 1.002];

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      className="block h-auto overflow-visible"
      role="img"
      aria-label={`Gráfico de preço de ${fmtIsoDay(bars[0].date)} a ${fmtIsoDay(bars[bars.length - 1].date)}`}
    >
      {ticks.map((t) => (
        <g key={t}>
          <line x1={0} x2={PLOT_W} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeDasharray="4 4" />
          <text x={W} y={y(t)} dy={4} textAnchor="end" className="mono" fontSize={11} fill="var(--muted)">
            {fmtPrice(t)}
          </text>
        </g>
      ))}
      {SERIES.map((s) => (
        <polyline
          key={s.key}
          points={points(s.key)}
          fill="none"
          stroke={s.color}
          strokeWidth={s.width}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      ))}
      <text x={0} y={236} className="mono" fontSize={11} fill="var(--muted)">
        {fmtIsoDay(bars[0].date)}
      </text>
      <text x={PLOT_W} y={236} textAnchor="end" className="mono" fontSize={11} fill="var(--muted)">
        {fmtIsoDay(bars[bars.length - 1].date)}
      </text>
    </svg>
  );
}
