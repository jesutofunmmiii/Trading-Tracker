"use client";

// Data sources: routine_items (order_index, title — static seed),
// routine_completions (completed, note, completion_date — last 90 days).
//
// Date boundary: completion_date uses the browser's local calendar date so
// "today" flips at the user's device midnight, not UTC midnight.
// Missed days = no completed row for that date; no cleanup needed.
// Streak = consecutive full days (all items done) ending at the last complete day.
// Unchecking upserts completed=false (preserves the note).

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchRoutineItems,
  fetchRecentCompletions,
  upsertCompletion,
  routineKeys,
  localDateStr,
  type CompletionUpsertValues,
} from "@/lib/queries/routine";
import type { RoutineItem, RoutineCompletion } from "@/lib/types";
import {
  AlertTriangle,
  CheckCircle2,
  Circle,
  Flame,
  Loader2,
  StickyNote,
  TrendingUp,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

const WINDOW = 90; // days of history to fetch (covers streak + 30-day adherence)

// ── Date helpers ──────────────────────────────────────────────────────────────

function todayLocalDate(): string {
  return localDateStr(new Date());
}

function formatDisplayDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
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
  // If today isn't yet fully complete, start counting from yesterday
  if ((byDate.get(today) ?? 0) < itemCount) d.setDate(d.getDate() - 1);
  let streak = 0;
  for (let i = 0; i < WINDOW; i++) {
    if ((byDate.get(localDateStr(d)) ?? 0) >= itemCount) {
      streak++;
      d.setDate(d.getDate() - 1);
    } else {
      break;
    }
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
  // Re-derived each render so date updates correctly on page refresh
  const today = todayLocalDate();

  // ── Local state ────────────────────────────────────────────────────────────
  const [expandedNoteId, setExpandedNoteId] = useState<string | null>(null);
  // Draft note text keyed by routine_item_id; lazy-initialised when note first opened
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [pendingToggleIds, setPendingToggleIds] = useState<Set<string>>(new Set());
  const [savingNoteId, setSavingNoteId] = useState<string | null>(null);
  const [savedFlashId, setSavedFlashId] = useState<string | null>(null);
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

  // ── Derived ────────────────────────────────────────────────────────────────
  const todayStatusMap = new Map<string, RoutineCompletion>();
  for (const c of completions) {
    if (c.completion_date === today) todayStatusMap.set(c.routine_item_id, c);
  }

  const todayCount = items.filter(
    (item) => todayStatusMap.get(item.id)?.completed === true
  ).length;
  const byDate = buildCompletedCountByDate(completions);
  const streak = computeStreak(byDate, items.length, today);
  const adherence = compute30DayAdherence(completions, items.length, today);
  const todayProgress = items.length > 0 ? Math.round((todayCount / items.length) * 100) : 0;
  const allDoneToday = todayCount > 0 && todayCount === items.length;

  // ── Toggle mutation (optimistic) ───────────────────────────────────────────
  const toggleMutation = useMutation({
    mutationFn: (vals: CompletionUpsertValues) => upsertCompletion(vals),

    onMutate: async (vals) => {
      setPendingToggleIds((prev) => new Set(prev).add(vals.routine_item_id));
      setToggleError(null);
      await queryClient.cancelQueries({ queryKey: routineKeys.completions(WINDOW) });
      const previous = queryClient.getQueryData<RoutineCompletion[]>(
        routineKeys.completions(WINDOW)
      );

      queryClient.setQueryData<RoutineCompletion[]>(
        routineKeys.completions(WINDOW),
        (old = []) => {
          const exists = old.find(
            (c) =>
              c.routine_item_id === vals.routine_item_id &&
              c.completion_date === vals.completion_date
          );
          if (exists) {
            return old.map((c) =>
              c.routine_item_id === vals.routine_item_id &&
              c.completion_date === vals.completion_date
                ? { ...c, completed: vals.completed }
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
      );

      return { previous };
    },

    onError: (err, vals, ctx) => {
      if (ctx?.previous)
        queryClient.setQueryData(routineKeys.completions(WINDOW), ctx.previous);
      setToggleError(err instanceof Error ? err.message : "Failed to update item");
      setPendingToggleIds((prev) => {
        const next = new Set(prev);
        next.delete(vals.routine_item_id);
        return next;
      });
    },

    onSuccess: (_, vals) => {
      setPendingToggleIds((prev) => {
        const next = new Set(prev);
        next.delete(vals.routine_item_id);
        return next;
      });
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: routineKeys.completions(WINDOW) });
    },
  });

  // ── Note save mutation ─────────────────────────────────────────────────────
  const noteMutation = useMutation({
    mutationFn: (vals: CompletionUpsertValues) => upsertCompletion(vals),

    onSuccess: (_, vals) => {
      setSavingNoteId(null);
      setNoteError(null);
      setNoteDrafts((prev) => ({ ...prev, [vals.routine_item_id]: vals.note ?? "" }));
      setSavedFlashId(vals.routine_item_id);
      setTimeout(
        () => setSavedFlashId((curr) => (curr === vals.routine_item_id ? null : curr)),
        2000
      );
      queryClient.invalidateQueries({ queryKey: routineKeys.completions(WINDOW) });
    },

    onError: (err) => {
      setSavingNoteId(null);
      setNoteError(err instanceof Error ? err.message : "Failed to save note");
    },
  });

  // ── Handlers ───────────────────────────────────────────────────────────────
  function handleToggle(item: RoutineItem) {
    const completion = todayStatusMap.get(item.id);
    toggleMutation.mutate({
      routine_item_id: item.id,
      completion_date: today,
      completed: !(completion?.completed ?? false),
      note: completion?.note ?? null,
    });
  }

  function handleNoteToggle(itemId: string) {
    if (expandedNoteId === itemId) {
      setExpandedNoteId(null);
      return;
    }
    // Lazy-init draft from saved note the first time this item is opened
    setNoteDrafts((prev) => {
      if (itemId in prev) return prev;
      return { ...prev, [itemId]: todayStatusMap.get(itemId)?.note ?? "" };
    });
    setExpandedNoteId(itemId);
  }

  function handleNoteSave(itemId: string) {
    const completion = todayStatusMap.get(itemId);
    const draft = noteDrafts[itemId] ?? "";
    setSavingNoteId(itemId);
    noteMutation.mutate({
      routine_item_id: itemId,
      completion_date: today,
      completed: completion?.completed ?? false,
      note: draft || null,
    });
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

  // ── Error ──────────────────────────────────────────────────────────────────
  if (itemsError || completionsError) {
    const msg =
      (itemsErr instanceof Error ? itemsErr.message : null) ??
      (completionsErr instanceof Error ? completionsErr.message : null) ??
      "Unknown error";
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-red-500/30 bg-red-500/10 p-12 text-center">
        <AlertTriangle className="h-7 w-7 text-red-400" />
        <div>
          <p className="font-medium text-red-200">Couldn&apos;t load routine</p>
          <p className="mt-1 text-sm text-red-300/80">{msg}</p>
        </div>
      </div>
    );
  }

  // ── Empty (seed not run) ───────────────────────────────────────────────────
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
          <div className="text-right">
            <span
              className={cn(
                "text-2xl font-bold tabular-nums",
                allDoneToday ? "text-emerald-400" : "text-gold-400"
              )}
            >
              {todayCount}
            </span>
            <span className="text-sm text-navy-400"> / {items.length}</span>
            <p className="text-xs text-navy-500">today</p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-2 w-full overflow-hidden rounded-full bg-navy-700">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-500",
              allDoneToday ? "bg-emerald-500" : "bg-gold-500"
            )}
            style={{ width: `${todayProgress}%` }}
          />
        </div>

        {/* Streak + adherence */}
        <div className="flex flex-wrap gap-2">
          <div
            className={cn(
              "flex items-center gap-1.5 rounded-lg border px-3 py-1.5",
              streak > 0
                ? "border-gold-500/30 bg-gold-500/10"
                : "border-navy-700 bg-navy-800/50"
            )}
          >
            <Flame
              className={cn("h-4 w-4", streak > 0 ? "text-gold-400" : "text-navy-600")}
            />
            <span
              className={cn(
                "text-sm font-semibold tabular-nums",
                streak > 0 ? "text-gold-300" : "text-navy-500"
              )}
            >
              {streak}
            </span>
            <span className="text-xs text-navy-500">day streak</span>
          </div>

          <div className="flex items-center gap-1.5 rounded-lg border border-navy-700 bg-navy-800/50 px-3 py-1.5">
            <TrendingUp className="h-4 w-4 text-navy-500" />
            <span
              className={cn(
                "text-sm font-semibold tabular-nums",
                adherence >= 80
                  ? "text-emerald-400"
                  : adherence >= 50
                  ? "text-gold-400"
                  : "text-navy-400"
              )}
            >
              {adherence}%
            </span>
            <span className="text-xs text-navy-500">30-day adherence</span>
          </div>
        </div>
      </div>

      {/* Inline errors */}
      {toggleError && (
        <div className="flex items-center gap-3 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          <AlertTriangle className="h-4 w-4 shrink-0 text-red-400" />
          <span className="flex-1">{toggleError}</span>
          <button
            onClick={() => setToggleError(null)}
            className="shrink-0 text-red-400 transition-colors hover:text-red-200"
            aria-label="Dismiss error"
          >
            ✕
          </button>
        </div>
      )}
      {noteError && (
        <div className="flex items-center gap-3 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          <AlertTriangle className="h-4 w-4 shrink-0 text-red-400" />
          <span className="flex-1">{noteError}</span>
          <button
            onClick={() => setNoteError(null)}
            className="shrink-0 text-red-400 transition-colors hover:text-red-200"
            aria-label="Dismiss error"
          >
            ✕
          </button>
        </div>
      )}

      {/* Item list */}
      <div className="space-y-2">
        {items.map((item) => {
          const completion = todayStatusMap.get(item.id);
          const checked = completion?.completed ?? false;
          const savedNote = completion?.note ?? "";
          const isExpanded = expandedNoteId === item.id;
          // Draft: use map value if initialised, else fall back to savedNote
          const draft = item.id in noteDrafts ? noteDrafts[item.id] : savedNote;
          const draftChanged = draft !== savedNote;
          const isTogglePending = pendingToggleIds.has(item.id);
          const isSavingNote = savingNoteId === item.id;
          const showFlash = savedFlashId === item.id;

          return (
            <div
              key={item.id}
              className={cn(
                "rounded-xl border transition-colors duration-150",
                checked
                  ? "border-emerald-500/25 bg-emerald-500/5"
                  : "border-navy-700 bg-navy-800/60"
              )}
            >
              {/* Main row */}
              <div className="flex items-center gap-3 px-4 py-3">
                {/* Checkbox */}
                <button
                  onClick={() => handleToggle(item)}
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

                {/* Order number */}
                <span className="w-5 shrink-0 font-mono text-xs text-navy-600">
                  {String(item.order_index).padStart(2, "0")}
                </span>

                {/* Title */}
                <span
                  className={cn(
                    "flex-1 text-sm font-medium leading-snug",
                    checked
                      ? "text-emerald-200 line-through decoration-emerald-500/40"
                      : "text-navy-100"
                  )}
                >
                  {item.title}
                </span>

                {/* Note toggle button */}
                <button
                  onClick={() => handleNoteToggle(item.id)}
                  aria-label={
                    isExpanded ? "Close note" : savedNote ? "View / edit note" : "Add note"
                  }
                  title={
                    savedNote && !isExpanded
                      ? savedNote.length > 60
                        ? savedNote.slice(0, 57) + "…"
                        : savedNote
                      : undefined
                  }
                  className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors",
                    isExpanded
                      ? "bg-navy-600 text-navy-200 hover:bg-navy-500"
                      : savedNote
                      ? "text-gold-400/80 hover:bg-navy-700 hover:text-gold-400"
                      : "text-navy-700 hover:bg-navy-700 hover:text-navy-400"
                  )}
                >
                  {isExpanded ? (
                    <X className="h-3.5 w-3.5" />
                  ) : (
                    <StickyNote className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>

              {/* Note area */}
              {isExpanded && (
                <div className="border-t border-navy-700 px-4 pb-3.5 pt-3">
                  <textarea
                    value={draft}
                    onChange={(e) =>
                      setNoteDrafts((prev) => ({ ...prev, [item.id]: e.target.value }))
                    }
                    placeholder="Add a reflection note for today…"
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
                        <CheckCircle2 className="h-3 w-3" />
                        Saved
                      </span>
                    )}
                    {draftChanged && !showFlash && (
                      <button
                        onClick={() => handleNoteSave(item.id)}
                        disabled={isSavingNote}
                        className={cn(
                          "flex items-center gap-1 rounded px-2.5 py-1 text-xs font-medium transition-colors",
                          "bg-gold-500/20 text-gold-300 hover:bg-gold-500/30",
                          "disabled:pointer-events-none disabled:opacity-50"
                        )}
                      >
                        {isSavingNote ? (
                          <>
                            <Loader2 className="h-3 w-3 animate-spin" />
                            Saving…
                          </>
                        ) : (
                          "Save note"
                        )}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* All-done banner */}
      {allDoneToday && (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 py-4">
          <CheckCircle2 className="h-5 w-5 text-emerald-400" />
          <span className="font-medium text-emerald-300">Full routine complete for today!</span>
        </div>
      )}
    </div>
  );
}
