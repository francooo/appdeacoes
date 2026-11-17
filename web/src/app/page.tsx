import Link from "next/link";
import { Suspense } from "react";
import { Header } from "@/components/header";
import { PageSkeleton } from "@/components/page-skeleton";
import { ScoreBadge } from "@/components/score-badge";
import { Sparkline } from "@/components/sparkline";
import { Chip, Disclaimer, EmptyState, Kpi, PageHeading, Pill, ScoreChip, SectionTable } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { getLatestAnalyses, getSparklines, type Analysis } from "@/lib/db";
import {
  ACTION_ORDER,
  actionTone,
  confidenceLabel,
  fmtDateTime,
  fmtMoney,
  fmtPct,
  fmtPrice,
  fmtRatio,
  pick,
  pickNum,
  pickText,
  posNegClass,
  scoreTone,
} from "@/lib/format";

export default function Home() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Dashboard />
    </Suspense>
  );
}

function rowData(a: Analysis) {
  const raw = a.raw_result ?? {};
  const dp = "dashboard.data_perspective";
  return {
    raw,
    price: pickNum(raw, "current_price"),
    change: pickNum(raw, "change_pct"),
    action: actionTone((pick(raw, "action") as string) ?? (pick(raw, "decision_type") as string)),
    oneLiner: pickText(raw, "dashboard.core_conclusion.one_sentence") || a.analysis_summary || "",
    confidence: confidenceLabel(pick(raw, "confidence_level") as string),
    position: pickText(raw, "dashboard.battle_plan.position_strategy.suggested_position"),
    bullish: pick(raw, `${dp}.trend_status.is_bullish`) as boolean | undefined,
    support: pickNum(raw, `${dp}.price_position.support_level`),
    resistance: pickNum(raw, `${dp}.price_position.resistance_level`),
    low: pickNum(raw, "market_snapshot.low"),
    high: pickNum(raw, "market_snapshot.high"),
    volRatio: pickNum(raw, "market_snapshot.volume_ratio") ?? pickNum(raw, `${dp}.volume_analysis.volume_ratio`),
  };
}

async function Dashboard() {
  const user = await requireUser();
  const [analyses, sparks] = await Promise.all([getLatestAnalyses(), getSparklines(30)]);
  const rows = analyses.map((a) => ({ a, d: rowData(a) }));

  const lastUpdate = analyses.reduce<string | null>(
    (max, a) => (!max || a.created_at > max ? a.created_at : max),
    null,
  );

  return (
    <>
      <Header userName={user.name ?? user.email} active="/" />
      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-5 px-4 py-8">
        <PageHeading title="Painel do dia">
          {lastUpdate && (
            <>
              Atualizado em <span className="mono">{fmtDateTime(lastUpdate)}</span>
            </>
          )}
        </PageHeading>

        {rows.length === 0 ? (
          <EmptyState title="Nenhuma análise ainda">
            Rode o workflow “Análise diária de ações” no GitHub Actions para gerar os primeiros relatórios.
          </EmptyState>
        ) : (
          <>
            <Summary rows={rows} />

            <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,340px),1fr))] gap-4">
              {rows.map(({ a, d }) => (
                <StockCard key={a.code} a={a} d={d} spark={sparks[a.code] ?? []} />
              ))}
            </div>

            <Comparison rows={rows} />
          </>
        )}

        <Disclaimer>
          Conteúdo gerado por IA a partir de dados do Yahoo Finance. Não é recomendação de investimento.
        </Disclaimer>
      </main>
    </>
  );
}

type Row = { a: Analysis; d: ReturnType<typeof rowData> };

function Summary({ rows }: { rows: Row[] }) {
  const scores = rows.map((r) => r.a.sentiment_score).filter((s): s is number => s != null);
  const avg = scores.length ? Math.round(scores.reduce((s, v) => s + v, 0) / scores.length) : null;
  const best = rows[0];
  const worst = rows[rows.length - 1];

  const counts = new Map<string, { label: string; tone: ReturnType<typeof actionTone>["tone"]; n: number }>();
  for (const { d } of rows) {
    const c = counts.get(d.action.key) ?? { label: d.action.label, tone: d.action.tone, n: 0 };
    c.n += 1;
    counts.set(d.action.key, c);
  }
  const ordered = [...counts.entries()].sort(
    ([a], [b]) => (ACTION_ORDER.indexOf(a) + 1 || 99) - (ACTION_ORDER.indexOf(b) + 1 || 99),
  );

  return (
    <>
      <section className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3">
        <Kpi label="Ações analisadas">
          <span className="kpi__value">{rows.length}</span>
        </Kpi>
        <Kpi label="Nota média">
          <span className="kpi__value">{avg ?? "—"}</span>
          {avg != null && <Pill tone={scoreTone(avg).tone} size="sm">{scoreTone(avg).label}</Pill>}
        </Kpi>
        <ExtremeKpi label="Maior nota" row={best} />
        <ExtremeKpi label="Menor nota" row={worst} />
      </section>

      <div className="flex flex-wrap gap-2">
        {ordered.map(([key, c]) => (
          <span key={key} className={`pill ${c.tone} tone-bg px-3 py-[5px] text-[13px] font-medium`}>
            {c.label}: <span className="mono font-bold">{c.n}</span>
          </span>
        ))}
      </div>
    </>
  );
}

function ExtremeKpi({ label, row }: { label: string; row: Row }) {
  const tone = scoreTone(row.a.sentiment_score).tone;
  return (
    <Kpi label={label}>
      <span className="flex items-baseline gap-2.5">
        <span className={`kpi__value ${tone} tone-fg`}>{row.a.sentiment_score ?? "—"}</span>
        <span className="mono text-[13px] text-muted">{row.a.code}</span>
      </span>
    </Kpi>
  );
}

function StockCard({ a, d, spark }: { a: Analysis; d: Row["d"]; spark: number[] }) {
  return (
    <Link href={`/acao/${encodeURIComponent(a.code)}`} className="card card--link flex flex-col gap-3.5 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="mono text-base font-semibold">{a.code}</p>
          <p className="mt-0.5 truncate text-xs text-muted">{a.name}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="mono text-base font-semibold">{fmtMoney(d.price, d.raw)}</p>
          <p className={`mono mt-0.5 text-xs ${posNegClass(d.change)}`}>{fmtPct(d.change)}</p>
        </div>
      </div>

      <Sparkline values={spark} height={40} />

      <div className="flex items-center gap-2.5">
        <ScoreBadge score={a.sentiment_score} showLabel />
        <Pill tone={d.action.tone} className="ml-auto">{d.action.label}</Pill>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {a.trend_prediction && <Chip label="Tendência:" value={<span className="font-sans">{a.trend_prediction}</span>} />}
        <Chip label="Confiança:" value={<span className="font-sans">{d.confidence}</span>} />
        {d.bullish != null && <Chip label={d.bullish ? "Médias alinhadas (alta)" : "Médias sem alinhamento"} />}
      </div>

      {d.oneLiner && <p className="line-clamp-3 text-[13px] leading-[1.55] text-muted">{d.oneLiner}</p>}

      <dl className="mt-auto grid grid-cols-3 gap-x-3 gap-y-2.5 border-t border-line pt-3">
        <Stat label="Compra" value={fmtPrice(a.ideal_buy)} strong />
        <Stat label="Stop" value={fmtPrice(a.stop_loss)} strong cls="neg" />
        <Stat label="Alvo" value={fmtPrice(a.take_profit)} strong cls="pos" />
        <Stat label="Suporte" value={fmtPrice(d.support)} />
        <Stat label="Resistência" value={fmtPrice(d.resistance)} />
        <Stat label="Volume" value={fmtRatio(d.volRatio)} />
      </dl>

      {d.position && (
        <p className="text-xs text-muted">
          Posição sugerida: <span className="font-medium text-foreground">{d.position}</span>
        </p>
      )}
    </Link>
  );
}

function Stat({ label, value, strong, cls = "" }: { label: string; value: string; strong?: boolean; cls?: string }) {
  return (
    <div>
      <dt className="stat__label">{label}</dt>
      <dd className={`stat__value ${strong ? "font-medium" : ""} ${value === "—" ? "" : cls}`}>{value}</dd>
    </div>
  );
}

function Comparison({ rows }: { rows: Row[] }) {
  return (
    <SectionTable title="Comparativo" legend="Potencial = (alvo − preço) ÷ preço" minWidth={760}>
      <thead>
        <tr>
          <th>Ação</th>
          <th className="num">Preço</th>
          <th className="num">Dia</th>
          <th className="num">Mín–Máx</th>
          <th className="center">Nota</th>
          <th>Recomendação</th>
          <th>Tendência</th>
          <th className="num">Compra</th>
          <th className="num">Stop</th>
          <th className="num">Alvo</th>
          <th className="num">Potencial</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(({ a, d }) => {
          const upside = d.price && a.take_profit ? ((a.take_profit - d.price) / d.price) * 100 : null;
          return (
            <tr key={a.code}>
              <td>
                <Link
                  href={`/acao/${encodeURIComponent(a.code)}`}
                  className="mono font-semibold underline decoration-line underline-offset-[3px]"
                >
                  {a.code}
                </Link>
              </td>
              <td className="num">{fmtMoney(d.price, d.raw)}</td>
              <td className={`num ${posNegClass(d.change)}`}>{fmtPct(d.change)}</td>
              <td className="num text-muted">
                {d.low != null && d.high != null ? `${fmtPrice(d.low)} – ${fmtPrice(d.high)}` : "—"}
              </td>
              <td className="center"><ScoreChip score={a.sentiment_score} /></td>
              <td><Pill tone={d.action.tone} size="sm">{d.action.label}</Pill></td>
              <td>{a.trend_prediction ?? "—"}</td>
              <td className="num">{fmtPrice(a.ideal_buy)}</td>
              <td className="num neg">{fmtPrice(a.stop_loss)}</td>
              <td className="num pos">{fmtPrice(a.take_profit)}</td>
              <td className={`num font-semibold ${posNegClass(upside)}`}>{fmtPct(upside)}</td>
            </tr>
          );
        })}
      </tbody>
    </SectionTable>
  );
}
