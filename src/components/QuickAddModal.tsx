import { useEffect, useRef, useState } from "react";
import { CircleAlert, Plus, Save, X } from "lucide-react";
import type { Confidence, Difficulty, Problem } from "../types";
import { CONFIDENCE_META, MODULES } from "../types";

export interface ProblemFormValues {
  title: string;
  url: string;
  module: string;
  difficulty: Difficulty;
  confidence: Confidence;
}

interface QuickAddModalProps {
  open: boolean;
  /** When set, the modal edits this problem instead of creating a new one. */
  editing: Problem | null;
  onClose: () => void;
  onSubmit: (values: ProblemFormValues) => void;
}

const DIFFICULTY_OPTIONS: Difficulty[] = ["easy", "medium", "hard"];

export function QuickAddModal({
  open,
  editing,
  onClose,
  onSubmit,
}: QuickAddModalProps) {
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [module, setModule] = useState<string>(MODULES[0]);
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [confidence, setConfidence] = useState<Confidence>("hints");
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setTitle(editing?.title ?? "");
      setUrl(editing?.url ?? "");
      setModule(editing?.module ?? MODULES[0]);
      setDifficulty(editing?.difficulty ?? "medium");
      setConfidence(editing?.confidence ?? "hints");
      setError("");
      const t = setTimeout(() => inputRef.current?.focus(), 60);
      return () => clearTimeout(t);
    }
  }, [open, editing]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError("Problem name is required.");
      return;
    }
    onSubmit({ title: title.trim(), url: url.trim(), module, difficulty, confidence });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 pt-[8vh]">
      <div
        className="will-change-overlay fixed inset-0 animate-fade-in bg-zinc-950/70 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={editing ? "Edit problem" : "Quick add problem"}
        className="card will-change-overlay relative w-full max-w-lg animate-scale-in p-6 shadow-2xl"
      >
        <div className="mb-5 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold text-zinc-100">
              {editing ? "Edit Problem" : "Quick Add Problem"}
            </h2>
            <p className="mt-0.5 text-sm text-zinc-500">
              {editing
                ? "Update the details of this problem."
                : "Log a problem you just practiced. Review schedule starts tomorrow."}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1.5 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="qa-title"
              className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-zinc-500"
            >
              Problem Name *
            </label>
            <input
              id="qa-title"
              ref={inputRef}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Two Sum"
              className="h-10 w-full rounded-lg border border-zinc-800 bg-zinc-900/70 px-3 text-sm text-zinc-200 placeholder:text-zinc-600 transition-colors focus:border-emerald-500/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            />
          </div>

          <div>
            <label
              htmlFor="qa-url"
              className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-zinc-500"
            >
              LeetCode / Platform URL
            </label>
            <input
              id="qa-url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://leetcode.com/problems/…"
              inputMode="url"
              className="h-10 w-full rounded-lg border border-zinc-800 bg-zinc-900/70 px-3 text-sm text-zinc-200 placeholder:text-zinc-600 transition-colors focus:border-emerald-500/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="qa-module"
                className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-zinc-500"
              >
                Module Category
              </label>
              <select
                id="qa-module"
                value={module}
                onChange={(e) => setModule(e.target.value)}
                className="h-10 w-full appearance-none rounded-lg border border-zinc-800 bg-zinc-900/70 px-3 text-sm text-zinc-200 transition-colors focus:border-emerald-500/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              >
                {MODULES.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Difficulty
              </span>
              <div className="grid h-10 grid-cols-3 gap-1 rounded-lg border border-zinc-800 bg-zinc-900/70 p-1">
                {DIFFICULTY_OPTIONS.map((d) => {
                  const selected = difficulty === d;
                  const meta =
                    d === "easy"
                      ? "text-emerald-400 bg-emerald-500/15"
                      : d === "medium"
                        ? "text-amber-400 bg-amber-500/15"
                        : "text-rose-400 bg-rose-500/15";
                  return (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setDifficulty(d)}
                      aria-pressed={selected}
                      className={`rounded-md text-xs font-semibold capitalize transition-all ${
                        selected ? meta : "text-zinc-500 hover:text-zinc-300"
                      }`}
                    >
                      {d}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div>
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Initial Confidence
            </span>
            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(CONFIDENCE_META) as Confidence[]).map((c) => {
                const meta = CONFIDENCE_META[c];
                const selected = confidence === c;
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setConfidence(c)}
                    aria-pressed={selected}
                    className={`flex flex-col items-center gap-1.5 rounded-lg border px-2 py-2.5 transition-all ${
                      selected
                        ? `border-transparent ring-1 ${meta.chip.replace(
                            /text-(emerald|amber|rose)-300/,
                            "text-zinc-100",
                          )}`
                        : "border-zinc-800 bg-zinc-900/50 hover:border-zinc-700"
                    }`}
                  >
                    <span className={`h-2.5 w-2.5 rounded-full ${meta.dot}`} />
                    <span className="text-[11px] font-medium leading-tight text-zinc-300">
                      {meta.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {error && (
            <p className="flex items-center gap-1.5 text-sm text-rose-400">
              <CircleAlert className="h-4 w-4" />
              {error}
            </p>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="h-10 rounded-lg border border-zinc-800 px-4 text-sm font-medium text-zinc-400 transition-colors hover:bg-zinc-800/60 hover:text-zinc-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-emerald-500 px-4 text-sm font-semibold text-zinc-950 shadow-lg shadow-emerald-500/20 transition-all hover:bg-emerald-400 active:scale-[0.98]"
            >
              {editing ? (
                <>
                  <Save className="h-4 w-4" /> Save Changes
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4" /> Add Problem
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
