"use client";

import { useState } from "react";
import { CheckCircle2, Circle, ListTodo, Plus, Trash2 } from "lucide-react";
import type { Store } from "../hooks/useStore";

/**
 * A compact to-do card for the dashboard. Tasks live in the store — synced
 * to the cloud alongside the problem bank — and persist in the browser.
 * Open tasks are shown on top, completed ones struck through below, with a
 * one-click clear for the finished pile.
 */
export function TasksPanel({ store }: { store: Store }) {
  const tasks = store.tasks;
  const [text, setText] = useState("");

  const submit = () => {
    if (store.addTask(text)) setText("");
  };

  const open = tasks.filter((t) => !t.completedAt);
  const done = tasks.filter((t) => t.completedAt);

  return (
    <section className="card p-5" aria-label="To-do list">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-zinc-300">
          <ListTodo className="h-4 w-4 text-emerald-400" />
          To-Do
        </h2>
        <span className="text-xs font-medium text-zinc-500">
          {tasks.length === 0
            ? "No tasks"
            : `${open.length} open${done.length > 0 ? ` · ${done.length} done` : ""}`}
        </span>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="mt-3 flex items-center gap-2"
      >
        <Plus className="h-4 w-4 shrink-0 text-zinc-600" />
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Add a task and press Enter…"
          aria-label="Add a task"
          maxLength={200}
          className="h-9 flex-1 rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 text-sm text-zinc-200 placeholder:text-zinc-600 transition-colors focus:border-emerald-500/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
        />
        <button
          type="submit"
          disabled={!text.trim()}
          aria-label="Add task"
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-emerald-500 px-3.5 text-sm font-bold text-zinc-950 transition-all hover:bg-emerald-400 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Add
        </button>
      </form>

      {tasks.length === 0 ? (
        <p className="mt-4 rounded-lg border border-dashed border-zinc-800 px-4 py-6 text-center text-xs text-zinc-600">
          No tasks yet — add your first above.
        </p>
      ) : (
        <ul className="mt-3 max-h-56 space-y-1 overflow-y-auto pr-1">
          {open.map((t) => (
            <li key={t.id} className="group flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-zinc-800/40">
              <button
                onClick={() => store.toggleTask(t.id)}
                aria-label={`Mark “${t.text}” complete`}
                title="Mark complete"
                className="shrink-0 text-zinc-600 transition-colors hover:text-emerald-400"
              >
                <Circle className="h-[18px] w-[18px]" />
              </button>
              <span className="min-w-0 flex-1 truncate text-sm text-zinc-300">
                {t.text}
              </span>
              <button
                onClick={() => store.removeTask(t.id)}
                aria-label={`Delete task: ${t.text}`}
                title="Delete task"
                className="shrink-0 rounded-md p-1 text-zinc-600 opacity-0 transition-all group-hover:opacity-100 hover:bg-rose-500/10 hover:text-rose-400"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
          {done.map((t) => (
            <li key={t.id} className="group flex items-center gap-2.5 rounded-lg px-2 py-1.5 opacity-60 transition-colors hover:bg-zinc-800/40">
              <button
                onClick={() => store.toggleTask(t.id)}
                aria-label={`Reopen “${t.text}”`}
                title="Reopen"
                className="shrink-0 text-emerald-400/70 transition-colors hover:text-emerald-300"
              >
                <CheckCircle2 className="h-[18px] w-[18px]" />
              </button>
              <span className="min-w-0 flex-1 truncate text-sm text-zinc-400 line-through">
                {t.text}
              </span>
              <button
                onClick={() => store.removeTask(t.id)}
                aria-label={`Delete task: ${t.text}`}
                title="Delete task"
                className="shrink-0 rounded-md p-1 text-zinc-600 opacity-0 transition-all group-hover:opacity-100 hover:bg-rose-500/10 hover:text-rose-400"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {done.length > 0 && (
        <div className="mt-2.5 flex justify-end">
          <button
            onClick={store.clearCompletedTasks}
            className="text-[11px] font-semibold text-zinc-600 transition-colors hover:text-rose-400"
          >
            Clear {done.length} completed
          </button>
        </div>
      )}
    </section>
  );
}
