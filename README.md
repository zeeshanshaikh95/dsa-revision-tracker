# DSA Revision Tracker & Spaced Repetition Hub

A dark-themed, Linear/Vercel-inspired dashboard for tracking DSA practice and scheduling spaced-repetition reviews. Built with React 19, TypeScript, Tailwind CSS v4, and Lucide icons.

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

- [Vite](https://vite.dev) + [React 19](https://react.dev)
- [TypeScript](https://www.typescriptlang.org)
- [Tailwind CSS v4](https://tailwindcss.com)
- [lucide-react](https://lucide.dev) icons
