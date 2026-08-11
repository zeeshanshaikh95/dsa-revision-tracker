import { useMemo, useSyncExternalStore } from "react";

/**
 * Client-side auth for the static export: accounts and the active session
 * live in localStorage. Not production-grade security (no backend), but the
 * right trade-off for a personal, offline-first tracker.
 */

const USERS_KEY = "dsa-revision-tracker:users";
const SESSION_KEY = "dsa-revision-tracker:session";

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

export interface AuthStore {
  /** True once the persisted session has been loaded on the client. */
  ready: boolean;
  /** Logged-in user's email, or null when signed out. */
  user: string | null;
  login: (email: string, password: string) => string | null;
  signup: (email: string, password: string, confirm: string) => string | null;
  logout: () => void;
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
    }),
    [authState],
  );
}
