"use client";
import { useState } from "react";
import { Monitor, Sun, Moon } from "lucide-react";
import { cn } from "@/lib/utils";

type Theme = "system" | "light" | "dark";

const OPTIONS: { value: Theme; label: string; icon: typeof Monitor }[] = [
  { value: "system", label: "System", icon: Monitor },
  { value: "light",  label: "Light",  icon: Sun },
  { value: "dark",   label: "Dark",   icon: Moon },
];

const COOKIE_MAX_AGE = 365 * 24 * 3600;

export function ThemePicker({ initialTheme }: { initialTheme: string }) {
  const [theme, setTheme] = useState<Theme>((initialTheme as Theme) || "system");

  function apply(t: Theme) {
    setTheme(t);
    // Set cookie so root layout picks it up on next SSR.
    document.cookie = `user-theme=${t}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`;
    // Apply immediately without a page reload.
    const html = document.documentElement;
    html.classList.remove("dark", "light");
    if (t === "dark") {
      html.classList.add("dark");
    } else if (t === "light") {
      html.classList.add("light");
    } else {
      // System: follow OS preference right now.
      if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
        html.classList.add("dark");
      }
    }
  }

  return (
    <div className="flex gap-2">
      {OPTIONS.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          type="button"
          onClick={() => apply(value)}
          className={cn(
            "flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
            theme === value
              ? "border-red-500 bg-red-50 text-red-700 dark:border-red-600 dark:bg-red-950/30 dark:text-red-400"
              : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 hover:text-zinc-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:border-zinc-600",
          )}
        >
          <Icon className="h-4 w-4" />
          {label}
        </button>
      ))}
    </div>
  );
}
