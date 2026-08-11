"use client";

import { memo } from "react";
import {
  Cloud,
  CloudOff,
  ExternalLink,
  Loader2,
  User,
} from "lucide-react";
import type { SyncStatus } from "../hooks/useDataSync";

interface SettingsProps {
  user: string | null;
  authMode: "supabase" | "local";
  syncStatus: SyncStatus;
}

const SETUP_URL =
  "https://github.com/zeeshanshaikh95/dsa-revision-tracker#optional-real-email-auth-with-supabase";

export const Settings = memo(function Settings({
  user,
  authMode,
  syncStatus,
}: SettingsProps) {
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2.5">
        <div>
          <h1 className="text-lg font-bold text-zinc-100">Settings</h1>
          <p className="text-sm text-zinc-500">Account, auth, and cloud sync.</p>
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
