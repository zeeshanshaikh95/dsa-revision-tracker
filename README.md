# DSA Revision Tracker & Spaced Repetition Hub

A dark-themed, Linear/Vercel-inspired dashboard for tracking DSA practice and scheduling spaced-repetition reviews. Built with Next.js 16, React 19, TypeScript, Tailwind CSS v4, and Lucide icons.

## Features

- **KPI dashboard** — total solved progress ring, "due for review today" counter, mastery streak (computed from the activity log), and core-module completion bars.
- **Problem bank** — scannable data table with status checkboxes, module pills, spaced-repetition badges (Overdue / Review Today / Safe), confidence signals, relative review dates, and filter tabs (All / Due for Review / module-specific) plus search.
- **Quick-add & edit modal** — log a problem with name, platform URL, module, difficulty, and confidence rating in seconds.
- **Revision drawer** — click any row for a slide-out panel with algorithmic pattern tag, tabbed notes (markdown-rendered "My Intuition" + "Complexity" code blocks), a focus timer, and the **"I Re-solved This From Scratch Now"** button that advances the spaced-repetition interval (1 → 3 → 7 → 14 → 30 → 60 → 90 → 180 days).
- **Persistence** — everything is stored in `localStorage`, with a seeded problem bank on first load so the dashboard is alive immediately.

## Getting started

```bash
npm install
npm run dev      # start the dev server
npm run build    # typecheck + production build
npm run lint     # oxlint
```

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
