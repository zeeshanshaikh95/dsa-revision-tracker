"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { Dices } from "lucide-react";
import type { Problem } from "./types";
import { currentStreak, relativeDay, reviewStatus, todayKey } from "./lib/spaced";
import { pickSurpriseProblem } from "./lib/surprise";
import { useStore, STORAGE_KEY_LEGACY } from "./hooks/useStore";
import { useAuth } from "./hooks/useAuth";
import { useDataSync } from "./hooks/useDataSync";
import { Sidebar, type NavKey } from "./components/Sidebar";
import { Login } from "./components/Login";
import { Header } from "./components/Header";
import { KpiGrid } from "./components/KpiGrid";
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

interface Toast {
  id: number;
  message: string;
  tone: "success" | "danger";
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
  const [nav, setNav] = useState<NavKey>("dashboard");
  const [search, setSearch] = useState("");
  const [tableFilter, setTableFilter] = useState<FilterKey>("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Problem | null>(null);
  const [drawerProblem, setDrawerProblem] = useState<Problem | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);

  const streak = useMemo(() => currentStreak(store.activity), [store.activity]);
  const today = todayKey();
  const dueCount = useMemo(
    () =>
      store.problems.filter(
        (p) => p.status === "active" && reviewStatus(p, today) !== "safe",
      ).length,
    [store.problems, today],
  );

  const notify = useCallback((message: string, tone: Toast["tone"] = "success") => {
    setToast({ id: Date.now(), message, tone });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2800);
    return () => clearTimeout(t);
  }, [toast]);

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
      <KpiGrid problems={store.problems} streak={streak} onShowDue={showDue} />
      <div className="flex items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-900/40 px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <button
            onClick={handleSurprise}
            aria-label="Surprise me with a random problem"
            title="Pick a random problem — overdue and due-today ones are more likely"
            className="inline-flex h-9 shrink-0 items-center gap-2 rounded-lg bg-emerald-500 px-4 text-sm font-bold text-zinc-950 transition-all hover:bg-emerald-400 active:scale-95"
          >
            <Dices className="h-4 w-4" />
            Surprise me
          </button>
          <p className="truncate text-xs text-zinc-500">
            Random problem — overdue and due-today ones are more likely to show
            up.
          </p>
        </div>
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
        <span className="ml-auto rounded-lg border border-zinc-800 bg-zinc-900/70 px-3 py-1.5 text-sm font-semibold text-zinc-300">
          {store.problems.length} total
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

      {/* Chat assistant */}
      <ChatBot store={store} />

      {/* Toast */}
      {toast && (
        <div
          key={toast.id}
          className={`fixed bottom-6 left-1/2 z-[60] -translate-x-1/2 animate-toast-in rounded-xl border px-4 py-3 text-sm font-medium shadow-2xl ${
            toast.tone === "danger"
              ? "border-rose-500/30 bg-zinc-900 text-rose-300"
              : "border-emerald-500/30 bg-zinc-900 text-emerald-300"
          }`}
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}
