export type Difficulty = "easy" | "medium" | "hard";

export type Confidence = "struggled" | "hints" | "mastered";

export type ProblemStatus = "active" | "completed";

export type ReviewStatus = "overdue" | "today" | "safe";

export interface Problem {
  id: string;
  title: string;
  url: string;
  module: string;
  difficulty: Difficulty;
  confidence: Confidence;
  status: ProblemStatus;
  /** Algorithmic pattern used, e.g. "Two-Pointer". */
  pattern: string;
  /** Plain-English notes (light markdown allowed). */
  intuition: string;
  timeComplexity: string;
  spaceComplexity: string;
  /** Local yyyy-mm-dd of the last solve. */
  lastSolved: string;
  /** How long the last solve took, e.g. "45m 5s". */
  lastDuration?: string;
  /** Local yyyy-mm-dd the problem comes due again. */
  nextReview: string;
  /** How many times it has been re-solved. */
  reviewCount: number;
  createdAt: string;
}

/** A dashboard to-do item; synced to the cloud alongside the bank. */
export interface Task {
  id: string;
  text: string;
  /** ISO timestamp of creation. */
  createdAt: string;
  /** ISO timestamp of completion, or null while open. */
  completedAt: string | null;
}

export const MODULES = [
  "Introduction",
  "Warm Up",
  "Time/Space Complexity",
  "Arrays",
  "Strings",
  "Hash Map",
  "Two Pointers",
  "Sliding Window",
  "Binary Search",
  "Linked Lists",
  "Stacks & Queues",
  "Trees & Graphs",
  "Recursion & Backtracking",
  "Dynamic Programming",
  "Heaps & Priority Queues",
  "Greedy",
  "Math & Bit Manipulation",
] as const;

export const PATTERNS = [
  "Two-Pointer",
  "Sliding Window",
  "Hash Map",
  "Binary Search",
  "Fast & Slow Pointers",
  "Prefix Sum",
  "Monotonic Stack",
  "Recursion",
  "Backtracking",
  "Dynamic Programming",
  "DFS / BFS",
  "Divide & Conquer",
  "Union-Find",
  "Topological Sort",
  "Greedy",
  "Simulation",
  "Bit Manipulation",
] as const;

/** Literal Tailwind class maps — full class names so Tailwind can see them. */
export const DIFFICULTY_STYLES: Record<
  Difficulty,
  { badge: string; dot: string; label: string }
> = {
  easy: {
    label: "Easy",
    badge:
      "bg-emerald-500/10 text-emerald-400 ring-emerald-500/25",
    dot: "bg-emerald-400",
  },
  medium: {
    label: "Medium",
    badge:
      "bg-amber-500/10 text-amber-400 ring-amber-500/25",
    dot: "bg-amber-400",
  },
  hard: {
    label: "Hard",
    badge: "bg-rose-500/10 text-rose-400 ring-rose-500/25",
    dot: "bg-rose-400",
  },
};

export const CONFIDENCE_META: Record<
  Confidence,
  { label: string; dot: string; bar: string; chip: string; hint: string }
> = {
  struggled: {
    label: "Struggled",
    dot: "bg-rose-400",
    bar: "bg-rose-400",
    chip: "bg-rose-500/10 text-rose-300 ring-rose-500/25",
    hint: "Needs another pass soon",
  },
  hints: {
    label: "Hints Needed",
    dot: "bg-amber-400",
    bar: "bg-amber-400",
    chip: "bg-amber-500/10 text-amber-300 ring-amber-500/25",
    hint: "Could solve with a nudge",
  },
  mastered: {
    label: "Mastered",
    dot: "bg-emerald-400",
    bar: "bg-emerald-400",
    chip: "bg-emerald-500/10 text-emerald-300 ring-emerald-500/25",
    hint: "Solved from scratch",
  },
};
