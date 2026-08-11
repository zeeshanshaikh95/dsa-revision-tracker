import { memo } from "react";
import {
  CheckCircle2,
  CircleAlert,
  Clock3,
  Layers,
  Target,
  TrendingUp,
} from "lucide-react";
import type { Problem } from "../types";
import { CONFIDENCE_META, DIFFICULTY_STYLES } from "../types";
import { currentStreak, moduleProgress, todayKey } from "../lib/spaced";
import {
  activityCalendar,
  confidenceStats,
  difficultyStats,
  formatMinutes,
  overdueCount,
  reviewForecast,
  shortDate,
  totalFocusedTime,
} from "../lib/analytics";

interface AnalyticsProps {
  problems: Problem[];
  activity: string[];
}

export const Analytics = memo(function Analytics({
  problems,
  activity,
}: AnalyticsProps) {
  const today = todayKey();
  const total = problems.length;
  const solved = problems.filter((p) => p.status === "completed").length;
  const pct = total === 0 ? 0 : Math.round((solved / total) * 100);
  const conf = confidenceStats(problems);
  const diff = difficultyStats(problems);
  const masteredPct =
    total === 0 ? 0 : Math.round((conf.mastered / total) * 100);
  const focusSec = totalFocusedTime(problems);
  const timed = problems.filter((p) => p.lastDuration).length;
  const forecast = reviewForecast(problems, today, 14);
  const overdue = overdueCount(problems, today);
  const forecastTotal = forecast.reduce((s, f) => s + f.count, 0);
  const maxForecast = Math.max(1, ...forecast.map((f) => f.count));
  const modules = moduleProgress(problems).filter((m) => m.total > 0);
  const weeks: { date: string; active: boolean }[][] = [];
  {
    const cells = activityCalendar(activity, 84);
    for (let i = 0; i < cells.length; i += 7) {
      weeks.push(cells.slice(i, i + 7));
    }
  }
  const streak = currentStreak(activity);

  if (total === 0) {
    return (
      <div className="card flex flex-col items-center justify-center gap-4 px-6 py-24 text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-zinc-800/80 text-zinc-400">
          <Target className="h-7 w-7" />
        </span>
        <div>
          <h1 className="text-xl font-bold text-zinc-100">Analytics</h1>
          <p className="mx-auto mt-1 max-w-md text-sm text-zinc-500">
            No data yet — log some problems and this page will show your
            difficulty mix, review load, and progress over time.
          </p>
        </div>
      </div>
    );
  }

  const summaryCards = [
    {
      label: "Total Problems",
      value: String(total),
      sub: `${modules.length} modules`,
      icon: Layers,
      accent: "text-zinc-400 bg-zinc-800/70",
    },
    {
      label: "Completed",
      value: `${solved} / ${total}`,
      sub: `${pct}% done`,
      icon: CheckCircle2,
      accent: "text-emerald-400 bg-emerald-500/10",
      bar: pct,
      barColor: "bg-emerald-400",
    },
    {
      label: "Mastery Rate",
      value: `${masteredPct}%`,
      sub: `${conf.mastered} solved from scratch`,
      icon: TrendingUp,
      accent: "text-amber-400 bg-amber-500/10",
    },
    {
      label: "Focused Time",
      value: focusSec > 0 ? formatMinutes(focusSec) : "—",
      sub: timed > 0 ? `across ${timed} timed solves` : "no time logged yet",
      icon: Clock3,
      accent: "text-rose-400 bg-rose-500/10",
    },
  ];

  const diffTotal = diff.easy.total + diff.medium.total + diff.hard.total;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2.5">
        <div>
          <h1 className="text-lg font-bold text-zinc-100">Analytics</h1>
          <p className="text-sm text-zinc-500">
            Your progress, review load, and mastery at a glance.
          </p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map((c) => (
          <div key={c.label} className="card p-5">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                  {c.label}
                </p>
                <p className="mt-1 text-2xl font-bold text-zinc-100">{c.value}</p>
                <p className="mt-0.5 text-xs text-zinc-500">{c.sub}</p>
              </div>
              <span
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${c.accent}`}
              >
                <c.icon className="h-5 w-5" />
              </span>
            </div>
            {"bar" in c && c.bar !== undefined && (
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-zinc-800">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${c.barColor}`}
                  style={{ width: `${c.bar}%` }}
                />
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Difficulty distribution */}
        <section className="card p-5">
          <h2 className="text-sm font-semibold text-zinc-300">
            Difficulty Mix
          </h2>
          <p className="text-xs text-zinc-500">
            {diffTotal} problems across easy, medium, and hard
          </p>
          <div className="mt-4 flex h-2.5 overflow-hidden rounded-full bg-zinc-800">
            {(["easy", "medium", "hard"] as const).map((d) =>
              diff[d].total > 0 ? (
                <div
                  key={d}
                  className={`h-full ${DIFFICULTY_STYLES[d].dot}`}
                  style={{
                    width: `${(diff[d].total / diffTotal) * 100}%`,
                  }}
                  title={`${diff[d].label}: ${diff[d].total}`}
                />
              ) : null,
            )}
          </div>
          <div className="mt-4 space-y-3">
            {(["easy", "medium", "hard"] as const).map((d) => (
              <div key={d}>
                <div className="mb-1 flex items-baseline justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-xs font-medium text-zinc-300">
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${DIFFICULTY_STYLES[d].dot}`}
                    />
                    {diff[d].label}
                    <span className="font-mono text-[11px] text-zinc-500">
                      {diff[d].solved}/{diff[d].total} solved
                    </span>
                  </span>
                  <span className="font-mono text-[11px] text-zinc-500">
                    {diff[d].pct}%
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-zinc-800">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${
                      diff[d].pct === 100
                        ? "bg-emerald-400"
                        : diff[d].pct >= 50
                          ? "bg-amber-400"
                          : "bg-rose-400"
                    }`}
                    style={{ width: `${diff[d].pct}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Confidence breakdown */}
        <section className="card p-5">
          <h2 className="text-sm font-semibold text-zinc-300">
            Confidence Breakdown
          </h2>
          <p className="text-xs text-zinc-500">
            How well you know what&apos;s in the bank
          </p>
          <div className="mt-4 space-y-4">
            {(["struggled", "hints", "mastered"] as const).map((c) => {
              const meta = CONFIDENCE_META[c];
              const share = total === 0 ? 0 : Math.round((conf[c] / total) * 100);
              return (
                <div key={c}>
                  <div className="mb-1 flex items-baseline justify-between gap-2">
                    <span className="flex items-center gap-1.5 text-xs font-medium text-zinc-300">
                      <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
                      {meta.label}
                      <span
                        className={`rounded-md px-1.5 py-0.5 font-mono text-[11px] ${meta.chip}`}
                      >
                        {conf[c]}
                      </span>
                    </span>
                    <span className="font-mono text-[11px] text-zinc-500">
                      {share}%
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-zinc-800">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${meta.bar}`}
                      style={{ width: `${share}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <p className="mt-4 text-xs text-zinc-500">
            <span className="font-semibold text-rose-400">Struggled</span> needs
            another pass ·{" "}
            <span className="font-semibold text-amber-400">Hints</span> close
            but needs reps ·{" "}
            <span className="font-semibold text-emerald-400">Mastered</span>{" "}
            solved from scratch
          </p>
        </section>
      </div>

      {/* Review load forecast */}
      <section className="card p-5">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-zinc-300">
              Review Load — Next 14 Days
            </h2>
            <p className="text-xs text-zinc-500">
              Problems coming due each day.{" "}
              {forecastTotal > 0
                ? `${forecastTotal} scheduled in the window`
                : "nothing scheduled — clear runway"}
              {overdue > 0 && (
                <span className="ml-1.5 font-semibold text-rose-400">
                  · {overdue} overdue now
                </span>
              )}
            </p>
          </div>
        </div>
        <div className="mt-5 flex h-32 items-end gap-1.5">
          {forecast.map((f, i) => (
            <div
              key={f.date}
              className="group relative flex h-full flex-1 flex-col justify-end"
              title={`${shortDate(f.date)} — ${f.count} due`}
            >
              <div
                className={`w-full rounded-t-md transition-all duration-500 ${
                  f.count > 0
                    ? i === 0
                      ? "bg-amber-400"
                      : "bg-amber-500/60 group-hover:bg-amber-400"
                    : "bg-zinc-800/80"
                }`}
                style={{ height: `${(f.count / maxForecast) * 100}%`, minHeight: f.count > 0 ? 4 : 2 }}
              />
              <span
                className={`mt-1.5 text-center text-[10px] font-mono ${
                  i === 0 ? "font-bold text-amber-400" : "text-zinc-600"
                }`}
              >
                {i === 0 ? "Tdy" : f.date.slice(8)}
              </span>
            </div>
          ))}
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Module completion */}
        <section className="card p-5">
          <h2 className="text-sm font-semibold text-zinc-300">
            Module Completion
          </h2>
          <p className="text-xs text-zinc-500">
            Solved per topic, best-first
          </p>
          <div className="mt-4 max-h-[300px] space-y-3 overflow-y-auto pr-1">
            {modules.map((m) => (
              <div key={m.module}>
                <div className="mb-1 flex items-baseline justify-between gap-2">
                  <span className="truncate text-xs font-medium text-zinc-300">
                    {m.module}
                  </span>
                  <span className="shrink-0 font-mono text-[11px] text-zinc-500">
                    {m.solved}/{m.total} · {m.pct}%
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
        </section>

        {/* Activity heatmap */}
        <section className="card p-5">
          <h2 className="text-sm font-semibold text-zinc-300">
            Activity — Last 12 Weeks
          </h2>
          <p className="text-xs text-zinc-500">
            Days you solved at least one problem
            {streak > 0 && (
              <span className="ml-1.5 font-semibold text-amber-400">
                · {streak} day streak
              </span>
            )}
          </p>
          <div className="mt-4 flex gap-1 overflow-x-auto">
            {weeks.map((week, wi) => (
              <div key={wi} className="flex flex-col gap-1">
                {week.map((cell) => (
                  <span
                    key={cell.date}
                    title={`${shortDate(cell.date)} — ${
                      cell.active ? "solved" : "no solve"
                    }`}
                    className={`h-2.5 w-2.5 rounded-[3px] transition-colors ${
                      cell.active ? "bg-emerald-400/80" : "bg-zinc-800"
                    }`}
                  />
                ))}
              </div>
            ))}
          </div>
          <p className="mt-3 flex items-center gap-1.5 text-xs text-zinc-500">
            <CircleAlert className="h-3 w-3 text-zinc-600" />
            {shortDate(weeks[0]?.[0]?.date ?? today)} – {shortDate(today)} ·{" "}
            {new Set(activity).size} active days logged
          </p>
        </section>
      </div>
    </div>
  );
});
