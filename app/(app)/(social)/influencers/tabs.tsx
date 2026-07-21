"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search, Gauge, LineChart } from "lucide-react";

const TABS = [
  { href: "/influencers", label: "Discover", icon: Search },
  { href: "/influencers/analyze", label: "Analyze", icon: Gauge },
  { href: "/influencers/tracked", label: "Tracking", icon: LineChart },
];

export function InfluencerTabs() {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1 rounded-lg border border-zinc-200 bg-zinc-50 p-1 dark:border-zinc-800 dark:bg-zinc-900">
      {TABS.map((t) => {
        const active =
          t.href === "/influencers"
            ? pathname === "/influencers"
            : pathname.startsWith(t.href);
        const Icon = t.icon;
        return (
          <Link
            key={t.href}
            href={t.href}
            className={
              "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors " +
              (active
                ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-zinc-100"
                : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200")
            }
          >
            <Icon className="h-3.5 w-3.5" />
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
