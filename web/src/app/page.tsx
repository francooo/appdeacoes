import Link from "next/link";
import { Suspense } from "react";
import { Header } from "@/components/header";
import { PageSkeleton } from "@/components/page-skeleton";
import { ScoreBadge } from "@/components/score-badge";
import { Sparkline } from "@/components/sparkline";
import { requireUser } from "@/lib/auth";
import { getLatestAnalyses, getSparklines, type Analysis } from "@/lib/db";
import {
  actionTone,
  confidenceLabel,
  fmtCompact,
  fmtDateTime,
  fmtPct,
  fmtMoney,
  fmtPrice,
  pick,
  pickNum,
  pickText,
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
  return {
    raw,
    price: pickNum(raw, "current_price"),
    change: pickNum(raw, "change_pct"),
    action: (pick(raw, "action") as string | undefined) ?? (pick(raw, "decision_type") as string | undefined),
    signal: pickText(raw, "dashboard.core_conclusion.signal_type"),
    oneLiner: pickText(raw, "dashboard.core_conclusion.one_sentence") || a.analysis_summary || "",
    confidence: pick(raw, "confidence_level") as string | undefined,
    position: pickText(raw, "dashboard.battle_plan.position_strategy.suggested_position"),
    bullish: pick(raw, "dashboard.data_perspective.trend_status.is_bullish") as boolean | undefined,
    support: pickNum(raw, "dashboard.data_perspective.price_position.support_level"),
    resistance: pickNum(raw, "dashboard.data_perspective.price_position.resistance_level"),
    low: pickNum(raw, "market_snapshot.low"),
    high: pickNum(raw, "market_snapshot.high"),
    volume: pickNum(raw, "market_snapshot.volume"),
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
  const scores = analyses.map((a) => a.sentiment_score).filter((s): s is number => s != null);
  const avg = scores.length ? Math.round(scores.reduce((s, v) => s + v, 0) / scores.length) : null;
  const counts = rows.reduce<Record<string, number>>((acc, { d }) => {
    const label = actionTone(d.action).label;
    acc[label] = (acc[label] ?? 0) + 1;
    return acc;
  }, {});
  const best = rows[0];
  const worst = rows[rows.length - 1];

  return (
    <>
      <Header userName={user.name ?? user.email} active="/" />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Painel do dia</h1>
            <p className="text-sm text-muted">Análise gerada por IA a partir do daily_stock_analysis</p>
          </div>
          {lastUpdate && <p className="text-sm text-muted">Atualizado em {fmtDateTime(lastUpdate)}</p>}
        </div>

        {rows.length === 0 ? (
          <div className="card p-10 text-center">
            <p className="font-medium">Nenhuma análise ainda</p>
            <p className="mt-1 text-sm text-muted">
              Rode o workflow “Análise diária de ações” no GitHub Actions para gerar os primeiros relatórios.
            </p>
          </div>
        ) : (
          <>
            {/* Resumo */}
            <section className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
              <div className="card p-4">
                <p className="text-xs text-muted">Ações analisadas</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums">{rows.length}</p>
              </div>
              <div className="card p-4">
                <p className="text-xs text-muted">Nota média</p>
                <div className="mt-1">
                  <ScoreBadge score={avg} />
                </div>
              </div>
              <div className="card p-4">
                <p className="text-xs text-muted">Maior nota</p>
                <p className="mt-1 font-mono text-lg font-semibold">
                  {best.a.code} <span className="text-emerald-500">{best.a.sentiment_score ?? "—"}</span>
                </p>
              </div>
              <div className="card p-4">
                <p className="text-xs text-muted">Menor nota</p>
                <p className="mt-1 font-mono text-lg font-semibold">
                  {worst.a.code} <span className="text-red-500">{worst.a.sentiment_score ?? "—"}</span>
                </p>
              </div>
            </section>
            <div className="mb-6 flex flex-wrap gap-2 text-xs">
              {Object.entries(counts).map(([label, n]) => (
                <span key={label} className="rounded-full border border-line bg-surface px-3 py-1">
                  {label}: <strong className="tabular-nums">{n}</strong>
                </span>
              ))}
            </div>

            {/* Cards */}
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {rows.map(({ a, d }) => {
                const act = actionTone(d.action);
                return (
                  <Link
                    key={a.code}
                    href={`/acao/${encodeURIComponent(a.code)}`}
                    className="card group flex flex-col gap-3 p-5 transition hover:border-emerald-500/50"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-mono text-lg font-semibold">{a.code}</p>
                        <p className="truncate text-sm text-muted">{a.name}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-mono tabular-nums">{fmtMoney(d.price, d.raw)}</p>
                        <p className={`font-mono text-sm tabular-nums ${(d.change ?? 0) >= 0 ? "text-emerald-500" : "text-red-500"}`}>
                          {fmtPct(d.change)}
                        </p>
                      </div>
                    </div>

                    <Sparkline values={sparks[a.code] ?? []} />

                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <ScoreBadge score={a.sentiment_score} />
                      <span className={`${act.cls} tone-bg rounded-full px-2.5 py-1 text-xs font-semibold`}>{act.label}</span>
                    </div>

                    <div className="flex flex-wrap gap-1.5 text-xs">
                      {a.trend_prediction && (
                        <span className="rounded-md bg-surface-2 px-2 py-0.5">Tendência: {a.trend_prediction}</span>
                      )}
                      <span className="rounded-md bg-surface-2 px-2 py-0.5">Confiança: {confidenceLabel(d.confidence)}</span>
                      {d.bullish != null && (
                        <span className="rounded-md bg-surface-2 px-2 py-0.5">
                          Médias: {d.bullish ? "alinhadas p/ alta" : "sem alinhamento"}
                        </span>
                      )}
                    </div>

                    {d.oneLiner && <p className="line-clamp-3 text-sm text-muted">{d.oneLiner}</p>}

                    <dl className="mt-auto grid grid-cols-3 gap-x-2 gap-y-2 border-t border-line pt-3 text-xs">
                      <Stat label="Compra" value={fmtPrice(a.ideal_buy)} />
                      <Stat label="Stop" value={fmtPrice(a.stop_loss)} />
                      <Stat label="Alvo" value={fmtPrice(a.take_profit)} />
                      <Stat label="Suporte" value={fmtPrice(d.support)} />
                      <Stat label="Resistência" value={fmtPrice(d.resistance)} />
                      <Stat label="Volume" value={fmtCompact(d.volume)} />
                    </dl>
                    {d.position && <p className="text-xs text-muted">{d.position}</p>}
                  </Link>
                );
              })}
            </div>

            {/* Tabela comparativa */}
            <section className="card mt-8 overflow-x-auto">
              <h2 className="px-5 pt-5 text-sm font-semibold">Comparativo</h2>
              <table className="mt-3 w-full min-w-190 text-left text-sm">
                <thead className="text-xs text-muted">
                  <tr className="border-b border-line">
                    {["Ação", "Preço", "Dia", "Mín–Máx do dia", "Nota", "Recomendação", "Tendência", "Compra", "Stop", "Alvo", "Potencial"].map((h) => (
                      <th key={h} className="px-3 py-2 font-medium first:pl-5 last:pr-5">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map(({ a, d }) => {
                    const upside = d.price && a.take_profit ? ((a.take_profit - d.price) / d.price) * 100 : null;
                    return (
                      <tr key={a.code} className="border-b border-line last:border-0 hover:bg-surface-2">
                        <td className="px-3 py-2 pl-5">
                          <Link href={`/acao/${encodeURIComponent(a.code)}`} className="font-mono font-semibold hover:underline">
                            {a.code}
                          </Link>
                        </td>
                        <td className="px-3 py-2 font-mono tabular-nums whitespace-nowrap">{fmtMoney(d.price, d.raw)}</td>
                        <td className={`px-3 py-2 font-mono tabular-nums ${(d.change ?? 0) >= 0 ? "text-emerald-500" : "text-red-500"}`}>
                          {fmtPct(d.change)}
                        </td>
                        <td className="px-3 py-2 font-mono tabular-nums whitespace-nowrap">
                          {fmtPrice(d.low)} – {fmtPrice(d.high)}
                        </td>
                        <td className="px-3 py-2 font-mono">{a.sentiment_score ?? "—"}</td>
                        <td className="px-3 py-2">{actionTone(d.action).label}</td>
                        <td className="px-3 py-2">{a.trend_prediction ?? "—"}</td>
                        <td className="px-3 py-2 font-mono tabular-nums">{fmtPrice(a.ideal_buy)}</td>
                        <td className="px-3 py-2 font-mono tabular-nums">{fmtPrice(a.stop_loss)}</td>
                        <td className="px-3 py-2 font-mono tabular-nums">{fmtPrice(a.take_profit)}</td>
                        <td className={`px-3 py-2 pr-5 font-mono tabular-nums ${(upside ?? 0) >= 0 ? "text-emerald-500" : "text-red-500"}`}>
                          {fmtPct(upside)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </section>
          </>
        )}

        <p className="mt-10 text-xs text-muted">
          Conteúdo gerado automaticamente por IA, apenas para estudo. Não é recomendação de investimento.
        </p>
      </main>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-muted">{label}</dt>
      <dd className="font-mono tabular-nums">{value}</dd>
    </div>
  );
}
