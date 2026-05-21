"use client";
import { useTransition } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
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
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { BrandSwitcher, type BrandOption } from "@/components/brand-switcher";

const NAV_GROUPS: {
  label: string | null;
  items: { href: string; label: string; icon: typeof Home }[];
}[] = [
  {
    label: null,
    items: [{ href: "/dashboard", label: "Dashboard", icon: Home }],
  },
  {
    label: "Engage",
    items: [
      { href: "/contacts", label: "Contacts", icon: Users },
      { href: "/outreach", label: "Outreach", icon: Send },
      { href: "/email", label: "Email", icon: Mail },
      { href: "/inbox", label: "Inbox", icon: Inbox },
    ],
  },
  {
    label: "Publish",
    items: [
      { href: "/social", label: "Social", icon: Megaphone },
      { href: "/sentiment", label: "Sentiment", icon: BarChart3 },
    ],
  },
  {
    label: "Catalog",
    items: [{ href: "/movies", label: "Movies", icon: Film }],
  },
  {
    label: null,
    items: [{ href: "/settings", label: "Settings", icon: Settings }],
  },
];

export function Sidebar({
  user,
  brands,
  activeBrandId,
}: {
  user: { email?: string | null; name?: string | null };
  brands: BrandOption[];
  activeBrandId: string | null;
}) {
  const pathname = usePathname();
  const [, startTransition] = useTransition();

  const initials = (user.name ?? user.email ?? "?")
    .split(/[\s@.]/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("");

  return (
    <aside
      className="flex h-screen w-[220px] shrink-0 flex-col"
      style={{ background: "var(--sidebar-bg)", borderRight: "1px solid var(--sidebar-border)" }}
    >
      {/* Logo */}
      <div className="px-4 pt-5 pb-3">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-600 text-sm font-bold text-white shadow-lg shadow-red-900/40">
            P
          </div>
          <div>
            <div className="text-[13px] font-semibold text-white tracking-tight">
              PRTools
            </div>
            <div className="text-[10px] text-zinc-600 tracking-wide uppercase">
              Good Deed
            </div>
          </div>
        </div>
      </div>

      {/* Brand switcher */}
      <BrandSwitcher brands={brands} activeBrandId={activeBrandId} />

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-5">
        {NAV_GROUPS.map((group, gi) => (
          <div key={gi}>
            {group.label ? (
              <div className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-widest text-zinc-600">
                {group.label}
              </div>
            ) : null}
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
                      "group relative flex items-center gap-2.5 rounded-md px-2.5 py-[7px] text-[13px] font-medium transition-all duration-100",
                      active
                        ? "bg-white/10 text-white"
                        : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200",
                    )}
                  >
                    {active && (
                      <span className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-r-full bg-red-500" />
                    )}
                    <Icon
                      className={cn(
                        "h-[15px] w-[15px] shrink-0 transition-colors",
                        active ? "text-red-400" : "text-zinc-500 group-hover:text-zinc-400",
                      )}
                    />
                    <span className="flex-1">{label}</span>
                    {active && (
                      <ChevronRight className="h-3 w-3 text-zinc-600" />
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* User */}
      <div
        className="border-t px-3 py-3"
        style={{ borderColor: "var(--sidebar-border)" }}
      >
        <div className="flex items-center gap-2.5 rounded-md px-1.5 py-1.5">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-red-500 to-red-700 text-[11px] font-bold text-white shadow shadow-red-900/30">
            {initials || "U"}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[12px] font-medium text-zinc-300">
              {user.name ?? user.email?.split("@")[0] ?? "Account"}
            </div>
            <div className="truncate text-[10px] text-zinc-600">
              {user.email}
            </div>
          </div>
          <form action="/api/auth/signout" method="post">
            <button
              type="submit"
              title="Sign out"
              className="rounded-md p-1 text-zinc-600 transition-colors hover:bg-white/5 hover:text-zinc-400"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </form>
        </div>
      </div>
    </aside>
  );
}
