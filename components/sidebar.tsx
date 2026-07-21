"use client";
import { useMemo, useSyncExternalStore, useTransition } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChevronDown,
  Users,
  Send,
  Inbox,
  BarChart3,
  Megaphone,
  Settings,
  Mail,
  Home,
  LogOut,
  Film,
  MessageCircle,
  Sparkles,
  Radar,
  Clapperboard,
  Workflow,
  BookOpen,
  GraduationCap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { BrandSwitcher, type BrandOption } from "@/components/brand-switcher";

type ToolSection = "pr" | "social" | null;

const NAV_GROUPS: {
  label: string | null;
  section: ToolSection;
  items: { href: string; label: string; icon: typeof Home }[];
}[] = [
  {
    label: null,
    section: null,
    items: [
      { href: "/dashboard", label: "Dashboard", icon: Home },
      { href: "/movies", label: "Movies", icon: Film },
      { href: "/resources", label: "Resources", icon: BookOpen },
    ],
  },
  {
    label: "PR Tools",
    section: "pr",
    items: [
      { href: "/contacts", label: "Contacts", icon: Users },
      { href: "/pr-finder", label: "Find contacts", icon: Radar },
      { href: "/outreach", label: "Outreach", icon: Send },
      { href: "/sequences", label: "Sequences", icon: Workflow },
      { href: "/email", label: "Email", icon: Mail },
      { href: "/screeners", label: "Screeners", icon: Clapperboard },
      { href: "/pitch-report", label: "Pitch report", icon: BarChart3 },
      { href: "/inbox", label: "PR Inbox", icon: Inbox },
    ],
  },
  {
    label: "Social Media",
    section: "social",
    items: [
      { href: "/social", label: "Social", icon: Megaphone },
      { href: "/influencers", label: "Influencers", icon: Sparkles },
      { href: "/sentiment", label: "Sentiment", icon: BarChart3 },
      { href: "/dms", label: "DMs", icon: MessageCircle },
    ],
  },
  {
    label: null,
    section: null,
    items: [{ href: "/settings", label: "Settings", icon: Settings }],
  },
];

// Restricted nav shown to onboardees — only the portal and shared resources.
const ONBOARDING_NAV_GROUPS: typeof NAV_GROUPS = [
  {
    label: null,
    section: null,
    items: [
      { href: "/portal", label: "Onboarding", icon: GraduationCap },
      { href: "/resources", label: "Resources", icon: BookOpen },
    ],
  },
];

const COLLAPSED_KEY = "sidebar-collapsed";
const COLLAPSED_EVENT = "sidebar-collapsed-change";

function subscribeToCollapsed(cb: () => void): () => void {
  window.addEventListener(COLLAPSED_EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(COLLAPSED_EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

function readCollapsed(): string {
  try {
    return localStorage.getItem(COLLAPSED_KEY) ?? "{}";
  } catch {
    return "{}";
  }
}

type ToolAccess = "all" | "pr_only" | "social_only";

function sectionVisible(section: ToolSection, toolAccess: ToolAccess): boolean {
  if (section === null) return true;
  if (toolAccess === "all") return true;
  if (toolAccess === "pr_only") return section === "pr";
  if (toolAccess === "social_only") return section === "social";
  return true;
}

export function Sidebar({
  user,
  role: _role,
  toolAccess,
  isOnboarding = false,
  brands,
  activeBrandId,
}: {
  user: { email?: string | null; name?: string | null };
  role: string;
  toolAccess: ToolAccess;
  isOnboarding?: boolean;
  brands: BrandOption[];
  activeBrandId: string | null;
}) {
  const pathname = usePathname();
  const [, startTransition] = useTransition();
  void startTransition;

  // Collapsed state per labeled group, remembered across visits (and synced
  // across tabs). Server render always shows everything expanded; the stored
  // preference kicks in on hydration.
  const collapsedRaw = useSyncExternalStore(
    subscribeToCollapsed,
    readCollapsed,
    () => "{}",
  );
  const collapsed = useMemo<Record<string, boolean>>(() => {
    try {
      return JSON.parse(collapsedRaw);
    } catch {
      return {};
    }
  }, [collapsedRaw]);

  function toggleGroup(label: string) {
    const next = { ...collapsed, [label]: !collapsed[label] };
    try {
      localStorage.setItem(COLLAPSED_KEY, JSON.stringify(next));
      window.dispatchEvent(new Event(COLLAPSED_EVENT));
    } catch {
      // Persistence is best-effort.
    }
  }

  const initials = (user.name ?? user.email ?? "?")
    .split(/[\s@.]/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("");

  const visibleGroups = isOnboarding
    ? ONBOARDING_NAV_GROUPS
    : NAV_GROUPS.filter((g) => sectionVisible(g.section, toolAccess));

  return (
    <aside
      className="flex h-screen w-[220px] shrink-0 flex-col"
      style={{ background: "var(--sidebar-bg)", borderRight: "1px solid var(--sidebar-border)" }}
    >
      {/* Logo */}
      <div className="px-4 pt-5 pb-2">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-red-600 text-[13px] font-black text-white shadow-md shadow-red-900/50">
            P
          </div>
          <span className="text-[14px] font-semibold tracking-tight text-white">
            PRTools
          </span>
        </div>
      </div>

      {/* Brand switcher */}
      {!isOnboarding && (
        <BrandSwitcher brands={brands} activeBrandId={activeBrandId} />
      )}

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-2 space-y-4">
        {visibleGroups.map((group, gi) => {
          const isCollapsed = group.label ? !!collapsed[group.label] : false;
          const containsActive = group.items.some(
            ({ href }) =>
              pathname === href ||
              (href !== "/dashboard" && pathname.startsWith(href)),
          );
          return (
          <div key={gi}>
            {group.label ? (
              <button
                type="button"
                onClick={() => toggleGroup(group.label!)}
                aria-expanded={!isCollapsed}
                className="group/header mb-1 flex w-full items-center justify-between rounded-md px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-600 transition-colors hover:text-zinc-400"
              >
                <span className="flex items-center gap-1.5">
                  {group.label}
                  {isCollapsed && containsActive && (
                    <span
                      className="h-1.5 w-1.5 rounded-full bg-red-500"
                      title="Contains the current page"
                    />
                  )}
                </span>
                <ChevronDown
                  className={cn(
                    "h-3 w-3 text-zinc-600 transition-transform duration-150 group-hover/header:text-zinc-400",
                    isCollapsed && "-rotate-90",
                  )}
                />
              </button>
            ) : null}
            {!isCollapsed && (
            <div className="space-y-0.5">
              {group.items.map(({ href, label, icon: Icon }) => {
                const active =
                  pathname === href ||
                  (href !== "/dashboard" && pathname.startsWith(href));
                return (
                  <Link
                    key={href}
                    href={href}
                    className={cn(
                      "group relative flex items-center gap-2.5 rounded-md px-2.5 py-[6px] text-[13px] font-medium transition-colors duration-100",
                      active
                        ? "bg-white/10 text-white"
                        : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200",
                    )}
                  >
                    {active && (
                      <span className="absolute left-0 top-1/2 h-[18px] w-0.5 -translate-y-1/2 rounded-r-full bg-red-500" />
                    )}
                    <Icon
                      className={cn(
                        "h-[15px] w-[15px] shrink-0 transition-colors",
                        active ? "text-red-400" : "text-zinc-500 group-hover:text-zinc-300",
                      )}
                    />
                    <span className="truncate">{label}</span>
                  </Link>
                );
              })}
            </div>
            )}
          </div>
          );
        })}
      </nav>

      {/* User */}
      <div
        className="border-t px-3 py-3"
        style={{ borderColor: "var(--sidebar-border)" }}
      >
        <div className="flex items-center gap-2.5 rounded-lg px-2 py-2 transition-colors hover:bg-white/5">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-red-500 to-red-700 text-[11px] font-bold text-white shadow shadow-red-900/40">
            {initials || "U"}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[12px] font-medium leading-tight text-zinc-200">
              {user.name ?? user.email?.split("@")[0] ?? "Account"}
            </div>
            <div className="truncate text-[10px] text-zinc-500 leading-tight">
              {user.email}
            </div>
          </div>
          <form action="/api/auth/signout" method="post">
            <button
              type="submit"
              title="Sign out"
              className="rounded-md p-1.5 text-zinc-500 transition-colors hover:bg-white/10 hover:text-zinc-300"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </form>
        </div>
      </div>
    </aside>
  );
}
