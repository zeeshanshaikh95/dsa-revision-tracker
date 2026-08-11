import { Flame, Plus, Search, X } from "lucide-react";

interface HeaderProps {
  search: string;
  onSearch: (value: string) => void;
  streak: number;
  dueCount: number;
  onQuickAdd: () => void;
}

export function Header({
  search,
  onSearch,
  streak,
  dueCount,
  onQuickAdd,
}: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-zinc-800/70 bg-zinc-950/80 backdrop-blur-md">
      <div className="flex items-center gap-3 px-4 py-3 md:px-6">
        {/* Search */}
        <div className="relative min-w-0 flex-1 md:max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <input
            type="search"
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Search problems, patterns, modules…"
            className="h-10 w-full rounded-lg border border-zinc-800 bg-zinc-900/70 pl-9 pr-8 text-sm text-zinc-200 placeholder:text-zinc-600 transition-colors focus:border-emerald-500/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          />
          {search && (
            <button
              onClick={() => onSearch("")}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-zinc-500 hover:text-zinc-300"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="ml-auto flex items-center gap-2.5">
          {/* Streak badge */}
          <div
            className={`hidden items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-semibold sm:flex ${
              streak > 0
                ? "border-amber-500/25 bg-amber-500/10 text-amber-400"
                : "border-zinc-800 bg-zinc-900/60 text-zinc-500"
            }`}
            title="Consecutive days with at least one problem solved"
          >
            <Flame
              className={`h-4 w-4 ${streak > 0 ? "animate-pulse-soft" : ""}`}
              fill="currentColor"
            />
            {streak} Day{streak === 1 ? "" : "s"}
          </div>

          {/* Due today quick hint */}
          <div
            className={`hidden items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-semibold lg:flex ${
              dueCount > 0
                ? "border-amber-500/30 bg-amber-500/10 text-amber-400"
                : "border-zinc-800 bg-zinc-900/60 text-zinc-500"
            }`}
            title="Problems due for review"
          >
            <span className="relative flex h-2 w-2">
              {dueCount > 0 && (
                <span className="absolute inline-flex h-full w-full animate-ping-soft rounded-full bg-amber-400" />
              )}
              <span
                className={`relative inline-flex h-2 w-2 rounded-full ${
                  dueCount > 0 ? "bg-amber-400" : "bg-zinc-600"
                }`}
              />
            </span>
            {dueCount} due today
          </div>

          {/* Quick add */}
          <button
            onClick={onQuickAdd}
            className="group inline-flex h-10 items-center gap-1.5 rounded-lg bg-emerald-500 px-3.5 text-sm font-semibold text-zinc-950 shadow-lg shadow-emerald-500/20 transition-all hover:bg-emerald-400 active:scale-[0.98] md:px-4"
          >
            <Plus className="h-4 w-4 transition-transform group-hover:rotate-90" />
            <span className="hidden md:inline">Add Problem</span>
          </button>
        </div>
      </div>
    </header>
  );
}
