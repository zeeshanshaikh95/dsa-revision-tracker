import type { Problem, ReviewStatus } from "../types";

/** Spaced-repetition intervals in days, in review order. */
export const REVIEW_INTERVALS = [1, 3, 7, 14, 30, 60, 90, 180] as const;

const DAY_MS = 86_400_000;

/** Format a Date as a local yyyy-mm-dd string. */
export function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Today's local date key. */
export function todayKey(): string {
  return toDateKey(new Date());
}

/** Add `days` to a local date and return it as a yyyy-mm-dd key. */
export function addDaysKey(key: string, days: number): string {
  const [y, m, d] = key.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + days);
  return toDateKey(date);
}

/** Whole days between two date keys (b - a), local-timezone safe. */
export function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  const from = new Date(ay, am - 1, ad).getTime();
  const to = new Date(by, bm - 1, bd).getTime();
  return Math.round((to - from) / DAY_MS);
}

/** Next review key after a fresh solve, given how many times it was solved. */
export function nextReviewAfterSolve(reviewCount: number): string {
  const idx = Math.min(reviewCount, REVIEW_INTERVALS.length - 1);
  return addDaysKey(todayKey(), REVIEW_INTERVALS[idx]);
}

/** Where a problem sits relative to today's review schedule. */
export function reviewStatus(p: Problem, today: string): ReviewStatus {
  if (p.status === "completed") return "safe";
  if (p.nextReview < today) return "overdue";
  if (p.nextReview === today) return "today";
  return "safe";
}

/** Consecutive days (ending today or yesterday) with recorded activity. */
export function currentStreak(activity: string[]): number {
  const days = new Set(activity);
  let cursor = new Date();
  if (!days.has(toDateKey(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
  }
  let streak = 0;
  while (days.has(toDateKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export interface ModuleProgress {
  module: string;
  total: number;
  solved: number;
  pct: number;
}

/** Per-module solved/total completion, sorted best-first. */
export function moduleProgress(problems: Problem[]): ModuleProgress[] {
  const map = new Map<string, { total: number; solved: number }>();
  for (const p of problems) {
    const entry = map.get(p.module) ?? { total: 0, solved: 0 };
    entry.total += 1;
    if (p.status === "completed") entry.solved += 1;
    map.set(p.module, entry);
  }
  return [...map.entries()]
    .map(([module, v]) => ({
      module,
      total: v.total,
      solved: v.solved,
      pct: Math.round((v.solved / v.total) * 100),
    }))
    .sort((a, b) => b.pct - a.pct || b.total - a.total);
}

/** Human relative label, e.g. "today", "3d ago", "in 5d", "yesterday". */
export function relativeDay(key: string, today: string): string {
  const diff = daysBetween(today, key);
  if (diff === 0) return "today";
  if (diff === -1) return "yesterday";
  if (diff === 1) return "tomorrow";
  if (diff < 0) return `${-diff}d ago`;
  return `in ${diff}d`;
}
