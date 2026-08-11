import { useCallback, useEffect, useRef, useState } from "react";
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
  return { problems: buildSeed(), activity: [todayKey()] };
}

export interface Store {
  /** True once localStorage has been read on the client (SSR-safe). */
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
  // Start with null so the server prerender never touches localStorage.
  // The client loads persisted state in an effect right after first paint.
  const [state, setState] = useState<PersistedState | null>(null);

  // Latest state for synchronous reads inside callbacks (e.g. resetReview).
  const stateRef = useRef<PersistedState | null>(null);
  stateRef.current = state;

  useEffect(() => {
    setState(loadState());
  }, []);

  useEffect(() => {
    if (state) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      } catch {
        // Storage may be unavailable (private mode) — the app still works in-memory.
      }
    }
  }, [state]);

  const recordActivity = useCallback(
    (st: PersistedState): PersistedState => {
      const today = todayKey();
      return st.activity.includes(today)
        ? st
        : { ...st, activity: [...st.activity, today] };
    },
    [],
  );

  const addProblem = useCallback(
    (input: NewProblemInput): Problem => {
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
      setState((prev) => {
        if (!prev) return prev;
        return recordActivity({ ...prev, problems: [problem, ...prev.problems] });
      });
      return problem;
    },
    [recordActivity],
  );

  const updateProblem = useCallback((id: string, patch: Partial<Problem>) => {
    setState((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        problems: prev.problems.map((p) =>
          p.id === id ? { ...p, ...patch } : p,
        ),
      };
    });
  }, []);

  const deleteProblem = useCallback((id: string) => {
    setState((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        problems: prev.problems.filter((p) => p.id !== id),
      };
    });
  }, []);

  const toggleStatus = useCallback((id: string) => {
    setState((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        problems: prev.problems.map((p) =>
          p.id === id
            ? {
                ...p,
                status: p.status === "completed" ? "active" : "completed",
              }
            : p,
        ),
      };
    });
  }, []);

  /** Reset the spaced-repetition countdown after re-solving from scratch. */
  const resetReview = useCallback(
    (id: string): string => {
      const today = todayKey();
      const current = stateRef.current?.problems.find((p) => p.id === id);
      const next = nextReviewAfterSolve(current?.reviewCount ?? 0);
      setState((prev) => {
        if (!prev) return prev;
        return recordActivity({
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
        });
      });
      return next;
    },
    [recordActivity],
  );

  return {
    ready: state !== null,
    problems: state?.problems ?? [],
    activity: state?.activity ?? [],
    addProblem,
    updateProblem,
    deleteProblem,
    toggleStatus,
    resetReview,
  };
}
