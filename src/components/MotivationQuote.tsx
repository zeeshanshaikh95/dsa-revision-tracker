"use client";

import { useState } from "react";
import { Quote as QuoteIcon, Shuffle } from "lucide-react";
import { todayKey } from "../lib/spaced";
import {
  dailyQuoteIndex,
  MOTIVATIONAL_QUOTES,
  randomQuoteIndex,
} from "../lib/quotes";

/**
 * A slim "fuel for the grind" strip: a deterministic quote of the day with
 * a shuffle button to cycle through more. Lives at the top of the dashboard.
 */
export function MotivationQuote() {
  const [idx, setIdx] = useState(() => dailyQuoteIndex(todayKey()));
  const quote = MOTIVATIONAL_QUOTES[idx];

  const shuffle = () => setIdx((cur) => randomQuoteIndex(cur));

  return (
    <div className="card relative overflow-hidden px-5 py-3.5">
      {/* subtle accent line */}
      <span className="absolute inset-y-0 left-0 w-0.5 bg-gradient-to-b from-emerald-400 via-amber-400 to-rose-400" />
      <div className="flex items-center gap-3">
        <QuoteIcon className="h-5 w-5 shrink-0 text-emerald-400/80" />
        <p className="min-w-0 flex-1 truncate text-sm italic leading-relaxed text-zinc-300">
          “{quote.text}”
          <span className="ml-2 not-italic text-xs font-semibold text-zinc-500">
            — {quote.author}
          </span>
        </p>
        <button
          onClick={shuffle}
          aria-label="Shuffle quote"
          title="Another one"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-emerald-300 active:scale-90"
        >
          <Shuffle className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
