import { useMemo, useSyncExternalStore } from "react";

/**
 * Client-side auth for the static export: accounts and the active session
 * live in localStorage. Not production-grade security (no backend), but the
 * right trade-off for a personal, offline-first tracker.
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

/** Try to sign in. Returns an error message, or null on success. */
export function login(email: string, password: string): string | null {
  const norm = email.trim().toLowerCase();
  const { users } = getSnapshot();
  const user = users.find((u) => u.email === norm);
  if (!user) return "No account found for this email.";
  if (user.password !== password) return "Incorrect password — try again.";
  setState({ users, session: norm });
  return null;
}

/** Create an account and sign in. Returns an error message, or null. */
export function signup(
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

export function logout(): void {
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

/**
 * Start the password reset flow for an account. There is no mail server on
 * this static site, so the 6-digit code is returned here and the UI shows it
 * in a demo box ("this would normally be emailed"). The code expires after
 * 10 minutes.
 */
export function requestResetCode(
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
    // Storage unavailable — flow cannot proceed.
    return { error: "Storage unavailable — cannot send a reset code.", demoCode: null };
  }
  return { error: null, demoCode: code };
}

/**
 * Check the reset code (and expiry) without changing anything. Returns an
 * error, or null when the code is valid.
 */
export function verifyResetCode(email: string, code: string): string | null {
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

/**
 * Verify the reset code and set a new password. Signs the user out so they
 * log in again with the new credentials. Returns an error, or null on success.
 */
export function resetPassword(
  email: string,
  code: string,
  newPassword: string,
  confirm: string,
): string | null {
  const norm = email.trim().toLowerCase();
  const reset = readReset();
  if (!reset || reset.email !== norm)
    return "Request a reset code first.";
  if (Date.now() > reset.expiresAt) {
    try {
      localStorage.removeItem(RESET_KEY);
    } catch {
      // ignore
    }
    return "This code has expired — request a new one.";
  }
  if (reset.code !== code.trim())
    return "Incorrect code — check and try again.";
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

export interface AuthStore {
  /** True once the persisted session has been loaded on the client. */
  ready: boolean;
  /** Logged-in user's email, or null when signed out. */
  user: string | null;
  login: (email: string, password: string) => string | null;
  signup: (email: string, password: string, confirm: string) => string | null;
  logout: () => void;
  requestResetCode: (
    email: string,
  ) => { error: string | null; demoCode: string | null };
  verifyResetCode: (email: string, code: string) => string | null;
  resetPassword: (
    email: string,
    code: string,
    newPassword: string,
    confirm: string,
  ) => string | null;
}

export function useAuth(): AuthStore {
  const authState = useSyncExternalStore(
    subscribe,
    getSnapshot,
    () => serverSnapshot,
  );
  return useMemo(
    () => ({
      ready: authState !== serverSnapshot,
      user: authState.session,
      login,
      signup,
      logout,
      requestResetCode,
      verifyResetCode,
      resetPassword,
    }),
    [authState],
  );
}
