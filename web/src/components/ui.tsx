import type { ReactNode } from "react";
import { ChartLine } from "@/components/icons";
import type { Tone } from "@/lib/format";
import { scoreTone } from "@/lib/format";

/** Peças de UI do design system (docs/design/design-system/componentes.html). */

export function Pill({
  tone,
  size = "default",
  className = "",
  children,
}: {
  tone: Tone;
  size?: "sm" | "default" | "md";
  className?: string;
  children: ReactNode;
}) {
  const sz = size === "md" ? "pill--md" : size === "sm" ? "pill--sm" : "";
  return <span className={`pill ${sz} ${tone} tone-bg ${className}`}>{children}</span>;
}

export function Chip({ label, value }: { label: string; value?: ReactNode }) {
  return (
    <span className="chip">
      {label}
      {value !== undefined && <b>{value}</b>}
    </span>
  );
}

export function Kpi({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="kpi">
      <p className="kpi__label">{label}</p>
      <div className="mt-1.5 flex flex-wrap items-center gap-2.5">{children}</div>
      {hint && <p className="kpi__hint">{hint}</p>}
    </div>
  );
}

export function Level({
  label,
  value,
  pct,
  pctClass = "",
}: {
  label: string;
  value: string;
  pct?: string;
  pctClass?: string;
}) {
  return (
    <div className="level">
      <p className="level__label">{label}</p>
      <p className="level__value truncate">{value}</p>
      {pct && <p className={`level__pct ${pctClass}`}>{pct}</p>}
    </div>
  );
}

/** Selo da nota usado em tabelas. */
export function ScoreChip({ score }: { score: number | null }) {
  if (score == null) return <span className="text-muted">—</span>;
  return <span className={`score-chip ${scoreTone(score).tone} tone-bg`}>{score}</span>;
}

export function Card({
  title,
  aside,
  className = "",
  children,
}: {
  title?: string;
  aside?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={`card p-5 ${className}`}>
      {(title || aside) && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          {title && <h2 className="card-title">{title}</h2>}
          {aside}
        </div>
      )}
      {children}
    </section>
  );
}

/** Cartão com cabeçalho e tabela rolável. */
export function SectionTable({
  title,
  legend,
  minWidth,
  children,
}: {
  title: string;
  legend?: string;
  minWidth: number;
  children: ReactNode;
}) {
  return (
    <section className="card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-5 py-4">
        <h2 className="card-title">{title}</h2>
        {legend && <p className="text-xs text-muted">{legend}</p>}
      </div>
      <div className="table-wrap">
        <table className="table" style={{ minWidth }}>
          {children}
        </table>
      </div>
    </section>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="card flex flex-col items-center gap-2 px-6 py-12 text-center">
      <ChartLine size={28} className="text-muted opacity-50" />
      <p className="font-semibold">{title}</p>
      {children && <p className="max-w-md text-[13px] text-muted">{children}</p>}
    </div>
  );
}

export function Disclaimer({ children }: { children: ReactNode }) {
  return <p className="mt-2 text-center text-xs leading-relaxed text-muted">{children}</p>;
}

/** Título de página + informação à direita. */
export function PageHeading({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-2">
      <h1 className="page-title">{title}</h1>
      {children && <p className="text-[13px] text-muted">{children}</p>}
    </div>
  );
}
