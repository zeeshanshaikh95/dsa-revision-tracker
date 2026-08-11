import type { Problem, Task } from "../types";
import { getSupabase } from "./supabase";

/**
 * Cloud persistence for each user's problem bank, stored as real rows:
 * one `problems` row per problem plus one `user_profiles` row (activity log).
 * The browser keeps a per-user localStorage cache as the offline fallback and
 * the UI's synchronous source of truth; this module reconciles with the cloud.
 *
 * Table setup (run once in the Supabase SQL editor):
 *
 *   create table if not exists public.problems (
 *     id               uuid primary key,
 *     user_id          uuid not null references auth.users (id) on delete cascade,
 *     title            text not null,
 *     url              text not null,
 *     module           text not null,
 *     difficulty       text not null,
 *     confidence       text not null,
 *     status           text not null default 'active',
 *     pattern          text not null,
 *     intuition        text not null default '',
 *     time_complexity  text not null default '',
 *     space_complexity text not null default '',
 *     last_solved      date not null,
 *     last_duration    text,
 *     next_review      date not null,
 *     review_count     integer not null default 0,
 *     created_at       date not null,
 *     updated_at       timestamptz not null default now()
 *   );
 *   create table if not exists public.user_profiles (
 *     user_id    uuid primary key references auth.users (id) on delete cascade,
 *     activity   jsonb not null default '[]'::jsonb,
 *     tasks      jsonb not null default '[]'::jsonb,
 *     updated_at timestamptz not null default now()
 *   );
 *   alter table public.problems enable row level security;
 *   alter table public.user_profiles enable row level security;
 *
 *   create policy "Users manage their own problems"
 *     on public.problems for all
 *     using (auth.uid() = user_id)
 *     with check (auth.uid() = user_id);
 *   create policy "Users manage their own profile"
 *     on public.user_profiles for all
 *     using (auth.uid() = user_id)
 *     with check (auth.uid() = user_id);
 */

/** Legacy localStorage bank from before per-user sync existed. */
export const STORAGE_KEY_LEGACY = "dsa-revision-tracker:v1";

export interface BankRow {
  problems: Problem[];
  activity: string[];
  tasks: Task[];
  updated_at: string;
}

interface ProblemRow {
  id: string;
  user_id: string;
  title: string;
  url: string;
  module: string;
  difficulty: string;
  confidence: string;
  status: string;
  pattern: string;
  intuition: string;
  time_complexity: string;
  space_complexity: string;
  last_solved: string;
  last_duration: string | null;
  next_review: string;
  review_count: number;
  created_at: string;
  updated_at: string;
}

interface ProfileRow {
  user_id: string;
  activity: string[] | null;
  tasks: Task[] | null;
  updated_at: string;
}

export function tsToMs(iso: string): number {
  const t = Date.parse(iso);
  return Number.isNaN(t) ? 0 : t;
}

function rowToProblem(r: ProblemRow): Problem {
  return {
    id: r.id,
    title: r.title,
    url: r.url,
    module: r.module,
    difficulty: r.difficulty as Problem["difficulty"],
    confidence: r.confidence as Problem["confidence"],
    status: r.status as Problem["status"],
    pattern: r.pattern,
    intuition: r.intuition,
    timeComplexity: r.time_complexity,
    spaceComplexity: r.space_complexity,
    lastSolved: r.last_solved,
    lastDuration: r.last_duration ?? undefined,
    nextReview: r.next_review,
    reviewCount: r.review_count,
    createdAt: r.created_at,
  };
}

function problemToRow(
  p: Problem,
  userId: string,
  updatedAt: string,
): ProblemRow {
  return {
    id: p.id,
    user_id: userId,
    title: p.title,
    url: p.url,
    module: p.module,
    difficulty: p.difficulty,
    confidence: p.confidence,
    status: p.status,
    pattern: p.pattern,
    intuition: p.intuition,
    time_complexity: p.timeComplexity,
    space_complexity: p.spaceComplexity,
    last_solved: p.lastSolved,
    last_duration: p.lastDuration ?? null,
    next_review: p.nextReview,
    review_count: p.reviewCount,
    created_at: p.createdAt,
    updated_at: updatedAt,
  };
}

/** Fetch the user's whole bank from the cloud. Null when nothing exists yet. */
export async function fetchBank(userId: string): Promise<BankRow | null> {
  const sb = await getSupabase();
  if (!sb) return null;
  const [problemsRes, profileRes] = await Promise.all([
    sb.from("problems").select("*").eq("user_id", userId),
    sb.from("user_profiles").select("*").eq("user_id", userId).maybeSingle(),
  ]);
  if (problemsRes.error) throw problemsRes.error;
  if (profileRes.error) throw profileRes.error;

  const rows = (problemsRes.data ?? []) as ProblemRow[];
  const profile = profileRes.data as ProfileRow | null;
  if (rows.length === 0 && !profile) return null;

  const problems = rows.map(rowToProblem);
  const activity = profile?.activity ?? [];
  const tasks = Array.isArray(profile?.tasks)
    ? (profile.tasks as Task[])
    : [];

  // Bank-level timestamp = newest of every problem row + the profile row.
  let bestMs = 0;
  let bestRaw = "";
  const consider = (iso?: string) => {
    if (!iso) return;
    const ms = tsToMs(iso);
    if (ms > bestMs) {
      bestMs = ms;
      bestRaw = iso;
    }
  };
  for (const r of rows) consider(r.updated_at);
  consider(profile?.updated_at);

  return { problems, activity, tasks, updated_at: bestRaw || new Date().toISOString() };
}

/**
 * Push the whole bank: upsert every problem row (LWW via updated_at), upsert
 * the activity profile, and delete rows that were deleted locally since the
 * last push (tracked as tombstones — never a blanket sweep, which could
 * erase problems another device added).
 */
export async function upsertBank(
  userId: string,
  problems: Problem[],
  activity: string[],
  tasks: Task[],
  deletedIds: string[],
  updatedAt: string,
): Promise<void> {
  const sb = await getSupabase();
  if (!sb) return;
  const rows = problems.map((p) => problemToRow(p, userId, updatedAt));

  const calls: PromiseLike<{ error: unknown }>[] = [];
  if (rows.length > 0) {
    calls.push(sb.from("problems").upsert(rows, { onConflict: "id" }));
  }
  calls.push(
    sb.from("user_profiles").upsert(
      { user_id: userId, activity, tasks, updated_at: updatedAt },
      { onConflict: "user_id" },
    ),
  );
  if (deletedIds.length > 0) {
    calls.push(
      sb
        .from("problems")
        .delete()
        .eq("user_id", userId)
        .in("id", deletedIds),
    );
  }
  const results = await Promise.all(calls);
  const error = results.find((r) => r.error)?.error;
  if (error) throw error;
}

/** Read the pre-sync localStorage bank (for one-time migration). */
export function loadLegacyBank(): {
  problems: Problem[];
  activity: string[];
} | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_LEGACY);
    if (raw) {
      const parsed = JSON.parse(raw) as {
        problems?: Problem[];
        activity?: string[];
      };
      if (
        Array.isArray(parsed.problems) &&
        Array.isArray(parsed.activity) &&
        parsed.problems.length > 0
      ) {
        return { problems: parsed.problems, activity: parsed.activity };
      }
    }
  } catch {
    // Corrupt or unreadable — no legacy bank.
  }
  return null;
}
