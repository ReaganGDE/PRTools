"use client";
import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type CalPost = {
  id: string;
  title: string | null;
  body: string;
  platform: string;
  status: string;
  scheduledAt: Date | null;
  postedAt: Date | null;
};

const PLATFORM_COLORS: Record<string, string> = {
  instagram: "bg-pink-100 text-pink-800 dark:bg-pink-950/40 dark:text-pink-300",
  facebook: "bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300",
  youtube: "bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-300",
  reddit: "bg-orange-100 text-orange-800 dark:bg-orange-950/40 dark:text-orange-300",
  tiktok: "bg-zinc-200 text-zinc-900 dark:bg-zinc-700 dark:text-zinc-100",
  x: "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900",
  linkedin: "bg-sky-100 text-sky-800 dark:bg-sky-950/40 dark:text-sky-300",
  pinterest: "bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300",
  threads: "bg-zinc-200 text-zinc-900 dark:bg-zinc-700 dark:text-zinc-100",
  bluesky: "bg-sky-100 text-sky-800 dark:bg-sky-950/40 dark:text-sky-300",
  snapchat: "bg-yellow-100 text-yellow-900 dark:bg-yellow-950/40 dark:text-yellow-300",
  gbp: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300",
  multi: "bg-purple-100 text-purple-800 dark:bg-purple-950/40 dark:text-purple-300",
};

function startOfWeek(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - x.getDay());
  return x;
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function PostCalendar({ posts }: { posts: CalPost[] }) {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const today = new Date();

  const monthLabel = new Intl.DateTimeFormat(undefined, {
    month: "long",
    year: "numeric",
  }).format(weekStart);

  return (
    <div className="rounded-lg border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-semibold">{monthLabel}</h3>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setWeekStart(startOfWeek(new Date()))}
          >
            Today
          </Button>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setWeekStart(addDays(weekStart, -7))}
            className="h-7 w-7"
            aria-label="Previous week"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setWeekStart(addDays(weekStart, 7))}
            className="h-7 w-7"
            aria-label="Next week"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-7 border-b border-zinc-200 dark:border-zinc-800">
        {days.map((d) => {
          const isToday = sameDay(d, today);
          return (
            <div
              key={d.toISOString()}
              className={cn(
                "border-r border-zinc-200 px-3 py-2 text-center last:border-r-0 dark:border-zinc-800",
                isToday ? "bg-red-50/50 dark:bg-red-950/20" : "",
              )}
            >
              <div className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
                {d.toLocaleDateString(undefined, { weekday: "short" })}
              </div>
              <div
                className={cn(
                  "mt-0.5 text-sm font-semibold",
                  isToday ? "text-red-600 dark:text-red-400" : "",
                )}
              >
                {d.getDate()}
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid min-h-[400px] grid-cols-7">
        {days.map((d) => {
          const dayPosts = posts.filter((p) => {
            const when = p.postedAt ?? p.scheduledAt;
            return when ? sameDay(new Date(when), d) : false;
          });
          return (
            <div
              key={d.toISOString()}
              className="space-y-1.5 border-r border-zinc-200 p-2 last:border-r-0 dark:border-zinc-800"
            >
              {dayPosts.map((p) => {
                const when = p.postedAt ?? p.scheduledAt;
                const time = when
                  ? new Date(when).toLocaleTimeString(undefined, {
                      hour: "numeric",
                      minute: "2-digit",
                    })
                  : "";
                const colorCls =
                  PLATFORM_COLORS[p.platform] ?? PLATFORM_COLORS.multi;
                return (
                  <div
                    key={p.id}
                    className="cursor-default rounded-md border border-zinc-200 bg-white p-1.5 text-xs shadow-sm transition-shadow hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900"
                  >
                    <div className="mb-1 flex items-center justify-between gap-1">
                      <span
                        className={cn(
                          "rounded-full px-1.5 py-0.5 text-[9px] font-medium capitalize",
                          colorCls,
                        )}
                      >
                        {p.platform}
                      </span>
                      <span className="text-[10px] text-zinc-500">{time}</span>
                    </div>
                    <div className="line-clamp-2 text-zinc-700 dark:text-zinc-300">
                      {p.title || p.body}
                    </div>
                    {p.status !== "posted" ? (
                      <div
                        className={cn(
                          "mt-1 inline-block rounded px-1 py-0.5 text-[9px] font-medium",
                          p.status === "failed"
                            ? "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300"
                            : p.status === "draft"
                              ? "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                              : "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300",
                        )}
                      >
                        {p.status}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
