import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Supabase wiring for real email auth (confirmation + password-reset links).
 *
 * The project URL + anon key are public by design and are inlined at build
 * time from NEXT_PUBLIC_* env vars. When they are absent (fresh checkout,
 * no project yet) the app falls back to the built-in localStorage auth —
 * everything keeps working, just without real emails.
 */

export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

let clientPromise: Promise<SupabaseClient | null> | null = null;

/** Lazily create (and cache) the Supabase client. Loads the ~40KB library
 *  only when actually configured, keeping it out of the initial bundle. */
export function getSupabase(): Promise<SupabaseClient | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return Promise.resolve(null);
  if (!clientPromise) {
    clientPromise = import("@supabase/supabase-js").then(({ createClient }) =>
      createClient(url, anonKey),
    );
  }
  return clientPromise;
}
