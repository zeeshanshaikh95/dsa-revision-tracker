"use client";

import { memo, useState } from "react";
import {
  Bell,
  BellOff,
  BellRing,
  Cloud,
  CloudOff,
  ExternalLink,
  Loader2,
  Minus,
  Plus,
  Quote as QuoteIcon,
  Target,
  Trash2,
  User,
} from "lucide-react";
import type { Quote } from "../lib/quotes";
import type { SyncStatus } from "../hooks/useDataSync";

interface SettingsProps {
  user: string | null;
  authMode: "supabase" | "local";
  syncStatus: SyncStatus;
  /** Problems solved today (feeds the daily goal display). */
  solvedToday: number;
  /** Target problems per day. */
  dailyGoal: number;
  onDailyGoalChange: (goal: number) => void;
  notificationsEnabled: boolean;
  /** Turn notifications on/off; resolves to whether they're actually on. */
  onNotificationsChange: (enabled: boolean) => Promise<boolean>;
  onTestNotification: () => void;
  /** User-authored quotes mixed into the daily rotation. */
  customQuotes: Quote[];
  onCustomQuotesChange: (quotes: Quote[]) => void;
}

const SETUP_URL =
  "https://github.com/zeeshanshaikh95/dsa-revision-tracker#optional-real-email-auth-with-supabase";

export const Settings = memo(function Settings({
  user,
  authMode,
  syncStatus,
  solvedToday,
  dailyGoal,
  onDailyGoalChange,
  notificationsEnabled,
  onNotificationsChange,
  onTestNotification,
  customQuotes,
  onCustomQuotesChange,
}: SettingsProps) {
  const [notifyBusy, setNotifyBusy] = useState(false);
  const [notifyNote, setNotifyNote] = useState<string | null>(null);
  const [quoteText, setQuoteText] = useState("");
  const [quoteAuthor, setQuoteAuthor] = useState("");
  const [quoteError, setQuoteError] = useState<string | null>(null);

  const addQuote = () => {
    const text = quoteText.trim();
    if (!text) {
      setQuoteError("Write the quote first.");
      return;
    }
    if (text.length > 200) {
      setQuoteError("Keep it under 200 characters.");
      return;
    }
    if (customQuotes.length >= 50) {
      setQuoteError("You can save up to 50 custom quotes.");
      return;
    }
    onCustomQuotesChange([
      ...customQuotes,
      { text, author: quoteAuthor.trim() || "You" },
    ]);
    setQuoteText("");
    setQuoteAuthor("");
    setQuoteError(null);
  };

  const removeQuote = (index: number) => {
    onCustomQuotesChange(customQuotes.filter((_, i) => i !== index));
  };

  const toggleNotifications = async () => {
    if (notificationsEnabled) {
      setNotifyNote(null);
      await onNotificationsChange(false);
      return;
    }
    setNotifyBusy(true);
    setNotifyNote(null);
    try {
      const granted = await onNotificationsChange(true);
      setNotifyNote(
        granted
          ? "You'll get one browser notification per day when problems are due."
          : "Permission was blocked — allow notifications in your browser settings to enable due alerts.",
      );
    } finally {
      setNotifyBusy(false);
    }
  };

  const stepGoal = (delta: number) => {
    onDailyGoalChange(Math.min(50, Math.max(1, dailyGoal + delta)));
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2.5">
        <div>
          <h1 className="text-lg font-bold text-zinc-100">Settings</h1>
          <p className="text-sm text-zinc-500">
            Account, cloud sync, daily goal, and notifications.
          </p>
        </div>
      </div>

      {/* Account */}
      <section className="card p-5">
        <h2 className="text-sm font-semibold text-zinc-300">Account</h2>
        <div className="mt-3 flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-zinc-300">
            <User className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-zinc-100">
              {user ?? "Signed out"}
            </p>
            <span
              className={`mt-1 inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold ${
                authMode === "supabase"
                  ? "bg-emerald-500/15 text-emerald-400"
                  : "bg-zinc-800 text-zinc-400"
              }`}
            >
              {authMode === "supabase" ? "Supabase auth" : "Local auth"}
            </span>
          </div>
        </div>
      </section>

      {/* Daily goal */}
      <section className="card p-5">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-zinc-300">
          <Target className="h-4 w-4 text-emerald-400" />
          Daily Goal
        </h2>
        <p className="mt-1 text-xs text-zinc-500">
          How many problems you want to solve each day. The dashboard ring
          tracks your progress against it.
        </p>
        <div className="mt-4 flex items-center gap-4">
          <div className="flex items-center gap-1 rounded-lg border border-zinc-800 bg-zinc-950/60 p-1">
            <button
              onClick={() => stepGoal(-1)}
              aria-label="Decrease daily goal"
              className="flex h-8 w-8 items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200 disabled:opacity-30"
              disabled={dailyGoal <= 1}
            >
              <Minus className="h-4 w-4" />
            </button>
            <span className="w-10 text-center font-mono text-lg font-bold text-zinc-100">
              {dailyGoal}
            </span>
            <button
              onClick={() => stepGoal(1)}
              aria-label="Increase daily goal"
              className="flex h-8 w-8 items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200 disabled:opacity-30"
              disabled={dailyGoal >= 50}
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
          <div className="text-sm text-zinc-400">
            <span
              className={`font-bold ${
                solvedToday >= dailyGoal ? "text-emerald-400" : "text-zinc-100"
              }`}
            >
              {solvedToday}
            </span>{" "}
            solved today
            {solvedToday >= dailyGoal
              ? " — goal complete 🎉"
              : ` · ${dailyGoal - solvedToday} to go`}
          </div>
        </div>
      </section>

      {/* My quotes */}
      <section className="card p-5">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-zinc-300">
          <QuoteIcon className="h-4 w-4 text-emerald-400" />
          My Quotes
        </h2>
        <p className="mt-1 text-xs text-zinc-500">
          Add your own lines and they&apos;re mixed into the daily rotation —
          the dashboard strip, the chat&apos;s &quot;motivate me&quot;, and the
          goal-complete toast.
        </p>

        <div className="mt-4 space-y-2.5">
          <textarea
            value={quoteText}
            onChange={(e) => {
              setQuoteText(e.target.value);
              setQuoteError(null);
            }}
            placeholder={"Write your quote… e.g. “Small steps every day beat big leaps once in a while.”"}
            maxLength={200}
            rows={2}
            spellCheck={false}
            className="w-full resize-y rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-2.5 text-sm leading-relaxed text-zinc-200 placeholder:text-zinc-600 transition-colors focus:border-emerald-500/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          />
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              value={quoteAuthor}
              onChange={(e) => setQuoteAuthor(e.target.value)}
              placeholder="Author (optional, defaults to You)"
              maxLength={40}
              className="h-9 flex-1 rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 text-sm text-zinc-200 placeholder:text-zinc-600 transition-colors focus:border-emerald-500/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            />
            <button
              onClick={addQuote}
              className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-emerald-500 px-4 text-sm font-bold text-zinc-950 transition-all hover:bg-emerald-400 active:scale-95"
            >
              Add quote
            </button>
          </div>
          {quoteError && (
            <p className="text-xs font-medium text-rose-400">{quoteError}</p>
          )}
        </div>

        {customQuotes.length > 0 ? (
          <ul className="mt-4 space-y-2">
            {customQuotes.map((q, i) => (
              <li
                key={i}
                className="flex items-start gap-2.5 rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2.5"
              >
                <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm italic leading-relaxed text-zinc-300">
                    “{q.text}”
                  </p>
                  <p className="mt-0.5 text-xs font-semibold text-zinc-500">
                    — {q.author}
                  </p>
                </div>
                <button
                  onClick={() => removeQuote(i)}
                  aria-label={`Remove quote: ${q.text}`}
                  title="Remove this quote"
                  className="shrink-0 rounded-md p-1.5 text-zinc-500 transition-colors hover:bg-rose-500/10 hover:text-rose-400"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-xs text-zinc-600">
            No custom quotes yet — the rotation is running on the built-in 26.
          </p>
        )}
      </section>

      {/* Notifications */}
      <section className="card p-5">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-zinc-300">
          <Bell className="h-4 w-4 text-amber-400" />
          Due Notifications
        </h2>
        <p className="mt-1 text-xs text-zinc-500">
          Get a browser notification once per day when reviews are due — even
          when the tab is in the background.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            onClick={toggleNotifications}
            disabled={notifyBusy}
            className={`inline-flex h-9 items-center gap-2 rounded-lg px-4 text-sm font-bold transition-all active:scale-95 disabled:opacity-50 ${
              notificationsEnabled
                ? "bg-emerald-500 text-zinc-950 hover:bg-emerald-400"
                : "border border-zinc-800 bg-zinc-900/70 text-zinc-300 hover:border-emerald-500/40 hover:text-emerald-300"
            }`}
          >
            {notifyBusy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : notificationsEnabled ? (
              <BellRing className="h-4 w-4" />
            ) : (
              <BellOff className="h-4 w-4" />
            )}
            {notifyBusy
              ? "Requesting…"
              : notificationsEnabled
                ? "Notifications on"
                : "Enable notifications"}
          </button>
          {notificationsEnabled && (
            <button
              onClick={onTestNotification}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900/70 px-3 text-sm font-semibold text-zinc-400 transition-colors hover:border-emerald-500/40 hover:text-emerald-300"
            >
              <BellRing className="h-3.5 w-3.5" />
              Send test
            </button>
          )}
        </div>
        {notifyNote && (
          <p className="mt-3 text-xs leading-relaxed text-zinc-400">{notifyNote}</p>
        )}
        {notificationsEnabled && typeof window !== "undefined" && (
          <p className="mt-3 text-[11px] text-zinc-600">
            Status: {window.Notification?.permission ?? "unsupported"}. To
            change it, use your browser's site permissions.
          </p>
        )}
      </section>

      {/* Cloud sync */}
      <section className="card p-5">
        <h2 className="text-sm font-semibold text-zinc-300">Cloud Sync</h2>
        <p className="text-xs text-zinc-500">
          Your problem bank, synced across devices.
        </p>

        {authMode === "supabase" ? (
          <div className="mt-3 flex items-center gap-2.5 rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2.5 text-sm text-zinc-300">
            {syncStatus === "loading" ? (
              <Loader2 className="h-4 w-4 animate-spin text-zinc-400" />
            ) : syncStatus === "synced" ? (
              <Cloud className="h-4 w-4 text-emerald-400" />
            ) : (
              <CloudOff className="h-4 w-4 text-rose-400" />
            )}
            <span className="font-medium">
              {syncStatus === "loading"
                ? "Syncing your bank…"
                : syncStatus === "synced"
                  ? "Bank synced to the cloud"
                  : "Sync failed — changes stay local"}
            </span>
          </div>
        ) : (
          <div className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
            <div className="flex items-start gap-3">
              <CloudOff className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
              <div>
                <p className="text-sm font-semibold text-amber-300">
                  Cloud sync is off
                </p>
                <p className="mt-1 text-sm text-amber-200/70">
                  You&apos;re using local-only auth, so your problem bank lives
                  in this browser. Connect a free Supabase project to sync your
                  bank across devices and get real password-reset emails.
                </p>
                <a
                  href={SETUP_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-amber-400/15 px-3 py-1.5 text-sm font-semibold text-amber-300 ring-1 ring-inset ring-amber-500/30 transition-colors hover:bg-amber-400/25 hover:text-amber-200"
                >
                  Set up Supabase
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
            </div>
          </div>
        )}

        {authMode === "supabase" && syncStatus === "error" && (
          <p className="mt-2 text-xs text-rose-400">
            Sync failed — make sure the{" "}
            <code className="rounded bg-zinc-900 px-1 py-0.5 font-mono">
              problems
            </code>{" "}
            and{" "}
            <code className="rounded bg-zinc-900 px-1 py-0.5 font-mono">
              user_profiles
            </code>{" "}
            tables exist (see the README setup steps).
          </p>
        )}
      </section>
    </div>
  );
});
