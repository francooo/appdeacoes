import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { Header } from "@/components/header";
import { ArrowLeft } from "@/components/icons";
import { PageSkeleton } from "@/components/page-skeleton";
import { ChartLegend, PriceChart } from "@/components/price-chart";
import { ScoreBadge } from "@/components/score-badge";
import { Card, Disclaimer, Pill, ScoreChip, SectionTable } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { getAnalysesForCode, getDailyBars } from "@/lib/db";
import {
  actionTone,
  checklistItem,
  confidenceLabel,
  fmtChange,
  fmtCompact,
  fmtDate,
  fmtDateTime,
  fmtDayMonth,
  fmtDecimal,
  fmtMoney,
  fmtMoneyCompact,
  fmtPct,
  fmtPctAbs,
  fmtPrice,
  fmtRatio,
  fmtSigned,
  pick,
  pickList,
  pickNum,
  pickText,
  posNegClass,
  recommendationLabel,
  sentimentTone,
  trendStrengthLabel,
} from "@/lib/format";

/** Textos do relatório (cada cartão só aparece se houver conteúdo). */
const SECTIONS: { key: string; title: string }[] = [
  { key: "key_points", title: "Pontos-chave" },
  { key: "buy_reason", title: "Justificativa" },
  { key: "risk_warning", title: "Riscos" },
  { key: "short_term_outlook", title: "Curto prazo" },
  { key: "medium_term_outlook", title: "Médio prazo" },
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
  { key: "technical_indicators", label: "Técnicos" },
  { key: "fundamentals", label: "Fundamentos" },
  { key: "market_conditions", label: "Mercado" },
  { key: "news_sentiment", label: "Notícias" },
];

type KV = { label: string; value: string; cls?: string };

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
  const D = "dashboard";
  const price = pickNum(raw, "current_price");
  const change = pickNum(raw, "change_pct");
  const prevClose = pickNum(raw, "market_snapshot.prev_close");
  const act = actionTone((pick(raw, "action") as string) ?? (pick(raw, "decision_type") as string));
  const isB3 = pick(raw, "currency") === "BRL";

  // ---------- Pregão e indicadores
  const pregao: KV[] = [
    { label: "Abertura", value: fmtPrice(pickNum(raw, "market_snapshot.open")) },
    { label: "Máxima", value: fmtPrice(pickNum(raw, "market_snapshot.high")) },
    { label: "Mínima", value: fmtPrice(pickNum(raw, "market_snapshot.low")) },
    { label: "Fech. anterior", value: fmtPrice(prevClose) },
    { label: "Amplitude", value: fmtPctAbs(pickNum(raw, "market_snapshot.amplitude")) },
    { label: "Volume", value: fmtCompact(pickNum(raw, "market_snapshot.volume")) },
  ];
  const pp = `${D}.data_perspective.price_position`;
  const bias = pickNum(raw, `${pp}.bias_ma5`);
  const macd = pickNum(raw, "technicals.macd");
  const chg = (k: string) => pickNum(raw, `technicals.${k}`);
  const indicators: KV[] = [
    { label: "MM5", value: fmtPrice(pickNum(raw, `${pp}.ma5`)) },
    { label: "MM10", value: fmtPrice(pickNum(raw, `${pp}.ma10`)) },
    { label: "MM20", value: fmtPrice(pickNum(raw, `${pp}.ma20`)) },
    { label: "MM60", value: fmtPrice(chg("ma60")) },
    { label: "Desvio MM5", value: fmtPct(bias), cls: posNegClass(bias) },
    { label: "Força tendência", value: trendStrengthLabel(pickNum(raw, `${D}.data_perspective.trend_status.trend_score`)) },
    { label: "Suporte", value: fmtPrice(pickNum(raw, `${pp}.support_level`)) },
    { label: "Resistência", value: fmtPrice(pickNum(raw, `${pp}.resistance_level`)) },
    { label: "RSI 14", value: fmtDecimal(chg("rsi14")) },
    { label: "MACD", value: fmtSigned(macd), cls: posNegClass(macd) },
    {
      label: "Volume rel.",
      value: fmtRatio(pickNum(raw, "market_snapshot.volume_ratio") ?? pickNum(raw, `${D}.data_perspective.volume_analysis.volume_ratio`)),
    },
    { label: "Var. 5d", value: fmtPct(chg("chg_5d")), cls: posNegClass(chg("chg_5d")) },
    { label: "Var. 20d", value: fmtPct(chg("chg_20d")), cls: posNegClass(chg("chg_20d")) },
    { label: "Var. 60d", value: fmtPct(chg("chg_60d")), cls: posNegClass(chg("chg_60d")) },
    { label: "Máx. 52 sem.", value: fmtPrice(chg("high_52w")) },
    { label: "Mín. 52 sem.", value: fmtPrice(chg("low_52w")) },
  ].filter((i) => i.value !== "—");

  // ---------- Fundamentos e manchetes (análises da B3)
  const fundamentals: KV[] | null = pick(raw, "fundamentals")
    ? [
        { label: "Setor", value: pickText(raw, "fundamentals.sector") || "—" },
        { label: "Indústria", value: pickText(raw, "fundamentals.industry") || "—" },
        { label: "Valor de mercado", value: fmtMoneyCompact(pickNum(raw, "fundamentals.market_cap"), raw) },
        { label: "P/L", value: fmtPrice(pickNum(raw, "fundamentals.pe")) },
        { label: "P/L projetado", value: fmtPrice(pickNum(raw, "fundamentals.forward_pe")) },
        { label: "P/VP", value: fmtPrice(pickNum(raw, "fundamentals.pb")) },
        { label: "ROE", value: fmtPctAbs(pickNum(raw, "fundamentals.roe"), 1) },
        { label: "Dividend yield", value: fmtPctAbs(pickNum(raw, "fundamentals.dividend_yield")) },
        { label: "Consenso", value: recommendationLabel(pick(raw, "fundamentals.recommendation")) },
        { label: "Preço-alvo médio", value: fmtMoney(pickNum(raw, "fundamentals.target_mean"), raw) },
      ]
    : null;
  const news = (Array.isArray(pick(raw, "news")) ? (pick(raw, "news") as { title?: string; date?: string; publisher?: string }[]) : [])
    .filter((n) => n?.title);

  // ---------- Plano
  const potential = price && latest.take_profit ? ((latest.take_profit - price) / price) * 100 : null;
  const riskToStop = price && latest.stop_loss ? ((latest.stop_loss - price) / price) * 100 : null;
  const rawScore = pickNum(raw, `${D}.decision_score_calibration.raw_score`);
  const adjusted = pickNum(raw, `${D}.decision_score_calibration.adjusted_score`);
  const scoreDelta = rawScore != null && adjusted != null && rawScore !== adjusted ? adjusted - rawScore : null;
  const sections = SECTIONS.map((s) => ({ ...s, text: pickText(raw, s.key) })).filter((s) => s.text);
  const sentiment = pickText(raw, `${D}.intelligence.sentiment_summary`);
  const limitations = pickList(raw, `${D}.phase_decision.data_limitations`);

  return (
    <>
      <Header userName={user.name ?? user.email} active="/" />
      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-4 px-4 py-8">
        <Link href="/" className="inline-flex items-center gap-1.5 self-start text-[13px] text-muted hover:text-foreground">
          <ArrowLeft size={14} /> Voltar ao painel
        </Link>

        {/* Cabeçalho */}
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h1 className="mono text-[30px] font-semibold leading-none">{latest.code}</h1>
              <span className="text-base text-muted">{latest.name}</span>
            </div>
            <p className="mt-1.5 text-xs text-muted">
              Análise de <span className="mono">{fmtDateTime(latest.created_at)}</span>
              {pickText(raw, "model_used") && (
                <> · modelo <span className="mono">{pickText(raw, "model_used")}</span></>
              )}
            </p>
          </div>
          <div className="text-right">
            <p className="mono text-[30px] font-semibold leading-none">{fmtMoney(price, raw)}</p>
            <p className={`mono mt-1.5 text-sm ${posNegClass(change)}`}>
              {fmtChange(price != null && prevClose != null ? price - prevClose : null, change)}
            </p>
          </div>
        </div>

        {/* Conclusão + entrada/saída */}
        <div className="flex flex-wrap gap-4">
          <section className="card flex min-w-0 grow-[2] basis-[560px] flex-col gap-4 p-5">
            <div className="flex flex-wrap items-center gap-4">
              <ScoreBadge score={latest.sentiment_score} large showLabel caption="nota de 0 a 100" />
              <Pill tone={act.tone} size="md">{act.label}</Pill>
              <div className="flex flex-wrap gap-x-[18px] gap-y-1.5 text-[13px]">
                <span><span className="text-muted">Recomendação: </span>{latest.operation_advice ?? "—"}</span>
                <span><span className="text-muted">Tendência: </span>{latest.trend_prediction ?? "—"}</span>
                <span><span className="text-muted">Confiança: </span>{confidenceLabel(pick(raw, "confidence_level") as string)}</span>
              </div>
            </div>
            {pickText(raw, `${D}.core_conclusion.one_sentence`) && (
              <p className="rounded-lg bg-surface-2 px-4 py-3.5 text-[17px] font-medium leading-[1.45]">
                {pickText(raw, `${D}.core_conclusion.one_sentence`)}
              </p>
            )}
            {latest.analysis_summary && (
              <p className="whitespace-pre-line text-sm leading-[1.65] text-muted">{latest.analysis_summary}</p>
            )}
            <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-3">
              <Advice title="Se você não tem a ação" text={pickText(raw, `${D}.core_conclusion.position_advice.no_position`)} />
              <Advice title="Se você já tem a ação" text={pickText(raw, `${D}.core_conclusion.position_advice.has_position`)} />
            </div>
          </section>

          <section className="card flex grow basis-[320px] flex-col gap-3.5 p-5">
            <h2 className="card-title">Pontos de entrada e saída</h2>
            <div className="grid grid-cols-2 gap-2.5">
              <MiniLevel label="Compra ideal" value={fmtPrice(latest.ideal_buy)} />
              <MiniLevel label="Compra secundária" value={fmtPrice(latest.secondary_buy)} />
              <MiniLevel label="Stop loss" value={fmtPrice(latest.stop_loss)} cls="neg" />
              <MiniLevel label="Alvo" value={fmtPrice(latest.take_profit)} cls="pos" />
            </div>
            <div className="flex flex-col gap-1.5 text-[13px]">
              <div className="flex justify-between">
                <span className="text-muted">Potencial até o alvo</span>
                <span className={`mono font-semibold ${posNegClass(potential)}`}>{fmtPct(potential)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Risco até o stop</span>
                <span className={`mono font-semibold ${posNegClass(riskToStop)}`}>{fmtPct(riskToStop)}</span>
              </div>
            </div>
            <div className="flex flex-col gap-2.5 border-t border-line pt-3 text-[13px] leading-normal">
              <Field label="Posição sugerida" text={pickText(raw, `${D}.battle_plan.position_strategy.suggested_position`)} />
              <Field label="Plano de entrada" text={pickText(raw, `${D}.battle_plan.position_strategy.entry_plan`)} />
              <Field label="Controle de risco" text={pickText(raw, `${D}.battle_plan.position_strategy.risk_control`)} />
            </div>
          </section>
        </div>

        {/* Gráfico + pregão/indicadores */}
        <div className="flex flex-wrap gap-4">
          <Card className="min-w-0 grow-[2] basis-[560px]" title={`Gráfico · ${bars.length} pregões`} aside={<ChartLegend />}>
            <PriceChart bars={bars} />
          </Card>
          <div className="flex grow basis-[320px] flex-col gap-4">
            <Card title="Pregão">
              <KeyValues items={pregao} />
            </Card>
            {indicators.length > 0 && (
              <Card title="Indicadores">
                <KeyValues items={indicators} />
              </Card>
            )}
          </div>
        </div>

        {/* Checklist, agora, composição */}
        <div className="grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-4">
          <Card title="Checklist da operação">
            {pickList(raw, `${D}.battle_plan.action_checklist`).length ? (
              <ul className="flex flex-col gap-2.5 text-[13px] leading-[1.45]">
                {pickList(raw, `${D}.battle_plan.action_checklist`).map((c) => {
                  const item = checklistItem(c);
                  return (
                    <li key={c} className="flex gap-2.5">
                      <span className={`${item.tone} tone-bg mono inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-xs font-bold`}>
                        {item.glyph}
                      </span>
                      <span>{item.text}</span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-[13px] text-muted">Sem checklist nesta análise.</p>
            )}
          </Card>

          <Card title="O que fazer agora">
            <div className="flex flex-col gap-3 text-[13px] leading-normal">
              <Field label="Ação imediata" text={pickText(raw, `${D}.phase_decision.immediate_action`)} />
              <Field label="Próxima checagem" text={pickText(raw, `${D}.phase_decision.next_check_time`)} />
              {pickList(raw, `${D}.phase_decision.watch_conditions`).length > 0 && (
                <div>
                  <p className="text-xs text-muted">Condições a acompanhar</p>
                  <ul className="mt-1 list-disc pl-[18px]">
                    {pickList(raw, `${D}.phase_decision.watch_conditions`).map((w) => <li key={w}>{w}</li>)}
                  </ul>
                </div>
              )}
            </div>
          </Card>

          <Card title="Composição da nota">
            <div className="flex flex-col gap-3 text-[13px]">
              {ATTRIBUTION.map(({ key, label }) => {
                const v = pickNum(raw, `${D}.signal_attribution.${key}`) ?? 0;
                return (
                  <div key={key}>
                    <div className="mb-[5px] flex justify-between">
                      <span>{label}</span>
                      <span className="mono text-muted">{v}%</span>
                    </div>
                    <div className="bar"><span style={{ width: `${Math.min(100, Math.max(0, v))}%` }} /></div>
                  </div>
                );
              })}
              <div className="flex flex-col gap-1.5 border-t border-line pt-2.5 leading-[1.45]">
                <InlineField label="Sinal mais forte de alta" text={pickText(raw, `${D}.signal_attribution.strongest_bullish_signal`)} />
                <InlineField label="Sinal mais forte de baixa" text={pickText(raw, `${D}.signal_attribution.strongest_bearish_signal`)} />
                {scoreDelta != null && (
                  <p>
                    <span className="text-muted">Ajuste de nota: </span>
                    <span className={`mono font-semibold ${posNegClass(scoreDelta)}`}>{fmtSigned(scoreDelta, 0)}</span>
                    {pickText(raw, `${D}.decision_score_calibration.guardrail_reason`) &&
                      ` por ${pickText(raw, `${D}.decision_score_calibration.guardrail_reason`).replace(/\.$/, "").toLowerCase()}`}
                  </p>
                )}
              </div>
            </div>
          </Card>
        </div>

        {/* Fundamentos + manchetes */}
        {(fundamentals || news.length > 0) && (
          <div className="flex flex-wrap gap-4">
            {fundamentals && (
              <Card className="min-w-0 grow basis-[420px]" title="Fundamentos" aside={isB3 ? <span className="tag text-muted">B3</span> : undefined}>
                <dl className="grid grid-cols-2 gap-x-5 gap-y-2 text-[13px]">
                  {fundamentals.map((f) => (
                    <div key={f.label} className="flex justify-between gap-3 border-b border-line py-1">
                      <dt className="text-muted">{f.label}</dt>
                      <dd className="mono truncate text-right">{f.value}</dd>
                    </div>
                  ))}
                </dl>
              </Card>
            )}
            {news.length > 0 && (
              <Card className="min-w-0 grow basis-[420px]" title="Manchetes">
                <ul className="-mt-2.5">
                  {news.map((n) => (
                    <li key={n.title} className="border-b border-line py-2.5">
                      <p className="text-[13px] font-medium leading-[1.4]">{n.title}</p>
                      <p className="mt-[3px] text-xs text-muted">
                        {n.date && <span className="mono">{fmtDayMonth(n.date)}</span>}
                        {n.date && n.publisher && " · "}
                        {n.publisher}
                      </p>
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </div>
        )}

        {/* Notícias e resultados + catalisadores */}
        <div className="flex flex-wrap gap-4">
          <Card className="min-w-0 grow basis-[420px]" title="Notícias e resultados">
            <div className="flex flex-col gap-3 text-[13px] leading-[1.55]">
              <Field label="Últimas notícias" text={pickText(raw, `${D}.intelligence.latest_news`)} />
              {sentiment && (
                <div>
                  <p className="text-xs text-muted">Sentimento</p>
                  <Pill tone={sentimentTone(sentiment).tone} size="sm" className="mt-1">{sentimentTone(sentiment).label}</Pill>
                  <p className="mt-1.5">{sentiment}</p>
                </div>
              )}
              <Field label="Perspectiva de resultados" text={pickText(raw, `${D}.intelligence.earnings_outlook`)} />
            </div>
          </Card>
          <Card className="min-w-0 grow basis-[420px]" title="Catalisadores e alertas">
            <div className="flex flex-col gap-3.5 text-[13px]">
              <DotList title="Catalisadores positivos" items={pickList(raw, `${D}.intelligence.positive_catalysts`)} color="#10b981" />
              <DotList title="Alertas de risco" items={pickList(raw, `${D}.intelligence.risk_alerts`)} color="#dc2626" />
              {limitations.length > 0 && (
                <p className="border-t border-line pt-2.5 text-xs text-muted">Limitações: {limitations.join("; ")}</p>
              )}
            </div>
          </Card>
        </div>

        {/* Textos do relatório */}
        {sections.length > 0 && (
          <>
            <h2 className="mt-2 text-base font-semibold">Textos do relatório</h2>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,360px),1fr))] gap-4">
              {sections.map((s) => (
                <article key={s.key} className="card p-5">
                  <h3 className="mb-2 text-sm font-semibold">{s.title}</h3>
                  <p className="whitespace-pre-line text-sm leading-[1.65] text-muted">{s.text}</p>
                </article>
              ))}
            </div>
          </>
        )}

        {/* Histórico */}
        <SectionTable title="Histórico de análises" minWidth={680}>
          <thead>
            <tr>
              <th>Data</th>
              <th className="center">Nota</th>
              <th>Recomendação</th>
              <th>Tendência</th>
              <th className="num">Compra</th>
              <th className="num">Stop</th>
              <th className="num">Alvo</th>
            </tr>
          </thead>
          <tbody>
            {history.map((h) => (
              <tr key={h.id}>
                <td className="mono">{fmtDate(h.created_at)}</td>
                <td className="center"><ScoreChip score={h.sentiment_score} /></td>
                <td>{h.operation_advice ?? "—"}</td>
                <td>{h.trend_prediction ?? "—"}</td>
                <td className="num">{fmtPrice(h.ideal_buy)}</td>
                <td className="num neg">{fmtPrice(h.stop_loss)}</td>
                <td className="num pos">{fmtPrice(h.take_profit)}</td>
              </tr>
            ))}
          </tbody>
        </SectionTable>

        <Disclaimer>
          Conteúdo gerado por IA a partir de dados do Yahoo Finance. Não é recomendação de investimento.
        </Disclaimer>
      </main>
    </>
  );
}

function MiniLevel({ label, value, cls = "" }: { label: string; value: string; cls?: string }) {
  return (
    <div className="rounded-lg border border-line p-3">
      <p className="text-[11px] text-muted">{label}</p>
      <p className={`mono mt-1 text-[17px] font-semibold ${value === "—" ? "" : cls}`}>{value}</p>
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

function InlineField({ label, text }: { label: string; text: string }) {
  if (!text) return null;
  return (
    <p>
      <span className="text-muted">{label}: </span>
      {text}
    </p>
  );
}

function Advice({ title, text }: { title: string; text: string }) {
  if (!text) return null;
  return (
    <div className="rounded-lg border border-line p-3.5">
      <p className="mb-1.5 text-xs font-semibold text-muted">{title}</p>
      <p className="text-[13px] leading-[1.55]">{text}</p>
    </div>
  );
}

function KeyValues({ items }: { items: KV[] }) {
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-[13px]">
      {items.map((i) => (
        <div key={i.label} className="flex justify-between gap-2">
          <dt className="truncate text-muted">{i.label}</dt>
          <dd className={`mono whitespace-nowrap ${i.cls ?? ""}`}>{i.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function DotList({ title, items, color }: { title: string; items: string[]; color: string }): ReactNode {
  return (
    <div>
      <p className="mb-1.5 text-xs text-muted">{title}</p>
      {items.length ? (
        <ul className="flex flex-col gap-1.5">
          {items.map((i) => (
            <li key={i} className="flex gap-2 leading-[1.45]">
              <span className="mt-[6px] h-[7px] w-[7px] shrink-0 rounded-full" style={{ background: color }} />
              <span>{i}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted">Nenhum identificado.</p>
      )}
    </div>
  );
}
