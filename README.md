# DSA Revision Tracker & Spaced Repetition Hub

A dark-themed, Linear/Vercel-inspired dashboard for tracking DSA practice and scheduling spaced-repetition reviews. Built with Next.js 16, React 19, TypeScript, Tailwind CSS v4, and Lucide icons.

## Features

- **KPI dashboard** — total solved progress ring, "due for review today" counter, mastery streak (computed from the activity log), and core-module completion bars.
- **Problem bank** — scannable data table with status checkboxes, module pills, spaced-repetition badges (Overdue / Review Today / Safe), confidence signals, relative review dates, and filter tabs (All / Due for Review / module-specific) plus search.
- **Quick-add & edit modal** — log a problem with name, platform URL, module, difficulty, and confidence rating in seconds.
- **Revision drawer** — click any row for a slide-out panel with algorithmic pattern tag, tabbed notes (markdown-rendered "My Intuition" + "Complexity" code blocks), a focus timer, and the **"I Re-solved This From Scratch Now"** button that advances the spaced-repetition interval (1 → 3 → 7 → 14 → 30 → 60 → 90 → 180 days).
- **Analytics** — summary stats, difficulty and confidence distributions, a 14-day review-load forecast, per-module completion, and a 12-week activity heatmap.
- **Auth & accounts** — login/sign-up gate (seeded with `admin@gmail.com` / `12345678`), a forgot-password reset flow, and per-user data.
- **Cloud sync (optional)** — with Supabase configured, each user's bank lives in a hosted `problems` table and syncs across devices (offline-first via a per-user `localStorage` cache, last-write-wins, tombstone-safe deletes).
- **Persistence** — local-first: everything is cached in `localStorage` with a seeded problem bank on first load, so the dashboard is alive immediately and works offline.

## Getting started

```bash
npm install
npm run dev      # start the dev server
npm run build    # typecheck + production build
npm run lint     # oxlint
```

Optional Supabase config lives in `.env.example` — copy it to `.env.local` and fill in your project values to enable real email auth and cloud sync.

## Stack

- [Next.js 16](https://nextjs.org) (App Router, static export) + [React 19](https://react.dev)
- [TypeScript](https://www.typescriptlang.org)
- [Tailwind CSS v4](https://tailwindcss.com)
- [lucide-react](https://lucide.dev) icons

## Deployment

Pushing to `main` triggers the GitHub Actions workflow (`.github/workflows/deploy.yml`), which builds the static export (`next build` → `out/`) and deploys it to GitHub Pages at `https://zeeshanshaikh95.github.io/dsa-revision-tracker/`.

## Auth

The app opens on a login page. Without any configuration it uses the built-in **localStorage auth** (seeded with `admin@gmail.com` / `12345678`, with sign-up and a demo reset-code flow).

### Optional: real email auth with Supabase

To get real confirmation emails and password-reset links, create a free project at [supabase.com](https://supabase.com), then:

1. **Authentication → Providers → Email** — make sure "Confirm email" is enabled.
2. **Authentication → URL Configuration** — set Site URL to `https://zeeshanshaikh95.github.io/dsa-revision-tracker/` and add `http://localhost:3000/dsa-revision-tracker/**` to Redirect URLs (for local dev).
3. **Project Settings → API** — copy the Project URL and the `anon` public key.
4. Add them as repo secrets (used by the deploy workflow; the anon key is public by design):

   ```bash
   gh secret set SUPABASE_URL
   gh secret set SUPABASE_ANON_KEY
   ```

5. For local development, create `.env.local`:

   ```
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   ```

The next push to `main` builds with those values inlined and the app switches to Supabase accounts automatically (the `@supabase/supabase-js` library is only loaded when configured). Without the secrets, the localStorage fallback keeps working — nothing breaks.

### Sync your problem bank across devices

Once Supabase is enabled, the dashboard reads and writes a **`problems` table** (one row per problem) plus a `user_profiles` row holding the activity log **and your to-do tasks**, synced across devices:

- the browser keeps a per-user `localStorage` cache (instant first paint, works offline);
- every change is debounce-pushed to the cloud (and flushed when you close the tab); deletes are tracked as tombstones so one device's removal never erases another device's additions;
- on login the cloud bank wins when it's newer, local wins when it's newer (last-write-wins);
- **first login migrates your existing bank automatically** — but log in from the device that already has your data, because that's the bank the cloud starts with.

Create the tables once in the Supabase SQL editor (row-level security enforces per-user isolation):

```sql
create table if not exists public.problems (
  id               uuid primary key,
  user_id          uuid not null references auth.users (id) on delete cascade,
  title            text not null,
  url              text not null,
  module           text not null,
  difficulty       text not null,
  confidence       text not null,
  status           text not null default 'active',
  pattern          text not null,
  intuition        text not null default '',
  time_complexity  text not null default '',
  space_complexity text not null default '',
  last_solved      date not null,
  last_duration    text,
  next_review      date not null,
  review_count     integer not null default 0,
  created_at       date not null,
  updated_at       timestamptz not null default now()
);
create table if not exists public.user_profiles (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  activity   jsonb not null default '[]'::jsonb,
  tasks      jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.problems enable row level security;
alter table public.user_profiles enable row level security;

create policy "Users manage their own problems"
  on public.problems for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
create policy "Users manage their own profile"
  on public.user_profiles for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
```

Until the tables exist the app keeps working fully offline — the header shows a small synced/offline indicator so you can see the state.
