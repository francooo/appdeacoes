export function fmtPrice(v: number | null | undefined) {
  if (v == null || Number.isNaN(v)) return "—";
  return v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function fmtPct(v: number | null | undefined) {
  if (v == null || Number.isNaN(v)) return "—";
  const s = v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${v > 0 ? "+" : ""}${s}%`;
}

export function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Faixas do próprio daily_stock_analysis: >70 forte alta, >60 alta, 40–60 lateral, <40 baixa. */
export function scoreTone(score: number | null) {
  if (score == null) return { label: "Sem nota", cls: "tone-neutral" };
  if (score > 70) return { label: "Forte alta", cls: "tone-strong-up" };
  if (score > 60) return { label: "Alta", cls: "tone-up" };
  if (score >= 40) return { label: "Lateral", cls: "tone-neutral" };
  return { label: "Baixa", cls: "tone-down" };
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
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

export function pickList(obj: unknown, path: string): string[] {
  const v = pick(obj, path);
  if (!Array.isArray(v)) return [];
  return v.map((x) => asText(x)).filter(Boolean);
}

export function fmtCompact(v: number | null | undefined) {
  if (v == null || Number.isNaN(v)) return "—";
  return v.toLocaleString("pt-BR", { notation: "compact", maximumFractionDigits: 1 });
}

/** Ação canônica do daily_stock_analysis → rótulo e cor. */
export function actionTone(action: string | null | undefined) {
  switch ((action ?? "").toLowerCase()) {
    case "buy":
    case "add":
      return { label: "Comprar", cls: "tone-strong-up" };
    case "hold":
      return { label: "Manter", cls: "tone-up" };
    case "watch":
      return { label: "Observar", cls: "tone-neutral" };
    case "reduce":
      return { label: "Reduzir", cls: "tone-down" };
    case "sell":
    case "avoid":
      return { label: "Vender / evitar", cls: "tone-down" };
    case "alert":
      return { label: "Alerta", cls: "tone-down" };
    default:
      return { label: action || "—", cls: "tone-neutral" };
  }
}

export function confidenceLabel(v: string | null | undefined) {
  const map: Record<string, string> = { high: "Alta", medium: "Média", low: "Baixa", "高": "Alta", "中": "Média", "低": "Baixa" };
  return v ? (map[v.toLowerCase()] ?? v) : "—";
}

/** Símbolo da moeda do relatório: B3 grava currency=BRL; o daily_stock_analysis (EUA) não grava. */
export function currencySymbol(raw: unknown) {
  return pick(raw, "currency") === "BRL" ? "R$" : "US$";
}

export function fmtMoney(v: number | null | undefined, raw: unknown) {
  const s = fmtPrice(v);
  return s === "—" ? s : `${currencySymbol(raw)} ${s}`;
}

const RECOMMENDATION_PT: Record<string, string> = {
  strong_buy: "Compra forte", buy: "Compra", hold: "Neutro", underperform: "Abaixo do mercado",
  sell: "Venda", strong_sell: "Venda forte", none: "—",
};
export function recommendationLabel(v: unknown) {
  return typeof v === "string" ? (RECOMMENDATION_PT[v] ?? v) : "—";
}
