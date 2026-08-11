import type { Problem } from "../types";
import { getSupabase } from "./supabase";

/**
 * Cloud persistence for each user's problem bank. One row per user in the
 * `user_banks` table (problems + activity as JSONB) keeps reads/writes simple
 * and is plenty for a personal tracker.
 *
 * Table + RLS setup (run once in the Supabase SQL editor):
 *
 *   create table if not exists public.user_banks (
 *     user_id    uuid primary key references auth.users (id) on delete cascade,
 *     problems   jsonb not null default '[]'::jsonb,
 *     activity   jsonb not null default '[]'::jsonb,
 *     updated_at timestamptz not null default now()
 *   );
 *   alter table public.user_banks enable row level security;
 *
 *   create policy "Users manage their own bank"
 *     on public.user_banks for all
 *     using (auth.uid() = user_id)
 *     with check (auth.uid() = user_id);
 */

/** Legacy localStorage bank from before per-user sync existed. */
export const STORAGE_KEY_LEGACY = "dsa-revision-tracker:v1";

export interface BankRow {
  user_id: string;
  problems: Problem[] | null;
  activity: string[] | null;
  updated_at: string;
}

export function tsToMs(iso: string): number {
  const t = Date.parse(iso);
  return Number.isNaN(t) ? 0 : t;
}

export async function fetchBank(userId: string): Promise<BankRow | null> {
  const sb = await getSupabase();
  if (!sb) return null;
  const { data, error } = await sb
    .from("user_banks")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return (data as BankRow) ?? null;
}

export async function upsertBank(
  userId: string,
  problems: Problem[],
  activity: string[],
  updatedAt: string,
): Promise<void> {
  const sb = await getSupabase();
  if (!sb) return;
  const { error } = await sb
    .from("user_banks")
    .upsert(
      { user_id: userId, problems, activity, updated_at: updatedAt },
      { onConflict: "user_id" },
    );
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
