"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Problem } from "../types";
import { useAuth } from "./useAuth";
import type { Store } from "./useStore";
import {
  fetchBank,
  loadLegacyBank,
  tsToMs,
  upsertBank,
} from "../lib/sync";

export type SyncStatus = "off" | "loading" | "synced" | "error";

export interface DataSync {
  status: SyncStatus;
}

const PUSH_DEBOUNCE_MS = 600;

/**
 * Keeps the local bank (in-memory + localStorage cache) in sync with the
 * user's `user_banks` Supabase row:
 *  - on login: pull the cloud row; hydrate when it's newer, push when local
 *    is newer or the row doesn't exist yet (first login migrates the legacy
 *    localStorage bank);
 *  - on every local mutation: debounce-push to the cloud;
 *  - last-write-wins via `updated_at` timestamps.
 */
export function useDataSync(store: Store): DataSync {
  const auth = useAuth();
  const active = auth.ready && auth.mode === "supabase" && !!auth.userId;
  const uid = auth.userId;
  const [status, setStatus] = useState<SyncStatus>("off");

  const statusRef = useRef<SyncStatus>("off");
  const setStatusSafe = useCallback((s: SyncStatus) => {
    statusRef.current = s;
    setStatus(s);
  }, []);
  /** updatedAt of the last state the cloud knows about (from hydration or push). */
  const lastHandledTs = useRef<string | null>(null);
  const timerRef = useRef<number | null>(null);

  const push = useCallback(
    async (problems: Problem[], activity: string[]) => {
      if (!uid) return;
      const updatedAt = new Date().toISOString();
      try {
        await upsertBank(uid, problems, activity, updatedAt);
        setStatusSafe("synced");
      } catch {
        // Offline or table not created yet — data stays local and the next
        // mutation (or next login) retries.
        setStatusSafe("error");
      }
    },
    [uid, setStatusSafe],
  );

  const schedulePush = useCallback(
    (snap: ReturnType<Store["getSnapshot"]>) => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => {
        timerRef.current = null;
        const current = store.getSnapshot();
        if (current.meta.updatedAt === lastHandledTs.current) return;
        void push(current.problems, current.activity).then(() => {
          lastHandledTs.current = current.meta.updatedAt;
        });
      }, PUSH_DEBOUNCE_MS);
    },
    [store, push],
  );

  // Initial load: hydrate from the cloud, or push local (migrating the
  // legacy bank on a user's first login).
  useEffect(() => {
    if (!active || !uid) {
      setStatusSafe("off");
      lastHandledTs.current = null;
      return;
    }
    let cancelled = false;
    setStatusSafe("loading");
    void (async () => {
      let row: Awaited<ReturnType<typeof fetchBank>> = null;
      try {
        row = await fetchBank(uid);
      } catch {
        // Offline or the table doesn't exist yet — keep working locally.
      }
      if (cancelled) return;
      const snap = store.getSnapshot();
      if (row) {
        const dbTs = tsToMs(row.updated_at);
        const localTs = tsToMs(snap.meta.updatedAt);
        if (dbTs > localTs) {
          // Cloud is newer (or the local cache predates sync) — hydrate.
          lastHandledTs.current = row.updated_at;
          store.hydrate(row.problems ?? [], row.activity ?? [], row.updated_at);
          setStatusSafe("synced");
        } else {
          // Local is newer — push it up.
          await push(snap.problems, snap.activity);
          lastHandledTs.current = snap.meta.updatedAt;
        }
      } else {
        // No cloud row yet. First login? Adopt the legacy localStorage bank
        // if the fresh per-user cache is empty (log in from the device that
        // has your data first).
        const legacy =
          snap.problems.length === 0 ? loadLegacyBank() : null;
        const problems = legacy ? legacy.problems : snap.problems;
        const activity = legacy ? legacy.activity : snap.activity;
        await push(problems, activity);
        lastHandledTs.current = snap.meta.updatedAt;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [active, uid, store, push, setStatusSafe]);

  // Watch local mutations and push them up.
  useEffect(() => {
    if (!active) return;
    return store.subscribe(() => {
      const snap = store.getSnapshot();
      if (snap.meta.updatedAt === lastHandledTs.current) return;
      schedulePush(snap);
    });
  }, [active, store, schedulePush]);

  // Best-effort flush when the tab is hidden or closed.
  useEffect(() => {
    if (!active) return;
    const flush = () => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
        const snap = store.getSnapshot();
        if (snap.meta.updatedAt !== lastHandledTs.current) {
          void push(snap.problems, snap.activity);
        }
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flush();
    };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [active, store, push]);

  return { status };
}
