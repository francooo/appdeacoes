import "server-only";
import { neon } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error("DATABASE_URL não definida. Configure em web/.env.local ou na Vercel.");
}

export const sql = neon(url);

export type Analysis = {
  id: string;
  code: string;
  name: string | null;
  report_type: string | null;
  sentiment_score: number | null;
  operation_advice: string | null;
  trend_prediction: string | null;
  analysis_summary: string | null;
  raw_result: Record<string, unknown> | null;
  news_content: string | null;
  ideal_buy: number | null;
  secondary_buy: number | null;
  stop_loss: number | null;
  take_profit: number | null;
  created_at: string;
};

export type DailyBar = {
  date: string;
  close: number | null;
  pct_chg: number | null;
  ma5: number | null;
  ma10: number | null;
  ma20: number | null;
  volume: number | null;
};

/** Última análise de cada ação. */
export async function getLatestAnalyses(): Promise<Analysis[]> {
  const rows = await sql`
    SELECT DISTINCT ON (code) *
    FROM analyses
    ORDER BY code, created_at DESC
  `;
  return (rows as Analysis[]).sort(
    (a, b) => (b.sentiment_score ?? -1) - (a.sentiment_score ?? -1),
  );
}

export async function getAnalysesForCode(code: string, limit = 30): Promise<Analysis[]> {
  const rows = await sql`
    SELECT * FROM analyses WHERE code = ${code}
    ORDER BY created_at DESC LIMIT ${limit}
  `;
  return rows as Analysis[];
}

export async function getDailyBars(code: string, limit = 60): Promise<DailyBar[]> {
  const rows = await sql`
    SELECT date::text AS date, close, pct_chg, ma5, ma10, ma20, volume
    FROM stock_daily WHERE code = ${code}
    ORDER BY date DESC LIMIT ${limit}
  `;
  return (rows as DailyBar[]).reverse();
}

export async function findUserByEmail(email: string) {
  const rows = await sql`
    SELECT id, email, name, password_hash FROM users WHERE email = ${email.toLowerCase()}
  `;
  return rows[0] as
    | { id: number; email: string; name: string | null; password_hash: string }
    | undefined;
}

/** Últimos N fechamentos por ação, para os minigráficos do painel. */
export async function getSparklines(days = 30): Promise<Record<string, number[]>> {
  const rows = (await sql`
    SELECT code, close FROM (
      SELECT code, date, close,
             row_number() OVER (PARTITION BY code ORDER BY date DESC) AS rn
      FROM stock_daily
    ) t
    WHERE rn <= ${days} AND close IS NOT NULL
    ORDER BY code, date
  `) as { code: string; close: number }[];
  const out: Record<string, number[]> = {};
  for (const r of rows) (out[r.code] ??= []).push(r.close);
  return out;
}

export type SwingRun = {
  id: string;
  created_at: string;
  universe_size: number | null;
  screened: number | null;
  ibov_chg20: number | null;
  ibov_trend: string | null;
};

export type SwingAI = {
  veredito?: string;
  confianca?: string;
  tese?: string;
  gatilho_entrada?: string;
  gestao?: string;
  horizonte?: string;
  riscos?: string[];
  checklist?: string[];
  news?: string[];
  model?: string;
};

export type SwingPick = {
  rank: number;
  code: string;
  name: string | null;
  setup: string | null;
  score: number | null;
  price: number | null;
  entry: number | null;
  stop: number | null;
  target: number | null;
  target2: number | null;
  risk_pct: number | null;
  reward_pct: number | null;
  rsi: number | null;
  atr_pct: number | null;
  fin_volume: number | null;
  rs20: number | null;
  selected: boolean;
  metrics: Record<string, unknown> | null;
  ai: SwingAI | null;
};

export async function getLatestSwing(): Promise<{ run: SwingRun; picks: SwingPick[] } | null> {
  let run: SwingRun | undefined;
  try {
    [run] = (await sql`SELECT * FROM swing_runs ORDER BY created_at DESC LIMIT 1`) as SwingRun[];
  } catch {
    return null; // tabela ainda não criada (screener nunca rodou)
  }
  if (!run) return null;
  const picks = (await sql`SELECT * FROM swing_picks WHERE run_id = ${run.id} ORDER BY rank`) as SwingPick[];
  return { run, picks };
}
