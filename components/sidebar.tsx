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
  KeyRound,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: Home },
  { href: "/contacts", label: "Contacts", icon: Users },
  { href: "/outreach", label: "Outreach", icon: Send },
  { href: "/email", label: "Email", icon: Mail },
  { href: "/inbox", label: "Inbox", icon: Inbox },
  { href: "/sentiment", label: "Sentiment", icon: BarChart3 },
  { href: "/social", label: "Social", icon: Megaphone },
  { href: "/resources", label: "Resources", icon: KeyRound },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar({
  user,
}: {
  user: { email?: string | null; name?: string | null };
}) {
  const pathname = usePathname();
  return (
    <aside className="flex h-screen w-56 shrink-0 flex-col border-r border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <div className="px-4 py-5">
        <div className="text-sm font-semibold">Influencer & PR</div>
        <div className="text-xs text-zinc-500">Tracker</div>
      </div>
      <nav className="flex-1 px-2">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active =
            pathname === href ||
            (href !== "/dashboard" && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-zinc-100 font-medium text-zinc-900 dark:bg-zinc-800 dark:text-zinc-50"
                  : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-50",
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <div className="truncate text-xs text-zinc-500">{user.email}</div>
        <form action="/api/auth/signout" method="post" className="mt-2">
          <button
            type="submit"
            className="text-xs text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
          >
            Sign out
          </button>
        </form>
      </div>
    </aside>
  );
}
