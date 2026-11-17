import type { DailyBar } from "@/lib/db";

const W = 720;
const H = 220;
const PAD = { top: 12, right: 12, bottom: 24, left: 48 };

type Line = { key: keyof DailyBar; label: string; cls: string };
const LINES: Line[] = [
  { key: "close", label: "Fechamento", cls: "stroke-emerald-500" },
  { key: "ma5", label: "MM5", cls: "stroke-sky-400" },
  { key: "ma20", label: "MM20", cls: "stroke-amber-400" },
];

export function PriceChart({ bars }: { bars: DailyBar[] }) {
  const values = bars.flatMap((b) =>
    LINES.map((l) => b[l.key]).filter((v): v is number => typeof v === "number"),
  );
  if (bars.length < 2 || values.length === 0) {
    return <p className="text-sm text-muted">Sem histórico de cotações suficiente.</p>;
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const x = (i: number) => PAD.left + (i / (bars.length - 1)) * (W - PAD.left - PAD.right);
  const y = (v: number) => PAD.top + (1 - (v - min) / span) * (H - PAD.top - PAD.bottom);

  const path = (key: keyof DailyBar) =>
    bars
      .map((b, i) => {
        const v = b[key];
        return typeof v === "number" ? `${x(i).toFixed(1)},${y(v).toFixed(1)}` : null;
      })
      .filter(Boolean)
      .map((p, i) => `${i === 0 ? "M" : "L"}${p}`)
      .join(" ");

  const ticks = [min, min + span / 2, max];

  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Gráfico de preço">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} className="stroke-line" strokeDasharray="3 4" />
            <text x={PAD.left - 6} y={y(t) + 4} textAnchor="end" className="fill-muted font-mono text-[11px]">
              {t.toFixed(2)}
            </text>
          </g>
        ))}
        <text x={PAD.left} y={H - 6} className="fill-muted font-mono text-[11px]">
          {bars[0].date}
        </text>
        <text x={W - PAD.right} y={H - 6} textAnchor="end" className="fill-muted font-mono text-[11px]">
          {bars[bars.length - 1].date}
        </text>
        {LINES.map((l) => (
          <path key={l.key} d={path(l.key)} fill="none" strokeWidth={l.key === "close" ? 2 : 1.25} className={l.cls} />
        ))}
      </svg>
      <figcaption className="mt-2 flex gap-4 text-xs text-muted">
        {LINES.map((l) => (
          <span key={l.key} className="flex items-center gap-1.5">
            <svg width="14" height="4" aria-hidden>
              <line x1="0" x2="14" y1="2" y2="2" strokeWidth="2" className={l.cls} />
            </svg>
            {l.label}
          </span>
        ))}
      </figcaption>
    </figure>
  );
}
