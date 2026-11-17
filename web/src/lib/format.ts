/** Formatação e mapeamentos do design system (docs/design/design-system/DESIGN-SYSTEM.md). */

export type Tone = "su" | "up" | "ne" | "dn";

const MINUS = "−"; // sinal tipográfico U+2212
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

function num(v: number, digits = 2) {
  return Math.abs(v).toLocaleString("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function fmtPrice(v: number | null | undefined) {
  if (!isNum(v)) return "—";
  return `${v < 0 ? MINUS : ""}${num(v)}`;
}

/** Número com sinal explícito: +0,08 / −0,44. */
export function fmtSigned(v: number | null | undefined, digits = 2) {
  if (!isNum(v)) return "—";
  return `${v > 0 ? "+" : v < 0 ? MINUS : ""}${num(v, digits)}`;
}

/** Percentual com sinal explícito: +1,25% / −0,98%. */
export function fmtPct(v: number | null | undefined, digits = 2) {
  if (!isNum(v)) return "—";
  return `${fmtSigned(v, digits)}%`;
}

/** Percentual sem sinal: 5,95%. */
export function fmtPctAbs(v: number | null | undefined, digits = 2) {
  if (!isNum(v)) return "—";
  return `${num(v, digits)}%`;
}

/** Variação absoluta + percentual: −0,44 (−0,98%). */
export function fmtChange(abs: number | null | undefined, pct: number | null | undefined) {
  if (!isNum(pct)) return "—";
  return isNum(abs) ? `${fmtSigned(abs)} (${fmtPct(pct)})` : fmtPct(pct);
}

/** Razão: 2,10×. */
export function fmtRatio(v: number | null | undefined) {
  if (!isNum(v)) return "—";
  return `${num(v)}×`;
}

export function fmtDecimal(v: number | null | undefined, digits = 1) {
  if (!isNum(v)) return "—";
  return `${v < 0 ? MINUS : ""}${num(v, digits)}`;
}

/** Compacto pt-BR: 601,5 bi · 38,4 mi · 12,3 mil. */
export function fmtCompact(v: number | null | undefined) {
  if (!isNum(v)) return "—";
  const a = Math.abs(v);
  const sign = v < 0 ? MINUS : "";
  const scales: [number, string][] = [[1e12, "tri"], [1e9, "bi"], [1e6, "mi"], [1e3, "mil"]];
  for (const [base, suffix] of scales) {
    if (a >= base) return `${sign}${(a / base).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} ${suffix}`;
  }
  return `${sign}${a.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}`;
}

const TZ = "America/Sao_Paulo";

export function fmtDateTime(iso: string) {
  return new Date(iso)
    .toLocaleString("pt-BR", { timeZone: TZ, day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })
    .replace(",", "");
}

export function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { timeZone: TZ, day: "2-digit", month: "2-digit", year: "numeric" });
}

/** "2026-11-16" (data pura) ou ISO → 16/11. */
export function fmtDayMonth(value: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (m) return `${m[3]}/${m[2]}`;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString("pt-BR", { timeZone: TZ, day: "2-digit", month: "2-digit" });
}

/** "2026-11-16" → 16/11/2026 (sem conversão de fuso). */
export function fmtIsoDay(value: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : value;
}

export function posNegClass(v: number | null | undefined) {
  if (!isNum(v) || v === 0) return "";
  return v > 0 ? "pos" : "neg";
}

/** Faixas de nota: >70 Forte alta · >60 Alta · 40–60 Lateral · <40 Baixa. */
export function scoreTone(score: number | null | undefined): { label: string; tone: Tone } {
  if (!isNum(score)) return { label: "Sem nota", tone: "ne" };
  if (score > 70) return { label: "Forte alta", tone: "su" };
  if (score > 60) return { label: "Alta", tone: "up" };
  if (score >= 40) return { label: "Lateral", tone: "ne" };
  return { label: "Baixa", tone: "dn" };
}

/** Ação canônica → rótulo e tom. */
export function actionTone(action: string | null | undefined): { label: string; tone: Tone; key: string } {
  const key = (action ?? "").toLowerCase();
  switch (key) {
    case "buy":
    case "add":
      return { label: "Comprar", tone: "su", key: "buy" };
    case "hold":
      return { label: "Manter", tone: "up", key: "hold" };
    case "watch":
      return { label: "Observar", tone: "ne", key: "watch" };
    case "reduce":
      return { label: "Reduzir", tone: "dn", key: "reduce" };
    case "sell":
      return { label: "Vender", tone: "dn", key: "sell" };
    case "avoid":
      return { label: "Evitar", tone: "dn", key: "avoid" };
    case "alert":
      return { label: "Alerta", tone: "dn", key: "alert" };
    default:
      return { label: action || "—", tone: "ne", key: key || "unknown" };
  }
}

/** Ordem fixa dos contadores do painel. */
export const ACTION_ORDER = ["buy", "hold", "watch", "reduce", "sell", "avoid", "alert"];

export function verdictTone(v: string | null | undefined): Tone {
  if (v === "Operar") return "su";
  if (v === "Evitar") return "dn";
  return "ne";
}

export function confidenceLabel(v: string | null | undefined) {
  const map: Record<string, string> = {
    high: "Alta", medium: "Média", low: "Baixa", alta: "Alta", "média": "Média", media: "Média", baixa: "Baixa",
    "高": "Alta", "中": "Média", "低": "Baixa",
  };
  return v ? (map[v.toLowerCase()] ?? v) : "—";
}

/** Item de checklist da IA ("✅ ...", "⚠️ ...", "❌ ...") → tom + glifo + texto limpo. */
export function checklistItem(text: string): { tone: Tone; glyph: string; text: string } {
  const t = text.trim();
  const strip = (s: string) => s.replace(/^[\s✅✔☑️⚠️❌✖✗❗!️️]+/u, "").trim();
  if (/^(✅|✔|☑)/u.test(t)) return { tone: "su", glyph: "✓", text: strip(t) };
  if (/^(❌|✖|✗)/u.test(t)) return { tone: "dn", glyph: "✕", text: strip(t) };
  if (/^(⚠|❗|!)/u.test(t)) return { tone: "ne", glyph: "!", text: strip(t) };
  return { tone: "ne", glyph: "•", text: t };
}

/** Texto livre de sentimento → pílula. */
export function sentimentTone(text: string): { tone: Tone; label: string } {
  const t = text.toLowerCase();
  if (/(muito positiv|otimist|bullish|positiv|favor[aá]vel)/.test(t) && !/(negativ|pessimist)/.test(t))
    return { tone: "su", label: "Positivo" };
  if (/(negativ|pessimist|bearish|desfavor[aá]vel)/.test(t)) return { tone: "dn", label: "Negativo" };
  return { tone: "ne", label: "Neutro" };
}

/** Força da tendência (0–100) → texto. */
export function trendStrengthLabel(v: number | null | undefined) {
  if (!isNum(v)) return "—";
  if (v >= 70) return "Forte";
  if (v >= 50) return "Moderada";
  return "Fraca";
}

export function asText(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v.trim();
  if (Array.isArray(v)) return v.map(asText).filter(Boolean).join("\n");
  return JSON.stringify(v, null, 2);
}

/** Lê um caminho como "dashboard.battle_plan.sniper_points" de um objeto JSON. */
export function pick(obj: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>(
    (acc, key) => (acc && typeof acc === "object" ? (acc as Record<string, unknown>)[key] : undefined),
    obj,
  );
}

export function pickText(obj: unknown, path: string): string {
  return asText(pick(obj, path));
}

export function pickNum(obj: unknown, path: string): number | null {
  const v = pick(obj, path);
  return isNum(v) ? v : null;
}

export function pickList(obj: unknown, path: string): string[] {
  const v = pick(obj, path);
  if (!Array.isArray(v)) return [];
  return v.map((x) => asText(x)).filter(Boolean);
}

/** Símbolo da moeda do relatório: B3 grava currency=BRL; o daily_stock_analysis (EUA) não grava. */
export function currencySymbol(raw: unknown) {
  return pick(raw, "currency") === "BRL" ? "R$" : "US$";
}

export function fmtMoney(v: number | null | undefined, raw: unknown) {
  const s = fmtPrice(v);
  return s === "—" ? s : `${currencySymbol(raw)} ${s}`;
}

export function fmtMoneyCompact(v: number | null | undefined, raw: unknown) {
  const s = fmtCompact(v);
  return s === "—" ? s : `${currencySymbol(raw)} ${s}`;
}

const RECOMMENDATION_PT: Record<string, string> = {
  strong_buy: "Compra forte", buy: "Compra", hold: "Neutro", underperform: "Abaixo do mercado",
  sell: "Venda", strong_sell: "Venda forte", none: "—",
};
export function recommendationLabel(v: unknown) {
  return typeof v === "string" ? (RECOMMENDATION_PT[v] ?? v) : "—";
}
