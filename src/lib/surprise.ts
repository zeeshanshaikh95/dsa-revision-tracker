import type { Problem } from "../types";
import { reviewStatus } from "./spaced";

/**
 * Pick a random active problem for a "Surprise me" practice session.
 *
 * Weights lean toward what actually needs attention:
 *   overdue        → 5
 *   due today      → 3
 *   otherwise      → 1
 *   struggled      → +1 (recent struggle deserves a re-pass)
 * Completed problems are never picked.
 */
export function pickSurpriseProblem(
  problems: Problem[],
  today: string,
): Problem | null {
  const active = problems.filter((p) => p.status === "active");
  if (active.length === 0) return null;

  const weighted = active.map((p) => {
    const status = reviewStatus(p, today);
    const base = status === "overdue" ? 5 : status === "today" ? 3 : 1;
    const struggle = p.confidence === "struggled" ? 1 : 0;
    return { problem: p, weight: Math.min(base + struggle, 6) };
  });

  const total = weighted.reduce((sum, x) => sum + x.weight, 0);
  let roll = Math.random() * total;
  for (const { problem, weight } of weighted) {
    roll -= weight;
    if (roll < 0) return problem;
  }
  return weighted[weighted.length - 1].problem;
}
