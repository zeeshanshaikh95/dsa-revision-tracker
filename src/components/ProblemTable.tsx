import { memo, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
  ExternalLink,
  MoreHorizontal,
  Pencil,
  RotateCcw,
  Search,
  Trash2,
} from "lucide-react";
import type { Problem } from "../types";
import { relativeDay, reviewStatus, todayKey } from "../lib/spaced";
import {
  CompletedMark,
  ConfidenceIndicator,
  DifficultyBadge,
  EmptyHint,
  ModuleTag,
  ReviewStatusBadge,
} from "./badges";

export type FilterKey = "all" | "due" | "arrays";
type SortKey = "nextReview" | "title" | "difficulty";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "due", label: "Due for Review" },
  { key: "arrays", label: "Arrays Only" },
];

interface ProblemTableProps {
  problems: Problem[];
  filter: FilterKey;
  onFilterChange: (key: FilterKey) => void;
  search: string;
  onSearch: (value: string) => void;
  onSelect: (problem: Problem) => void;
  onToggleStatus: (id: string) => void;
  onEdit: (problem: Problem) => void;
  onDelete: (id: string) => void;
  onResetReview: (id: string) => void;
  /** When provided, shows a destructive "Clear all" button in the toolbar. */
  onClearAll?: () => void;
}

/** Destructive "Clear all" with a two-step confirm, like the row delete. */
function ClearAllButton({
  onClear,
  disabled,
}: {
  onClear: () => void;
  disabled?: boolean;
}) {
  const [confirming, setConfirming] = useState(false);
  return (
    <button
      disabled={disabled}
      onClick={() => {
        if (confirming) {
          setConfirming(false);
          onClear();
        } else {
          setConfirming(true);
        }
      }}
      onBlur={() => setConfirming(false)}
      title="Remove every problem from the bank"
      className={`inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border px-3 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
        confirming
          ? "border-rose-500/40 bg-rose-500/15 text-rose-400"
          : "border-zinc-800 bg-zinc-900/70 text-zinc-400 hover:border-rose-500/40 hover:text-rose-400"
      }`}
    >
      <Trash2 className="h-3.5 w-3.5" />
      {confirming ? "Confirm clear?" : "Clear all"}
    </button>
  );
}

interface RowProps {
  problem: Problem;
  today: string;
  onSelect: (problem: Problem) => void;
  onToggleStatus: (id: string) => void;
  onEdit: (problem: Problem) => void;
  onDelete: (id: string) => void;
  onResetReview: (id: string) => void;
}

/**
 * A single table row. Memoized so typing in search/filters (or changing
 * unrelated rows) doesn't re-render the whole table.
 */
const ProblemRow = memo(function ProblemRow({
  problem: p,
  today,
  onSelect,
  onToggleStatus,
  onEdit,
  onDelete,
  onResetReview,
}: RowProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const status = reviewStatus(p, today);

  // Close this row's menu on outside click / Escape.
  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
        setConfirmDelete(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMenuOpen(false);
        setConfirmDelete(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      window.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  return (
    <tr
      onClick={() => onSelect(p)}
      className="group cursor-pointer border-b border-zinc-800/50 transition-colors last:border-0 hover:bg-zinc-800/40"
    >
      {/* Status checkbox */}
      <td className="px-4 py-3.5" onClick={(e) => e.stopPropagation()}>
        <button
          role="checkbox"
          aria-checked={p.status === "completed"}
          aria-label={
            p.status === "completed"
              ? `Reopen ${p.title}`
              : `Mark ${p.title} complete`
          }
          onClick={() => onToggleStatus(p.id)}
          className={`flex h-5 w-5 items-center justify-center rounded-md border transition-all ${
            p.status === "completed"
              ? "border-emerald-500 bg-emerald-500 text-zinc-950"
              : "border-zinc-700 bg-zinc-900 hover:border-emerald-500/70"
          }`}
        >
          {p.status === "completed" && (
            <Check className="h-3.5 w-3.5" strokeWidth={3} />
          )}
        </button>
      </td>

      {/* Title */}
      <td className="max-w-[280px] px-2 py-3.5">
        <div className="flex items-center gap-2">
          <a
            href={p.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="group/link inline-flex items-center gap-1 truncate text-sm font-semibold text-zinc-100 transition-colors hover:text-emerald-400"
            title={`Open ${p.title}`}
          >
            <span className="truncate">{p.title}</span>
            <ExternalLink className="h-3 w-3 shrink-0 text-zinc-600 opacity-0 transition-opacity group-hover/link:opacity-100" />
          </a>
          {p.status === "completed" && <CompletedMark />}
        </div>
        <p className="mt-0.5 truncate text-xs text-zinc-600">{p.pattern}</p>
      </td>

      <td className="px-2 py-3.5">
        <ModuleTag module={p.module} />
      </td>

      {/* Review status */}
      <td className="px-2 py-3.5">
        <ReviewStatusBadge status={status} />
      </td>

      {/* Confidence */}
      <td className="px-2 py-3.5">
        <ConfidenceIndicator confidence={p.confidence} />
      </td>

      <td className="px-2 py-3.5">
        <DifficultyBadge difficulty={p.difficulty} />
      </td>

      {/* Next review */}
      <td className="whitespace-nowrap px-2 py-3.5 font-mono text-xs text-zinc-500">
        {relativeDay(p.nextReview, today)}
      </td>

      {/* Actions */}
      <td className="px-2 py-3.5 text-right" onClick={(e) => e.stopPropagation()}>
        <div className="relative inline-block" ref={menuRef}>
          <button
            onClick={() => {
              setMenuOpen((v) => !v);
              setConfirmDelete(false);
            }}
            aria-label={`Actions for ${p.title}`}
            className="rounded-lg p-1.5 text-zinc-500 opacity-0 transition-all group-hover:opacity-100 hover:bg-zinc-700/60 hover:text-zinc-200 focus:opacity-100"
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-full z-20 mt-1 w-48 animate-scale-in rounded-lg border border-zinc-800 bg-zinc-900 p-1 text-left shadow-2xl">
              <button
                onClick={() => {
                  setMenuOpen(false);
                  onEdit(p);
                }}
                className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-sm text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-zinc-100"
              >
                <Pencil className="h-3.5 w-3.5 text-zinc-500" />
                Edit
              </button>
              <button
                onClick={() => {
                  setMenuOpen(false);
                  onResetReview(p.id);
                }}
                className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-sm text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-zinc-100"
              >
                <RotateCcw className="h-3.5 w-3.5 text-zinc-500" />
                Reset review cycle
              </button>
              <button
                onClick={() => {
                  if (confirmDelete) {
                    onDelete(p.id);
                    setMenuOpen(false);
                    setConfirmDelete(false);
                  } else {
                    setConfirmDelete(true);
                  }
                }}
                className={`flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-sm transition-colors ${
                  confirmDelete
                    ? "bg-rose-500/15 font-semibold text-rose-400"
                    : "text-zinc-300 hover:bg-zinc-800 hover:text-rose-400"
                }`}
              >
                <Trash2 className="h-3.5 w-3.5 text-rose-400/80" />
                {confirmDelete ? "Confirm delete?" : "Delete"}
              </button>
            </div>
          )}
        </div>
      </td>
    </tr>
  );
});

export function ProblemTable({
  problems,
  filter,
  onFilterChange,
  search,
  onSearch,
  onSelect,
  onToggleStatus,
  onEdit,
  onDelete,
  onResetReview,
  onClearAll,
}: ProblemTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("nextReview");
  const [sortAsc, setSortAsc] = useState(true);
  const today = todayKey();
  // Keep the input urgent; let the filtered/sorted list trail by a tick so
  // fast typing never blocks the main thread.
  const deferredSearch = useDeferredValue(search);

  const counts = useMemo(
    () => ({
      all: problems.length,
      due: problems.filter(
        (p) => p.status === "active" && reviewStatus(p, today) !== "safe",
      ).length,
      arrays: problems.filter((p) => p.module === "Arrays").length,
    }),
    [problems, today],
  );

  const visible = useMemo(() => {
    const q = deferredSearch.trim().toLowerCase();
    let list = problems.filter((p) => {
      if (filter === "due")
        return p.status === "active" && reviewStatus(p, today) !== "safe";
      if (filter === "arrays") return p.module === "Arrays";
      return true;
    });
    if (q) {
      list = list.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          p.module.toLowerCase().includes(q) ||
          p.pattern.toLowerCase().includes(q) ||
          p.difficulty.includes(q),
      );
    }
    const dir = sortAsc ? 1 : -1;
    const score = (p: Problem) => {
      if (p.status === "completed") return Number.MAX_SAFE_INTEGER;
      return p.nextReview.localeCompare(today);
    };
    return [...list].sort((a, b) => {
      if (sortKey === "title") return a.title.localeCompare(b.title) * dir;
      if (sortKey === "difficulty")
        return a.difficulty.localeCompare(b.difficulty) * dir;
      // Default: due items first (overdue → today → safe), then by date.
      const aScore = score(a);
      const bScore = score(b);
      if (aScore !== bScore) return aScore - bScore;
      return a.nextReview.localeCompare(b.nextReview) * dir;
    });
  }, [problems, deferredSearch, filter, sortKey, sortAsc, today]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortAsc((v) => !v);
    } else {
      setSortKey(key);
      setSortAsc(key !== "nextReview");
    }
  };

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col)
      return (
        <ChevronsUpDown className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-60" />
      );
    return sortAsc ? (
      <ChevronUp className="h-3 w-3 text-emerald-400" />
    ) : (
      <ChevronDown className="h-3 w-3 text-emerald-400" />
    );
  };

  return (
    <section className="card overflow-hidden">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 border-b border-zinc-800/70 p-4 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap items-center gap-1.5">
          {FILTERS.map(({ key, label }) => {
            const isActive = filter === key;
            return (
              <button
                key={key}
                onClick={() => onFilterChange(key)}
                className={`inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-zinc-800 text-zinc-100 ring-1 ring-inset ring-zinc-700"
                    : "text-zinc-500 hover:bg-zinc-800/60 hover:text-zinc-300"
                }`}
              >
                {label}
                <span
                  className={`rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${
                    isActive
                      ? "bg-emerald-500/15 text-emerald-400"
                      : "bg-zinc-800 text-zinc-500"
                  }`}
                >
                  {counts[key]}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex w-full items-center gap-2 md:w-auto">
          {onClearAll && (
            <ClearAllButton
              onClear={onClearAll}
              disabled={problems.length === 0}
            />
          )}
          <div className="relative w-full md:w-64">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
            <input
              type="search"
              value={search}
              onChange={(e) => onSearch(e.target.value)}
              placeholder="Filter table…"
              className="h-8 w-full rounded-lg border border-zinc-800 bg-zinc-900/70 pl-8 pr-3 text-sm text-zinc-200 placeholder:text-zinc-600 transition-colors focus:border-emerald-500/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table
          className={`w-full min-w-[820px] border-collapse text-left ${
            problems.length > 50 ? "virtualized-rows" : ""
          }`}
        >
          <thead>
            <tr className="border-b border-zinc-800/70 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
              <th className="w-12 px-4 py-3">
                <span className="sr-only">Status</span>
              </th>
              <th className="px-2 py-3">
                <button
                  onClick={() => toggleSort("title")}
                  className="group inline-flex items-center gap-1 hover:text-zinc-300"
                >
                  Problem
                  <SortIcon col="title" />
                </button>
              </th>
              <th className="px-2 py-3">Module</th>
              <th className="px-2 py-3">Review</th>
              <th className="px-2 py-3">Confidence</th>
              <th className="px-2 py-3">
                <button
                  onClick={() => toggleSort("difficulty")}
                  className="group inline-flex items-center gap-1 hover:text-zinc-300"
                >
                  Difficulty
                  <SortIcon col="difficulty" />
                </button>
              </th>
              <th className="px-2 py-3">
                <button
                  onClick={() => toggleSort("nextReview")}
                  className="group inline-flex items-center gap-1 hover:text-zinc-300"
                >
                  Next Review
                  <SortIcon col="nextReview" />
                </button>
              </th>
              <th className="w-12 px-2 py-3 text-right">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 && (
              <tr>
                <td colSpan={8}>
                  <EmptyHint label="No problems match this view. Try a different filter, or add a new problem." />
                </td>
              </tr>
            )}
            {visible.map((p) => (
              <ProblemRow
                key={p.id}
                problem={p}
                today={today}
                onSelect={onSelect}
                onToggleStatus={onToggleStatus}
                onEdit={onEdit}
                onDelete={onDelete}
                onResetReview={onResetReview}
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-zinc-800/70 px-4 py-2.5 text-xs text-zinc-600">
        <span>
          Showing <span className="font-semibold text-zinc-400">{visible.length}</span> of{" "}
          {problems.length} problems
        </span>
        <span className="hidden sm:inline">
          Click a row to open revision notes · Tab to filter
        </span>
      </div>
    </section>
  );
}
