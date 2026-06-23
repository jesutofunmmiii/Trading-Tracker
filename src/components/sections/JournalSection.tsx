"use client";

// Data sources: premarket_entries, postmarket_entries, trades (activity map via journal.ts).
// Calendar is the primary view — clicking a day opens that day's Pre-Market + Post-Market panels.
// Pre-market and post-market internals are placeholder stubs; built in the next step.

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  BarChart2,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Sun,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  journalKeys,
  fetchJournalActivityForMonth,
} from "@/lib/queries/journal";
import { PreMarketPanel } from "@/components/sections/PreMarketPanel";

// ── Date helpers ──────────────────────────────────────────────────────────────

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function isoDate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function formatDisplayDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function monthLabel(year: number, month: number): string {
  return new Date(year, month - 1, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

function buildCalendarGrid(year: number, month: number): (number | null)[] {
  const firstDow = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const cells: (number | null)[] = Array(firstDow).fill(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  return cells;
}

const DAYS_OF_WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// ── JournalSection ────────────────────────────────────────────────────────────

export function JournalSection() {
  const today = todayStr();
  const todayYear = new Date().getFullYear();
  const todayMonth = new Date().getMonth() + 1;

  const [calYear, setCalYear] = useState(todayYear);
  const [calMonth, setCalMonth] = useState(todayMonth);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedPanel, setSelectedPanel] = useState<
    "premarket" | "postmarket" | null
  >(null);

  const atCurrentMonth = calYear === todayYear && calMonth === todayMonth;

  // ── Activity query ─────────────────────────────────────────────────────────
  const {
    data: activityMap,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: journalKeys.activityByMonth(calYear, calMonth),
    queryFn: () => fetchJournalActivityForMonth(calYear, calMonth),
  });

  // ── Month navigation ───────────────────────────────────────────────────────
  function prevMonth() {
    setSelectedDate(null);
    setSelectedPanel(null);
    if (calMonth === 1) { setCalYear((y) => y - 1); setCalMonth(12); }
    else setCalMonth((m) => m - 1);
  }

  function nextMonth() {
    if (atCurrentMonth) return;
    setSelectedDate(null);
    setSelectedPanel(null);
    if (calMonth === 12) { setCalYear((y) => y + 1); setCalMonth(1); }
    else setCalMonth((m) => m + 1);
  }

  // ── Error state ────────────────────────────────────────────────────────────
  if (isError) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-red-500/30 bg-red-500/10 p-12 text-center">
        <AlertTriangle className="h-7 w-7 text-red-400" />
        <p className="font-medium text-red-200">Couldn&apos;t load journal data</p>
        <p className="mt-1 text-sm text-red-300/80">
          {error instanceof Error ? error.message : "Unknown error"}
        </p>
      </div>
    );
  }

  // ── Main render ────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gold-500/15 ring-1 ring-gold-500/25">
          <BookOpen className="h-5 w-5 text-gold-400" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-navy-50">Trading Journal</h1>
          <p className="mt-1 text-sm text-navy-400">
            Click any day to open that day&apos;s pre-market analysis and post-market log.
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {/* Month navigation */}
        <div className="flex items-center justify-between gap-2">
          <button
            onClick={prevMonth}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-navy-700 text-navy-400 transition-colors hover:border-navy-600 hover:text-navy-200"
            aria-label="Previous month"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-sm font-semibold text-navy-100">
            {monthLabel(calYear, calMonth)}
          </span>
          <button
            onClick={nextMonth}
            disabled={atCurrentMonth}
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-lg border transition-colors",
              atCurrentMonth
                ? "cursor-not-allowed border-navy-800 text-navy-700"
                : "border-navy-700 text-navy-400 hover:border-navy-600 hover:text-navy-200"
            )}
            aria-label="Next month"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        {/* Weekday headers */}
        <div className="grid grid-cols-7 gap-1.5">
          {DAYS_OF_WEEK.map((dow) => (
            <div
              key={dow}
              className="py-1 text-center font-mono text-[10px] font-medium uppercase tracking-wider text-navy-600"
            >
              {dow}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-8 text-navy-400">
            <Loader2 className="h-4 w-4 animate-spin text-gold-500" />
            Loading…
          </div>
        ) : (
          <div className="grid grid-cols-7 gap-1.5">
            {buildCalendarGrid(calYear, calMonth).map((day, idx) => {
              if (day === null) return <div key={`empty-${idx}`} />;

              const dateStr = isoDate(calYear, calMonth, day);
              const isFuture = dateStr > today;
              const isToday = dateStr === today;
              const isSelected = selectedDate === dateStr;
              const activity = activityMap?.get(dateStr);
              const hasPremarket = activity?.hasPremarket ?? false;
              const hasPostmarket = activity?.hasPostmarket ?? false;
              const tradeCount = activity?.tradeCount ?? 0;
              const hasActivity = hasPremarket || hasPostmarket || tradeCount > 0;

              return (
                <button
                  key={dateStr}
                  onClick={() => {
                    if (isFuture) return;
                    const next = selectedDate === dateStr ? null : dateStr;
                    setSelectedDate(next);
                    setSelectedPanel(null);
                  }}
                  aria-label={`${dateStr}${hasActivity ? " — has journal entries" : ""}`}
                  aria-pressed={isSelected}
                  className={cn(
                    "relative aspect-square w-full rounded-lg border transition-all duration-150 focus-visible:outline-none",
                    isFuture
                      ? "cursor-not-allowed border-navy-800/50 bg-navy-800/20 opacity-35"
                      : isSelected
                      ? "cursor-pointer border-gold-400/60 bg-gold-500/20 ring-2 ring-gold-400/60"
                      : isToday
                      ? "cursor-pointer border-gold-500/50 bg-gold-500/10 ring-1 ring-gold-500/40 hover:bg-gold-500/15"
                      : hasActivity
                      ? "cursor-pointer border-navy-600 bg-navy-800/70 hover:bg-navy-700/60"
                      : "cursor-pointer border-navy-700/50 bg-navy-800/40 hover:bg-navy-700/50"
                  )}
                >
                  {/* Day number */}
                  <span
                    className={cn(
                      "absolute inset-0 flex items-center justify-center font-mono text-[11px] font-bold leading-none",
                      isFuture
                        ? "text-navy-700"
                        : isToday
                        ? "text-gold-300"
                        : isSelected
                        ? "text-gold-200"
                        : "text-navy-300"
                    )}
                  >
                    {day}
                  </span>

                  {/* Activity dots — visible only when at least one entry type exists */}
                  {hasActivity && !isFuture && (
                    <div className="absolute bottom-[3px] left-0 right-0 flex justify-center gap-[3px]">
                      {hasPremarket && (
                        <span className="h-1 w-1 rounded-full bg-gold-400" />
                      )}
                      {hasPostmarket && (
                        <span className="h-1 w-1 rounded-full bg-sky-400" />
                      )}
                      {tradeCount > 0 && (
                        <span className="h-1 w-1 rounded-full bg-emerald-400" />
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Legend */}
        <div className="flex flex-wrap gap-3 text-[11px] text-navy-500">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-gold-400/80" />
            Pre-market entry
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-sky-400/80" />
            Post-market entry
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-400/80" />
            Trades logged
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm border border-gold-500/40 bg-gold-500/15" />
            Today
          </span>
        </div>

        {/* ── Day detail panel ───────────────────────────────────────────────── */}
        {selectedDate && (
          <div className="space-y-4 border-t border-navy-700 pt-5">
            {/* Panel header */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                {selectedPanel && (
                  <button
                    onClick={() => setSelectedPanel(null)}
                    className="text-navy-500 transition-colors hover:text-navy-300"
                    aria-label="Back to day overview"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                )}
                <div>
                  <p className="font-semibold text-navy-100">
                    {formatDisplayDate(selectedDate)}
                  </p>
                  <p className="mt-0.5 text-xs text-navy-500">
                    {(() => {
                      const a = activityMap?.get(selectedDate);
                      const parts: string[] = [];
                      if (a?.hasPremarket) parts.push("pre-market");
                      if (a?.hasPostmarket) parts.push("post-market");
                      if ((a?.tradeCount ?? 0) > 0)
                        parts.push(
                          `${a!.tradeCount} trade${a!.tradeCount === 1 ? "" : "s"}`
                        );
                      return parts.length > 0
                        ? parts.join(" · ")
                        : "No entries yet";
                    })()}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedDate(null)}
                className="mt-0.5 text-navy-500 transition-colors hover:text-navy-300"
                aria-label="Close day detail"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Two-panel chooser or selected panel */}
            {selectedPanel === null ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {/* Pre-Market card */}
                <button
                  onClick={() => setSelectedPanel("premarket")}
                  className="group rounded-xl border border-navy-700 bg-navy-800/60 p-5 text-left transition-all hover:border-gold-500/40 hover:bg-navy-800/80"
                >
                  <div className="mb-3 flex items-center gap-2">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gold-500/15 transition-colors group-hover:bg-gold-500/25">
                      <Sun className="h-4 w-4 text-gold-400" />
                    </div>
                    <h3 className="text-sm font-semibold text-navy-100">
                      Pre-Market Analysis
                    </h3>
                    {activityMap?.get(selectedDate)?.hasPremarket && (
                      <span className="ml-auto shrink-0 rounded-full bg-gold-500/20 px-2 py-0.5 text-[10px] font-medium text-gold-400">
                        Entry exists
                      </span>
                    )}
                  </div>
                  <p className="text-sm leading-relaxed text-navy-500 transition-colors group-hover:text-navy-400">
                    Timeframe screenshots, news events, and session analysis.
                  </p>
                  <div className="mt-3 flex items-center gap-1 text-xs font-medium text-gold-400/50 transition-colors group-hover:text-gold-400">
                    Open
                    <ChevronRight className="h-3.5 w-3.5" />
                  </div>
                </button>

                {/* Post-Market card */}
                <button
                  onClick={() => setSelectedPanel("postmarket")}
                  className="group rounded-xl border border-navy-700 bg-navy-800/60 p-5 text-left transition-all hover:border-sky-500/30 hover:bg-navy-800/80"
                >
                  <div className="mb-3 flex items-center gap-2">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-navy-700/60 transition-colors group-hover:bg-sky-500/15">
                      <BarChart2 className="h-4 w-4 text-navy-400 transition-colors group-hover:text-sky-400" />
                    </div>
                    <h3 className="text-sm font-semibold text-navy-100">
                      Post-Market Log
                    </h3>
                    {(() => {
                      const a = activityMap?.get(selectedDate);
                      const hasPost =
                        a?.hasPostmarket || (a?.tradeCount ?? 0) > 0;
                      if (!hasPost) return null;
                      const label =
                        (a?.tradeCount ?? 0) > 0
                          ? `${a!.tradeCount} trade${a!.tradeCount === 1 ? "" : "s"}`
                          : "Entry exists";
                      return (
                        <span className="ml-auto shrink-0 rounded-full bg-sky-500/20 px-2 py-0.5 text-[10px] font-medium text-sky-400">
                          {label}
                        </span>
                      );
                    })()}
                  </div>
                  <p className="text-sm leading-relaxed text-navy-500 transition-colors group-hover:text-navy-400">
                    Trade log, follow-up screenshots, and session review.
                  </p>
                  <div className="mt-3 flex items-center gap-1 text-xs font-medium text-sky-400/50 transition-colors group-hover:text-sky-400">
                    Open
                    <ChevronRight className="h-3.5 w-3.5" />
                  </div>
                </button>
              </div>
            ) : selectedPanel === "premarket" ? (
              <PreMarketPanel date={selectedDate} />
            ) : (
              /* Post-market placeholder */
              <div className="rounded-xl border border-navy-700 bg-navy-800/60 p-5">
                <div className="mb-3 flex items-center gap-2">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-navy-700/60">
                    <BarChart2 className="h-4 w-4 text-navy-400" />
                  </div>
                  <h3 className="text-sm font-semibold text-navy-100">
                    Post-Market Log
                  </h3>
                </div>
                <p className="text-sm leading-relaxed text-navy-500">
                  Trade log (pair, P&L, session, entry type), follow-up
                  screenshots, and post-market review — coming in the next build
                  step.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
