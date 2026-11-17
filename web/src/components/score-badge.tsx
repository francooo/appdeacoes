import { scoreTone } from "@/lib/format";

/** Selo da nota (0–100) com rótulo opcional da faixa. */
export function ScoreBadge({
  score,
  large = false,
  showLabel = false,
  caption,
}: {
  score: number | null;
  large?: boolean;
  showLabel?: boolean;
  caption?: string;
}) {
  const { label, tone } = scoreTone(score);
  return (
    <div className={`inline-flex items-center ${large ? "gap-3" : "gap-2.5"} ${tone}`}>
      <span className={`score-badge ${large ? "score-badge--large" : ""} tone-bg`}>{score ?? "—"}</span>
      {(showLabel || caption) && (
        <span className="flex flex-col">
          {showLabel && (
            <span className={`tone-fg ${large ? "text-sm font-semibold" : "text-[13px] font-medium"}`}>{label}</span>
          )}
          {caption && <span className="text-xs text-muted">{caption}</span>}
        </span>
      )}
    </div>
  );
}
