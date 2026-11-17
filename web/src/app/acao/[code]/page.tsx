import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { Header } from "@/components/header";
import { PageSkeleton } from "@/components/page-skeleton";
import { PriceChart } from "@/components/price-chart";
import { ScoreBadge } from "@/components/score-badge";
import { requireUser } from "@/lib/auth";
import { getAnalysesForCode, getDailyBars } from "@/lib/db";
import {
  actionTone,
  confidenceLabel,
  fmtCompact,
  fmtDateTime,
  fmtPct,
  fmtMoney,
  fmtPrice,
  pick,
  pickList,
  pickNum,
  pickText,
  recommendationLabel,
} from "@/lib/format";

/** Textos do relatório exibidos como seções na parte de baixo. */
const SECTIONS: { key: string; title: string }[] = [
  { key: "key_points", title: "Pontos-chave" },
  { key: "buy_reason", title: "Justificativa" },
  { key: "risk_warning", title: "Riscos" },
  { key: "short_term_outlook", title: "Curto prazo (1–3 dias)" },
  { key: "medium_term_outlook", title: "Médio prazo (1–2 semanas)" },
  { key: "trend_analysis", title: "Tendência" },
  { key: "technical_analysis", title: "Análise técnica" },
  { key: "ma_analysis", title: "Médias móveis" },
  { key: "volume_analysis", title: "Volume" },
  { key: "pattern_analysis", title: "Padrões de candles" },
  { key: "fundamental_analysis", title: "Fundamentos" },
  { key: "company_highlights", title: "Destaques da empresa" },
  { key: "sector_position", title: "Setor" },
  { key: "news_summary", title: "Notícias" },
  { key: "market_sentiment", title: "Sentimento do mercado" },
  { key: "hot_topics", title: "Temas em alta" },
];

const ATTRIBUTION: { key: string; label: string }[] = [
  { key: "technical_indicators", label: "Indicadores técnicos" },
  { key: "fundamentals", label: "Fundamentos" },
  { key: "market_conditions", label: "Condições de mercado" },
  { key: "news_sentiment", label: "Notícias / sentimento" },
];

export default function StockPage({ params }: PageProps<"/acao/[code]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <StockDetail params={params} />
    </Suspense>
  );
}

async function StockDetail({ params }: { params: Promise<{ code: string }> }) {
  const user = await requireUser();
  const code = decodeURIComponent((await params).code);
  const [history, bars] = await Promise.all([getAnalysesForCode(code), getDailyBars(code)]);
  if (history.length === 0) notFound();

  const latest = history[0];
  const raw = latest.raw_result ?? {};
  const dash = "dashboard";
  const price = pickNum(raw, "current_price");
  const change = pickNum(raw, "change_pct");
  const act = actionTone((pick(raw, "action") as string) ?? (pick(raw, "decision_type") as string));
  const sections = SECTIONS.map((s) => ({ ...s, text: pickText(raw, s.key) })).filter((s) => s.text);

  const checklist = pickList(raw, `${dash}.battle_plan.action_checklist`);
  const watchConditions = pickList(raw, `${dash}.phase_decision.watch_conditions`);
  const limitations = pickList(raw, `${dash}.phase_decision.data_limitations`);
  const catalysts = pickList(raw, `${dash}.intelligence.positive_catalysts`);
  const riskAlerts = pickList(raw, `${dash}.intelligence.risk_alerts`);
  const rawScore = pickNum(raw, `${dash}.decision_score_calibration.raw_score`);
  const adjusted = pickNum(raw, `${dash}.decision_score_calibration.adjusted_score`);
  const guardrail = pickText(raw, `${dash}.decision_score_calibration.guardrail_reason`);

  const snapshot: [string, string][] = [
    ["Abertura", fmtPrice(pickNum(raw, "market_snapshot.open"))],
    ["Máxima", fmtPrice(pickNum(raw, "market_snapshot.high"))],
    ["Mínima", fmtPrice(pickNum(raw, "market_snapshot.low"))],
    ["Fech. anterior", fmtPrice(pickNum(raw, "market_snapshot.prev_close"))],
    ["Amplitude", fmtPct(pickNum(raw, "market_snapshot.amplitude"))],
    ["Volume", fmtCompact(pickNum(raw, "market_snapshot.volume"))],
  ];
  const technicals: [string, string][] = [
    ["MM5", fmtPrice(pickNum(raw, `${dash}.data_perspective.price_position.ma5`))],
    ["MM10", fmtPrice(pickNum(raw, `${dash}.data_perspective.price_position.ma10`))],
    ["MM20", fmtPrice(pickNum(raw, `${dash}.data_perspective.price_position.ma20`))],
    ["Desvio da MM5", fmtPct(pickNum(raw, `${dash}.data_perspective.price_position.bias_ma5`))],
    ["Suporte", fmtPrice(pickNum(raw, `${dash}.data_perspective.price_position.support_level`))],
    ["Resistência", fmtPrice(pickNum(raw, `${dash}.data_perspective.price_position.resistance_level`))],
    ["Força da tendência", String(pickNum(raw, `${dash}.data_perspective.trend_status.trend_score`) ?? "—")],
    ["Volume", pickText(raw, `${dash}.data_perspective.volume_analysis.volume_status`) || "—"],
  ];
  if (pick(raw, "technicals")) {
    technicals.push(
      ["RSI (14)", String(pickNum(raw, "technicals.rsi14") ?? "—")],
      ["MACD", `${pickNum(raw, "technicals.macd") ?? "—"} / sinal ${pickNum(raw, "technicals.macd_signal") ?? "—"}`],
      ["MM60", fmtPrice(pickNum(raw, "technicals.ma60"))],
      ["Var. 5 dias", fmtPct(pickNum(raw, "technicals.chg_5d"))],
      ["Var. 20 dias", fmtPct(pickNum(raw, "technicals.chg_20d"))],
      ["Var. 60 dias", fmtPct(pickNum(raw, "technicals.chg_60d"))],
      ["Máx. 52 sem.", fmtPrice(pickNum(raw, "technicals.high_52w"))],
      ["Mín. 52 sem.", fmtPrice(pickNum(raw, "technicals.low_52w"))],
    );
  }
  const fundamentals: [string, string][] | null = pick(raw, "fundamentals")
    ? [
        ["Setor", pickText(raw, "fundamentals.sector") || "—"],
        ["Indústria", pickText(raw, "fundamentals.industry") || "—"],
        ["Valor de mercado", fmtCompact(pickNum(raw, "fundamentals.market_cap"))],
        ["P/L", fmtPrice(pickNum(raw, "fundamentals.pe"))],
        ["P/L projetado", fmtPrice(pickNum(raw, "fundamentals.forward_pe"))],
        ["P/VP", fmtPrice(pickNum(raw, "fundamentals.pb"))],
        ["ROE", fmtPct(pickNum(raw, "fundamentals.roe")).replace("+", "")],
        ["Dividend yield", fmtPct(pickNum(raw, "fundamentals.dividend_yield")).replace("+", "")],
        ["Consenso analistas", `${recommendationLabel(pick(raw, "fundamentals.recommendation"))}${pickNum(raw, "fundamentals.analysts") ? ` (${pickNum(raw, "fundamentals.analysts")})` : ""}`],
        ["Preço-alvo médio", fmtMoney(pickNum(raw, "fundamentals.target_mean"), raw)],
      ]
    : null;
  const newsItems = (Array.isArray(pick(raw, "news")) ? (pick(raw, "news") as { title: string; date?: string; publisher?: string }[]) : []).filter((n) => n?.title);

  return (
    <>
      <Header userName={user.name ?? user.email} />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8">
        <Link href="/" className="text-sm text-muted hover:text-foreground">
          ← Voltar ao painel
        </Link>

        {/* Cabeçalho */}
        <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-mono text-3xl font-semibold">{latest.code}</h1>
            <p className="text-muted">{latest.name}</p>
            <p className="mt-1 text-xs text-muted">
              Análise de {fmtDateTime(latest.created_at)}
              {pickText(raw, "model_used") && ` · modelo ${pickText(raw, "model_used")}`}
            </p>
          </div>
          <div className="text-right">
            <p className="font-mono text-2xl tabular-nums">{fmtMoney(price, raw)}</p>
            <p className={`font-mono tabular-nums ${(change ?? 0) >= 0 ? "text-emerald-500" : "text-red-500"}`}>
              {fmtPct(change)}
            </p>
          </div>
        </div>

        {/* Conclusão */}
        <section className="mt-6 grid gap-4 lg:grid-cols-3">
          <div className="card space-y-4 p-5 lg:col-span-2">
            <div className="flex flex-wrap items-center gap-4">
              <ScoreBadge score={latest.sentiment_score} large />
              <span className={`${act.cls} tone-bg rounded-full px-3 py-1 text-sm font-semibold`}>{act.label}</span>
              <div className="text-sm">
                <p><span className="text-muted">Recomendação: </span><strong>{latest.operation_advice ?? "—"}</strong></p>
                <p><span className="text-muted">Tendência: </span>{latest.trend_prediction ?? "—"}</p>
                <p><span className="text-muted">Confiança: </span>{confidenceLabel(pick(raw, "confidence_level") as string)}</p>
              </div>
            </div>
            {pickText(raw, `${dash}.core_conclusion.one_sentence`) && (
              <p className="rounded-lg bg-surface-2 p-3 text-sm font-medium">
                {pickText(raw, `${dash}.core_conclusion.one_sentence`)}
              </p>
            )}
            {latest.analysis_summary && <p className="leading-relaxed whitespace-pre-line">{latest.analysis_summary}</p>}
            <div className="grid gap-3 sm:grid-cols-2">
              <Advice title="Se você não tem a ação" text={pickText(raw, `${dash}.core_conclusion.position_advice.no_position`)} />
              <Advice title="Se você já tem a ação" text={pickText(raw, `${dash}.core_conclusion.position_advice.has_position`)} />
            </div>
          </div>

          <div className="card p-5">
            <h2 className="mb-3 text-sm font-semibold">Pontos de entrada e saída</h2>
            <dl className="space-y-2 text-sm">
              {[
                ["Compra ideal", latest.ideal_buy],
                ["Compra secundária", latest.secondary_buy],
                ["Stop loss", latest.stop_loss],
                ["Alvo (take profit)", latest.take_profit],
              ].map(([label, v]) => (
                <div key={label as string} className="flex justify-between border-b border-line pb-2 last:border-0">
                  <dt className="text-muted">{label}</dt>
                  <dd className="font-mono tabular-nums">{fmtPrice(v as number | null)}</dd>
                </div>
              ))}
            </dl>
            {price && latest.take_profit && latest.stop_loss && (
              <p className="mt-3 text-xs text-muted">
                Potencial até o alvo:{" "}
                <span className="font-mono text-emerald-500">{fmtPct(((latest.take_profit - price) / price) * 100)}</span>
                {" · "}Risco até o stop:{" "}
                <span className="font-mono text-red-500">{fmtPct(((latest.stop_loss - price) / price) * 100)}</span>
              </p>
            )}
            <div className="mt-4 space-y-2 border-t border-line pt-4 text-sm">
              <Field label="Posição sugerida" text={pickText(raw, `${dash}.battle_plan.position_strategy.suggested_position`)} />
              <Field label="Plano de entrada" text={pickText(raw, `${dash}.battle_plan.position_strategy.entry_plan`)} />
              <Field label="Controle de risco" text={pickText(raw, `${dash}.battle_plan.position_strategy.risk_control`)} />
            </div>
          </div>
        </section>

        {/* Gráfico + pregão */}
        <section className="mt-4 grid gap-4 lg:grid-cols-3">
          <div className="card p-5 lg:col-span-2">
            <h2 className="mb-3 text-sm font-semibold">Preço — últimos {bars.length} pregões</h2>
            <PriceChart bars={bars} />
          </div>
          <div className="card p-5">
            <h2 className="mb-3 text-sm font-semibold">Pregão</h2>
            <KeyValues items={snapshot} />
            <h2 className="mt-5 mb-3 text-sm font-semibold">Indicadores</h2>
            <KeyValues items={technicals} />
          </div>
        </section>

        {/* Plano de ação + composição da nota */}
        <section className="mt-4 grid gap-4 lg:grid-cols-3">
          <Panel title="Checklist da operação">
            {checklist.length ? (
              <ul className="space-y-1.5 text-sm">
                {checklist.map((c) => <li key={c}>{c}</li>)}
              </ul>
            ) : <Empty />}
          </Panel>

          <Panel title="O que fazer agora">
            <div className="space-y-2 text-sm">
              <Field label="Ação imediata" text={pickText(raw, `${dash}.phase_decision.immediate_action`)} />
              <Field label="Próxima checagem" text={pickText(raw, `${dash}.phase_decision.next_check_time`)} />
              {watchConditions.length > 0 && (
                <div>
                  <p className="text-xs text-muted">Condições para acompanhar</p>
                  <ul className="mt-1 list-disc space-y-1 pl-4">
                    {watchConditions.map((w) => <li key={w}>{w}</li>)}
                  </ul>
                </div>
              )}
            </div>
          </Panel>

          <Panel title="Composição da nota">
            <div className="space-y-2.5">
              {ATTRIBUTION.map(({ key, label }) => {
                const v = pickNum(raw, `${dash}.signal_attribution.${key}`) ?? 0;
                return (
                  <div key={key}>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted">{label}</span>
                      <span className="font-mono">{v}%</span>
                    </div>
                    <div className="mt-1 h-1.5 rounded-full bg-surface-2">
                      <div className="h-1.5 rounded-full bg-emerald-500" style={{ width: `${Math.min(100, Math.max(0, v))}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-4 space-y-2 border-t border-line pt-3 text-sm">
              <Field label="Sinal mais forte de alta" text={pickText(raw, `${dash}.signal_attribution.strongest_bullish_signal`)} />
              <Field label="Sinal mais forte de baixa" text={pickText(raw, `${dash}.signal_attribution.strongest_bearish_signal`)} />
              {rawScore != null && adjusted != null && rawScore !== adjusted && (
                <p className="text-xs text-muted">
                  Nota original da IA <strong className="font-mono">{rawScore}</strong> ajustada para{" "}
                  <strong className="font-mono">{adjusted}</strong>
                  {guardrail && `: ${guardrail}`}
                </p>
              )}
            </div>
          </Panel>
        </section>

        {(fundamentals || newsItems.length > 0) && (
          <section className="mt-4 grid gap-4 md:grid-cols-2">
            {fundamentals && (
              <Panel title="Fundamentos (Yahoo Finance)">
                <KeyValues items={fundamentals} />
              </Panel>
            )}
            {newsItems.length > 0 && (
              <Panel title="Manchetes recentes">
                <ul className="space-y-2 text-sm">
                  {newsItems.map((n) => (
                    <li key={n.title} className="border-b border-line pb-2 last:border-0">
                      <p>{n.title}</p>
                      <p className="text-xs text-muted">{[n.date, n.publisher].filter(Boolean).join(" · ")}</p>
                    </li>
                  ))}
                </ul>
              </Panel>
            )}
          </section>
        )}

        {/* Inteligência */}
        <section className="mt-4 grid gap-4 md:grid-cols-2">
          <Panel title="Notícias e resultados">
            <div className="space-y-2 text-sm">
              <Field label="Últimas notícias" text={pickText(raw, `${dash}.intelligence.latest_news`)} />
              <Field label="Sentimento" text={pickText(raw, `${dash}.intelligence.sentiment_summary`)} />
              <Field label="Perspectiva de resultados" text={pickText(raw, `${dash}.intelligence.earnings_outlook`)} />
            </div>
          </Panel>
          <Panel title="Catalisadores e alertas">
            <div className="space-y-3 text-sm">
              <List title="Catalisadores positivos" items={catalysts} tone="text-emerald-500" />
              <List title="Alertas de risco" items={riskAlerts} tone="text-red-500" />
              {limitations.length > 0 && <List title="Limitações dos dados" items={limitations} tone="text-muted" />}
            </div>
          </Panel>
        </section>

        {/* Textos do relatório */}
        {sections.length > 0 && (
          <section className="mt-4 grid gap-4 md:grid-cols-2">
            {sections.map((s) => (
              <article key={s.key} className="card p-5">
                <h2 className="mb-2 text-sm font-semibold">{s.title}</h2>
                <p className="text-sm leading-relaxed whitespace-pre-line text-muted">{s.text}</p>
              </article>
            ))}
          </section>
        )}

        {/* Histórico */}
        <section className="card mt-4 overflow-x-auto p-5">
          <h2 className="mb-3 text-sm font-semibold">Histórico de análises</h2>
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-muted">
              <tr>
                {["Data", "Nota", "Recomendação", "Tendência", "Compra", "Stop", "Alvo"].map((h) => (
                  <th key={h} className="py-2 pr-4 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {history.map((h) => (
                <tr key={h.id} className="border-t border-line">
                  <td className="py-2 pr-4 whitespace-nowrap">{fmtDateTime(h.created_at)}</td>
                  <td className="py-2 pr-4 font-mono">{h.sentiment_score ?? "—"}</td>
                  <td className="py-2 pr-4">{h.operation_advice ?? "—"}</td>
                  <td className="py-2 pr-4">{h.trend_prediction ?? "—"}</td>
                  <td className="py-2 pr-4 font-mono">{fmtPrice(h.ideal_buy)}</td>
                  <td className="py-2 pr-4 font-mono">{fmtPrice(h.stop_loss)}</td>
                  <td className="py-2 pr-4 font-mono">{fmtPrice(h.take_profit)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <p className="mt-10 text-xs text-muted">
          Conteúdo gerado automaticamente por IA, apenas para estudo. Não é recomendação de investimento.
        </p>
      </main>
    </>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="card p-5">
      <h2 className="mb-3 text-sm font-semibold">{title}</h2>
      {children}
    </div>
  );
}

function Field({ label, text }: { label: string; text: string }) {
  if (!text) return null;
  return (
    <div>
      <p className="text-xs text-muted">{label}</p>
      <p>{text}</p>
    </div>
  );
}

function Advice({ title, text }: { title: string; text: string }) {
  if (!text) return null;
  return (
    <div className="rounded-lg border border-line p-3 text-sm">
      <p className="mb-1 text-xs font-semibold text-muted">{title}</p>
      <p>{text}</p>
    </div>
  );
}

function KeyValues({ items }: { items: [string, string][] }) {
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
      {items.map(([k, v]) => (
        <div key={k}>
          <dt className="text-xs text-muted">{k}</dt>
          <dd className="font-mono tabular-nums">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function List({ title, items, tone }: { title: string; items: string[]; tone: string }) {
  return (
    <div>
      <p className="text-xs text-muted">{title}</p>
      {items.length ? (
        <ul className={`mt-1 list-disc space-y-1 pl-4 ${tone}`}>
          {items.map((i) => <li key={i}><span className="text-foreground">{i}</span></li>)}
        </ul>
      ) : (
        <p className="mt-1 text-muted">Nenhum identificado.</p>
      )}
    </div>
  );
}

function Empty() {
  return <p className="text-sm text-muted">Sem dados nesta análise.</p>;
}
