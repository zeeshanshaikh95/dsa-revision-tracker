"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { CheckCircle2, Settings } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Problem } from "./types";
import { currentStreak, relativeDay, reviewStatus, todayKey } from "./lib/spaced";
import { useStore } from "./hooks/useStore";
import { useAuth } from "./hooks/useAuth";
import { Sidebar, type NavKey } from "./components/Sidebar";
import { Login } from "./components/Login";
import { Header } from "./components/Header";
import { KpiGrid } from "./components/KpiGrid";
import { Analytics } from "./components/Analytics";
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

interface Toast {
  id: number;
  message: string;
  tone: "success" | "danger";
}

export default function App() {
  const store = useStore();
  const auth = useAuth();
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

  // Signed out — show the login / sign-up gate.
  if (!auth.user) {
    return (
      <Login
        onLogin={auth.login}
        onSignup={auth.signup}
        onRequestReset={auth.requestResetCode}
        onVerifyResetCode={auth.verifyResetCode}
        onResetPassword={auth.resetPassword}
      />
    );
  }

  const dashboard = (
    <div className="space-y-5">
      <KpiGrid problems={store.problems} streak={streak} onShowDue={showDue} />
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

  const placeholder = (title: string, icon: LucideIcon, blurb: string) => {
    const Icon = icon;
    return (
      <div className="card flex flex-col items-center justify-center gap-4 px-6 py-24 text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-zinc-800/80 text-zinc-400">
          <Icon className="h-7 w-7" />
        </span>
        <div>
          <h1 className="text-xl font-bold text-zinc-100">{title}</h1>
          <p className="mx-auto mt-1 max-w-md text-sm text-zinc-500">{blurb}</p>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/70 px-4 py-2 text-sm text-zinc-400">
          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          Data is already being collected — this view ships next.
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-zinc-950">
      <Sidebar active={nav} onChange={setNav} onLogout={auth.logout} />
      <main className="pl-[68px]">
        <Header
          search={search}
          onSearch={setSearch}
          streak={streak}
          dueCount={dueCount}
          onQuickAdd={openAdd}
        />
        <div className="mx-auto max-w-[1400px] px-4 py-6 md:px-6">
          {nav === "dashboard" && dashboard}
          {nav === "bank" && bank}
          {nav === "analytics" && (
            <Analytics problems={store.problems} activity={store.activity} />
          )}
          {nav === "settings" &&
            placeholder(
              "Settings",
              Settings,
              "Review interval tuning, streak goals, and data export will live here.",
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
