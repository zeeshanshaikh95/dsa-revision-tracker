"use client";

import { useCallback, useSyncExternalStore } from "react";

export interface Task {
  id: string;
  text: string;
  /** ISO timestamp of creation. */
  createdAt: string;
  /** ISO timestamp of completion, or null while open. */
  completedAt: string | null;
}

export const TASKS_STORAGE_KEY = "dsa-revision-tracker:tasks:v1";

const MAX_TASKS = 200;
const MAX_TEXT = 200;

const listeners = new Set<() => void>();
let tasks: Task[] | null = null;

function loadTasks(): Task[] {
  try {
    const raw = localStorage.getItem(TASKS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) {
        return parsed
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
            text: t.text.trim().slice(0, MAX_TEXT),
            createdAt: t.createdAt,
            completedAt: t.completedAt,
          }))
          .slice(0, MAX_TASKS);
      }
    }
  } catch {
    // Corrupt or unavailable storage — start empty.
  }
  return [];
}

/** Current tasks (client only; empty during SSR/prerender). */
export function getTasks(): Task[] {
  if (typeof window === "undefined") return [];
  if (!tasks) tasks = loadTasks();
  return tasks;
}

function persist(next: Task[]): void {
  tasks = next;
  try {
    localStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Storage unavailable — the in-memory list still drives the UI.
  }
  listeners.forEach((l) => l());
}

/** Add a task; returns the new task or null when the input is invalid. */
export function addTask(text: string): Task | null {
  const trimmed = text.trim();
  if (!trimmed || trimmed.length > MAX_TEXT) return null;
  if (getTasks().length >= MAX_TASKS) return null;
  const task: Task = {
    id: crypto.randomUUID(),
    text: trimmed,
    createdAt: new Date().toISOString(),
    completedAt: null,
  };
  persist([task, ...getTasks()]);
  return task;
}

/** Toggle a task's completion state. */
export function toggleTask(id: string): void {
  const now = new Date().toISOString();
  persist(
    getTasks().map((t) =>
      t.id === id
        ? { ...t, completedAt: t.completedAt ? null : now }
        : t,
    ),
  );
}

/** Delete a single task. */
export function removeTask(id: string): void {
  persist(getTasks().filter((t) => t.id !== id));
}

/** Remove every completed task. */
export function clearCompletedTasks(): void {
  persist(getTasks().filter((t) => !t.completedAt));
}

/** Subscribe a component to the task list (snapshot identity is stable). */
export function useTasks(): Task[] {
  const getSnapshot = useCallback(() => getTasks(), []);
  return useSyncExternalStore(
    (onChange) => {
      listeners.add(onChange);
      return () => {
        listeners.delete(onChange);
      };
    },
    getSnapshot,
    () => [],
  );
}
