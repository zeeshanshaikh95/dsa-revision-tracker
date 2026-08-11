import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import type { Problem } from "../types";
import { buildSeed } from "../data/seed";
import { nextReviewAfterSolve, todayKey } from "../lib/spaced";

const STORAGE_KEY = "dsa-revision-tracker:v1";

export interface NewProblemInput {
  title: string;
  url: string;
  module: string;
  difficulty: Problem["difficulty"];
  confidence: Problem["confidence"];
}

interface PersistedState {
  problems: Problem[];
  /** Local yyyy-mm-dd keys on which the user solved at least one problem. */
  activity: string[];
}

function buildInitial(): PersistedState {
  return { problems: buildSeed(), activity: [todayKey()] };
}

function loadState(): PersistedState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as PersistedState;
      if (Array.isArray(parsed.problems) && Array.isArray(parsed.activity)) {
        return parsed;
      }
    }
  } catch {
    // Corrupt storage — fall through to a fresh seed.
  }
  return buildInitial();
}

/**
 * Module-level store (single consumer: the dashboard). useSyncExternalStore
 * drives the SSR-safe handoff:
 *  - Server prerender + hydration render use `getServerSnapshot` (empty shell),
 *    which always matches the served HTML.
 *  - Immediately after hydration, React swaps in `getSnapshot` (localStorage)
 *    with a synchronous re-render before the first paint — no loading flash.
 */
let state: PersistedState | null = null;
const serverSnapshot: PersistedState = { problems: [], activity: [] };
const listeners = new Set<() => void>();

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

/** Client snapshot: persisted state, lazily loaded and cached. */
function getSnapshot(): PersistedState {
  if (state === null) state = loadState();
  return state;
}

/** Server/hydration snapshot: a stable empty shell. */
function getServerSnapshot(): PersistedState {
  return serverSnapshot;
}

function setState(updater: (prev: PersistedState) => PersistedState): void {
  const prev = getSnapshot();
  const next = updater(prev);
  if (next !== prev) {
    state = next;
    listeners.forEach((l) => l());
  }
}

export interface Store {
  /** True once persisted state has been loaded on the client. */
  ready: boolean;
  problems: Problem[];
  activity: string[];
  addProblem: (input: NewProblemInput) => Problem;
  updateProblem: (id: string, patch: Partial<Problem>) => void;
  deleteProblem: (id: string) => void;
  toggleStatus: (id: string) => void;
  resetReview: (id: string) => string;
}

export function useStore(): Store {
  const storeState = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  // Persist on every change (runs after the hydration swap, so a fresh seed
  // is only written when there is genuinely nothing stored yet).
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(storeState));
    } catch {
      // Storage may be unavailable (private mode) — the app still works in-memory.
    }
  }, [storeState]);

  const recordActivity = (st: PersistedState): PersistedState => {
    const today = todayKey();
    return st.activity.includes(today)
      ? st
      : { ...st, activity: [...st.activity, today] };
  };

  const addProblem = useCallback((input: NewProblemInput): Problem => {
    const today = todayKey();
    const problem: Problem = {
      id: crypto.randomUUID(),
      ...input,
      url: input.url.trim() || "https://leetcode.com/problemset/",
      status: "active",
      pattern: "—",
      intuition: "",
      timeComplexity: "O(?)",
      spaceComplexity: "O(?)",
      lastSolved: today,
      nextReview: nextReviewAfterSolve(0),
      reviewCount: 0,
      createdAt: today,
    };
    setState((prev) =>
      recordActivity({ ...prev, problems: [problem, ...prev.problems] }),
    );
    return problem;
  }, []);

  const updateProblem = useCallback((id: string, patch: Partial<Problem>): void => {
    setState((prev) => ({
      ...prev,
      problems: prev.problems.map((p) =>
        p.id === id ? { ...p, ...patch } : p,
      ),
    }));
  }, []);

  const deleteProblem = useCallback((id: string): void => {
    setState((prev) => ({
      ...prev,
      problems: prev.problems.filter((p) => p.id !== id),
    }));
  }, []);

  const toggleStatus = useCallback((id: string): void => {
    setState((prev) => ({
      ...prev,
      problems: prev.problems.map((p) =>
        p.id === id
          ? {
              ...p,
              status: p.status === "completed" ? "active" : "completed",
            }
          : p,
      ),
    }));
  }, []);

  /** Reset the spaced-repetition countdown after re-solving from scratch. */
  const resetReview = useCallback((id: string): string => {
    const today = todayKey();
    const current = getSnapshot().problems.find((p) => p.id === id);
    const next = nextReviewAfterSolve(current?.reviewCount ?? 0);
    setState((prev) =>
      recordActivity({
        ...prev,
        problems: prev.problems.map((p) =>
          p.id === id
            ? {
                ...p,
                lastSolved: today,
                nextReview: next,
                reviewCount: p.reviewCount + 1,
                status: "active",
              }
            : p,
        ),
      }),
    );
    return next;
  }, []);

  // Memoize the store object: its identity must change ONLY when data changes.
  // If it changed on every App render, every memoized row/child would re-render
  // on each keystroke or filter click — the callbacks above are stable, and
  // problems/activity arrays are reference-stable between mutations.
  return useMemo(
    () => ({
      ready: storeState !== serverSnapshot,
      problems: storeState.problems,
      activity: storeState.activity,
      addProblem,
      updateProblem,
      deleteProblem,
      toggleStatus,
      resetReview,
    }),
    [
      storeState,
      addProblem,
      updateProblem,
      deleteProblem,
      toggleStatus,
      resetReview,
    ],
  );
}
