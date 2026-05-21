"use client";
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
  const initials = (user.name ?? user.email ?? "?")
    .split(/[\s@]/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("");

  return (
    <aside className="flex h-screen w-60 shrink-0 flex-col border-r border-zinc-200 bg-zinc-50/50 dark:border-zinc-800 dark:bg-zinc-950/50">
      <div className="px-5 py-5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-red-600 text-sm font-bold text-white shadow-sm">
            P
          </div>
          <div>
            <div className="text-sm font-semibold tracking-tight">PR Tracker</div>
            <div className="text-[11px] text-zinc-500">Influencer & PR</div>
          </div>
        </div>
      </div>

      <BrandSwitcher brands={brands} activeBrandId={activeBrandId} />

      <nav className="flex-1 space-y-5 overflow-y-auto px-3 pb-4">
        {NAV_GROUPS.map((group, gi) => (
          <div key={gi}>
            {group.label ? (
              <div className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
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
                      "group relative flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                      active
                        ? "bg-white font-medium text-zinc-900 shadow-sm dark:bg-zinc-900 dark:text-zinc-50"
                        : "text-zinc-600 hover:bg-white/70 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900/70 dark:hover:text-zinc-50",
                    )}
                  >
                    {active ? (
                      <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r-full bg-red-600" />
                    ) : null}
                    <Icon
                      className={cn(
                        "h-4 w-4 transition-colors",
                        active
                          ? "text-red-600"
                          : "text-zinc-500 group-hover:text-zinc-700 dark:group-hover:text-zinc-300",
                      )}
                    />
                    {label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-zinc-200 px-3 py-3 dark:border-zinc-800">
        <div className="flex items-center gap-2.5 rounded-md px-2 py-1.5">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-red-500 to-red-700 text-[11px] font-semibold text-white">
            {initials || "U"}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-xs font-medium">
              {user.name ?? "Account"}
            </div>
            <div className="truncate text-[11px] text-zinc-500">
              {user.email}
            </div>
          </div>
          <form action="/api/auth/signout" method="post">
            <button
              type="submit"
              title="Sign out"
              className="rounded p-1 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </form>
        </div>
      </div>
    </aside>
  );
}
