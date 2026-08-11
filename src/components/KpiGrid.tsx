import { CheckCircle2, Flame, Layers, ListChecks, Zap } from "lucide-react";
import type { Problem } from "../types";
import { moduleProgress, reviewStatus, todayKey } from "../lib/spaced";
import { ProgressRing } from "./ProgressRing";

interface KpiGridProps {
  problems: Problem[];
  streak: number;
  onShowDue: () => void;
}

export function KpiGrid({ problems, streak, onShowDue }: KpiGridProps) {
  const total = problems.length;
  const solved = problems.filter((p) => p.status === "completed").length;
  const pct = total === 0 ? 0 : Math.round((solved / total) * 100);
  const today = todayKey();

  const due = problems.filter(
    (p) => p.status === "active" && reviewStatus(p, today) !== "safe",
  );
  const overdue = due.filter((p) => reviewStatus(p, today) === "overdue");
  const dueTitles = due
    .slice(0, 3)
    .map((p) => p.title)
    .join(" · ");

  const modules = moduleProgress(problems).slice(0, 3);

  return (
    <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {/* 1 — Total solved */}
      <div className="card flex items-center gap-4 p-5">
        <ProgressRing pct={pct} size={72} stroke={7}>
          <span className="text-sm font-bold text-zinc-100">{pct}%</span>
        </ProgressRing>
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
            Total Solved
          </p>
          <p className="mt-1 text-xl font-bold text-zinc-100">
            {solved} <span className="text-sm font-medium text-zinc-500">/ {total}</span>
          </p>
          <p className="mt-0.5 flex items-center gap-1 text-xs text-zinc-500">
            <ListChecks className="h-3 w-3" />
            Problems logged
          </p>
        </div>
      </div>

      {/* 2 — Due today */}
      <button
        onClick={onShowDue}
        className={`card group relative overflow-hidden p-5 text-left transition-colors hover:border-zinc-700 ${
          due.length > 0 ? "ring-1 ring-inset ring-amber-500/30" : ""
        }`}
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
              Due for Review
            </p>
            <p
              className={`mt-1 text-3xl font-bold ${
                due.length > 0 ? "text-amber-400" : "text-zinc-100"
              }`}
            >
              {due.length}
            </p>
          </div>
          <span
            className={`flex h-10 w-10 items-center justify-center rounded-lg ${
              due.length > 0
                ? "animate-pulse-soft bg-amber-500/15 text-amber-400"
                : "bg-zinc-800/70 text-zinc-500"
            }`}
          >
            <Zap className="h-5 w-5" />
          </span>
        </div>
        <p className="mt-2 truncate text-xs text-zinc-500">
          {due.length > 0
            ? dueTitles || "Problems need a pass"
            : "All caught up — nothing due"}
        </p>
        {overdue.length > 0 && (
          <span className="mt-2 inline-flex items-center gap-1 rounded-md bg-rose-500/10 px-2 py-0.5 text-[11px] font-semibold text-rose-400 ring-1 ring-inset ring-rose-500/25">
            {overdue.length} overdue
          </span>
        )}
        <span className="absolute inset-x-0 bottom-0 h-0.5 origin-left scale-x-0 bg-amber-400 transition-transform duration-300 group-hover:scale-x-100" />
      </button>

      {/* 3 — Mastery streak */}
      <div className="card p-5">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
              Mastery Streak
            </p>
            <p className="mt-1 flex items-center gap-2 text-3xl font-bold text-zinc-100">
              <Flame
                className={`h-7 w-7 ${streak > 0 ? "text-amber-400" : "text-zinc-700"}`}
                fill="currentColor"
              />
              {streak}
            </p>
          </div>
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-800/70 text-zinc-400">
            <CheckCircle2 className="h-5 w-5" />
          </span>
        </div>
        <p className="mt-2 text-xs text-zinc-500">
          {streak > 0 ? (
            <>
              <span className="font-semibold text-amber-400">
                {streak} day{streak === 1 ? "" : "s"}
              </span>{" "}
              active — keep the chain alive
            </>
          ) : (
            "Solve one problem today to start a chain"
          )}
        </p>
      </div>

      {/* 4 — Module completion */}
      <div className="card p-5">
        <div className="flex items-start justify-between gap-2">
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
            Core Modules
          </p>
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-800/70 text-zinc-400">
            <Layers className="h-5 w-5" />
          </span>
        </div>
        <div className="mt-3 space-y-2.5">
          {modules.length === 0 && (
            <p className="text-xs text-zinc-600">No modules tracked yet.</p>
          )}
          {modules.map((m) => (
            <div key={m.module}>
              <div className="mb-1 flex items-baseline justify-between gap-2">
                <span className="truncate text-xs font-medium text-zinc-300">
                  {m.module}
                </span>
                <span className="shrink-0 font-mono text-[11px] text-zinc-500">
                  {m.pct}%
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-zinc-800">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${
                    m.pct === 100
                      ? "bg-emerald-400"
                      : m.pct >= 50
                        ? "bg-amber-400"
                        : "bg-rose-400"
                  }`}
                  style={{ width: `${m.pct}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
