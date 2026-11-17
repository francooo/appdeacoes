import type { Metadata } from "next";
import { Suspense, type ReactNode } from "react";
import { Header } from "@/components/header";
import { ChevronDown } from "@/components/icons";
import { PageSkeleton } from "@/components/page-skeleton";
import { Sparkline } from "@/components/sparkline";
import { Chip, Disclaimer, EmptyState, Kpi, Level, PageHeading, Pill, ScoreChip, SectionTable } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { getLatestSwing, getSparklines, type SwingPick, type SwingRun } from "@/lib/db";
import {
  confidenceLabel,
  fmtCompact,
  fmtDateTime,
  fmtDecimal,
  fmtPct,
  fmtPctAbs,
  fmtPrice,
  fmtRatio,
  posNegClass,
  verdictTone,
} from "@/lib/format";

export const metadata: Metadata = { title: "Swing Trade · Análise de Ações" };

export default function SwingPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Swing />
    </Suspense>
  );
}

const brl = (v: number | null | undefined) => {
  const s = fmtPrice(v);
  return s === "—" ? s : `R$ ${s}`;
};

async function Swing() {
  const user = await requireUser();
  const [data, sparks] = await Promise.all([getLatestSwing(), getSparklines(60)]);

  return (
    <>
      <Header userName={user.name ?? user.email} active="/swing" />
      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-5 px-4 py-8">
        <PageHeading title="Swing Trade · B3">
          {data && (
            <>
              Varredura de <span className="mono">{fmtDateTime(data.run.created_at)}</span>
            </>
          )}
        </PageHeading>

        {!data ? (
          <EmptyState title="Nenhuma varredura ainda">
            O screener roda junto com a análise diária no GitHub Actions.
          </EmptyState>
        ) : (
          <Content run={data.run} picks={data.picks} sparks={sparks} />
        )}

        <Disclaimer>
          Swing trade envolve risco de perda. Critérios técnicos sem backtest e vereditos gerados por IA. Não é
          recomendação de investimento.
        </Disclaimer>
      </main>
    </>
  );
}

function Content({ run, picks, sparks }: { run: SwingRun; picks: SwingPick[]; sparks: Record<string, number[]> }) {
  const selected = picks.filter((p) => p.selected);
  const operar = selected.filter((p) => p.ai?.veredito === "Operar").length;

  return (
    <>
      <section className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3">
        <Kpi label="Ações varridas" hint="universo de ações líquidas">
          <span className="kpi__value">{run.universe_size ?? "—"}</span>
        </Kpi>
        <Kpi label="Passaram no filtro" hint="liquidez ≥ R$ 20 mi/dia">
          <span className="kpi__value">{run.screened ?? "—"}</span>
        </Kpi>
        <Kpi label="Avaliadas pela IA" hint="nota ≥ 55 e com setup">
          <span className="kpi__value">{selected.length}</span>
          <Pill tone="su" size="sm">{operar} Operar</Pill>
        </Kpi>
        <Kpi label="Ibovespa (20 dias)" hint={run.ibov_trend ?? undefined}>
          <span className={`kpi__value ${posNegClass(run.ibov_chg20)}`}>{fmtPct(run.ibov_chg20)}</span>
        </Kpi>
      </section>

      <details className="card px-5 py-3.5">
        <summary className="flex items-center justify-between text-sm font-semibold">
          Como as ações são escolhidas
          <ChevronDown size={16} className="chevron text-muted" />
        </summary>
        <div className="mt-3.5 grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-x-7 gap-y-4 text-[13px] leading-[1.55] text-muted">
          <Explain title="Pontuação (0–100)">
            Tendência (30), momento (30), força relativa contra o Ibovespa (20) e setup (20). Penalidade de −15 para RSI
            acima de 75 e para preço mais de 8% acima da MM20.
          </Explain>
          <Explain title="Setups">
            Rompimento com volume, pullback na MM20 e tendência de alta. Ações sem setup não vão para a IA.
          </Explain>
          <Explain title="Stop e alvos">
            Stop no maior valor entre a mínima de 10 pregões e preço − 2×ATR. Alvo 1 = 2× o risco; alvo 2 = 3× o risco.
          </Explain>
          <Explain title="Tamanho da posição">
            Arrisque no máximo 1% do capital:{" "}
            <span className="mono text-foreground">quantidade = (capital × 1%) ÷ (entrada − stop)</span>
          </Explain>
        </div>
      </details>

      {selected.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-2">
          {selected.map((p) => (
            <PickCard key={p.code} p={p} spark={sparks[p.code] ?? []} />
          ))}
        </div>
      )}

      <SectionTable title={`Ranking completo (top ${picks.length})`} legend="Desempate por força relativa" minWidth={900}>
        <thead>
          <tr>
            <th>#</th>
            <th>Ação</th>
            <th>Setup</th>
            <th className="center">Nota</th>
            <th className="num">Preço</th>
            <th className="num">Stop</th>
            <th className="num">Alvo 2R</th>
            <th className="num">Risco</th>
            <th className="num">RSI</th>
            <th className="num">vs Ibov</th>
            <th className="num">Liquidez</th>
            <th>IA</th>
          </tr>
        </thead>
        <tbody>
          {picks.map((p) => (
            <tr key={p.code}>
              <td className="mono text-muted">{p.rank}</td>
              <td className="mono font-semibold">{p.code}</td>
              <td className="whitespace-nowrap">{p.setup}</td>
              <td className="center"><ScoreChip score={p.score} /></td>
              <td className="num">{fmtPrice(p.price)}</td>
              <td className="num neg">{fmtPrice(p.stop)}</td>
              <td className="num pos">{fmtPrice(p.target)}</td>
              <td className="num">{fmtPctAbs(p.risk_pct)}</td>
              <td className="num">{fmtDecimal(p.rsi)}</td>
              <td className={`num ${posNegClass(p.rs20)}`}>{fmtPct(p.rs20)}</td>
              <td className="num">{fmtCompact(p.fin_volume)}</td>
              <td>
                {p.ai?.veredito ? (
                  <Pill tone={verdictTone(p.ai.veredito)} size="sm">{p.ai.veredito}</Pill>
                ) : (
                  <span className="text-muted">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </SectionTable>
    </>
  );
}

function Explain({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <p className="mb-1 font-semibold text-foreground">{title}</p>
      <p>{children}</p>
    </div>
  );
}

function PickCard({ p, spark }: { p: SwingPick; spark: number[] }) {
  const ai = p.ai;
  const m = (p.metrics ?? {}) as {
    reasons?: string[];
    warnings?: string[];
    dist_ma20_pct?: number;
    vol_ratio?: number;
    atr?: number;
  };
  const pctFrom = (v: number | null) => (p.price && v != null ? ((v - p.price) / p.price) * 100 : null);
  const signals = [...(m.reasons ?? []), ...(m.warnings ?? []).map((w) => `Atenção: ${w}`)];

  return (
    <article className="card flex min-w-0 flex-col gap-3.5 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="mono text-[13px] text-muted">#{p.rank}</span>
            <span className="mono text-lg font-semibold">{p.code}</span>
            {p.setup && <span className="tag">{p.setup}</span>}
          </div>
          {p.name && <p className="mt-0.5 truncate text-[13px] text-muted">{p.name}</p>}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          {ai?.veredito && <Pill tone={verdictTone(ai.veredito)} size="md">{ai.veredito}</Pill>}
          <span className="text-xs text-muted">
            Nota <span className="mono font-semibold text-foreground">{p.score ?? "—"}</span>
            {ai?.confianca && ` · conf. ${confidenceLabel(ai.confianca).toLowerCase()}`}
          </span>
        </div>
      </div>

      <Sparkline values={spark} height={44} />

      <div className="grid grid-cols-4 gap-2">
        <Level label="Entrada" value={brl(p.entry)} />
        <Level label="Stop" value={brl(p.stop)} pct={fmtPct(pctFrom(p.stop))} pctClass="neg" />
        <Level label="Alvo 1" value={brl(p.target)} pct={fmtPct(pctFrom(p.target))} pctClass="pos" />
        <Level label="Alvo 2" value={brl(p.target2)} pct={fmtPct(pctFrom(p.target2))} pctClass="pos" />
      </div>

      <div className="flex flex-wrap gap-1.5">
        <Chip label="RSI" value={fmtDecimal(p.rsi)} />
        <Chip label="ATR" value={m.atr != null ? fmtPrice(m.atr) : fmtPctAbs(p.atr_pct)} />
        <Chip label="vs Ibov" value={fmtPct(p.rs20)} />
        <Chip label="Liquidez" value={p.fin_volume != null ? `R$ ${fmtCompact(p.fin_volume)}` : "—"} />
        <Chip label="Volume" value={fmtRatio(m.vol_ratio)} />
        <Chip label="dist. MM20" value={fmtPct(m.dist_ma20_pct)} />
        <Chip label="Horizonte" value={ai?.horizonte ?? "—"} />
      </div>

      {ai?.tese && (
        <div>
          <p className="mb-1 text-xs text-muted">Tese (IA)</p>
          <p className="text-sm leading-[1.6]">{ai.tese}</p>
        </div>
      )}

      {(ai?.gatilho_entrada || ai?.gestao) && (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-2.5">
          {ai?.gatilho_entrada && <Box title="Gatilho de entrada" text={ai.gatilho_entrada} />}
          {ai?.gestao && <Box title="Gestão" text={ai.gestao} />}
        </div>
      )}

      <details className="border-t border-line pt-3">
        <summary className="flex items-center justify-between text-[13px] font-semibold">
          Checklist, riscos e sinais
          <ChevronDown size={16} className="chevron text-muted" />
        </summary>
        <div className="mt-3 grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3.5 text-[13px] leading-normal">
          <ListBlock title="Checklist" items={ai?.checklist ?? []} />
          <ListBlock title="Riscos" items={ai?.riscos ?? []} />
          <ListBlock title="Sinais a favor" items={signals} />
          <ListBlock title="Notícias consideradas" items={ai?.news ?? []} />
        </div>
      </details>
    </article>
  );
}

function Box({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-lg border border-line p-3 text-[13px] leading-normal">
      <p className="mb-1 text-xs font-semibold text-muted">{title}</p>
      <p>{text}</p>
    </div>
  );
}

function ListBlock({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div>
      <p className="mb-1 text-xs font-semibold text-muted">{title}</p>
      <ul className="list-disc space-y-1 pl-[18px]">
        {items.map((i) => (
          <li key={i}>{i}</li>
        ))}
      </ul>
    </div>
  );
}
