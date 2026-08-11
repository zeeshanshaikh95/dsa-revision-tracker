import { useMemo, useSyncExternalStore } from "react";
import type { Problem, Task } from "../types";
import { buildSeed } from "../data/seed";
import { nextReviewAfterSolve, todayKey } from "../lib/spaced";

export const STORAGE_KEY_LEGACY = "dsa-revision-tracker:v1";

/** Legacy standalone tasks key, superseded by tasks living in the bank state. */
const TASKS_KEY_LEGACY = "dsa-revision-tracker:tasks:v1";

const MAX_TASKS = 200;
const MAX_TASK_TEXT = 200;

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
  /** Dashboard to-do items — synced to the cloud with the bank. */
  tasks: Task[];
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
  tasks: [],
  meta: { updatedAt: EPOCH, deletedIds: [] },
};

function nowIso(): string {
  return new Date().toISOString();
}

function sanitizeTasks(tasks: unknown): Task[] {
  if (!Array.isArray(tasks)) return [];
  return tasks
    .filter(
      (t): t is Task =>
        !!t &&
        typeof t.id === "string" &&
        typeof t.text === "string" &&
        t.text.trim().length > 0 &&
        typeof t.createdAt === "string" &&
        (t.completedAt === null || typeof t.completedAt === "string"),
    )
    .map((t) => ({
      id: t.id,
      text: t.text.trim().slice(0, MAX_TASK_TEXT),
      createdAt: t.createdAt,
      completedAt: t.completedAt,
    }))
    .slice(0, MAX_TASKS);
}

/** One-time adoption of tasks saved under the old standalone key. */
function migrateLegacyTasks(): Task[] {
  try {
    const raw = localStorage.getItem(TASKS_KEY_LEGACY);
    if (raw) {
      const migrated = sanitizeTasks(JSON.parse(raw));
      if (migrated.length > 0) {
        localStorage.removeItem(TASKS_KEY_LEGACY);
        return migrated;
      }
    }
  } catch {
    // Corrupt or unreadable — nothing to migrate.
  }
  return [];
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
        const tasks =
          Array.isArray(parsed.tasks) && parsed.tasks.length > 0
            ? sanitizeTasks(parsed.tasks)
            : migrateLegacyTasks();
        return { problems: parsed.problems, activity: parsed.activity, tasks, meta };
      }
    }
  } catch {
    // Corrupt storage — fall through to a fresh (or empty) bank.
  }
  return {
    problems: seed ? buildSeed() : [],
    activity: seed ? [todayKey()] : [],
    tasks: migrateLegacyTasks(),
    meta: { updatedAt: EPOCH, deletedIds: [] },
  };
}

interface StoreInstance {
  subscribe: (onChange: () => void) => () => void;
  getSnapshot: () => PersistedState;
  getServerSnapshot: () => PersistedState;
  /** Replace the bank with cloud data (marks it as synced state). */
  hydrate: (
    problems: Problem[],
    activity: string[],
    updatedAt: string,
    tasks?: Task[],
  ) => void;
  /** Drop synced tombstones without stamping a new updatedAt. */
  ackTombstones: () => void;
  addProblem: (input: NewProblemInput) => Problem;
  updateProblem: (id: string, patch: Partial<Problem>) => void;
  deleteProblem: (id: string) => void;
  clearAllProblems: () => void;
  toggleStatus: (id: string) => void;
  resetReview: (id: string) => string;
  addTask: (text: string) => Task | null;
  toggleTask: (id: string) => void;
  removeTask: (id: string) => void;
  clearCompletedTasks: () => void;
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
    tasks: Task[] = [],
  ): void => {
    // Cloud data replaces the bank; tombstones are cleared (they were either
    // pushed or the cloud is newer, so the cloud's rows are authoritative).
    commit({ problems, activity, tasks, meta: { updatedAt, deletedIds: [] } });
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
    const today = todayKey();
    setState((prev) => {
      const problem = prev.problems.find((p) => p.id === id);
      const completing = problem?.status === "active";
      const next = {
        ...prev,
        problems: prev.problems.map((p) =>
          p.id === id
            ? {
                ...p,
                status: (p.status === "completed" ? "active" : "completed") as Problem["status"],
                // Marking complete counts as solving it today (feeds the
                // daily-goal ring and the streak).
                lastSolved: completing ? today : p.lastSolved,
              }
            : p,
        ),
      };
      return completing ? recordActivity(next) : next;
    });
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

  const addTask = (text: string): Task | null => {
    const trimmed = text.trim();
    if (!trimmed || trimmed.length > MAX_TASK_TEXT) return null;
    if (getSnapshot().tasks.length >= MAX_TASKS) return null;
    const task: Task = {
      id: crypto.randomUUID(),
      text: trimmed,
      createdAt: new Date().toISOString(),
      completedAt: null,
    };
    setState((prev) => ({ ...prev, tasks: [task, ...prev.tasks] }));
    return task;
  };

  const toggleTask = (id: string): void => {
    const now = new Date().toISOString();
    setState((prev) => ({
      ...prev,
      tasks: prev.tasks.map((t) =>
        t.id === id
          ? { ...t, completedAt: t.completedAt ? null : now }
          : t,
      ),
    }));
  };

  const removeTask = (id: string): void => {
    setState((prev) => ({
      ...prev,
      tasks: prev.tasks.filter((t) => t.id !== id),
    }));
  };

  const clearCompletedTasks = (): void => {
    setState((prev) => ({
      ...prev,
      tasks: prev.tasks.filter((t) => !t.completedAt),
    }));
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
    addTask,
    toggleTask,
    removeTask,
    clearCompletedTasks,
  };
}

export interface Store extends StoreInstance {
  /** True once persisted state has been loaded on the client. */
  ready: boolean;
  problems: Problem[];
  activity: string[];
  tasks: Task[];
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
      tasks: storeState.tasks,
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
      addTask: instance.addTask,
      toggleTask: instance.toggleTask,
      removeTask: instance.removeTask,
      clearCompletedTasks: instance.clearCompletedTasks,
    }),
    [storeState, instance],
  );
}
