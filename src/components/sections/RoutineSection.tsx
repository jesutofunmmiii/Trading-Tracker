"use client";

// Data sources: routine_items (order_index, title — static seed),
// routine_completions (completed, note, completion_date).
//
// Two queries run simultaneously:
//   1. completions(WINDOW=90) — drives streak, adherence, and today's checklist.
//   2. completionsByMonth(year, month) — drives the calendar grid and day-detail
//      checklist when calendar view is active.
//
// Date boundary: browser local date (getFullYear/Month/Date), consistent across
// both views.  Glow rules: GREEN = all 8 done; RED = past day with ≥1 completed
// but not all 8; neutral otherwise (no data, today, future).

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchRoutineItems,
  fetchRecentCompletions,
  fetchCompletionsForMonth,
  upsertCompletion,
  routineKeys,
  localDateStr,
  type CompletionUpsertValues,
} from "@/lib/queries/routine";
import type { RoutineItem, RoutineCompletion } from "@/lib/types";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Circle,
  Flame,
  Loader2,
  StickyNote,
  TrendingUp,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

const WINDOW = 90;
const DAYS_OF_WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// ── Date helpers ──────────────────────────────────────────────────────────────

function todayLocalDate(): string {
  return localDateStr(new Date());
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
  });
}

function monthLabel(year: number, month: number): string {
  return new Date(year, month - 1, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

// Returns array of day numbers (1–N) padded with nulls for leading empty cells.
function buildCalendarGrid(year: number, month: number): (number | null)[] {
  const firstDow = new Date(year, month - 1, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, month, 0).getDate();
  const cells: (number | null)[] = Array(firstDow).fill(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  return cells;
}

// ── Stats helpers ─────────────────────────────────────────────────────────────

function buildCompletedCountByDate(completions: RoutineCompletion[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const c of completions) {
    if (c.completed) map.set(c.completion_date, (map.get(c.completion_date) ?? 0) + 1);
  }
  return map;
}

function computeStreak(byDate: Map<string, number>, itemCount: number, today: string): number {
  if (itemCount === 0) return 0;
  const d = new Date(today + "T00:00:00");
  if ((byDate.get(today) ?? 0) < itemCount) d.setDate(d.getDate() - 1);
  let streak = 0;
  for (let i = 0; i < WINDOW; i++) {
    if ((byDate.get(localDateStr(d)) ?? 0) >= itemCount) {
      streak++;
      d.setDate(d.getDate() - 1);
    } else break;
  }
  return streak;
}

function compute30DayAdherence(
  completions: RoutineCompletion[],
  itemCount: number,
  today: string
): number {
  if (itemCount === 0) return 0;
  const cutoff = new Date(today + "T00:00:00");
  cutoff.setDate(cutoff.getDate() - 29);
  const cutoffStr = localDateStr(cutoff);
  const count = completions.filter((c) => c.completed && c.completion_date >= cutoffStr).length;
  return Math.round((count / (itemCount * 30)) * 100);
}

// ── RoutineSection ────────────────────────────────────────────────────────────

export function RoutineSection() {
  const queryClient = useQueryClient();
  const today = todayLocalDate();
  const todayYear = new Date().getFullYear();
  const todayMonthNum = new Date().getMonth() + 1;

  // ── View & calendar state ──────────────────────────────────────────────────
  const [activeView, setActiveView] = useState<"today" | "calendar">("today");
  const [calYear, setCalYear] = useState(todayYear);
  const [calMonth, setCalMonth] = useState(todayMonthNum);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // ── Shared note/toggle state ───────────────────────────────────────────────
  // Notes are keyed by "${itemId}:${date}" so today and calendar share one map.
  const [expandedNoteKey, setExpandedNoteKey] = useState<string | null>(null);
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [pendingToggleIds, setPendingToggleIds] = useState<Set<string>>(new Set());
  const [savingNoteKey, setSavingNoteKey] = useState<string | null>(null);
  const [savedFlashKey, setSavedFlashKey] = useState<string | null>(null);
  const [toggleError, setToggleError] = useState<string | null>(null);
  const [noteError, setNoteError] = useState<string | null>(null);

  // ── Queries ────────────────────────────────────────────────────────────────
  const {
    data: items = [],
    isLoading: itemsLoading,
    isError: itemsError,
    error: itemsErr,
  } = useQuery({
    queryKey: routineKeys.items,
    queryFn: fetchRoutineItems,
    staleTime: Infinity,
  });

  const {
    data: completions = [],
    isLoading: completionsLoading,
    isError: completionsError,
    error: completionsErr,
  } = useQuery({
    queryKey: routineKeys.completions(WINDOW),
    queryFn: () => fetchRecentCompletions(WINDOW),
  });

  const {
    data: calCompletions = [],
    isLoading: calLoading,
  } = useQuery({
    queryKey: routineKeys.completionsByMonth(calYear, calMonth),
    queryFn: () => fetchCompletionsForMonth(calYear, calMonth),
    enabled: activeView === "calendar",
  });

  // ── Derived ────────────────────────────────────────────────────────────────
  const todayStatusMap = new Map<string, RoutineCompletion>();
  for (const c of completions) {
    if (c.completion_date === today) todayStatusMap.set(c.routine_item_id, c);
  }

  const todayCount = items.filter((i) => todayStatusMap.get(i.id)?.completed === true).length;
  const byDate90 = buildCompletedCountByDate(completions);
  const streak = computeStreak(byDate90, items.length, today);
  const adherence = compute30DayAdherence(completions, items.length, today);
  const todayProgress = items.length > 0 ? Math.round((todayCount / items.length) * 100) : 0;
  const allDoneToday = todayCount > 0 && todayCount === items.length;

  // Calendar-view derived
  const calByDate = buildCompletedCountByDate(calCompletions);
  const calStatusMap = new Map<string, RoutineCompletion>();
  if (selectedDate) {
    for (const c of calCompletions) {
      if (c.completion_date === selectedDate) calStatusMap.set(c.routine_item_id, c);
    }
  }
  const atCurrentMonth = calYear === todayYear && calMonth === todayMonthNum;

  // ── Helpers shared by both mutations ──────────────────────────────────────

  function applyOptimisticUpdate(
    old: RoutineCompletion[] = [],
    vals: CompletionUpsertValues
  ): RoutineCompletion[] {
    const exists = old.find(
      (c) =>
        c.routine_item_id === vals.routine_item_id &&
        c.completion_date === vals.completion_date
    );
    if (exists) {
      return old.map((c) =>
        c.routine_item_id === vals.routine_item_id &&
        c.completion_date === vals.completion_date
          ? { ...c, completed: vals.completed, note: vals.note }
          : c
      );
    }
    return [
      ...old,
      {
        id: crypto.randomUUID(),
        user_id: "optimistic",
        routine_item_id: vals.routine_item_id,
        completion_date: vals.completion_date,
        completed: vals.completed,
        note: vals.note,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];
  }

  // ── Toggle mutation ────────────────────────────────────────────────────────
  const toggleMutation = useMutation({
    mutationFn: (vals: CompletionUpsertValues) => upsertCompletion(vals),

    onMutate: async (vals) => {
      setPendingToggleIds((p) => new Set(p).add(vals.routine_item_id));
      setToggleError(null);
      await queryClient.cancelQueries({ queryKey: routineKeys.completions(WINDOW) });
      await queryClient.cancelQueries({
        queryKey: routineKeys.completionsByMonth(calYear, calMonth),
      });
      const prevWindow = queryClient.getQueryData<RoutineCompletion[]>(
        routineKeys.completions(WINDOW)
      );
      const prevMonth = queryClient.getQueryData<RoutineCompletion[]>(
        routineKeys.completionsByMonth(calYear, calMonth)
      );
      queryClient.setQueryData<RoutineCompletion[]>(routineKeys.completions(WINDOW), (old) =>
        applyOptimisticUpdate(old, vals)
      );
      queryClient.setQueryData<RoutineCompletion[]>(
        routineKeys.completionsByMonth(calYear, calMonth),
        (old) => applyOptimisticUpdate(old, vals)
      );
      return { prevWindow, prevMonth };
    },

    onError: (err, vals, ctx) => {
      if (ctx?.prevWindow)
        queryClient.setQueryData(routineKeys.completions(WINDOW), ctx.prevWindow);
      if (ctx?.prevMonth)
        queryClient.setQueryData(
          routineKeys.completionsByMonth(calYear, calMonth),
          ctx.prevMonth
        );
      setToggleError(err instanceof Error ? err.message : "Failed to update item");
      setPendingToggleIds((p) => {
        const n = new Set(p);
        n.delete(vals.routine_item_id);
        return n;
      });
    },

    onSuccess: (_, vals) => {
      setPendingToggleIds((p) => {
        const n = new Set(p);
        n.delete(vals.routine_item_id);
        return n;
      });
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: routineKeys.completions(WINDOW) });
      queryClient.invalidateQueries({
        queryKey: routineKeys.completionsByMonth(calYear, calMonth),
      });
    },
  });

  // ── Note mutation ──────────────────────────────────────────────────────────
  const noteMutation = useMutation({
    mutationFn: (vals: CompletionUpsertValues) => upsertCompletion(vals),

    onSuccess: (_, vals) => {
      const nk = `${vals.routine_item_id}:${vals.completion_date}`;
      setSavingNoteKey(null);
      setNoteError(null);
      setNoteDrafts((p) => ({ ...p, [nk]: vals.note ?? "" }));
      setSavedFlashKey(nk);
      setTimeout(() => setSavedFlashKey((c) => (c === nk ? null : c)), 2000);
      queryClient.invalidateQueries({ queryKey: routineKeys.completions(WINDOW) });
      queryClient.invalidateQueries({
        queryKey: routineKeys.completionsByMonth(calYear, calMonth),
      });
    },

    onError: (err) => {
      setSavingNoteKey(null);
      setNoteError(err instanceof Error ? err.message : "Failed to save note");
    },
  });

  // ── Shared handlers ────────────────────────────────────────────────────────
  function handleToggle(item: RoutineItem, date: string, statusMap: Map<string, RoutineCompletion>) {
    const c = statusMap.get(item.id);
    toggleMutation.mutate({
      routine_item_id: item.id,
      completion_date: date,
      completed: !(c?.completed ?? false),
      note: c?.note ?? null,
    });
  }

  function handleNoteToggle(
    itemId: string,
    date: string,
    statusMap: Map<string, RoutineCompletion>
  ) {
    const nk = `${itemId}:${date}`;
    if (expandedNoteKey === nk) { setExpandedNoteKey(null); return; }
    setNoteDrafts((p) => {
      if (nk in p) return p;
      return { ...p, [nk]: statusMap.get(itemId)?.note ?? "" };
    });
    setExpandedNoteKey(nk);
  }

  function handleNoteSave(
    itemId: string,
    date: string,
    statusMap: Map<string, RoutineCompletion>
  ) {
    const nk = `${itemId}:${date}`;
    const c = statusMap.get(itemId);
    setSavingNoteKey(nk);
    noteMutation.mutate({
      routine_item_id: itemId,
      completion_date: date,
      completed: c?.completed ?? false,
      note: noteDrafts[nk] || null,
    });
  }

  // ── Month navigation ───────────────────────────────────────────────────────
  function prevMonth() {
    setSelectedDate(null);
    if (calMonth === 1) { setCalYear((y) => y - 1); setCalMonth(12); }
    else setCalMonth((m) => m - 1);
  }

  function nextMonth() {
    if (atCurrentMonth) return; // can't go past present
    setSelectedDate(null);
    if (calMonth === 12) { setCalYear((y) => y + 1); setCalMonth(1); }
    else setCalMonth((m) => m + 1);
  }

  function handleDaySelect(dateStr: string) {
    setSelectedDate((prev) => (prev === dateStr ? null : dateStr));
    setExpandedNoteKey(null);
  }

  // ── Loading ────────────────────────────────────────────────────────────────
  if (itemsLoading || completionsLoading) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-xl border border-navy-700 bg-navy-800/50 p-12 text-navy-300">
        <Loader2 className="h-5 w-5 animate-spin text-gold-500" />
        Loading routine…
      </div>
    );
  }

  if (itemsError || completionsError) {
    const msg =
      (itemsErr instanceof Error ? itemsErr.message : null) ??
      (completionsErr instanceof Error ? completionsErr.message : null) ??
      "Unknown error";
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-red-500/30 bg-red-500/10 p-12 text-center">
        <AlertTriangle className="h-7 w-7 text-red-400" />
        <p className="font-medium text-red-200">Couldn&apos;t load routine</p>
        <p className="mt-1 text-sm text-red-300/80">{msg}</p>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-navy-600 bg-navy-800/50 p-12 text-center">
        <CheckCircle2 className="h-7 w-7 text-gold-500" />
        <p className="text-navy-300">
          No routine items found. Run the seed migration to populate the 8 items.
        </p>
      </div>
    );
  }

  // ── Checklist renderer (shared by today view and day-detail) ───────────────
  function renderChecklist(
    date: string,
    statusMap: Map<string, RoutineCompletion>
  ) {
    return (
      <div className="space-y-2">
        {items.map((item) => {
          const completion = statusMap.get(item.id);
          const checked = completion?.completed ?? false;
          const savedNote = completion?.note ?? "";
          const nk = `${item.id}:${date}`;
          const isExpanded = expandedNoteKey === nk;
          const draft = nk in noteDrafts ? noteDrafts[nk] : savedNote;
          const draftChanged = draft !== savedNote;
          const isTogglePending = pendingToggleIds.has(item.id);
          const isSavingNote = savingNoteKey === nk;
          const showFlash = savedFlashKey === nk;

          return (
            <div
              key={item.id}
              className={cn(
                "rounded-xl border transition-colors duration-150",
                checked ? "border-emerald-500/25 bg-emerald-500/5" : "border-navy-700 bg-navy-800/60"
              )}
            >
              <div className="flex items-center gap-3 px-4 py-3">
                <button
                  onClick={() => handleToggle(item, date, statusMap)}
                  disabled={isTogglePending}
                  aria-label={checked ? `Uncheck: ${item.title}` : `Complete: ${item.title}`}
                  aria-pressed={checked}
                  className={cn(
                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition-all",
                    "disabled:pointer-events-none disabled:opacity-50",
                    checked ? "text-emerald-400" : "text-navy-600 hover:text-gold-500/70"
                  )}
                >
                  {isTogglePending ? (
                    <Loader2 className="h-4 w-4 animate-spin text-gold-400" />
                  ) : checked ? (
                    <CheckCircle2 className="h-5 w-5" />
                  ) : (
                    <Circle className="h-5 w-5" />
                  )}
                </button>

                <span className="w-5 shrink-0 font-mono text-xs text-navy-600">
                  {String(item.order_index).padStart(2, "0")}
                </span>

                <span
                  className={cn(
                    "flex-1 text-sm font-medium leading-snug",
                    checked ? "text-emerald-200 line-through decoration-emerald-500/40" : "text-navy-100"
                  )}
                >
                  {item.title}
                </span>

                <button
                  onClick={() => handleNoteToggle(item.id, date, statusMap)}
                  aria-label={isExpanded ? "Close note" : savedNote ? "View / edit note" : "Add note"}
                  title={savedNote && !isExpanded ? savedNote.slice(0, 60) : undefined}
                  className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors",
                    isExpanded
                      ? "bg-navy-600 text-navy-200 hover:bg-navy-500"
                      : savedNote
                      ? "text-gold-400/80 hover:bg-navy-700 hover:text-gold-400"
                      : "text-navy-700 hover:bg-navy-700 hover:text-navy-400"
                  )}
                >
                  {isExpanded ? <X className="h-3.5 w-3.5" /> : <StickyNote className="h-3.5 w-3.5" />}
                </button>
              </div>

              {isExpanded && (
                <div className="border-t border-navy-700 px-4 pb-3.5 pt-3">
                  <textarea
                    value={draft}
                    onChange={(e) =>
                      setNoteDrafts((p) => ({ ...p, [nk]: e.target.value }))
                    }
                    placeholder="Add a reflection note…"
                    rows={2}
                    maxLength={1000}
                    className={cn(
                      "w-full resize-none rounded-lg border border-navy-700 bg-navy-900/60 px-3 py-2",
                      "text-sm text-navy-100 placeholder:text-navy-600",
                      "focus:border-gold-500/40 focus:outline-none focus:ring-1 focus:ring-gold-500/20",
                      "transition-colors"
                    )}
                  />
                  <div className="mt-2 flex items-center justify-end gap-2">
                    {showFlash && (
                      <span className="flex items-center gap-1 text-xs text-emerald-400">
                        <CheckCircle2 className="h-3 w-3" /> Saved
                      </span>
                    )}
                    {draftChanged && !showFlash && (
                      <button
                        onClick={() => handleNoteSave(item.id, date, statusMap)}
                        disabled={isSavingNote}
                        className={cn(
                          "flex items-center gap-1 rounded px-2.5 py-1 text-xs font-medium transition-colors",
                          "bg-gold-500/20 text-gold-300 hover:bg-gold-500/30",
                          "disabled:pointer-events-none disabled:opacity-50"
                        )}
                      >
                        {isSavingNote ? (
                          <><Loader2 className="h-3 w-3 animate-spin" /> Saving…</>
                        ) : "Save note"}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  // ── Main render ────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-navy-50">Daily Routine</h1>
            <p className="mt-0.5 text-sm text-navy-400">{formatDisplayDate(today)}</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <span className={cn("text-2xl font-bold tabular-nums", allDoneToday ? "text-emerald-400" : "text-gold-400")}>
                {todayCount}
              </span>
              <span className="text-sm text-navy-400"> / {items.length}</span>
              <p className="text-xs text-navy-500">today</p>
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-2 w-full overflow-hidden rounded-full bg-navy-700">
          <div
            className={cn("h-full rounded-full transition-all duration-500", allDoneToday ? "bg-emerald-500" : "bg-gold-500")}
            style={{ width: `${todayProgress}%` }}
          />
        </div>

        {/* Stats + view toggle */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-2">
            <div className={cn(
              "flex items-center gap-1.5 rounded-lg border px-3 py-1.5",
              streak > 0 ? "border-gold-500/30 bg-gold-500/10" : "border-navy-700 bg-navy-800/50"
            )}>
              <Flame className={cn("h-4 w-4", streak > 0 ? "text-gold-400" : "text-navy-600")} />
              <span className={cn("text-sm font-semibold tabular-nums", streak > 0 ? "text-gold-300" : "text-navy-500")}>
                {streak}
              </span>
              <span className="text-xs text-navy-500">day streak</span>
            </div>

            <div className="flex items-center gap-1.5 rounded-lg border border-navy-700 bg-navy-800/50 px-3 py-1.5">
              <TrendingUp className="h-4 w-4 text-navy-500" />
              <span className={cn(
                "text-sm font-semibold tabular-nums",
                adherence >= 80 ? "text-emerald-400" : adherence >= 50 ? "text-gold-400" : "text-navy-400"
              )}>
                {adherence}%
              </span>
              <span className="text-xs text-navy-500">30-day</span>
            </div>
          </div>

          {/* View toggle */}
          <div className="flex rounded-lg border border-navy-700 bg-navy-800/60 p-0.5">
            <button
              onClick={() => setActiveView("today")}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                activeView === "today"
                  ? "bg-navy-600 text-navy-100"
                  : "text-navy-400 hover:text-navy-200"
              )}
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              Today
            </button>
            <button
              onClick={() => setActiveView("calendar")}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                activeView === "calendar"
                  ? "bg-navy-600 text-navy-100"
                  : "text-navy-400 hover:text-navy-200"
              )}
            >
              <CalendarDays className="h-3.5 w-3.5" />
              Month
            </button>
          </div>
        </div>
      </div>

      {/* Inline errors */}
      {toggleError && (
        <div className="flex items-center gap-3 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          <AlertTriangle className="h-4 w-4 shrink-0 text-red-400" />
          <span className="flex-1">{toggleError}</span>
          <button onClick={() => setToggleError(null)} className="shrink-0 text-red-400 transition-colors hover:text-red-200" aria-label="Dismiss">✕</button>
        </div>
      )}
      {noteError && (
        <div className="flex items-center gap-3 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          <AlertTriangle className="h-4 w-4 shrink-0 text-red-400" />
          <span className="flex-1">{noteError}</span>
          <button onClick={() => setNoteError(null)} className="shrink-0 text-red-400 transition-colors hover:text-red-200" aria-label="Dismiss">✕</button>
        </div>
      )}

      {/* ── TODAY VIEW ── */}
      {activeView === "today" && (
        <>
          {renderChecklist(today, todayStatusMap)}
          {allDoneToday && (
            <div className="flex items-center justify-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 py-4">
              <CheckCircle2 className="h-5 w-5 text-emerald-400" />
              <span className="font-medium text-emerald-300">Full routine complete for today!</span>
            </div>
          )}
        </>
      )}

      {/* ── CALENDAR VIEW ── */}
      {activeView === "calendar" && (
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
            <span className="text-sm font-semibold text-navy-100">{monthLabel(calYear, calMonth)}</span>
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
          <div className="grid grid-cols-7 gap-1">
            {DAYS_OF_WEEK.map((dow) => (
              <div key={dow} className="py-1 text-center font-mono text-[10px] font-medium uppercase tracking-wider text-navy-600">
                {dow}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          {calLoading ? (
            <div className="flex items-center justify-center gap-2 py-8 text-navy-400">
              <Loader2 className="h-4 w-4 animate-spin text-gold-500" />
              Loading…
            </div>
          ) : (
            <div className="grid grid-cols-7 gap-1">
              {buildCalendarGrid(calYear, calMonth).map((day, idx) => {
                if (day === null) {
                  return <div key={`empty-${idx}`} />;
                }

                const dateStr = isoDate(calYear, calMonth, day);
                const isFuture = dateStr > today;
                const isToday = dateStr === today;
                const isPast = dateStr < today;
                const completedCount = calByDate.get(dateStr) ?? 0;
                const allDone = completedCount > 0 && completedCount >= items.length;
                const hasAny = completedCount > 0;
                const isSelected = selectedDate === dateStr;

                return (
                  <button
                    key={dateStr}
                    onClick={() => !isFuture && handleDaySelect(dateStr)}
                    disabled={isFuture}
                    aria-label={`${dateStr}${completedCount > 0 ? `, ${completedCount}/${items.length} completed` : ""}`}
                    aria-pressed={isSelected}
                    className={cn(
                      "min-h-[44px] rounded-lg border p-1.5 text-left transition-all duration-150",
                      isFuture
                        ? "cursor-not-allowed border-navy-800/50 bg-navy-800/20 opacity-35"
                        : isSelected
                        ? "cursor-pointer border-gold-400/60 bg-gold-500/20 ring-2 ring-gold-400/60"
                        : isToday
                        ? "cursor-pointer border-gold-500/50 bg-gold-500/10 ring-1 ring-gold-500/40 hover:bg-gold-500/15"
                        : allDone
                        ? "cursor-pointer border-emerald-500/40 bg-emerald-500/10 ring-1 ring-emerald-500/30 hover:bg-emerald-500/15"
                        : isPast && hasAny
                        ? "cursor-pointer border-red-500/40 bg-red-500/10 ring-1 ring-red-500/30 hover:bg-red-500/15"
                        : "cursor-pointer border-navy-700 bg-navy-800/50 hover:bg-navy-700/60"
                    )}
                  >
                    <span className={cn(
                      "block font-mono text-xs font-semibold leading-none",
                      isToday ? "text-gold-300" : isSelected ? "text-gold-200" : "text-navy-300"
                    )}>
                      {day}
                    </span>
                    {hasAny && (
                      <span className={cn(
                        "mt-1 block text-[9px] font-medium leading-none",
                        allDone ? "text-emerald-400" : "text-navy-500"
                      )}>
                        {completedCount}/{items.length}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* Legend */}
          <div className="flex flex-wrap gap-3 text-[11px] text-navy-500">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm border border-emerald-500/40 bg-emerald-500/20" />
              All 8 done
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm border border-red-500/40 bg-red-500/20" />
              Incomplete (has data)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm border border-gold-500/40 bg-gold-500/15" />
              Today
            </span>
          </div>

          {/* Day detail panel */}
          {selectedDate && (
            <div className="space-y-3 border-t border-navy-700 pt-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-navy-100">
                    {formatDisplayDate(selectedDate)}
                  </p>
                  {(() => {
                    const cnt = calByDate.get(selectedDate) ?? 0;
                    return (
                      <p className={cn(
                        "text-xs",
                        cnt === items.length && cnt > 0 ? "text-emerald-400" : "text-navy-500"
                      )}>
                        {cnt} / {items.length} completed
                      </p>
                    );
                  })()}
                </div>
                <button
                  onClick={() => setSelectedDate(null)}
                  className="text-navy-500 transition-colors hover:text-navy-300"
                  aria-label="Close day detail"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              {renderChecklist(selectedDate, calStatusMap)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
