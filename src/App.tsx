"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Dices, Download, PlayCircle } from "lucide-react";
import type { Problem } from "./types";
import { currentStreak, relativeDay, reviewStatus, todayKey } from "./lib/spaced";
import { pickSurpriseProblem } from "./lib/surprise";
import { getQuotePool, randomQuoteIndex } from "./lib/quotes";
import { downloadText, problemsToCsv } from "./lib/export";
import { useStore, STORAGE_KEY_LEGACY } from "./hooks/useStore";
import { setSettings, useSettings } from "./hooks/useSettings";
import { useAuth } from "./hooks/useAuth";
import { useDataSync } from "./hooks/useDataSync";
import { Sidebar, type NavKey } from "./components/Sidebar";
import { Login } from "./components/Login";
import { Header } from "./components/Header";
import { KpiGrid } from "./components/KpiGrid";
import { MotivationQuote } from "./components/MotivationQuote";
import { Analytics } from "./components/Analytics";
import { Settings } from "./components/Settings";
import { ProblemTable, type FilterKey } from "./components/ProblemTable";
import type { ProblemFormValues } from "./components/QuickAddModal";

// Code-split the overlays: they only render when opened, so their chunks are
// fetched on demand instead of inflating the initial bundle.
const QuickAddModal = dynamic(
  () => import("./components/QuickAddModal").then((m) => m.QuickAddModal),
  { ssr: false },
) as typeof import("./components/QuickAddModal").QuickAddModal;
const Drawer = dynamic(() => import("./components/Drawer").then((m) => m.Drawer), {
  ssr: false,
}) as typeof import("./components/Drawer").Drawer;
const ChatBot = dynamic(
  () => import("./components/ChatBot").then((m) => m.ChatBot),
  { ssr: false },
) as typeof import("./components/ChatBot").ChatBot;
const ReviewSession = dynamic(
  () => import("./components/ReviewSession").then((m) => m.ReviewSession),
  { ssr: false },
) as typeof import("./components/ReviewSession").ReviewSession;

interface Toast {
  id: number;
  message: string;
  tone: "success" | "danger" | "celebration";
}

export default function App() {
  const auth = useAuth();
  // Per-user storage key in Supabase mode so each account syncs its own bank
  // across devices; the legacy shared key in local mode. Supabase users start
  // with an empty bank (no demo seed) — their data comes from the cloud.
  const storageKey =
    auth.mode === "supabase" && auth.userId
      ? `dsa-revision-tracker:v1:${auth.userId}`
      : STORAGE_KEY_LEGACY;
  const store = useStore(storageKey, auth.mode !== "supabase");
  const sync = useDataSync(store);
  const settings = useSettings();
  const [nav, setNav] = useState<NavKey>("dashboard");
  const [search, setSearch] = useState("");
  const [tableFilter, setTableFilter] = useState<FilterKey>("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Problem | null>(null);
  const [drawerProblem, setDrawerProblem] = useState<Problem | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const streak = useMemo(() => currentStreak(store.activity), [store.activity]);
  const today = todayKey();
  const dueCount = useMemo(
    () =>
      store.problems.filter(
        (p) => p.status === "active" && reviewStatus(p, today) !== "safe",
      ).length,
    [store.problems, today],
  );
  // Problems solved (or re-solved) today — the daily-goal metric.
  const solvedToday = useMemo(
    () => store.problems.filter((p) => p.lastSolved === today).length,
    [store.problems, today],
  );

  const notify = useCallback((message: string, tone: Toast["tone"] = "success") => {
    setToast({ id: Date.now(), message, tone });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const delay = toast.tone === "celebration" ? 5000 : 2800;
    const t = setTimeout(() => setToast(null), delay);
    return () => clearTimeout(t);
  }, [toast]);

  // Celebrate the daily goal the moment it's reached: a random motivational
  // quote toast, once per crossing. The first usable render only records the
  // state (the loading shell renders with an empty bank, which would make a
  // pre-met goal look like a fresh crossing and toast on every page load).
  const goalHit = settings.dailyGoal > 0 && solvedToday >= settings.dailyGoal;
  const goalHitRef = useRef(false);
  const seenUsable = useRef(false);
  useEffect(() => {
    if (!auth.ready || !store.ready) return;
    if (!seenUsable.current) {
      seenUsable.current = true;
      goalHitRef.current = goalHit;
      return;
    }
    if (goalHit && !goalHitRef.current) {
      goalHitRef.current = true;
      const pool = getQuotePool(settings.customQuotes);
      const q = pool[randomQuoteIndex(null, pool.length)];
      notify(`🎯 Daily goal complete! “${q.text}” — ${q.author}`, "celebration");
    } else if (!goalHit) {
      goalHitRef.current = false;
    }
  }, [goalHit, notify, auth.ready, store.ready, settings.customQuotes]);

  // Warm the lazy overlay chunks during idle time so opening the drawer or
  // quick-add modal never waits on a network fetch.
  useEffect(() => {
    const idle =
      window.requestIdleCallback ??
      ((cb: () => void) => window.setTimeout(cb, 1000));
    const handle = idle(() => {
      void import("./components/Drawer");
      void import("./components/QuickAddModal");
      void import("./components/ChatBot");
    });
    return () => {
      if (window.cancelIdleCallback) window.cancelIdleCallback(handle);
      else window.clearTimeout(handle);
    };
  }, []);

  const handleSubmit = (values: ProblemFormValues) => {
    if (editing) {
      store.updateProblem(editing.id, values);
      notify(`Updated “${values.title}”`);
      setModalOpen(false);
      setEditing(null);
    } else {
      const p = store.addProblem(values);
      notify(`Added “${p.title}” — first review tomorrow`);
      setModalOpen(false);
    }
  };

  const handleResetReview = useCallback(
    (id: string): string => {
      const next = store.resetReview(id);
      const title = store.problems.find((p) => p.id === id)?.title ?? "Problem";
      notify(`“${title}” reset — next review ${relativeDay(next, today)}`);
      return next;
    },
    [store, notify, today],
  );

  const handleClearAll = useCallback(() => {
    store.clearAllProblems();
    setDrawerProblem(null);
    notify("All problems cleared — fresh start", "danger");
  }, [store, notify]);

  const handleDelete = useCallback(
    (id: string) => {
      const title = store.problems.find((p) => p.id === id)?.title ?? "Problem";
      store.deleteProblem(id);
      setDrawerProblem((cur) => (cur?.id === id ? null : cur));
      notify(`Deleted “${title}”`, "danger");
    },
    [store, notify],
  );

  const handleToggleStatus = useCallback(
    (id: string) => {
      const p = store.problems.find((x) => x.id === id);
      store.toggleStatus(id);
      if (p) {
        notify(
          p.status === "completed"
            ? `Reopened “${p.title}”`
            : `“${p.title}” marked complete 🎉`,
        );
      }
    },
    [store, notify],
  );

  const openAdd = useCallback(() => {
    setEditing(null);
    setModalOpen(true);
  }, []);

  const openEdit = useCallback((p: Problem) => {
    setEditing(p);
    setModalOpen(true);
  }, []);

  const openDrawer = useCallback((p: Problem) => {
    setDrawerProblem(p);
  }, []);

  const showDue = useCallback(() => {
    setNav("dashboard");
    setSearch("");
    setTableFilter("due");
    notify(
      `Showing ${dueCount} problem${dueCount === 1 ? "" : "s"} due for review`,
    );
  }, [dueCount, notify]);

  const handleSurprise = useCallback(() => {
    const p = pickSurpriseProblem(store.problems, today);
    if (!p) {
      notify("No active problems to surprise you with — add a few first!", "danger");
      return;
    }
    setDrawerProblem(p);
  }, [store.problems, today, notify]);

  const startReview = useCallback(() => {
    if (dueCount === 0) {
      notify("Nothing due right now — you're all caught up! 🎉");
      return;
    }
    setReviewOpen(true);
  }, [dueCount, notify]);

  const handleExportCsv = useCallback(() => {
    downloadText(
      `dsa-bank-${today}.csv`,
      problemsToCsv(store.problems),
    );
    notify(
      `Exported ${store.problems.length} problem${store.problems.length === 1 ? "" : "s"} as CSV`,
    );
  }, [store.problems, today, notify]);

  // Due notifications: once per day, and only while the tab is in the
  // background — never ping someone who is actively looking at the dashboard.
  // The per-date flag means it can fire again tomorrow; clearing it when the
  // queue empties lets a fresh due problem re-trigger the same day.
  useEffect(() => {
    if (!settings.notificationsEnabled) return;
    if (
      typeof window === "undefined" ||
      !("Notification" in window) ||
      window.Notification.permission !== "granted"
    ) {
      return;
    }
    const flagKey = (day: string) =>
      `dsa-revision-tracker:notified:${day}`;
    const check = () => {
      const day = todayKey();
      const due = store.problems.filter(
        (p) => p.status === "active" && reviewStatus(p, day) !== "safe",
      );
      if (due.length === 0) {
        try {
          localStorage.removeItem(flagKey(day));
        } catch {
          /* ignore */
        }
        return;
      }
      if (document.hidden) {
        try {
          if (localStorage.getItem(flagKey(day))) return;
          const titles = due
            .slice(0, 3)
            .map((p) => p.title)
            .join(", ");
          const n = new window.Notification(
            due.length === 1
              ? "1 problem due for review"
              : `${due.length} problems due for review`,
            { body: titles, tag: "dsa-due-reviews" },
          );
          n.onclick = () => {
            window.focus();
            n.close();
          };
          localStorage.setItem(flagKey(day), "1");
        } catch {
          /* notification API failed — never crash the app over it */
        }
      }
    };
    check();
    const timer = window.setInterval(check, 10 * 60 * 1000);
    const onVisibility = () => {
      if (document.hidden) check();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [settings.notificationsEnabled, store.problems]);

  const handleNotificationsChange = useCallback(
    async (enabled: boolean): Promise<boolean> => {
      if (!enabled) {
        setSettings({ notificationsEnabled: false });
        return false;
      }
      if (typeof window === "undefined" || !("Notification" in window)) {
        return false;
      }
      const permission = await window.Notification.requestPermission();
      const granted = permission === "granted";
      setSettings({ notificationsEnabled: granted });
      return granted;
    },
    [],
  );

  const handleTestNotification = useCallback(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    try {
      const n = new window.Notification("Due notifications are working", {
        body: "This is a test — you'll get a daily alert when reviews come due.",
        tag: "dsa-test-notification",
      });
      n.onclick = () => {
        window.focus();
        n.close();
      };
    } catch {
      /* ignore */
    }
  }, []);

  // Global keyboard shortcuts: n = new problem, / = focus search.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (
        t &&
        (t.tagName === "INPUT" ||
          t.tagName === "TEXTAREA" ||
          t.tagName === "SELECT" ||
          t.isContentEditable)
      ) {
        return;
      }
      if (e.key === "n" || e.key === "N") {
        e.preventDefault();
        openAdd();
      } else if (e.key === "/") {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openAdd]);

  // Persisted state loads via useSyncExternalStore before first paint on the
  // client; during prerender/hydration `ready` is false and we show a shell.
  // Must come after all hooks so the hook order stays stable across renders.
  if (!auth.ready || !store.ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950">
        <div className="flex items-center gap-3 text-sm text-zinc-500">
          <span className="h-2 w-2 animate-pulse-soft rounded-full bg-emerald-400" />
          Loading…
        </div>
      </div>
    );
  }

  // Signed out, or mid password-recovery (arrived via reset email link) —
  // show the login gate. Recovery must gate BEFORE the user check: the reset
  // link creates a session, so the user is technically signed in.
  if (auth.recovery || !auth.user) {
    return (
      <Login
        onLogin={auth.login}
        onSignup={auth.signup}
        onRequestReset={auth.requestResetCode}
        onVerifyResetCode={auth.verifyResetCode}
        onResetPassword={auth.resetPassword}
        authMode={auth.mode}
        recovery={auth.recovery}
        recoveryEmail={auth.user}
      />
    );
  }

  const dashboard = (
    <div className="space-y-5">
      <MotivationQuote customQuotes={settings.customQuotes} />
      <KpiGrid
        problems={store.problems}
        streak={streak}
        solvedToday={solvedToday}
        goal={settings.dailyGoal}
        onShowDue={showDue}
      />
      <div className="flex flex-col gap-3 rounded-xl border border-zinc-800 bg-zinc-900/40 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={startReview}
            aria-label="Start a review session"
            title={
              dueCount > 0
                ? `Review ${dueCount} problem${dueCount === 1 ? "" : "s"} due now`
                : "Nothing due right now"
            }
            className="inline-flex h-9 shrink-0 items-center gap-2 rounded-lg bg-emerald-500 px-4 text-sm font-bold text-zinc-950 transition-all hover:bg-emerald-400 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <PlayCircle className="h-4 w-4" />
            Start Review{dueCount > 0 ? ` (${dueCount})` : ""}
          </button>
          <button
            onClick={handleSurprise}
            aria-label="Surprise me with a random problem"
            title="Pick a random problem — overdue and due-today ones are more likely"
            className="inline-flex h-9 shrink-0 items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/70 px-4 text-sm font-semibold text-zinc-300 transition-colors hover:border-emerald-500/50 hover:text-emerald-300"
          >
            <Dices className="h-4 w-4" />
            Surprise me
          </button>
        </div>
        <p className="truncate text-xs text-zinc-500">
          {dueCount > 0
            ? `Start Review walks your ${dueCount} due problems one at a time.`
            : "All caught up — nothing due for review right now."}
        </p>
      </div>
      <ProblemTable
        problems={store.problems}
        filter={tableFilter}
        onFilterChange={setTableFilter}
        search={search}
        onSearch={setSearch}
        onSelect={openDrawer}
        onToggleStatus={handleToggleStatus}
        onEdit={openEdit}
        onDelete={handleDelete}
        onResetReview={handleResetReview}
        onClearAll={handleClearAll}
      />
    </div>
  );

  const bank = (
    <div className="space-y-5">
      <div className="flex items-center gap-2.5">
        <div>
          <h1 className="text-lg font-bold text-zinc-100">Problem Bank</h1>
          <p className="text-sm text-zinc-500">
            Every logged problem across all modules.
          </p>
        </div>
        <span className="ml-auto flex items-center gap-2">
          <button
            onClick={handleExportCsv}
            aria-label="Export problems as CSV"
            title="Download the whole bank as a CSV file"
            disabled={store.problems.length === 0}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900/70 px-3 text-sm font-semibold text-zinc-400 transition-colors hover:border-emerald-500/40 hover:text-emerald-300 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </button>
          <span className="rounded-lg border border-zinc-800 bg-zinc-900/70 px-3 py-1.5 text-sm font-semibold text-zinc-300">
            {store.problems.length} total
          </span>
        </span>
      </div>
      <ProblemTable
        problems={store.problems}
        filter={tableFilter}
        onFilterChange={setTableFilter}
        search={search}
        onSearch={setSearch}
        onSelect={openDrawer}
        onToggleStatus={handleToggleStatus}
        onEdit={openEdit}
        onDelete={handleDelete}
        onResetReview={handleResetReview}
        onClearAll={handleClearAll}
      />
    </div>
  );

  return (
    <div className="min-h-screen bg-zinc-950">
      <Sidebar
        active={nav}
        onChange={setNav}
        onLogout={auth.logout}
        user={auth.user}
      />
      <main className="pl-[68px]">
        <Header
          search={search}
          onSearch={setSearch}
          searchRef={searchInputRef}
          streak={streak}
          dueCount={dueCount}
          syncStatus={sync.status}
          onQuickAdd={openAdd}
        />
        <div className="mx-auto max-w-[1400px] px-4 py-6 md:px-6">
          {nav === "dashboard" && dashboard}
          {nav === "bank" && bank}
          {nav === "analytics" && (
            <Analytics problems={store.problems} activity={store.activity} />
          )}
          {nav === "settings" && (
            <Settings
              user={auth.user}
              authMode={auth.mode}
              syncStatus={sync.status}
              solvedToday={solvedToday}
              dailyGoal={settings.dailyGoal}
              onDailyGoalChange={(goal) => setSettings({ dailyGoal: goal })}
              notificationsEnabled={settings.notificationsEnabled}
              onNotificationsChange={handleNotificationsChange}
              onTestNotification={handleTestNotification}
              customQuotes={settings.customQuotes}
              onCustomQuotesChange={(quotes) =>
                setSettings({ customQuotes: quotes })
              }
            />
          )}
        </div>
      </main>

      {/* Overlays */}
      <QuickAddModal
        open={modalOpen}
        editing={editing}
        onClose={() => {
          setModalOpen(false);
          setEditing(null);
        }}
        onSubmit={handleSubmit}
      />
      <Drawer
        problem={drawerProblem}
        onClose={() => setDrawerProblem(null)}
        onUpdate={store.updateProblem}
        onResetReview={handleResetReview}
      />

      {/* Review session */}
      <ReviewSession
        open={reviewOpen}
        problems={store.problems}
        onClose={() => setReviewOpen(false)}
        onResetReview={handleResetReview}
        customQuotes={settings.customQuotes}
      />

      {/* Chat assistant */}
      <ChatBot store={store} customQuotes={settings.customQuotes} />

      {/* Toast */}
      {toast && (
        <div
          key={toast.id}
          className={`fixed bottom-6 left-1/2 z-[60] -translate-x-1/2 animate-toast-in rounded-xl border px-4 py-3 text-sm font-medium shadow-2xl ${
            toast.tone === "danger"
              ? "border-rose-500/30 bg-zinc-900 text-rose-300"
              : toast.tone === "celebration"
                ? "border-amber-500/40 bg-gradient-to-r from-emerald-500/15 via-zinc-900 to-amber-500/15 text-zinc-100"
                : "border-emerald-500/30 bg-zinc-900 text-emerald-300"
          }`}
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}
