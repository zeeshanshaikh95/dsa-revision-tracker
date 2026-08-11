"use client";

import { useState } from "react";
import { Binary, Eye, EyeOff, Lock, LogIn, Mail, UserPlus } from "lucide-react";

interface LoginProps {
  onLogin: (email: string, password: string) => string | null;
  onSignup: (email: string, password: string, confirm: string) => string | null;
}

export function Login({ onLogin, onSignup }: LoginProps) {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const switchMode = (next: "login" | "signup") => {
    setMode(next);
    setError(null);
    setPassword("");
    setConfirm("");
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const err =
      mode === "login"
        ? onLogin(email, password)
        : onSignup(email, password, confirm);
    if (err) setError(err);
    // On success the auth store flips and App swaps to the dashboard.
  };

  const inputBase =
    "h-11 w-full rounded-lg border border-zinc-800 bg-zinc-900/70 pl-10 pr-10 text-sm text-zinc-200 placeholder:text-zinc-600 transition-colors focus:border-emerald-500/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/20";

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 px-4">
      <div className="w-full max-w-md">
        {/* Logo + title */}
        <div className="mb-8 flex flex-col items-center text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-lg shadow-emerald-500/25 ring-1 ring-emerald-400/30">
            <Binary className="h-7 w-7 text-zinc-950" strokeWidth={2.5} />
          </span>
          <h1 className="mt-4 text-xl font-bold text-zinc-100">
            DSA Revision Tracker
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            {mode === "login"
              ? "Log in to your revision hub"
              : "Create your account to start tracking"}
          </p>
        </div>

        <form
          onSubmit={submit}
          className="card space-y-4 p-6 shadow-2xl"
          noValidate
        >
          {/* Email */}
          <div>
            <label
              htmlFor="login-email"
              className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-zinc-500"
            >
              Email
            </label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
              <input
                id="login-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className={inputBase}
                required
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label
              htmlFor="login-password"
              className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-zinc-500"
            >
              Password
            </label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
              <input
                id="login-password"
                type={showPassword ? "text" : "password"}
                autoComplete={
                  mode === "login" ? "current-password" : "new-password"
                }
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={mode === "login" ? "••••••••" : "8+ characters"}
                className={inputBase}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-zinc-500 transition-colors hover:text-zinc-300"
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          {/* Confirm (sign-up only) */}
          {mode === "signup" && (
            <div>
              <label
                htmlFor="login-confirm"
                className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-zinc-500"
              >
                Confirm password
              </label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                <input
                  id="login-confirm"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Repeat your password"
                  className={inputBase}
                  required
                />
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <p
              role="alert"
              className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm font-medium text-rose-300"
            >
              {error}
            </p>
          )}

          {/* Submit */}
          <button
            type="submit"
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-emerald-500 text-sm font-semibold text-zinc-950 shadow-lg shadow-emerald-500/20 transition-all hover:bg-emerald-400 active:scale-[0.99]"
          >
            {mode === "login" ? (
              <>
                <LogIn className="h-4 w-4" />
                Log in
              </>
            ) : (
              <>
                <UserPlus className="h-4 w-4" />
                Create account
              </>
            )}
          </button>

          {/* Mode toggle */}
          <p className="text-center text-sm text-zinc-500">
            {mode === "login" ? (
              <>
                Don&apos;t have an account?{" "}
                <button
                  type="button"
                  onClick={() => switchMode("signup")}
                  className="font-semibold text-emerald-400 transition-colors hover:text-emerald-300"
                >
                  Sign up
                </button>
              </>
            ) : (
              <>
                Already have an account?{" "}
                <button
                  type="button"
                  onClick={() => switchMode("login")}
                  className="font-semibold text-emerald-400 transition-colors hover:text-emerald-300"
                >
                  Log in
                </button>
              </>
            )}
          </p>
        </form>

        {/* Demo hint */}
        <p className="mt-6 text-center text-xs text-zinc-600">
          Demo account —{" "}
          <code className="rounded bg-zinc-900 px-1.5 py-0.5 font-mono text-zinc-400">
            admin@gmail.com
          </code>{" "}
          /{" "}
          <code className="rounded bg-zinc-900 px-1.5 py-0.5 font-mono text-zinc-400">
            12345678
          </code>
        </p>
      </div>
    </div>
  );
}
