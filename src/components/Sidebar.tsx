import {
  BarChart3,
  Binary,
  Database,
  LayoutDashboard,
  LogOut,
  Settings,
} from "lucide-react";

export type NavKey = "dashboard" | "bank" | "analytics" | "settings";

const NAV_ITEMS: { key: NavKey; label: string; icon: typeof LayoutDashboard }[] =
  [
    { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { key: "bank", label: "Problem Bank", icon: Database },
    { key: "analytics", label: "Analytics", icon: BarChart3 },
    { key: "settings", label: "Settings", icon: Settings },
  ];

interface SidebarProps {
  active: NavKey;
  onChange: (key: NavKey) => void;
  onLogout: () => void;
  /** Logged-in user's email — drives the avatar initials. */
  user: string | null;
}

/** "admin@gmail.com" → "AD", "john.doe@x.com" → "JD". */
function initials(email: string | null): string {
  if (!email) return "?";
  const local = email.split("@")[0] ?? "";
  const parts = local.split(/[._-]/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return local.slice(0, 2).toUpperCase();
}

export function Sidebar({ active, onChange, onLogout, user }: SidebarProps) {
  return (
    <aside className="fixed inset-y-0 left-0 z-40 flex w-[68px] flex-col items-center border-r border-zinc-800/70 bg-zinc-950/90 py-4 backdrop-blur">
      {/* Logo */}
      <a
        href="#"
        onClick={(e) => {
          e.preventDefault();
          onChange("dashboard");
        }}
        className="group mb-6 flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-lg shadow-emerald-500/20 ring-1 ring-emerald-400/30 transition-transform hover:scale-105"
        title="DSA Revision Tracker"
      >
        <Binary className="h-5 w-5 text-zinc-950" strokeWidth={2.5} />
      </a>

      {/* Nav */}
      <nav className="flex flex-1 flex-col items-center gap-1.5">
        {NAV_ITEMS.map(({ key, label, icon: Icon }) => {
          const isActive = active === key;
          return (
            <button
              key={key}
              onClick={() => onChange(key)}
              title={label}
              aria-label={label}
              aria-current={isActive ? "page" : undefined}
              className={`group relative flex h-10 w-10 items-center justify-center rounded-lg transition-colors ${
                isActive
                  ? "bg-zinc-800 text-emerald-400"
                  : "text-zinc-500 hover:bg-zinc-800/60 hover:text-zinc-200"
              }`}
            >
              {isActive && (
                <span className="absolute -left-[13px] h-5 w-0.5 rounded-full bg-emerald-400" />
              )}
              <Icon className="h-[18px] w-[18px]" strokeWidth={2} />
              <span className="pointer-events-none absolute left-full ml-3 whitespace-nowrap rounded-md border border-zinc-800 bg-zinc-900 px-2.5 py-1.5 text-xs font-medium text-zinc-200 opacity-0 shadow-xl transition-opacity duration-150 group-hover:opacity-100">
                {label}
              </span>
            </button>
          );
        })}
      </nav>

      {/* Profile */}
      <div className="flex flex-col items-center gap-3">
        <button
          onClick={() => onChange("settings")}
          title="Settings"
          aria-label="Settings"
          className="flex h-10 w-10 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-zinc-800/60 hover:text-zinc-200"
        >
          <Settings className="h-[18px] w-[18px]" />
        </button>
        <button
          title="Profile"
          className="relative"
          onClick={() => onChange("settings")}
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-fuchsia-600 text-xs font-bold text-white ring-2 ring-zinc-800 transition-transform hover:scale-105">
            {initials(user)}
          </span>
          <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-zinc-950" />
        </button>
        <button
          onClick={onLogout}
          title="Log out"
          aria-label="Log out"
          className="flex h-9 w-9 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-rose-500/10 hover:text-rose-400"
        >
          <LogOut className="h-[17px] w-[17px]" />
        </button>
      </div>
    </aside>
  );
}
