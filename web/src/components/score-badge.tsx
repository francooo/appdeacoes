import { scoreTone } from "@/lib/format";

export function ScoreBadge({ score, large = false }: { score: number | null; large?: boolean }) {
  const tone = scoreTone(score);
  return (
    <div className={`inline-flex items-center gap-2 ${tone.cls}`}>
      <span
        className={`tone-bg inline-flex items-center justify-center rounded-lg font-mono font-semibold tabular-nums ${
          large ? "h-14 w-16 text-2xl" : "h-8 w-10 text-sm"
        }`}
      >
        {score ?? "—"}
      </span>
      <span className={`tone-fg font-medium ${large ? "text-base" : "text-xs"}`}>{tone.label}</span>
    </div>
  );
}
