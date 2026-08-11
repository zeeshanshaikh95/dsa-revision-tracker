import type { Problem } from "../types";

/**
 * Revision-notes generator — deterministic, client-side, instant.
 * Combines a curated per-pattern knowledge base with the problem's own
 * metadata (difficulty, confidence, module, review history) into a
 * structured revision card. No API keys, no network.
 */

export interface RevisionNote {
  pattern: string;
  idea: string;
  signals: string[];
  approach: string[];
  complexity: string;
  pitfalls: string[];
  variations: string[];
  tips: string[];
}

interface PatternNote {
  idea: string;
  signals: string[];
  approach: string[];
  complexity: string;
  pitfalls: string[];
  variations: string[];
}

/** Curated knowledge base, keyed by lowercase pattern name. */
const PATTERN_KNOWLEDGE: Record<string, PatternNote> = {
  "two-pointer": {
    idea: "Two indices move toward or away from each other to scan the array in one pass, avoiding nested loops.",
    signals: [
      "Sorted array (or array you're allowed to sort)",
      "Looking for pairs/triplets with a target sum or difference",
      "Palindromes, reversing, or partitioning problems",
      "O(n²) brute force that asks for O(n)",
    ],
    approach: [
      "Place one pointer at the start, one at the end (or both at start for window-style)",
      "Compare the two values against your target",
      "Move the pointer that gets you closer to the target (e.g., sum too big → move right pointer left)",
      "Skip duplicates after a match so pairs don't repeat",
      "Stop when the pointers cross",
    ],
    complexity: "O(n) time, O(1) extra space (O(n log n) if you must sort first)",
    pitfalls: [
      "Off-by-one on the loop condition — use `left < right`, not `<=`, or you re-count the same pair",
      "Forgetting to skip duplicate values after a match",
      "Modifying the array while pointers reference indices",
    ],
    variations: [
      "Two-sum variants (with/without sorting)",
      "Container with most water (greedy pointer move)",
      "Remove/partition in-place (slow-fast write pointer)",
      "3Sum / 4Sum (sort + two-pointer inside a loop)",
    ],
  },
  "sliding window": {
    idea: "A window of fixed or variable size slides across the array; expand and shrink it to track a condition in amortized O(n).",
    signals: [
      "Subarray / substring with a constraint (sum ≤ k, exactly k distinct)",
      "Longest / shortest window satisfying a condition",
      "'Contiguous' appears in the prompt",
      "Brute force enumerates all subarrays",
    ],
    approach: [
      "Expand the right edge, adding the new element to the window state",
      "While the window violates the constraint, shrink from the left",
      "Update the answer after each valid (fixed-size) or each satisfying (variable-size) window",
      "For fixed k: expand right, shrink left only when size > k",
      "Window state is usually a running sum, count map, or frequency counter",
    ],
    complexity: "O(n) time (each element enters and leaves once), O(k) space for the window state",
    pitfalls: [
      "Shrinking with `while` instead of `if` when the condition can stay invalid",
      "Forgetting to remove the left element from the window state on shrink",
      "Integer overflow on large running sums — use the right type/language idiom",
    ],
    variations: [
      "Longest substring without repeating characters",
      "Minimum window substring",
      "Max sum of k consecutive elements",
      "Permutation in string (frequency-counter window)",
    ],
  },
  "hash map": {
    idea: "Store elements by key for O(1) lookup — trade memory for time.",
    signals: [
      "Need to find if an element exists / count occurrences",
      "Pairs or complements (a + b = target)",
      "Detecting duplicates or anagrams",
      "Grouping elements by some property",
    ],
    approach: [
      "Identify the key: the value, its frequency, or a transformed signature",
      "Build the map in one pass while checking the condition on the fly",
      "For complements, store value → index (or count) and check before inserting",
      "For anagrams/duplicates, normalize the key (sorted chars or char counts)",
      "Mind collisions conceptually — in most languages the map handles it",
    ],
    complexity: "O(n) time, O(n) space",
    pitfalls: [
      "Modifying the map while iterating it",
      "Using mutable objects as keys without proper hashing",
      "Not accounting for duplicate values when the problem forbids reusing elements",
    ],
    variations: [
      "Two Sum and its many forms",
      "Group anagrams",
      "Contains Duplicate II",
      "Top K Frequent Elements (map + heap/bucket)",
    ],
  },
  "binary search": {
    idea: "Halve the search space each step on monotonic data — O(log n) instead of O(n).",
    signals: [
      "Sorted array or 'answers form a monotonic range' (min/max feasible)",
      "'Find the first/last occurrence', 'minimum such that', 'maximum such that'",
      "Peak finding or rotated-array searches",
      "Search space is large (10⁹) — binary search the ANSWER, not the array",
    ],
    approach: [
      "Define lo/hi over a range where the predicate is false...true (or true...false)",
      "Mid = lo + (hi - lo) / 2 (avoids overflow)",
      "Check the predicate at mid and decide which half to keep",
      "Track the last 'good' answer if searching for feasibility",
      "Verify your loop invariant with empty and single-element inputs",
    ],
    complexity: "O(log n) time, O(1) space",
    pitfalls: [
      "Infinite loops from `lo = mid` without progress — use `mid + 1` / `mid - 1` or `lo = mid` with careful rounding",
      "Overflow with `(lo + hi) / 2` on huge ranges",
      "Confusing 'find exact' vs 'find boundary' variants — off-by-one city",
    ],
    variations: [
      "First/last position of a target",
      "Search in rotated sorted array",
      "Find peak element",
      "Split array largest sum / Koko eating bananas (answer-space search)",
    ],
  },
  "fast & slow pointers": {
    idea: "Two pointers moving at different speeds detect cycles and find the middle in one pass.",
    signals: [
      "Linked list problems mentioning cycles, loops, or middle",
      "Detecting if a sequence repeats (e.g., happy number)",
      "Finding the middle or the k-th-from-end without length",
    ],
    approach: [
      "Move slow one step, fast two steps each iteration",
      "Cycle detection: if they meet, a cycle exists; walk from head + meeting point to find the entry",
      "Middle: when fast hits the end, slow is at the middle",
      "k-th from end: advance fast k steps first, then move both together",
      "Always null-check before dereferencing fast.next",
    ],
    complexity: "O(n) time, O(1) space",
    pitfalls: [
      "Null-pointer on fast.next.next without checks",
      "Confusing cycle-detection entry-point math with mere detection",
      "Off-by-one on the middle for even-length lists (choose left or right middle deliberately)",
    ],
    variations: [
      "Linked list cycle + cycle entry",
      "Middle of linked list",
      "Happy number",
      "Remove nth node from end",
    ],
  },
  "prefix sum": {
    idea: "Precompute cumulative sums so any range sum becomes one subtraction: sum(i..j) = prefix[j+1] - prefix[i].",
    signals: [
      "Repeated range-sum queries",
      "Subarray sum equals k / divisible by k",
      "2D range sums (prefix over rows+cols)",
      "'Number of subarrays with sum/condition'",
    ],
    approach: [
      "Build prefix[i] = sum of first i elements (prefix[0] = 0)",
      "Range sum = prefix[r+1] - prefix[l]",
      "For 'equals k' counts, track seen prefix sums in a map — current - k must have been seen",
      "For divisibility, track prefix sums modulo k in a map",
      "Extend to 2D with inclusion-exclusion for rectangles",
    ],
    complexity: "O(n) build, O(1) per query; O(n) space",
    pitfalls: [
      "Off-by-one on prefix indices — prefix[0] = 0 is the standard trick",
      "Forgetting the empty prefix when counting subarrays from index 0",
      "Negative modulo results in some languages (normalize with +k % k)",
    ],
    variations: [
      "Subarray sum equals K",
      "Continuous subarray sum (mod k)",
      "Range sum query 2D",
      "Product of array except self (prefix + suffix)",
    ],
  },
  "monotonic stack": {
    idea: "Keep a stack in strictly increasing/decreasing order; each element is pushed once and popped once, making the pass O(n).",
    signals: [
      "'Next greater / next smaller element'",
      "Daily temperatures / stock span style problems",
      "Histogram / largest rectangle",
      "Balancing parentheses or matching brackets",
    ],
    approach: [
      "Decide the stack's order: increasing for 'next smaller', decreasing for 'next greater'",
      "While the top of the stack violates the order, pop it — the current element is the pop's answer",
      "Store indices (not values) so you can compute distances",
      "For 'nearest' queries, scan left-to-right for next greater; right-to-left for previous",
      "After the pass, remaining stack elements have no greater/smaller element — handle per spec",
    ],
    complexity: "O(n) time, O(n) space",
    pitfalls: [
      "Wrong stack ordering direction (increasing vs decreasing)",
      "Comparing values when you stored indices (dereference first)",
      "Ties: decide whether equal elements should pop (often they should not)",
    ],
    variations: [
      "Daily temperatures",
      "Next greater element I/II",
      "Largest rectangle in histogram",
      "Valid parentheses variants",
    ],
  },
  recursion: {
    idea: "Solve a problem by defining the answer in terms of smaller versions of itself; trust the recursion, handle the base case.",
    signals: [
      "Tree / linked-list traversals",
      "'Every path/combination' shaped problems",
      "Problems with self-similar structure (divide a number, process nested structures)",
      "The brute-force you can express as 'solve(n) depends on solve(n-1)'",
    ],
    approach: [
      "Write the base case first (empty input, single node, n ≤ 1)",
      "Assume the recursive call returns the correct answer for the subproblem",
      "Combine subanswers at the current level (this is the 'merge' step)",
      "Count the recursion depth — deep trees may blow the stack",
      "Memoize when overlapping subproblems appear (see DP)",
    ],
    complexity: "Depends on branching: b branches at depth d → O(b^d) without memoization",
    pitfalls: [
      "Missing or wrong base case → infinite recursion",
      "Forgetting to return the combined result",
      "Stack overflow on deep recursion (convert to iterative when needed)",
    ],
    variations: [
      "Reverse a linked list recursively",
      "Tree traversals",
      "Pow(x, n) / exponentiation by squaring",
      "Tower of Hanoi",
    ],
  },
  backtracking: {
    idea: "Explore decisions step by step, and when a branch fails, undo (backtrack) and try the next option. Systematically enumerate candidates.",
    signals: [
      "'Generate all combinations / permutations / subsets'",
      "Constraint satisfaction: N-Queens, Sudoku, word search",
      "'Include or exclude' decision trees",
      "Grid path problems that must not revisit cells",
    ],
    approach: [
      "Define the state (partial candidate) and the choices at each step",
      "Order choices to prune early (sort, or try most constrained first)",
      "Add a choice → recurse → remove it (the backtrack)",
      "Prune with bounds/visited sets to avoid useless branches",
      "Terminate when the candidate is complete or the depth is exhausted",
    ],
    complexity: "O(b^d) worst case (b choices per decision, d decisions) — pruning is everything",
    pitfalls: [
      "Not undoing the choice (state leaks between branches)",
      "Passing mutable state that's shared instead of copied per branch",
      "Forgetting the visited-set reset on backtrack in grid problems",
    ],
    variations: [
      "Subsets / Permutations / Combinations",
      "N-Queens, Sudoku solver",
      "Word search",
      "Letter combinations of a phone number",
    ],
  },
  "dynamic programming": {
    idea: "Solve overlapping subproblems once and reuse — recursion + memoization, or a bottom-up table.",
    signals: [
      "'Number of ways to ...' / 'maximum/minimum ...' with choices",
      "Subsequence/subarray optimization problems",
      "Knapsack-style include/exclude decisions",
      "Overlapping subproblems (same inputs computed repeatedly)",
    ],
    approach: [
      "Define dp[i] (or dp[i][j]): the answer for a prefix/subproblem — state it in words first",
      "Write the recurrence: how dp[i] relates to smaller indices",
      "Pick the base cases and the traversal order (often left-to-right)",
      "Decide 1D vs 2D (2D often collapses to 1D with careful iteration)",
      "Sanity-check with a tiny example before coding",
    ],
    complexity: "O(states × transition cost); space O(states), improvable to O(1) with rolling arrays",
    pitfalls: [
      "Unclear state definition → wrong recurrence",
      "Wrong base case (dp[0] vs dp[1])",
      "Iteration order that reads not-yet-computed states (esp. 2D collapsed tables)",
    ],
    variations: [
      "Climbing stairs / house robber / coin change",
      "Longest common subsequence",
      "0/1 knapsack",
      "Edit distance, word break, LIS (with binary-search trick)",
    ],
  },
  "dfs / bfs": {
    idea: "Traverse a graph/tree: DFS goes deep (stack/recursion), BFS explores level by level (queue) — each has a natural use.",
    signals: [
      "Grid/tree traversal, connected components, islands",
      "'Shortest path in an unweighted graph' → BFS",
      "Topological/ancestor questions, path existence → DFS",
      "Serialization or generating all nodes",
    ],
    approach: [
      "Pick the entry point(s) — often loop over all cells/nodes for components",
      "DFS: recurse (or explicit stack), marking visited before enqueueing children",
      "BFS: queue, pop front, push unvisited neighbors, track distance/level",
      "Mark visited when PUSHED (not when popped) to avoid duplicates",
      "On grids, boundary-check before accessing neighbors; watch for 4 vs 8 directions",
    ],
    complexity: "O(V + E) time; O(V) space for visited + stack/queue",
    pitfalls: [
      "Double-processing nodes → mark visited when enqueued",
      "Infinite loops on cyclic graphs without a visited set",
      "Forgetting diagonal moves are excluded by default (4-directional grids)",
    ],
    variations: [
      "Number of islands",
      "Word ladder (BFS shortest path)",
      "Course schedule (DFS + cycle detection)",
      "Binary tree level order (BFS)",
    ],
  },
  "divide & conquer": {
    idea: "Split the input, solve each half, combine — the merge step is where the real work happens.",
    signals: [
      "Sorting (merge/quick sort)",
      "'Count pairs/crossing pairs' problems (inversions)",
      "Divide-the-array-then-combine structures",
      "Matrix/geometric problems that split space",
    ],
    approach: [
      "Split into halves until trivially solvable (base case)",
      "Solve each half recursively",
      "Combine: merge sorted halves, count crossing inversions, etc.",
      "Ensure the combine step is efficient — it usually dominates (O(n) per level)",
      "Watch the recursion depth: log n levels for balanced splits",
    ],
    complexity: "O(n log n) typical (merge sort, inversion counting); O(log n) space for the call stack",
    pitfalls: [
      "Counting crossing pairs twice (only count across the split!)",
      "Mutating the input during the merge in a way that breaks later levels",
      "Deep recursion on unbalanced splits",
    ],
    variations: [
      "Merge sort / quick sort",
      "Count inversions",
      "Maximum subarray (Kadane's rival, D&C form)",
      "Closest pair of points",
    ],
  },
  "union-find": {
    idea: "Group elements into disjoint sets with near-constant-time find/union — the go-to for connectivity questions.",
    signals: [
      "'Connected components', 'are these connected?', 'same group?'",
      "Dynamic connectivity: edges arrive over time",
      "Number of provinces / redundant connection",
      "Detecting cycles in undirected graphs",
    ],
    approach: [
      "Initialize each element as its own parent",
      "find(x): compress the path so future lookups are O(α)",
      "union(a, b): attach one root under the other (by rank/size to keep trees flat)",
      "Count distinct roots to get component counts",
      "For cycle detection: if union of two already-connected nodes, a cycle exists",
    ],
    complexity: "≈ O(α(n)) per op (inverse Ackermann — effectively constant); O(n) space",
    pitfalls: [
      "Skipping path compression → O(n) finds",
      "Union by arbitrary attachment → tall trees",
      "Forgetting to re-count roots after unions when tracking components",
    ],
    variations: [
      "Number of provinces",
      "Redundant connection",
      "Accounts merge",
      "Largest component size by common factor",
    ],
  },
  "topological sort": {
    idea: "Order nodes so every edge points forward — valid only for DAGs. Kahn's algorithm or DFS post-order.",
    signals: [
      "Prerequisites / dependencies ('take course A before B')",
      "Task scheduling with ordering constraints",
      "Detecting cycles in a directed graph (a cycle = impossible order)",
      "'Build order' style problems",
    ],
    approach: [
      "Kahn's: count in-degrees, start with in-degree-0 nodes in a queue",
      "Pop a node, add to order, decrement neighbors' in-degree, enqueue newly zeroed",
      "If the output has fewer nodes than input → there's a cycle",
      "DFS variant: post-order append + track visiting-state for back edges",
      "Lexicographically smallest order: use a min-heap instead of a plain queue",
    ],
    complexity: "O(V + E) time, O(V) space",
    pitfalls: [
      "Forgetting the cycle check (fewer nodes in order than expected)",
      "DFS back-edge detection: distinguish visiting vs visited",
      "Empty vs multiple valid orders — return per spec",
    ],
    variations: [
      "Course schedule I/II",
      "Alien dictionary",
      "Build order (dependency graph)",
      "Smallest string with swaps (union-find hybrid)",
    ],
  },
  greedy: {
    idea: "Make the locally optimal choice at each step, trusting it leads to a global optimum — no backtracking needed.",
    signals: [
      "'Maximum/minimum of something' where a simple priority rule works",
      "Interval scheduling / meeting rooms",
      "Coin-change with 'nice' denominations",
      "Activity selection, jumps, gas stations",
    ],
    approach: [
      "Sort by the greedy criterion (end time, ratio, deadline)",
      "Prove/assume the exchange argument: swapping any optimal solution into greedy form doesn't hurt",
      "Process in order, committing to each choice",
      "Greedy fails when a later choice depends on earlier ones in a non-local way — try DP instead",
      "Always verify with a counterexample hunt (that's how you know it's greedy-valid)",
    ],
    complexity: "O(n log n) dominated by sorting; O(1) extra space typical",
    pitfalls: [
      "Using greedy where the optimal choice isn't locally obvious (many problems need DP)",
      "Wrong sort key",
      "Not considering ties in the sort criterion",
    ],
    variations: [
      "Meeting rooms / interval scheduling",
      "Jump game II",
      "Gas station",
      "Task scheduler",
    ],
  },
  simulation: {
    idea: "Just follow the rules literally with careful state tracking — no trick, but precision matters.",
    signals: [
      "Process moves/steps on a board or array",
      "'Simulate the process' language",
      "Deterministic repeated operations (game of life)",
      "Clock/date/time math",
    ],
    approach: [
      "Model the state explicitly (position, direction, visited cells)",
      "Implement one step as a function, then loop",
      "Guard against infinite loops with a step cap or visited-state set",
      "Handle boundaries/wraparound per the rules",
      "Test with the provided examples — they catch rule misreads",
    ],
    complexity: "O(steps × work per step); space depends on tracked state",
    pitfalls: [
      "Misreading rules (off-by-one on boundaries, wraparound)",
      "Infinite loops on repeating states",
      "Over-optimizing a problem that just needs clean simulation",
    ],
    variations: [
      "Spiral matrix",
      "Robot bounded in circle",
      "Game of life",
      "Time needed to inform all employees",
    ],
  },
  "bit manipulation": {
    idea: "Use bitwise ops for O(1) space tricks: XOR for pairing, masks for subsets, shifts for powers of two.",
    signals: [
      "'Single number' / duplicates in pairs",
      "Powers of two, bits set, Hamming weight",
      "Subset enumeration for small n (bitmasks)",
      "Add/multiply without arithmetic operators",
    ],
    approach: [
      "XOR facts: a^a = 0, a^0 = a → the odd-one-out survives",
      "n & (n-1) clears the lowest set bit (popcount, power-of-two checks)",
      "To test bit i: (x >> i) & 1; to set: x | (1 << i)",
      "Masks for subsets: iterate 0..2^n-1 and read bits",
      "Careful with signed shifts in some languages — use unsigned where needed",
    ],
    complexity: "O(n) or O(bits) time, O(1) space — that's the point",
    pitfalls: [
      "Signed vs unsigned shifts (arithmetic vs logical)",
      "Operator precedence mixing & | with comparisons — parenthesize",
      "Overflow when shifting into the sign bit in C-like languages",
    ],
    variations: [
      "Single number (and II, III)",
      "Counting bits",
      "Subsets via bitmask",
      "Divide two integers without division",
    ],
  },
};

/** Fallback for patterns not in the knowledge base. */
const GENERIC: PatternNote = {
  idea: "No curated notes for this pattern yet — use the generic playbook below and write down what you learn.",
  signals: [
    "Read the examples carefully — they define the expected shape of the answer",
    "Identify the smallest meaningful input and trace your idea through it",
    "Look for the constraint that forces the algorithm (array sorted? small n? unique values?)",
    "Try brute force first, then look for repeated work to eliminate",
  ],
  approach: [
    "Restate the problem in one sentence in your own words",
    "Write the brute force, then measure where it's wasteful",
    "Check which pattern family it smells like: scan, partition, search, or combine",
    "Implement the cleaner version, then test edge cases (empty, single, extremes)",
    "Record the pattern name on the problem so future revisions get curated notes",
  ],
  complexity: "Derive it: count loops × work per iteration, plus space for extra structures",
  pitfalls: [
    "Jumping to code before the approach is settled",
    "Ignoring constraints (n = 10⁵ usually rules out O(n²))",
    "Not testing with the example inputs",
  ],
  variations: ["Edit the problem's pattern field to get curated notes for it"],
};

const DIFFICULTY_TIP: Record<string, string> = {
  easy: "Easy: resist over-engineering — a clean brute force that passes is fine; optimize only if asked.",
  medium: "Medium: identify the pattern from the signals before coding; the pattern IS the hint.",
  hard: "Hard: expect multiple steps. Find the core subproblem, solve it, then layer the rest; edge cases decide pass/fail.",
};

const CONFIDENCE_TIP: Record<string, string> = {
  struggled: "Struggled last time: walk the template approach step by step from scratch before touching the solution.",
  hints: "Needed hints last time: try to write the template from memory, then compare where you stalled.",
  mastered: "Mastered: do a 30-second recall test — can you name the approach, complexity, and the #1 pitfall?",
};

export function generateRevisionNotes(problem: Problem): RevisionNote {
  const key = problem.pattern.toLowerCase().trim();
  const base = PATTERN_KNOWLEDGE[key] ?? GENERIC;

  const tips = [
    DIFFICULTY_TIP[problem.difficulty] ?? DIFFICULTY_TIP.medium,
    CONFIDENCE_TIP[problem.confidence] ?? CONFIDENCE_TIP.hints,
    problem.reviewCount > 0
      ? `Re-solved ${problem.reviewCount}× — the next pass should be faster than the last.`
      : "Not re-solved yet — schedule a second pass after 1–3 days for long-term retention.",
    "Timebox: attempt 10 minutes without hints before peeking.",
  ];

  return {
    pattern: problem.pattern,
    idea: base.idea,
    signals: base.signals,
    approach: base.approach,
    complexity: base.complexity,
    pitfalls: base.pitfalls,
    variations: base.variations,
    tips,
  };
}

/** Render the generated note as copyable markdown. */
export function revisionNoteToMarkdown(n: RevisionNote, title: string): string {
  const lines = [
    `# ${title}`,
    "",
    `**Pattern:** ${n.pattern}`,
    "",
    `> ${n.idea}`,
    "",
    "## When to reach for it",
    ...n.signals.map((s) => `- ${s}`),
    "",
    "## Template approach",
    ...n.approach.map((s, i) => `${i + 1}. ${s}`),
    "",
    `**Typical cost:** ${n.complexity}`,
    "",
    "## Pitfalls",
    ...n.pitfalls.map((p) => `- ${p}`),
    "",
    "## Variations",
    ...n.variations.map((v) => `- ${v}`),
    "",
    "## Revision tips",
    ...n.tips.map((t) => `- ${t}`),
  ];
  return lines.join("\n");
}
