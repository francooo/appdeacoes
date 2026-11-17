import type { Metadata } from "next";
import { Suspense, type ReactNode } from "react";
import { Header } from "@/components/header";
import { PageSkeleton } from "@/components/page-skeleton";
import { Sparkline } from "@/components/sparkline";
import { requireUser } from "@/lib/auth";
import { getLatestSwing, getSparklines, type SwingPick } from "@/lib/db";
import { fmtCompact, fmtDateTime, fmtPct, fmtPrice } from "@/lib/format";

export const metadata: Metadata = { title: "Swing Trade · Análise de Ações" };

export default function SwingPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Swing />
    </Suspense>
  );
}

const VERDICT_TONE: Record<string, string> = {
  Operar: "tone-strong-up",
  Aguardar: "tone-neutral",
  Evitar: "tone-down",
};

function brl(v: number | null | undefined) {
  const s = fmtPrice(v);
  return s === "—" ? s : `R$ ${s}`;
}

async function Swing() {
  const user = await requireUser();
  const [data, sparks] = await Promise.all([getLatestSwing(), getSparklines(60)]);

  return (
    <>
      <Header userName={user.name ?? user.email} active="/swing" />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Swing Trade · B3</h1>
            <p className="text-sm text-muted">
              Melhores setups para operações de 3 a 20 pregões, com validação por IA
            </p>
          </div>
          {data && <p className="text-sm text-muted">Varredura de {fmtDateTime(data.run.created_at)}</p>}
        </div>

        {!data ? (
          <div className="card p-10 text-center">
            <p className="font-medium">Nenhuma varredura ainda</p>
            <p className="mt-1 text-sm text-muted">O screener roda junto com a análise diária no GitHub Actions.</p>
          </div>
        ) : (
          <Content run={data.run} picks={data.picks} sparks={sparks} />
        )}

        <p className="mt-10 text-xs text-muted">
          Sinais gerados automaticamente a partir de dados do Yahoo Finance e avaliados por IA, apenas para estudo.
          Não é recomendação de investimento. Operações de swing trade envolvem risco de perda.
        </p>
      </main>
    </>
  );
}

function Content({
  run,
  picks,
  sparks,
}: {
  run: NonNullable<Awaited<ReturnType<typeof getLatestSwing>>>["run"];
  picks: SwingPick[];
  sparks: Record<string, number[]>;
}) {
  const selected = picks.filter((p) => p.selected);
  const operar = selected.filter((p) => p.ai?.veredito === "Operar").length;

  return (
    <>
      <section className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="Ações varridas" value={String(run.universe_size ?? "—")} />
        <Kpi label="Passaram no filtro de liquidez" value={String(run.screened ?? "—")} />
        <Kpi label="Avaliadas pela IA" value={`${selected.length} (${operar} “Operar”)`} />
        <Kpi
          label="Ibovespa"
          value={run.ibov_chg20 != null ? `${fmtPct(run.ibov_chg20)} em 20d` : "—"}
          hint={run.ibov_trend ?? undefined}
        />
      </section>

      <details className="card mb-6 p-5 text-sm">
        <summary className="cursor-pointer font-medium">Como as ações são escolhidas</summary>
        <div className="mt-3 grid gap-4 text-muted md:grid-cols-2">
          <ul className="list-disc space-y-1 pl-4">
            <li><strong className="text-foreground">Liquidez:</strong> volume financeiro médio acima de R$ 20 mi/dia.</li>
            <li><strong className="text-foreground">Tendência (30 pts):</strong> preço acima da MM50, MM20 acima da MM50, MM50 subindo, preço acima da MM200.</li>
            <li><strong className="text-foreground">Momento (30 pts):</strong> RSI entre 50 e 68 e MACD positivo/acelerando.</li>
            <li><strong className="text-foreground">Força relativa (20 pts):</strong> desempenho acima do Ibovespa em 20 e 60 dias.</li>
            <li><strong className="text-foreground">Setup (20 pts):</strong> rompimento da máxima de 20 dias com volume, ou pullback até a MM20 em tendência de alta.</li>
          </ul>
          <ul className="list-disc space-y-1 pl-4">
            <li><strong className="text-foreground">Stop:</strong> o maior entre a mínima dos últimos 10 dias e 2× ATR abaixo do preço.</li>
            <li><strong className="text-foreground">Alvos:</strong> 2× e 3× o risco (relação risco/retorno 1:2 e 1:3).</li>
            <li><strong className="text-foreground">Penalidades:</strong> RSI acima de 75 ou preço mais de 8% acima da MM20.</li>
            <li><strong className="text-foreground">IA:</strong> as melhores são revisadas com as notícias recentes e recebem veredito Operar / Aguardar / Evitar.</li>
            <li><strong className="text-foreground">Tamanho da posição:</strong> arrisque no máximo 1% do capital. Quantidade = (capital × 1%) ÷ (entrada − stop).</li>
          </ul>
        </div>
      </details>

      {selected.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-2">
          {selected.map((p) => (
            <PickCard key={p.code} p={p} spark={sparks[p.code] ?? []} />
          ))}
        </div>
      )}

      <section className="card mt-8 overflow-x-auto">
        <h2 className="px-5 pt-5 text-sm font-semibold">Ranking completo (top {picks.length})</h2>
        <table className="mt-3 w-full min-w-225 text-left text-sm">
          <thead className="text-xs text-muted">
            <tr className="border-b border-line">
              {["#", "Ação", "Setup", "Nota", "Preço", "Stop", "Alvo 2R", "Risco", "RSI", "vs Ibov 20d", "Liquidez/dia", "IA"].map((h) => (
                <th key={h} className="px-3 py-2 font-medium first:pl-5 last:pr-5">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {picks.map((p) => (
              <tr key={p.code} className="border-b border-line last:border-0 hover:bg-surface-2">
                <td className="px-3 py-2 pl-5 text-muted">{p.rank}</td>
                <td className="px-3 py-2 font-mono font-semibold">{p.code}</td>
                <td className="px-3 py-2 whitespace-nowrap">{p.setup}</td>
                <td className="px-3 py-2 font-mono">{p.score}</td>
                <td className="px-3 py-2 font-mono tabular-nums whitespace-nowrap">{brl(p.price)}</td>
                <td className="px-3 py-2 font-mono tabular-nums whitespace-nowrap">{brl(p.stop)}</td>
                <td className="px-3 py-2 font-mono tabular-nums whitespace-nowrap">{brl(p.target)}</td>
                <td className="px-3 py-2 font-mono tabular-nums text-red-500">-{fmtPrice(p.risk_pct)}%</td>
                <td className="px-3 py-2 font-mono">{p.rsi?.toFixed(0) ?? "—"}</td>
                <td className={`px-3 py-2 font-mono ${(p.rs20 ?? 0) >= 0 ? "text-emerald-500" : "text-red-500"}`}>
                  {p.rs20 != null ? `${p.rs20 > 0 ? "+" : ""}${p.rs20.toFixed(1)} p.p.` : "—"}
                </td>
                <td className="px-3 py-2 font-mono">{fmtCompact(p.fin_volume)}</td>
                <td className="px-3 py-2 pr-5">
                  {p.ai?.veredito ? (
                    <span className={`${VERDICT_TONE[p.ai.veredito] ?? "tone-neutral"} tone-fg font-medium`}>{p.ai.veredito}</span>
                  ) : (
                    <span className="text-muted">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}

function PickCard({ p, spark }: { p: SwingPick; spark: number[] }) {
  const ai = p.ai;
  const m = (p.metrics ?? {}) as { reasons?: string[]; warnings?: string[]; dist_ma20_pct?: number; vol_ratio?: number };
  const tone = VERDICT_TONE[ai?.veredito ?? ""] ?? "tone-neutral";
  return (
    <article className="card flex flex-col gap-4 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted">#{p.rank}</span>
            <p className="font-mono text-lg font-semibold">{p.code}</p>
            <span className="rounded-md bg-surface-2 px-2 py-0.5 text-xs">{p.setup}</span>
          </div>
          <p className="truncate text-sm text-muted">{p.name}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          {ai?.veredito && (
            <span className={`${tone} tone-bg rounded-full px-3 py-1 text-sm font-semibold`}>{ai.veredito}</span>
          )}
          <span className="text-xs text-muted">
            Nota {p.score}/100{ai?.confianca ? ` · confiança ${ai.confianca.toLowerCase()}` : ""}
          </span>
        </div>
      </div>

      <Sparkline values={spark} />

      <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
        <Level label="Entrada" value={brl(p.entry)} />
        <Level label="Stop" value={brl(p.stop)} sub={`-${fmtPrice(p.risk_pct)}%`} subCls="text-red-500" />
        <Level label="Alvo 1 (2R)" value={brl(p.target)} sub={fmtPct(p.reward_pct)} subCls="text-emerald-500" />
        <Level
          label="Alvo 2 (3R)"
          value={brl(p.target2)}
          sub={p.price && p.target2 ? fmtPct(((p.target2 - p.price) / p.price) * 100) : undefined}
          subCls="text-emerald-500"
        />
      </dl>

      <div className="flex flex-wrap gap-1.5 text-xs">
        <Chip>RSI {p.rsi?.toFixed(0) ?? "—"}</Chip>
        <Chip>ATR {fmtPrice(p.atr_pct)}%</Chip>
        <Chip>vs Ibov 20d {p.rs20 != null ? `${p.rs20 > 0 ? "+" : ""}${p.rs20.toFixed(1)} p.p.` : "—"}</Chip>
        <Chip>Liquidez R$ {fmtCompact(p.fin_volume)}/dia</Chip>
        {m.vol_ratio != null && <Chip>Volume {m.vol_ratio}x</Chip>}
        {m.dist_ma20_pct != null && <Chip>{fmtPct(m.dist_ma20_pct)} da MM20</Chip>}
        {ai?.horizonte && <Chip>{ai.horizonte}</Chip>}
      </div>

      {ai?.tese && <p className="text-sm leading-relaxed">{ai.tese}</p>}

      {(ai?.gatilho_entrada || ai?.gestao) && (
        <div className="grid gap-3 sm:grid-cols-2">
          {ai?.gatilho_entrada && <Box title="Gatilho de entrada" text={ai.gatilho_entrada} />}
          {ai?.gestao && <Box title="Gestão da posição" text={ai.gestao} />}
        </div>
      )}

      <details className="text-sm">
        <summary className="cursor-pointer text-muted hover:text-foreground">Checklist, riscos e sinais</summary>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          {ai?.checklist && ai.checklist.length > 0 && <ListBlock title="Checklist" items={ai.checklist} />}
          {ai?.riscos && ai.riscos.length > 0 && <ListBlock title="Riscos" items={ai.riscos} bullet />}
          {m.reasons && m.reasons.length > 0 && <ListBlock title="Sinais a favor" items={m.reasons} bullet />}
          {m.warnings && m.warnings.length > 0 && <ListBlock title="Alertas técnicos" items={m.warnings} bullet />}
          {ai?.news && ai.news.length > 0 && <ListBlock title="Notícias consideradas" items={ai.news} bullet />}
        </div>
      </details>
    </article>
  );
}

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="card p-4">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
    </div>
  );
}

function Level({ label, value, sub, subCls }: { label: string; value: string; sub?: string; subCls?: string }) {
  return (
    <div className="rounded-lg bg-surface-2 p-2.5">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="font-mono tabular-nums">{value}</dd>
      {sub && <dd className={`font-mono text-xs tabular-nums ${subCls ?? ""}`}>{sub}</dd>}
    </div>
  );
}

function Chip({ children }: { children: ReactNode }) {
  return <span className="rounded-md bg-surface-2 px-2 py-0.5">{children}</span>;
}

function Box({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-lg border border-line p-3 text-sm">
      <p className="mb-1 text-xs font-semibold text-muted">{title}</p>
      <p>{text}</p>
    </div>
  );
}

function ListBlock({ title, items, bullet = false }: { title: string; items: string[]; bullet?: boolean }) {
  return (
    <div>
      <p className="mb-1 text-xs font-semibold text-muted">{title}</p>
      <ul className={`space-y-1 ${bullet ? "list-disc pl-4" : ""}`}>
        {items.map((i) => (
          <li key={i}>{i}</li>
        ))}
      </ul>
    </div>
  );
}
