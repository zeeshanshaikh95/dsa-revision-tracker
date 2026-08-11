"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  ChevronRight,
  Quote as QuoteIcon,
  SkipForward,
  X,
} from "lucide-react";
import type { Problem } from "../types";
import { relativeDay, reviewStatus, todayKey } from "../lib/spaced";
import { generateRevisionNotes } from "../lib/revisionNotes";
import type { Quote } from "../lib/quotes";
import { getQuotePool, randomQuoteIndex } from "../lib/quotes";
import {
  ConfidenceIndicator,
  DifficultyBadge,
  ModuleTag,
  ReviewStatusBadge,
} from "./badges";

interface ReviewSessionProps {
  open: boolean;
  problems: Problem[];
  onClose: () => void;
  /** Advance the review interval for a problem (the "solved" action). */
  onResetReview: (id: string) => void;
  /** User-authored quotes mixed into the celebratory pick. */
  customQuotes: Quote[];
}

/**
 * A focused review session: walks through the due queue one problem at a
 * time, showing the generated revision notes so each pass doubles as study.
 */
export function ReviewSession({
  open,
  problems,
  onClose,
  onResetReview,
  customQuotes,
}: ReviewSessionProps) {
  // Stable celebratory quote pool for the completion screen.
  const donePool = getQuotePool(customQuotes);
  const today = todayKey();

  // Snapshot the due queue when the session opens, most urgent first.
  const queue = useMemo(() => {
    if (!open) return [] as Problem[];
    return problems
      .filter((p) => p.status === "active" && reviewStatus(p, today) !== "safe")
      .sort((a, b) => a.nextReview.localeCompare(b.nextReview));
  }, [open, problems, today]);

  const [index, setIndex] = useState(0);
  // Stable celebratory quote for the completion screen.
  const [doneQuote] = useState(() => randomQuoteIndex(null, donePool.length));

  // Reset progress whenever a new session starts.
  useEffect(() => {
    if (open) setIndex(0);
  }, [open]);

  const done = queue.length > 0 && index >= queue.length;
  const currentId = queue[index]?.id;
  const current = problems.find((p) => p.id === currentId) ?? null;

  // A problem may be deleted mid-session (e.g. via the assistant) — skip it.
  useEffect(() => {
    if (open && queue.length > 0 && !done && !current && index < queue.length) {
      setIndex((i) => i + 1);
    }
  }, [open, queue.length, done, current, index]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const advance = () => setIndex((i) => i + 1);

  const note = current ? generateRevisionNotes(current) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 animate-fade-in bg-zinc-950/70 backdrop-blur-[2px]"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative w-full max-w-lg animate-scale-in overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/95 shadow-2xl backdrop-blur-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800/70 px-5 py-4">
          <div>
            <p className="text-sm font-bold text-zinc-100">Review Session</p>
            <p className="text-[11px] text-zinc-500">
              {done
                ? "All done"
                : `${index + 1} of ${queue.length} due for review`}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close review session"
            className="rounded-lg p-1.5 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {done ? (
          /* Summary */
          <div className="flex flex-col items-center gap-3 px-5 py-10 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400">
              <CheckCircle2 className="h-7 w-7" />
            </span>
            <p className="text-lg font-bold text-zinc-100">Session complete 🎉</p>
            <p className="max-w-sm text-sm leading-relaxed text-zinc-500">
              You reviewed {queue.length} problem{queue.length === 1 ? "" : "s"}.
              The ones you solved are scheduled for their next interval; the
              skipped ones stay in your due queue.
            </p>
            <p className="mx-auto max-w-sm text-center text-sm italic leading-relaxed text-zinc-400">
              <QuoteIcon className="mx-auto mb-1 h-4 w-4 text-emerald-400/80" />
              “{donePool[doneQuote]?.text}”
              <span className="ml-2 block not-italic text-xs font-semibold text-zinc-600">
                — {donePool[doneQuote]?.author}
              </span>
            </p>
            <button
              onClick={onClose}
              className="mt-2 inline-flex h-10 items-center gap-1.5 rounded-lg bg-emerald-500 px-5 text-sm font-bold text-zinc-950 transition-all hover:bg-emerald-400 active:scale-95"
            >
              Back to dashboard
            </button>
          </div>
        ) : current ? (
          <>
            {/* Progress bar */}
            <div className="h-1 w-full bg-zinc-800">
              <div
                className="h-full bg-emerald-400 transition-all duration-300"
                style={{
                  width: `${((index + (current ? 1 : 0)) / queue.length) * 100}%`,
                }}
              />
            </div>

            {/* Problem */}
            <div className="max-h-[60vh] overflow-y-auto p-5">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-bold text-zinc-100">
                  {current.title}
                </h2>
                <DifficultyBadge difficulty={current.difficulty} />
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                <ModuleTag module={current.module} />
                <span className="inline-flex items-center gap-1 rounded-md bg-indigo-500/10 px-2 py-0.5 font-semibold text-indigo-300 ring-1 ring-inset ring-indigo-500/25">
                  {current.pattern}
                </span>
                <ReviewStatusBadge status={reviewStatus(current, today)} />
                <ConfidenceIndicator confidence={current.confidence} />
              </div>
              <p className="mt-2 text-xs text-zinc-600">
                Last solved {relativeDay(current.lastSolved, today)}
                {current.lastDuration ? ` · took ${current.lastDuration}` : ""}
              </p>

              {/* Inline revision notes */}
              {note && (
                <div className="mt-4 space-y-3">
                  <div className="rounded-xl border border-indigo-500/25 bg-indigo-500/10 p-3.5">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-indigo-300">
                      The idea
                    </p>
                    <p className="mt-1 text-[13px] leading-relaxed text-zinc-300">
                      {note.idea}
                    </p>
                  </div>
                  <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3.5">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                      Watch out for
                    </p>
                    <ul className="mt-1.5 space-y-1">
                      {note.pitfalls.slice(0, 2).map((x, i) => (
                        <li
                          key={i}
                          className="flex gap-1.5 text-[13px] leading-relaxed text-zinc-400"
                        >
                          <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-rose-400" />
                          {x}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-2 border-t border-zinc-800/70 p-4">
              <button
                onClick={() => {
                  onResetReview(current.id);
                  advance();
                }}
                className="inline-flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-500 text-sm font-bold text-zinc-950 shadow-lg shadow-emerald-500/20 transition-all hover:bg-emerald-400 active:scale-[0.99]"
              >
                <CheckCircle2 className="h-4 w-4" />
                Solved — schedule next review
              </button>
              <button
                onClick={advance}
                aria-label="Skip this problem"
                title="Leave it in the due queue"
                className="inline-flex h-11 w-12 items-center justify-center rounded-xl border border-zinc-800 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
              >
                <SkipForward className="h-4 w-4" />
              </button>
            </div>
          </>
        ) : (
          /* No due problems */
          <div className="flex flex-col items-center gap-3 px-5 py-10 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-zinc-800 text-zinc-400">
              <CheckCircle2 className="h-7 w-7" />
            </span>
            <p className="text-lg font-bold text-zinc-100">Nothing due 🎉</p>
            <p className="max-w-sm text-sm leading-relaxed text-zinc-500">
              You're all caught up on reviews. Come back tomorrow — or add a
              new problem to keep the cycle going.
            </p>
            <button
              onClick={onClose}
              className="mt-2 inline-flex h-10 items-center gap-1.5 rounded-lg bg-emerald-500 px-5 text-sm font-bold text-zinc-950 transition-all hover:bg-emerald-400 active:scale-95"
            >
              <ChevronRight className="h-4 w-4" />
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
