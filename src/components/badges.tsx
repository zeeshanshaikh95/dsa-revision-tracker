import { Check, CircleAlert, CircleCheck, Clock3 } from "lucide-react";
import type { Confidence, Difficulty, ReviewStatus } from "../types";
import { CONFIDENCE_META, DIFFICULTY_STYLES } from "../types";

export function ReviewStatusBadge({ status }: { status: ReviewStatus }) {
  if (status === "overdue") {
    return (
      <span className="inline-flex animate-pulse-soft items-center gap-1.5 rounded-full bg-rose-500/10 px-2.5 py-1 text-xs font-semibold text-rose-400 ring-1 ring-inset ring-rose-500/30">
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping-soft rounded-full bg-rose-400" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-rose-400" />
        </span>
        Overdue
      </span>
    );
  }
  if (status === "today") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 px-2.5 py-1 text-xs font-semibold text-amber-400 ring-1 ring-inset ring-amber-500/40">
        <Clock3 className="h-3 w-3" />
        Review Today
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-800/80 px-2.5 py-1 text-xs font-medium text-zinc-400 ring-1 ring-inset ring-zinc-700/60">
      <CircleCheck className="h-3 w-3 text-zinc-500" />
      Safe
    </span>
  );
}

export function ModuleTag({ module }: { module: string }) {
  return (
    <span className="inline-flex max-w-[11rem] items-center truncate rounded-md bg-zinc-800/70 px-2 py-0.5 text-xs font-medium text-zinc-400 ring-1 ring-inset ring-zinc-700/50">
      {module}
    </span>
  );
}

/** 3-bar signal icon + colored dot for confidence. */
export function ConfidenceIndicator({
  confidence,
  showLabel = false,
}: {
  confidence: Confidence;
  showLabel?: boolean;
}) {
  const meta = CONFIDENCE_META[confidence];
  const levels = confidence === "mastered" ? 3 : confidence === "hints" ? 2 : 1;
  return (
    <span className="inline-flex items-center gap-2" title={meta.hint}>
      <span className="flex items-end gap-[3px]" aria-hidden>
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className={`w-[3px] rounded-sm ${
              i < levels ? meta.bar : "bg-zinc-700"
            }`}
            style={{ height: `${6 + i * 3}px` }}
          />
        ))}
      </span>
      <span className={`h-2 w-2 rounded-full ${meta.dot}`} />
      {showLabel && (
        <span className="text-xs font-medium text-zinc-400">{meta.label}</span>
      )}
    </span>
  );
}

export function DifficultyBadge({ difficulty }: { difficulty: Difficulty }) {
  const meta = DIFFICULTY_STYLES[difficulty];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${meta.badge}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
      {meta.label}
    </span>
  );
}

export function CompletedMark() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-zinc-800 px-2 py-0.5 text-[11px] font-medium text-zinc-500 ring-1 ring-inset ring-zinc-700/60">
      <Check className="h-3 w-3" />
      Done
    </span>
  );
}

export function EmptyHint({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
      <CircleAlert className="h-8 w-8 text-zinc-700" />
      <p className="text-sm text-zinc-500">{label}</p>
    </div>
  );
}
