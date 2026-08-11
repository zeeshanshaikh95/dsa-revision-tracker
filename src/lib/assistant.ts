import type { Confidence, Difficulty, Problem } from "../types";
import { CONFIDENCE_META, DIFFICULTY_STYLES, MODULES } from "../types";
import { relativeDay, reviewStatus, todayKey } from "./spaced";
import {
  confidenceStats,
  difficultyStats,
  formatMinutes,
  overdueCount,
  totalFocusedTime,
} from "./analytics";
import { pickSurpriseProblem } from "./surprise";
import { MOTIVATIONAL_QUOTES, randomQuoteIndex } from "./quotes";

/**
 * Deterministic assistant for managing the problem bank. Everything runs
 * client-side against the store — no backend or API keys needed.
 */

export interface ChatProblemInput {
  title: string;
  url: string;
  module: string;
  difficulty: Difficulty;
  confidence: Confidence;
}

export type ChatAction =
  | { kind: "reply"; text: string; chips?: string[] }
  | { kind: "add"; input: ChatProblemInput }
  | { kind: "delete"; problem: Problem }
  | { kind: "toggleStatus"; problem: Problem }
  | { kind: "resetReview"; problem: Problem }
  | { kind: "update"; problem: Problem; patch: Partial<Problem>; changes: string[] }
  | { kind: "clearAll" };

const DIFFICULTIES: Difficulty[] = ["easy", "medium", "hard"];
const CONFIDENCES: Confidence[] = ["struggled", "hints", "mastered"];

const KV_RE = /(\w+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s,]+))/gi;

const helpChips = ["What's due today?", "List all problems", "Stats", "Motivate me"];
const fallbackChips = ["Help", "What's due today?"];

function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Case-insensitive module lookup from the known list. */
function findModule(value: string): string | null {
  const q = value.trim().toLowerCase();
  return MODULES.find((m) => m.toLowerCase() === q) ?? null;
}

function difficultyLabel(d: Difficulty): string {
  return DIFFICULTY_STYLES[d].label;
}

function confidenceLabel(c: Confidence): string {
  return CONFIDENCE_META[c].label;
}

/** Parse a command's remainder into a title plus key=value pairs. */
function parseTitleAndKvs(rest: string): {
  title: string;
  kvs: Record<string, string>;
} {
  const kvs: Record<string, string> = {};
  const cleaned = rest.replace(KV_RE, (_m, key: string, q1?: string, q2?: string, bare?: string) => {
    kvs[key.toLowerCase()] = (q1 ?? q2 ?? bare ?? "").trim();
    return " ";
  });
  const title = cleaned.replace(/^["'\s]+|["'\s]+$/g, "").trim();
  return { title, kvs };
}

/** Find problems matching a title fragment; ranked by prefix closeness.
 *  An exact title match always wins outright over fuzzy contains-matches. */
function findProblems(query: string, problems: Problem[]): Problem[] {
  const q = norm(query);
  if (!q) return [];
  const exact = problems.filter((p) => norm(p.title) === q);
  if (exact.length > 0) return exact;
  const score = (p: Problem): number => {
    const n = norm(p.title);
    if (n === q) return 3;
    if (n.startsWith(q)) return 2;
    if (n.includes(q)) return 1;
    if (q.includes(n)) return 0.5;
    return -1;
  };
  return problems
    .map((p) => ({ p, s: score(p) }))
    .filter((x) => x.s >= 0)
    .sort((a, b) => b.s - a.s)
    .map((x) => x.p);
}

function helpAction(): ChatAction {
  return {
    kind: "reply",
    chips: helpChips,
    text:
      "I can manage your problem bank. Try:\n" +
      "• add \"Two Sum\" difficulty=easy module=Arrays\n" +
      "• remove \"Two Sum\"\n" +
      "• mark \"Two Sum\" done  ·  reopen \"Two Sum\"\n" +
      "• update \"Two Sum\" difficulty=hard confidence=mastered\n" +
      "• reset \"Two Sum\"   (restart its review cycle)\n" +
      "• what's due? · stats · list · search \"two\"\n" +
      "• clear all   (wipes the bank — asks for confirmation)\n" +
      "• motivate me  (a quote to keep the grind going)",
  };
}

function motivateAction(): ChatAction {
  const quote = MOTIVATIONAL_QUOTES[randomQuoteIndex(null)];
  return {
    kind: "reply",
    text: `💪 “${quote.text}” — ${quote.author}\n\nYou've got this. One problem at a time.`,
    chips: ["Surprise me", "What's due today?"],
  };
}

function listAction(problems: Problem[]): ChatAction {
  if (problems.length === 0)
    return {
      kind: "reply",
      text: "Your bank is empty. Add your first problem with something like: add \"Two Sum\" difficulty=easy",
      chips: ["Add \"Two Sum\" difficulty=easy", "Stats"],
    };
  const top = problems.slice(0, 10);
  const lines = top.map(
    (p, i) =>
      `${i + 1}. ${p.title} — ${DIFFICULTY_STYLES[p.difficulty].label} · ${p.pattern} · ${relativeDay(p.nextReview, todayKey())}`,
  );
  const more = problems.length > top.length ? `\n…and ${problems.length - top.length} more.` : "";
  return {
    kind: "reply",
    text: `You have ${problems.length} problems:\n${lines.join("\n")}${more}`,
    chips: ["What's due today?", "Stats"],
  };
}

function dueAction(problems: Problem[]): ChatAction {
  const today = todayKey();
  const due = problems
    .filter((p) => p.status === "active" && reviewStatus(p, today) !== "safe")
    .sort((a, b) => a.nextReview.localeCompare(b.nextReview));
  const overdue = overdueCount(problems, today);
  if (due.length === 0)
    return {
      kind: "reply",
      text: "Nothing due for review — you're all caught up. 🎉",
      chips: ["List all problems", "Stats"],
    };
  const lines = due.slice(0, 8).map(
    (p) => `• ${p.title} — ${relativeDay(p.nextReview, today)}`,
  );
  const more = due.length > 8 ? `\n…and ${due.length - 8} more.` : "";
  const overdueNote = overdue > 0 ? `\n⚠️ ${overdue} of them are overdue.` : "";
  return {
    kind: "reply",
    text: `${due.length} problem${due.length === 1 ? "" : "s"} due for review${overdueNote}:\n${lines.join("\n")}${more}`,
    chips: ["Mark the first one done", "Stats"],
  };
}

function searchAction(query: string, problems: Problem[]): ChatAction {
  const q = query.trim().replace(/^["'\s]+|["'\s]+$/g, "").toLowerCase();
  const matches = problems.filter(
    (p) =>
      p.title.toLowerCase().includes(q) ||
      p.module.toLowerCase().includes(q) ||
      p.pattern.toLowerCase().includes(q),
  );
  if (matches.length === 0)
    return {
      kind: "reply",
      text: `Nothing matches “${query.trim()}”.`,
      chips: ["List all problems", "Help"],
    };
  const lines = matches.slice(0, 8).map((p) => `• ${p.title} (${p.module})`);
  const more = matches.length > 8 ? `\n…and ${matches.length - 8} more.` : "";
  return {
    kind: "reply",
    text: `${matches.length} match${matches.length === 1 ? "" : "es"}:\n${lines.join("\n")}${more}`,
  };
}

function statsAction(problems: Problem[]): ChatAction {
  const total = problems.length;
  const solved = problems.filter((p) => p.status === "completed").length;
  const pct = total === 0 ? 0 : Math.round((solved / total) * 100);
  const diff = difficultyStats(problems);
  const conf = confidenceStats(problems);
  const focus = totalFocusedTime(problems);
  const lines = [
    `📊 ${total} problems · ${solved} completed (${pct}%)`,
    `Easy ${diff.easy.solved}/${diff.easy.total} · Medium ${diff.medium.solved}/${diff.medium.total} · Hard ${diff.hard.solved}/${diff.hard.total}`,
    `Mastered ${conf.mastered} · Hints ${conf.hints} · Struggled ${conf.struggled}`,
  ];
  if (focus > 0) lines.push(`⏱ ${formatMinutes(focus)} of focused time logged`);
  return {
    kind: "reply",
    text: lines.join("\n"),
    chips: ["What's due today?", "List all problems"],
  };
}

function addAction(rest: string): ChatAction {
  const { title, kvs } = parseTitleAndKvs(rest);
  if (!title)
    return {
      kind: "reply",
      text: "What should I add? e.g. add \"Two Sum\" difficulty=easy module=Arrays",
      chips: helpChips,
    };
  const module = findModule(kvs.module ?? "Introduction");
  if (!module)
    return {
      kind: "reply",
      text: `Unknown module “${kvs.module}” — pick one of: ${MODULES.join(", ")}`,
    };
  const difficulty = (kvs.difficulty ?? "easy").toLowerCase() as Difficulty;
  if (!DIFFICULTIES.includes(difficulty))
    return {
      kind: "reply",
      text: `Unknown difficulty “${kvs.difficulty}” — use easy, medium, or hard.`,
    };
  const confidence = (kvs.confidence ?? "hints").toLowerCase() as Confidence;
  if (!CONFIDENCES.includes(confidence))
    return {
      kind: "reply",
      text: `Unknown confidence “${kvs.confidence}” — use struggled, hints, or mastered.`,
    };
  return {
    kind: "add",
    input: { title, url: kvs.url ?? "", module, difficulty, confidence },
  };
}

function updateAction(rest: string, problems: Problem[]): ChatAction {
  const { title, kvs } = parseTitleAndKvs(rest);
  const matches = findProblems(title, problems);
  if (matches.length === 0)
    return {
      kind: "reply",
      text: `No problem found matching “${title}”. Try "list" to see your bank.`,
      chips: ["List all problems", "Help"],
    };
  if (matches.length > 1)
    return {
      kind: "reply",
      text: `Found ${matches.length} matches: ${matches
        .map((p) => p.title)
        .join(" · ")}. Include more of the title.`,
    };
  const patch: Partial<Problem> = {};
  const changes: string[] = [];
  for (const [key, value] of Object.entries(kvs)) {
    const v = value.trim();
    if (key === "difficulty") {
      const d = v.toLowerCase() as Difficulty;
      if (!DIFFICULTIES.includes(d))
        return { kind: "reply", text: `Unknown difficulty “${v}” — use easy, medium, or hard.` };
      patch.difficulty = d;
      changes.push(`difficulty → ${difficultyLabel(d)}`);
    } else if (key === "confidence") {
      const c = v.toLowerCase() as Confidence;
      if (!CONFIDENCES.includes(c))
        return { kind: "reply", text: `Unknown confidence “${v}” — use struggled, hints, or mastered.` };
      patch.confidence = c;
      changes.push(`confidence → ${confidenceLabel(c)}`);
    } else if (key === "module") {
      const m = findModule(v);
      if (!m)
        return { kind: "reply", text: `Unknown module “${v}” — pick one of: ${MODULES.join(", ")}` };
      patch.module = m;
      changes.push(`module → ${m}`);
    } else if (key === "url") {
      patch.url = v;
      changes.push("url updated");
    } else if (key === "pattern") {
      patch.pattern = v;
      changes.push(`pattern → ${v}`);
    } else {
      return {
        kind: "reply",
        text: `I can't update “${key}” — I support difficulty, confidence, module, url, and pattern.`,
      };
    }
  }
  if (changes.length === 0)
    return {
      kind: "reply",
      text: "What should I change? e.g. update \"Two Sum\" difficulty=hard confidence=mastered",
    };
  return { kind: "update", problem: matches[0], patch, changes };
}

function mutationAction(
  kind: "delete" | "toggleStatus" | "resetReview",
  query: string,
  problems: Problem[],
): ChatAction {
  const matches = findProblems(query, problems);
  if (matches.length === 0)
    return {
      kind: "reply",
      text: `No problem found matching “${query.trim()}”. Try "list" to see your bank.`,
      chips: ["List all problems", "Help"],
    };
  if (matches.length > 1)
    return {
      kind: "reply",
      text: `Found ${matches.length} matches: ${matches
        .map((p) => p.title)
        .join(" · ")}. Include more of the title.`,
    };
  return { kind, problem: matches[0] } as ChatAction;
}

export function parseChat(raw: string, problems: Problem[]): ChatAction {
  const input = raw.trim();
  const low = input.toLowerCase();
  if (!low) return { kind: "reply", text: "Say something like: what's due today?", chips: helpChips };

  if (/^(help|\?|commands|what can you do)$/.test(low)) return helpAction();
  if (/^(stats|summary|overview|progress|how am i doing)$/.test(low))
    return statsAction(problems);
  if (/^(motivate me|motivate|quote|inspire me|inspire|encourage me|i need motivation|give me a quote)$/.test(low))
    return motivateAction();
  if (/^(surprise me|surprise|random|pick one for me|what should i do|give me something)$/.test(low)) {
    const p = pickSurpriseProblem(problems, todayKey());
    if (!p)
      return {
        kind: "reply",
        text: "No active problems to surprise you with — add a few first!",
        chips: helpChips,
      };
    return {
      kind: "reply",
      text: `🎲 Surprise: “${p.title}” (${p.module} · ${difficultyLabel(p.difficulty)}) — ${relativeDay(p.nextReview, todayKey())}. Open it from the bank and give it a pass!`,
      chips: ["What's due today?", "List all problems"],
    };
  }
  if (/^(what'?s due|what is due|due today|due|overdue|what needs review|to review)/.test(low))
    return dueAction(problems);
  if (/\b(clear all|wipe everything|delete all|remove all)\b/.test(low))
    return { kind: "clearAll" };
  if (/^(list|show all|show|all problems|problems|ls)\b/.test(low))
    return listAction(problems);

  // Note: capture groups come from `input` (original casing) so titles keep
  // their capitalization; keywords match case-insensitively via the i flag.
  const searchMatch = input.match(/^(search|find)\s+(.+)$/i);
  if (searchMatch) return searchAction(searchMatch[2], problems);

  const delMatch = input.match(/^(remove|delete|drop)\s+(.+)$/i);
  if (delMatch) return mutationAction("delete", delMatch[2], problems);

  const reopenMatch = input.match(/^reopen\s+(.+)$/i);
  if (reopenMatch) return mutationAction("toggleStatus", reopenMatch[1], problems);

  const doneMatch = input.match(
    /^(mark|complete|finish)\s+(.+?)\s*(as\s+)?done\s*$/i,
  );
  if (doneMatch) return mutationAction("toggleStatus", doneMatch[2], problems);
  const doneShort = input.match(/^(mark|complete|finish)\s+(.+)$/i);
  if (doneShort) return mutationAction("toggleStatus", doneShort[2], problems);

  const resetMatch = input.match(/^reset\s+(.+)$/i);
  if (resetMatch) return mutationAction("resetReview", resetMatch[1], problems);

  const updMatch = input.match(/^(update|edit|change|modify)\s+(.+)$/i);
  if (updMatch) return updateAction(updMatch[2], problems);

  const addMatch = input.match(/^(add|new|create|log|track)\s+(.+)$/i);
  if (addMatch) return addAction(addMatch[2]);

  if (/^(hi|hey|hello|yo|sup)\b/.test(low))
    return {
      kind: "reply",
      text: "Hey! 👋 I can add, remove, search and update problems, tell you what's due, and summarize your progress. Type \"help\" to see everything.",
      chips: helpChips,
    };

  return {
    kind: "reply",
    text: `I didn't catch that. Try a command like add “Two Sum”, “what's due today?”, or “stats”. Type "help" for the full list.`,
    chips: fallbackChips,
  };
}
