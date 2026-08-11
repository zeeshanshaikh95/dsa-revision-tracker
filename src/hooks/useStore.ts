import { useMemo, useSyncExternalStore } from "react";
import type { Problem } from "../types";
import { buildSeed } from "../data/seed";
import { nextReviewAfterSolve, todayKey } from "../lib/spaced";

export const STORAGE_KEY_LEGACY = "dsa-revision-tracker:v1";

export interface NewProblemInput {
  title: string;
  url: string;
  module: string;
  difficulty: Problem["difficulty"];
  confidence: Problem["confidence"];
}

export interface PersistedState {
  problems: Problem[];
  /** Local yyyy-mm-dd keys on which the user solved at least one problem. */
  activity: string[];
  /**
   * Sync bookkeeping. Every local mutation stamps `updatedAt` (client clock);
   * `hydrate()` stamps it with the cloud's timestamp. The sync layer uses it
   * to tell "this change came from the cloud" apart from "the user edited".
   * `deletedIds` are tombstones for problems deleted locally but not yet
   * pushed — the sync layer deletes exactly those rows, never a blanket sweep.
   */
  meta: { updatedAt: string; deletedIds: string[] };
}

const EPOCH = "1970-01-01T00:00:00.000Z";
const serverSnapshot: PersistedState = {
  problems: [],
  activity: [],
  meta: { updatedAt: EPOCH, deletedIds: [] },
};

function nowIso(): string {
  return new Date().toISOString();
}

function loadState(storageKey: string, seed: boolean): PersistedState {
  try {
    const raw = localStorage.getItem(storageKey);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<PersistedState>;
      if (Array.isArray(parsed.problems) && Array.isArray(parsed.activity)) {
        const meta =
          parsed.meta && typeof parsed.meta.updatedAt === "string"
            ? {
                updatedAt: parsed.meta.updatedAt,
                deletedIds: Array.isArray(parsed.meta.deletedIds)
                  ? parsed.meta.deletedIds
                  : [],
              }
            : { updatedAt: EPOCH, deletedIds: [] };
        return { problems: parsed.problems, activity: parsed.activity, meta };
      }
    }
  } catch {
    // Corrupt storage — fall through to a fresh (or empty) bank.
  }
  return {
    problems: seed ? buildSeed() : [],
    activity: seed ? [todayKey()] : [],
    meta: { updatedAt: EPOCH, deletedIds: [] },
  };
}

interface StoreInstance {
  subscribe: (onChange: () => void) => () => void;
  getSnapshot: () => PersistedState;
  getServerSnapshot: () => PersistedState;
  /** Replace the bank with cloud data (marks it as synced state). */
  hydrate: (problems: Problem[], activity: string[], updatedAt: string) => void;
  /** Drop synced tombstones without stamping a new updatedAt. */
  ackTombstones: () => void;
  addProblem: (input: NewProblemInput) => Problem;
  updateProblem: (id: string, patch: Partial<Problem>) => void;
  deleteProblem: (id: string) => void;
  clearAllProblems: () => void;
  toggleStatus: (id: string) => void;
  resetReview: (id: string) => string;
}

/**
 * One store instance per (storageKey, seed) pair — a fresh instance per
 * Supabase user, so different accounts on the same browser never share a
 * cache. The in-memory state is the UI's synchronous source of truth and is
 * mirrored to localStorage (offline cache); the sync layer reconciles it with
 * the cloud.
 */
function createStore(storageKey: string, seed: boolean): StoreInstance {
  let state: PersistedState = loadState(storageKey, seed);
  const listeners = new Set<() => void>();

  const subscribe = (onChange: () => void): (() => void) => {
    listeners.add(onChange);
    return () => {
      listeners.delete(onChange);
    };
  };
  const getSnapshot = (): PersistedState => state;
  const getServerSnapshot = (): PersistedState => serverSnapshot;

  function commit(next: PersistedState): void {
    state = next;
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      // Storage may be unavailable (private mode) — the app still works in-memory.
    }
    listeners.forEach((l) => l());
  }

  /** Mutations stamp `updatedAt` so the sync layer sees a user edit. The
   *  updater may carry meta.deletedIds additions (tombstones). */
  function setState(updater: (prev: PersistedState) => PersistedState): void {
    const prev = getSnapshot();
    const next = updater(prev);
    if (next !== prev) {
      commit({
        ...next,
        meta: { ...next.meta, updatedAt: nowIso() },
      });
    }
  }

  const recordActivity = (st: PersistedState): PersistedState => {
    const today = todayKey();
    return st.activity.includes(today)
      ? st
      : { ...st, activity: [...st.activity, today] };
  };

  const hydrate = (
    problems: Problem[],
    activity: string[],
    updatedAt: string,
  ): void => {
    // Cloud data replaces the bank; tombstones are cleared (they were either
    // pushed or the cloud is newer, so the cloud's rows are authoritative).
    commit({ problems, activity, meta: { updatedAt, deletedIds: [] } });
  };

  /** Called by the sync layer after a successful push clears the tombstones. */
  const ackTombstones = (): void => {
    if (getSnapshot().meta.deletedIds.length === 0) return;
    commit({
      ...getSnapshot(),
      meta: { ...getSnapshot().meta, deletedIds: [] },
    });
  };

  const addProblem = (input: NewProblemInput): Problem => {
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
  };

  const updateProblem = (id: string, patch: Partial<Problem>): void => {
    setState((prev) => ({
      ...prev,
      problems: prev.problems.map((p) =>
        p.id === id ? { ...p, ...patch } : p,
      ),
    }));
  };

  const deleteProblem = (id: string): void => {
    setState((prev) => ({
      ...prev,
      problems: prev.problems.filter((p) => p.id !== id),
      meta: {
        ...prev.meta,
        deletedIds: prev.meta.deletedIds.includes(id)
          ? prev.meta.deletedIds
          : [...prev.meta.deletedIds, id],
      },
    }));
  };

  /** Wipe the problem bank. Keeps the activity log (streak history). */
  const clearAllProblems = (): void => {
    setState((prev) =>
      recordActivity({
        ...prev,
        problems: [],
        meta: {
          ...prev.meta,
          deletedIds: [
            ...prev.meta.deletedIds,
            ...prev.problems.map((p) => p.id),
          ],
        },
      }),
    );
  };

  const toggleStatus = (id: string): void => {
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
  };

  /** Reset the spaced-repetition countdown after re-solving from scratch. */
  const resetReview = (id: string): string => {
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
  };

  return {
    subscribe,
    getSnapshot,
    getServerSnapshot,
    hydrate,
    ackTombstones,
    addProblem,
    updateProblem,
    deleteProblem,
    clearAllProblems,
    toggleStatus,
    resetReview,
  };
}

export interface Store extends StoreInstance {
  /** True once persisted state has been loaded on the client. */
  ready: boolean;
  problems: Problem[];
  activity: string[];
}

export function useStore(storageKey: string, seed: boolean): Store {
  // One instance per key/seed — created once and reused across renders.
  const instance = useMemo(
    () => createStore(storageKey, seed),
    [storageKey, seed],
  );
  const storeState = useSyncExternalStore(
    instance.subscribe,
    instance.getSnapshot,
    instance.getServerSnapshot,
  );

  // Instance identity is stable, so this object only changes when data does.
  return useMemo(
    () => ({
      ready: storeState !== serverSnapshot,
      problems: storeState.problems,
      activity: storeState.activity,
      subscribe: instance.subscribe,
      getSnapshot: instance.getSnapshot,
      getServerSnapshot: instance.getServerSnapshot,
      hydrate: instance.hydrate,
      ackTombstones: instance.ackTombstones,
      addProblem: instance.addProblem,
      updateProblem: instance.updateProblem,
      deleteProblem: instance.deleteProblem,
      clearAllProblems: instance.clearAllProblems,
      toggleStatus: instance.toggleStatus,
      resetReview: instance.resetReview,
    }),
    [storeState, instance],
  );
}
