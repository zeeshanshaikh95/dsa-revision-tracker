"use client";

import { useCallback, useSyncExternalStore } from "react";

export interface AppSettings {
  /** Target number of problems to solve per day. */
  dailyGoal: number;
  /** Whether the browser should notify when reviews come due. */
  notificationsEnabled: boolean;
}

export const SETTINGS_STORAGE_KEY = "dsa-revision-tracker:settings:v1";

export const DEFAULT_SETTINGS: AppSettings = {
  dailyGoal: 3,
  notificationsEnabled: false,
};

const listeners = new Set<() => void>();
let settings: AppSettings | null = null;

function sanitize(parsed: Partial<AppSettings>): AppSettings {
  const raw = Math.round(parsed.dailyGoal ?? DEFAULT_SETTINGS.dailyGoal);
  const dailyGoal =
    Number.isFinite(raw) && raw >= 1
      ? Math.min(raw, 50)
      : DEFAULT_SETTINGS.dailyGoal;
  return {
    dailyGoal,
    notificationsEnabled: parsed.notificationsEnabled === true,
  };
}

function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (raw) return sanitize(JSON.parse(raw) as Partial<AppSettings>);
  } catch {
    // Corrupt or unavailable storage — fall back to defaults.
  }
  return DEFAULT_SETTINGS;
}

/** Current settings (client only; returns defaults during SSR/prerender). */
export function getSettings(): AppSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  if (!settings) settings = loadSettings();
  return settings;
}

function persist(next: AppSettings): void {
  settings = next;
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Storage unavailable — the in-memory value still drives the UI.
  }
  listeners.forEach((l) => l());
}

/** Merge a partial update into the persisted settings. */
export function setSettings(patch: Partial<AppSettings>): void {
  persist({ ...getSettings(), ...patch });
}

/** Subscribe a component to settings changes (snapshot identity is stable). */
export function useSettings(): AppSettings {
  const getSnapshot = useCallback(() => getSettings(), []);
  return useSyncExternalStore(
    (onChange) => {
      listeners.add(onChange);
      return () => {
        listeners.delete(onChange);
      };
    },
    getSnapshot,
    () => DEFAULT_SETTINGS,
  );
}
