import { useEffect, useRef, useState } from "react";
import {
  BookOpen,
  Clock3,
  Code2,
  ExternalLink,
  Eye,
  Pause,
  Play,
  RotateCcw,
  Timer,
  X,
} from "lucide-react";
import type { Problem } from "../types";
import { relativeDay, todayKey } from "../lib/spaced";
import { Markdown } from "../lib/markdown";
import { DifficultyBadge, ModuleTag } from "./badges";
import { ProgressRing } from "./ProgressRing";

type TabKey = "intuition" | "complexity";

const TIMER_PRESETS = [
  { label: "10m", seconds: 600 },
  { label: "15m", seconds: 900 },
  { label: "25m", seconds: 1500 },
];

interface DrawerProps {
  problem: Problem | null;
  onClose: () => void;
  onUpdate: (id: string, patch: Partial<Problem>) => void;
  onResetReview: (id: string) => string;
}

function formatTime(total: number): string {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function Drawer({ problem, onClose, onUpdate, onResetReview }: DrawerProps) {
  const [tab, setTab] = useState<TabKey>("intuition");
  const [preview, setPreview] = useState(false);
  const [resetMsg, setResetMsg] = useState<string | null>(null);

  // Focus timer state
  const [totalSecs, setTotalSecs] = useState(900);
  const [left, setLeft] = useState(900);
  const [running, setRunning] = useState(false);
  const totalRef = useRef(900);

  useEffect(() => {
    if (!problem) return;
    setTab("intuition");
    setPreview(false);
    setResetMsg(null);
    setRunning(false);
    setLeft(totalRef.current);
  }, [problem?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!running) return;
    const t = setInterval(
      () => setLeft((s) => (s <= 1 ? 0 : s - 1)),
      1000,
    );
    return () => clearInterval(t);
  }, [running]);

  useEffect(() => {
    if (left <= 0 && running) setRunning(false);
  }, [left, running]);

  useEffect(() => {
    if (!problem) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [problem, onClose]);

  if (!problem) return null;

  const today = todayKey();
  const timerPct = totalRef.current === 0 ? 0 : Math.round((left / totalRef.current) * 100);

  const pickPreset = (seconds: number) => {
    totalRef.current = seconds;
    setTotalSecs(seconds);
    setLeft(seconds);
    setRunning(false);
  };

  const handleReset = () => {
    const next = onResetReview(problem.id);
    setResetMsg(`Next review scheduled for ${relativeDay(next, today)}.`);
  };

  const isDone = left <= 0;

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div
        className="absolute inset-0 animate-fade-in bg-zinc-950/60 backdrop-blur-[2px]"
        onClick={onClose}
      />

      {/* Panel */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={`Revision notes for ${problem.title}`}
        className="absolute inset-y-0 right-0 flex w-full max-w-[480px] animate-slide-in-right flex-col border-l border-zinc-800 bg-zinc-900/95 shadow-2xl backdrop-blur-xl"
      >
        {/* Header */}
        <div className="border-b border-zinc-800/80 p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-bold text-zinc-100">
                  {problem.title}
                </h2>
                <DifficultyBadge difficulty={problem.difficulty} />
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                <ModuleTag module={problem.module} />
                <span className="inline-flex items-center gap-1">
                  <Timer className="h-3 w-3" />
                  Last solved {relativeDay(problem.lastSolved, today)}
                </span>
                {problem.lastDuration && (
                  <span
                    className="inline-flex items-center gap-1 rounded-md bg-zinc-800/80 px-2 py-0.5 font-mono text-[11px] text-zinc-400 ring-1 ring-inset ring-zinc-700/50"
                    title="Time taken on the last solve"
                  >
                    <Clock3 className="h-3 w-3" />
                    {problem.lastDuration}
                  </span>
                )}
              </div>
              <div className="mt-2 flex items-center gap-2">
                <span className="inline-flex items-center rounded-md bg-indigo-500/10 px-2 py-0.5 text-[11px] font-semibold text-indigo-300 ring-1 ring-inset ring-indigo-500/25">
                  {problem.pattern}
                </span>
                <a
                  href={problem.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-400 transition-colors hover:text-emerald-300"
                >
                  Open on platform <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>
            <button
              onClick={onClose}
              aria-label="Close drawer"
              className="shrink-0 rounded-lg p-1.5 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Tabs */}
          <div className="mt-4 flex gap-1 rounded-lg border border-zinc-800 bg-zinc-950/60 p-1">
            {(
              [
                { key: "intuition", label: "My Intuition", icon: BookOpen },
                { key: "complexity", label: "Complexity", icon: Code2 },
              ] as const
            ).map(({ key, label, icon: Icon }) => {
              const active = tab === key;
              return (
                <button
                  key={key}
                  onClick={() => setTab(key)}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-semibold transition-colors ${
                    active
                      ? "bg-zinc-800 text-zinc-100"
                      : "text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {tab === "intuition" ? (
            <div>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  Plain-English notes & edge cases
                </p>
                <button
                  onClick={() => setPreview((v) => !v)}
                  className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold transition-colors ${
                    preview
                      ? "bg-emerald-500/15 text-emerald-400 ring-1 ring-inset ring-emerald-500/30"
                      : "text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
                  }`}
                >
                  <Eye className="h-3 w-3" />
                  {preview ? "Editing" : "Preview"}
                </button>
              </div>

              {preview ? (
                <div className="min-h-[220px] rounded-lg border border-zinc-800 bg-zinc-950/60 p-4">
                  <Markdown text={problem.intuition} />
                </div>
              ) : (
                <textarea
                  value={problem.intuition}
                  onChange={(e) =>
                    onUpdate(problem.id, { intuition: e.target.value })
                  }
                  placeholder={"Write your intuition…\n\n**Edge cases**\n- Think about empty input\n- Mind off-by-one errors"}
                  spellCheck={false}
                  className="min-h-[220px] w-full resize-y rounded-lg border border-zinc-800 bg-zinc-950/60 p-4 font-mono text-[13px] leading-relaxed text-zinc-200 placeholder:text-zinc-600 transition-colors focus:border-emerald-500/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
              )}
              <p className="mt-2 text-[11px] text-zinc-600">
                Supports markdown: **bold**, `code`, - lists, # headings, &gt; quotes.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Optimal Space / Time Complexity
              </p>
              {(
                [
                  { label: "Time", value: problem.timeComplexity, key: "timeComplexity" },
                  { label: "Space", value: problem.spaceComplexity, key: "spaceComplexity" },
                ] as const
              ).map(({ label, value, key }) => (
                <div key={key}>
                  <span className="mb-1.5 block text-xs font-medium text-zinc-400">
                    {label}
                  </span>
                  <div className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950">
                    <div className="flex items-center justify-between border-b border-zinc-800/70 px-3 py-1.5">
                      <span className="flex items-center gap-1.5 font-mono text-[10px] text-zinc-500">
                        <span className="h-2 w-2 rounded-full bg-emerald-400/70" />
                        {label.toLowerCase()}.txt
                      </span>
                      <span className="font-mono text-[10px] text-zinc-600">big-o</span>
                    </div>
                    <input
                      value={value}
                      onChange={(e) =>
                        onUpdate(problem.id, { [key]: e.target.value } as Partial<Problem>)
                      }
                      spellCheck={false}
                      aria-label={`${label} complexity`}
                      className="w-full bg-transparent px-3 py-3 font-mono text-sm text-emerald-300 focus:outline-none"
                    />
                  </div>
                </div>
              ))}
              <p className="text-[11px] leading-relaxed text-zinc-600">
                Big-O ignores constants and lower-order terms. Revisit if your
                solution exceeds the expected bound.
              </p>
            </div>
          )}
        </div>

        {/* Footer: reset + timer */}
        <div className="space-y-3 border-t border-zinc-800/80 p-5">
          <button
            onClick={handleReset}
            className="w-full rounded-xl bg-emerald-500 px-4 py-3 text-sm font-bold text-zinc-950 shadow-lg shadow-emerald-500/25 transition-all hover:bg-emerald-400 active:scale-[0.99]"
          >
            I Re-solved This From Scratch Now
          </button>
          {resetMsg && (
            <p className="animate-slide-up text-center text-xs font-medium text-emerald-400">
              {resetMsg}
            </p>
          )}

          {/* Focus timer */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
            <div className="flex items-center justify-between">
              <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                <Timer className="h-3.5 w-3.5" />
                Focus Timer
              </p>
              <div className="flex gap-1">
                {TIMER_PRESETS.map((p) => (
                  <button
                    key={p.label}
                    onClick={() => pickPreset(p.seconds)}
                    className={`rounded-md px-2 py-1 text-[11px] font-semibold transition-colors ${
                      totalSecs === p.seconds
                        ? "bg-emerald-500/15 text-emerald-400 ring-1 ring-inset ring-emerald-500/30"
                        : "text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-3 flex items-center gap-4">
              <ProgressRing pct={timerPct} size={56} stroke={5}>
                <span className="font-mono text-[11px] font-bold text-zinc-100">
                  {formatTime(left)}
                </span>
              </ProgressRing>
              <div className="flex flex-1 items-center gap-2">
                <button
                  onClick={() => setRunning((r) => !r && left > 0)}
                  disabled={isDone}
                  className={`flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg text-sm font-semibold transition-all disabled:opacity-40 ${
                    running
                      ? "bg-zinc-800 text-amber-400 hover:bg-zinc-700"
                      : "bg-emerald-500 text-zinc-950 hover:bg-emerald-400"
                  }`}
                >
                  {running ? (
                    <>
                      <Pause className="h-4 w-4" /> Pause
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4" /> {isDone ? "Finished" : "Start"}
                    </>
                  )}
                </button>
                <button
                  onClick={() => pickPreset(totalRef.current)}
                  aria-label="Reset timer"
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-800 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
                >
                  <RotateCcw className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
