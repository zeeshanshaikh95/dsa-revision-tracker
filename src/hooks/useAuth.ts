import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { getSupabase, isSupabaseConfigured } from "../lib/supabase";

/**
 * Auth with two backends:
 *  - Supabase (when NEXT_PUBLIC_SUPABASE_URL/ANON_KEY are set at build time):
 *    real email/password accounts, confirmation emails, and password-reset
 *    links handled entirely by Supabase. Sessions persist in localStorage.
 *  - Local fallback (unconfigured): accounts + session in localStorage, and
 *    the reset "code" is shown on screen in a demo box (no mail server).
 */

const USERS_KEY = "dsa-revision-tracker:users";
const SESSION_KEY = "dsa-revision-tracker:session";
const RESET_KEY = "dsa-revision-tracker:reset";

export interface AuthUser {
  email: string;
  password: string;
}

interface AuthState {
  users: AuthUser[];
  /** Email of the logged-in user, or null. */
  session: string | null;
}

const ADMIN: AuthUser = { email: "admin@gmail.com", password: "12345678" };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

let state: AuthState | null = null;
const serverSnapshot: AuthState = { users: [], session: null };
const listeners = new Set<() => void>();

function loadState(): AuthState {
  let users: AuthUser[] = [];
  try {
    const raw = localStorage.getItem(USERS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AuthUser[];
      if (Array.isArray(parsed) && parsed.length > 0) users = parsed;
    }
  } catch {
    // Corrupt storage — reseed below.
  }
  if (users.length === 0) users = [ADMIN];
  let session: string | null = null;
  try {
    session = localStorage.getItem(SESSION_KEY);
  } catch {
    // Storage unavailable — stay logged out.
  }
  return { users, session };
}

function getSnapshot(): AuthState {
  if (state === null) state = loadState();
  return state;
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

function setState(next: AuthState): void {
  const prev = getSnapshot();
  if (next !== prev) {
    state = next;
    try {
      localStorage.setItem(USERS_KEY, JSON.stringify(next.users));
      if (next.session) localStorage.setItem(SESSION_KEY, next.session);
      else localStorage.removeItem(SESSION_KEY);
    } catch {
      // Storage may be unavailable — the app still works in-memory.
    }
    listeners.forEach((l) => l());
  }
}

// ---------------------------------------------------------------------------
// Local (fallback) backend — kept fully working when Supabase is unconfigured.
// ---------------------------------------------------------------------------

function loginLocal(email: string, password: string): string | null {
  const norm = email.trim().toLowerCase();
  const { users } = getSnapshot();
  const user = users.find((u) => u.email === norm);
  if (!user) return "No account found for this email.";
  if (user.password !== password) return "Incorrect password — try again.";
  setState({ users, session: norm });
  return null;
}

function signupLocal(
  email: string,
  password: string,
  confirm: string,
): string | null {
  const norm = email.trim().toLowerCase();
  if (!EMAIL_RE.test(norm)) return "Enter a valid email address.";
  if (password.length < 8) return "Password must be at least 8 characters.";
  if (password !== confirm) return "Passwords don't match.";
  const { users } = getSnapshot();
  if (users.some((u) => u.email === norm))
    return "An account with this email already exists.";
  setState({ users: [...users, { email: norm, password }], session: norm });
  return null;
}

function logoutLocal(): void {
  const { users } = getSnapshot();
  setState({ users, session: null });
}

interface ResetState {
  email: string;
  code: string;
  expiresAt: number;
}

const RESET_TTL_MS = 10 * 60 * 1000; // 10 minutes

function readReset(): ResetState | null {
  try {
    const raw = localStorage.getItem(RESET_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ResetState;
    if (parsed && typeof parsed.code === "string" && parsed.email) return parsed;
  } catch {
    // Corrupt reset state.
  }
  return null;
}

function requestResetCodeLocal(
  email: string,
): { error: string | null; demoCode: string | null } {
  const norm = email.trim().toLowerCase();
  const { users } = getSnapshot();
  if (!users.some((u) => u.email === norm))
    return { error: "No account found for this email.", demoCode: null };
  const code = String(Math.floor(100000 + Math.random() * 900000));
  const reset: ResetState = {
    email: norm,
    code,
    expiresAt: Date.now() + RESET_TTL_MS,
  };
  try {
    localStorage.setItem(RESET_KEY, JSON.stringify(reset));
  } catch {
    return {
      error: "Storage unavailable — cannot send a reset code.",
      demoCode: null,
    };
  }
  return { error: null, demoCode: code };
}

function verifyResetCodeLocal(email: string, code: string): string | null {
  const norm = email.trim().toLowerCase();
  const reset = readReset();
  if (!reset || reset.email !== norm) return "Request a reset code first.";
  if (Date.now() > reset.expiresAt) {
    try {
      localStorage.removeItem(RESET_KEY);
    } catch {
      // ignore
    }
    return "This code has expired — request a new one.";
  }
  if (reset.code !== code.trim()) return "Incorrect code — check and try again.";
  return null;
}

function resetPasswordLocal(
  email: string,
  code: string,
  newPassword: string,
  confirm: string,
): string | null {
  const norm = email.trim().toLowerCase();
  const reset = readReset();
  if (!reset || reset.email !== norm) return "Request a reset code first.";
  if (Date.now() > reset.expiresAt) {
    try {
      localStorage.removeItem(RESET_KEY);
    } catch {
      // ignore
    }
    return "This code has expired — request a new one.";
  }
  if (reset.code !== code.trim()) return "Incorrect code — check and try again.";
  if (newPassword.length < 8)
    return "Password must be at least 8 characters.";
  if (newPassword !== confirm) return "Passwords don't match.";
  const users = getSnapshot().users.map((u) =>
    u.email === norm ? { ...u, password: newPassword } : u,
  );
  try {
    localStorage.removeItem(RESET_KEY);
  } catch {
    // ignore
  }
  setState({ users, session: null });
  return null;
}

// ---------------------------------------------------------------------------
// Public store
// ---------------------------------------------------------------------------

export interface AuthStore {
  /** True once the session has been determined on the client. */
  ready: boolean;
  /** Logged-in user's email, or null when signed out. */
  user: string | null;
  /** Which backend is active. */
  mode: "supabase" | "local";
  /** True when the user arrived via a password-reset link (Supabase mode). */
  recovery: boolean;
  login: (email: string, password: string) => Promise<string | null>;
  signup: (
    email: string,
    password: string,
    confirm: string,
  ) => Promise<string | null>;
  logout: () => Promise<void>;
  requestResetCode: (
    email: string,
  ) => Promise<{ error: string | null; demoCode: string | null }>;
  verifyResetCode: (email: string, code: string) => Promise<string | null>;
  resetPassword: (
    email: string,
    code: string,
    newPassword: string,
    confirm: string,
  ) => Promise<string | null>;
}

export function useAuth(): AuthStore {
  const fallback = useSyncExternalStore(
    subscribe,
    getSnapshot,
    () => serverSnapshot,
  );
  const usingSupabase = isSupabaseConfigured();

  const [sbReady, setSbReady] = useState(false);
  const [sbUser, setSbUser] = useState<string | null>(null);
  const [recovery, setRecovery] = useState(false);

  useEffect(() => {
    if (!usingSupabase) {
      setSbReady(true);
      return;
    }
    let mounted = true;
    let unsubscribe: (() => void) | null = null;
    (async () => {
      const sb = await getSupabase();
      if (!sb || !mounted) return;
      const { data } = await sb.auth.getSession();
      if (!mounted) return;
      setSbUser(data.session?.user.email ?? null);
      setSbReady(true);
      const { data: sub } = sb.auth.onAuthStateChange((event, session) => {
        if (!mounted) return;
        if (event === "PASSWORD_RECOVERY") setRecovery(true);
        else if (event === "SIGNED_OUT") setRecovery(false);
        setSbUser(session?.user.email ?? null);
      });
      unsubscribe = () => sub.subscription.unsubscribe();
    })();
    return () => {
      mounted = false;
      unsubscribe?.();
    };
  }, [usingSupabase]);

  const ready = usingSupabase ? sbReady : fallback !== serverSnapshot;
  const user = usingSupabase ? sbUser : fallback.session;

  const login = useCallback(
    async (email: string, password: string): Promise<string | null> => {
      if (!usingSupabase) return loginLocal(email, password);
      const sb = await getSupabase();
      if (!sb) return "Supabase is not configured.";
      const { error } = await sb.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });
      if (error) {
        const msg = error.message.toLowerCase();
        if (msg.includes("email not confirmed"))
          return "Confirm your email first — check your inbox for the confirmation link.";
        return error.message;
      }
      return null;
    },
    [usingSupabase],
  );

  const signup = useCallback(
    async (
      email: string,
      password: string,
      confirm: string,
    ): Promise<string | null> => {
      if (!usingSupabase) return signupLocal(email, password, confirm);
      const norm = email.trim().toLowerCase();
      if (!EMAIL_RE.test(norm)) return "Enter a valid email address.";
      if (password.length < 8)
        return "Password must be at least 8 characters.";
      if (password !== confirm) return "Passwords don't match.";
      const sb = await getSupabase();
      if (!sb) return "Supabase is not configured.";
      const { data, error } = await sb.auth.signUp({ email: norm, password });
      if (error) return error.message;
      if (!data.session)
        return "Account created — confirm your email to log in.";
      return null;
    },
    [usingSupabase],
  );

  const logout = useCallback(async (): Promise<void> => {
    if (!usingSupabase) {
      logoutLocal();
      return;
    }
    const sb = await getSupabase();
    await sb?.auth.signOut();
  }, [usingSupabase]);

  const requestResetCode = useCallback(
    async (
      email: string,
    ): Promise<{ error: string | null; demoCode: string | null }> => {
      if (!usingSupabase) return requestResetCodeLocal(email);
      const sb = await getSupabase();
      if (!sb) return { error: "Supabase is not configured.", demoCode: null };
      const redirectTo = `${window.location.origin}${window.location.pathname}`;
      const { error } = await sb.auth.resetPasswordForEmail(
        email.trim().toLowerCase(),
        { redirectTo },
      );
      if (error) return { error: error.message, demoCode: null };
      // No demo code — a real reset link is on its way to the inbox.
      return { error: null, demoCode: null };
    },
    [usingSupabase],
  );

  const verifyResetCode = useCallback(
    async (email: string, code: string): Promise<string | null> => {
      if (!usingSupabase) return verifyResetCodeLocal(email, code);
      // Supabase mode has no codes — the emailed link IS the verification.
      return "No reset code in this mode — use the link from your email.";
    },
    [usingSupabase],
  );

  const resetPassword = useCallback(
    async (
      email: string,
      code: string,
      newPassword: string,
      confirm: string,
    ): Promise<string | null> => {
      if (!usingSupabase)
        return resetPasswordLocal(email, code, newPassword, confirm);
      if (newPassword.length < 8)
        return "Password must be at least 8 characters.";
      if (newPassword !== confirm) return "Passwords don't match.";
      const sb = await getSupabase();
      if (!sb) return "Supabase is not configured.";
      const { error } = await sb.auth.updateUser({ password: newPassword });
      if (error) return error.message;
      // Sign out so the user logs in again with the new password.
      await sb.auth.signOut();
      setRecovery(false);
      return null;
    },
    [usingSupabase],
  );

  return useMemo(
    () => ({
      ready,
      user,
      mode: usingSupabase ? "supabase" : "local",
      recovery,
      login,
      signup,
      logout,
      requestResetCode,
      verifyResetCode,
      resetPassword,
    }),
    [
      ready,
      user,
      usingSupabase,
      recovery,
      login,
      signup,
      logout,
      requestResetCode,
      verifyResetCode,
      resetPassword,
    ],
  );
}
