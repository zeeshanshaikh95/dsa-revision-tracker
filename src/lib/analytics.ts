import type { Confidence, Difficulty, Problem } from "../types";
import { addDaysKey, todayKey } from "./spaced";

export interface Bucket {
  label: string;
  total: number;
  solved: number;
  pct: number;
}

function makeBucket(label: string, total: number, solved: number): Bucket {
  return { label, total, solved, pct: total === 0 ? 0 : Math.round((solved / total) * 100) };
}

/** Solved/total per difficulty. */
export function difficultyStats(problems: Problem[]): Record<Difficulty, Bucket> {
  const counts: Record<Difficulty, { total: number; solved: number }> = {
    easy: { total: 0, solved: 0 },
    medium: { total: 0, solved: 0 },
    hard: { total: 0, solved: 0 },
  };
  for (const p of problems) {
    counts[p.difficulty].total += 1;
    if (p.status === "completed") counts[p.difficulty].solved += 1;
  }
  return {
    easy: makeBucket("Easy", counts.easy.total, counts.easy.solved),
    medium: makeBucket("Medium", counts.medium.total, counts.medium.solved),
    hard: makeBucket("Hard", counts.hard.total, counts.hard.solved),
  };
}

/** Count of problems at each confidence level. */
export function confidenceStats(problems: Problem[]): Record<Confidence, number> {
  const out: Record<Confidence, number> = { struggled: 0, hints: 0, mastered: 0 };
  for (const p of problems) out[p.confidence] += 1;
  return out;
}

/** Active problems due on each of the next `days` days. */
export function reviewForecast(
  problems: Problem[],
  today: string,
  days = 14,
): { date: string; count: number }[] {
  const out: { date: string; count: number }[] = [];
  for (let i = 0; i < days; i++) {
    const date = addDaysKey(today, i);
    const count = problems.filter(
      (p) => p.status === "active" && p.nextReview === date,
    ).length;
    out.push({ date, count });
  }
  return out;
}

/** Problems already past their review date. */
export function overdueCount(problems: Problem[], today: string): number {
  return problems.filter(
    (p) => p.status === "active" && p.nextReview < today,
  ).length;
}

/** Active days over the last `days` days (oldest first). */
export function activityCalendar(
  activity: string[],
  days = 84,
): { date: string; active: boolean }[] {
  const set = new Set(activity);
  const today = todayKey();
  const out: { date: string; active: boolean }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = addDaysKey(today, -i);
    out.push({ date, active: set.has(date) });
  }
  return out;
}

/** Parse "1h 2m 3s" / "45m 5s" / "12s" display durations into seconds. */
export function parseDuration(s?: string): number {
  if (!s) return 0;
  const h = s.match(/(\d+)\s*h/);
  const m = s.match(/(\d+)\s*m/);
  const sec = s.match(/(\d+)\s*s/);
  return (
    (h ? Number(h[1]) * 3600 : 0) +
    (m ? Number(m[1]) * 60 : 0) +
    (sec ? Number(sec[1]) : 0)
  );
}

/** Seconds → "4h 12m" / "45m". */
export function formatMinutes(totalSec: number): string {
  const h = Math.floor(totalSec / 3600);
  const m = Math.round((totalSec % 3600) / 60);
  if (h > 0) return m > 0 ? `${h}h ${m}m` : `${h}h`;
  return `${m}m`;
}

/** Total focused time across all logged solves. */
export function totalFocusedTime(problems: Problem[]): number {
  return problems.reduce((sum, p) => sum + parseDuration(p.lastDuration), 0);
}

/** yyyy-mm-dd → "Aug 11" style label. */
export function shortDate(key: string): string {
  const [, m, d] = key.split("-").map(Number);
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  return `${months[m - 1]} ${d}`;
}
