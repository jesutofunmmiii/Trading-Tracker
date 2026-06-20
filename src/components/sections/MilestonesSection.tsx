"use client";

// Data sources: milestones table (13 seeded rows, 4 stages).
// Reads via TanStack Query; status edits persist via optimistic Supabase UPDATE.

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchMilestones,
  updateMilestoneStatus,
  milestonesKeys,
} from "@/lib/queries/milestones";
import type { Milestone, MilestoneStatus } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Flag,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Constants ─────────────────────────────────────────────────────────────────

const STAGE_NAMES: Record<number, string> = {
  1: "Propfirm Foundation",
  2: "Scaling to $1m Funding",
  3: "Personal Broker Account",
  4: "Capital Base & Legacy",
};

const STATUS_LABEL: Record<MilestoneStatus, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  completed: "Completed",
};

const STATUS_ORDER: MilestoneStatus[] = [
  "not_started",
  "in_progress",
  "completed",
];

const STATUS_PROGRESS: Record<MilestoneStatus, number> = {
  not_started: 0,
  in_progress: 50,
  completed: 100,
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(value: number | null): string | null {
  if (value == null) return null;
  if (value >= 1_000_000)
    return `$${(value / 1_000_000 % 1 === 0 ? value / 1_000_000 : (value / 1_000_000).toFixed(1))}m`;
  if (value >= 1_000)
    return `$${value / 1_000 % 1 === 0 ? value / 1_000 : (value / 1_000).toFixed(1)}k`;
  return `$${value}`;
}

function groupByStage(milestones: Milestone[]): Map<number, Milestone[]> {
  const map = new Map<number, Milestone[]>();
  for (const m of milestones) {
    const arr = map.get(m.stage_number) ?? [];
    arr.push(m);
    map.set(m.stage_number, arr);
  }
  return map;
}

// ── StatusSelector ────────────────────────────────────────────────────────────

function StatusSelector({
  milestoneId,
  current,
  isPending,
  onChange,
}: {
  milestoneId: string;
  current: MilestoneStatus;
  isPending: boolean;
  onChange: (id: string, status: MilestoneStatus) => void;
}) {
  return (
    <div className="flex gap-1" role="group" aria-label="Set milestone status">
      {STATUS_ORDER.map((s) => {
        const active = current === s;
        return (
          <button
            key={s}
            onClick={() => !active && onChange(milestoneId, s)}
            disabled={isPending}
            aria-pressed={active}
            className={cn(
              "rounded px-2.5 py-1 text-xs font-medium transition-colors",
              "disabled:pointer-events-none disabled:opacity-50",
              active
                ? s === "completed"
                  ? "bg-emerald-500/25 text-emerald-200 ring-1 ring-emerald-500/40"
                  : s === "in_progress"
                  ? "bg-gold-500/25 text-gold-200 ring-1 ring-gold-500/40"
                  : "bg-navy-600 text-navy-100 ring-1 ring-navy-500"
                : "bg-navy-700/60 text-navy-400 hover:bg-navy-700 hover:text-navy-200"
            )}
          >
            {STATUS_LABEL[s]}
          </button>
        );
      })}
    </div>
  );
}

// ── MilestoneCard ─────────────────────────────────────────────────────────────

function MilestoneCard({
  milestone,
  isPending,
  onStatusChange,
}: {
  milestone: Milestone;
  isPending: boolean;
  onStatusChange: (id: string, status: MilestoneStatus) => void;
}) {
  const {
    id,
    order_index,
    title,
    status,
    account_size,
    payout_target,
    capital_threshold,
    est_timeline,
  } = milestone;

  const progress = STATUS_PROGRESS[status];

  const metrics: { label: string; value: string }[] = [];
  const fmtAccount = fmt(account_size);
  const fmtPayout = fmt(payout_target);
  const fmtCapital = fmt(capital_threshold);
  if (fmtAccount) metrics.push({ label: "Account", value: fmtAccount });
  if (fmtPayout) metrics.push({ label: "Payout target", value: fmtPayout });
  if (fmtCapital) metrics.push({ label: "Capital", value: fmtCapital });

  return (
    <Card
      className={cn(
        "transition-all duration-200",
        status === "completed" && "ring-1 ring-emerald-500/20",
        status === "in_progress" && "ring-1 ring-gold-500/20"
      )}
    >
      <CardHeader className="pb-3 pt-4">
        <div className="flex items-start gap-3">
          {/* Order number badge */}
          <span
            className={cn(
              "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-mono text-xs font-bold",
              status === "completed"
                ? "bg-emerald-500/20 text-emerald-300"
                : status === "in_progress"
                ? "bg-gold-500/20 text-gold-300"
                : "bg-navy-700 text-navy-400"
            )}
          >
            {String(order_index).padStart(2, "0")}
          </span>

          {/* Title */}
          <CardTitle className="flex-1 text-sm font-medium leading-snug">
            {title}
          </CardTitle>

          {/* Status icon */}
          <span className="mt-0.5 shrink-0">
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin text-gold-400" />
            ) : status === "completed" ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            ) : status === "in_progress" ? (
              <Clock className="h-4 w-4 text-gold-400" />
            ) : null}
          </span>
        </div>
      </CardHeader>

      <CardContent className="space-y-3 pb-4">
        {/* Metrics row */}
        {(metrics.length > 0 || est_timeline) && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {metrics.map(({ label, value }) => (
              <span key={label} className="text-xs">
                <span className="text-navy-500">{label} </span>
                <span className="font-semibold text-navy-100">{value}</span>
              </span>
            ))}
            {est_timeline && (
              <>
                {metrics.length > 0 && (
                  <span className="text-navy-600 text-xs">·</span>
                )}
                <span className="text-xs">
                  <span className="text-navy-500">Timeline </span>
                  <span className="font-semibold text-gold-400">
                    {est_timeline}
                  </span>
                </span>
              </>
            )}
          </div>
        )}

        {/* Progress bar */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span
              className={cn(
                "font-medium",
                status === "completed"
                  ? "text-emerald-300"
                  : status === "in_progress"
                  ? "text-gold-400"
                  : "text-navy-500"
              )}
            >
              {STATUS_LABEL[status]}
            </span>
            <span className="tabular-nums text-navy-500">{progress}%</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-navy-700">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-500",
                status === "completed"
                  ? "bg-emerald-500"
                  : status === "in_progress"
                  ? "bg-gold-500"
                  : "w-0"
              )}
              style={status !== "not_started" ? { width: `${progress}%` } : undefined}
            />
          </div>
        </div>

        {/* Status selector */}
        <StatusSelector
          milestoneId={id}
          current={status}
          isPending={isPending}
          onChange={onStatusChange}
        />
      </CardContent>
    </Card>
  );
}

// ── StageGroup ────────────────────────────────────────────────────────────────

function StageGroup({
  stageNumber,
  milestones,
  pendingIds,
  onStatusChange,
}: {
  stageNumber: number;
  milestones: Milestone[];
  pendingIds: Set<string>;
  onStatusChange: (id: string, status: MilestoneStatus) => void;
}) {
  const completed = milestones.filter((m) => m.status === "completed").length;
  const total = milestones.length;
  const stageProgress = total > 0 ? Math.round((completed / total) * 100) : 0;
  const allDone = completed === total;

  return (
    <section aria-labelledby={`stage-${stageNumber}-heading`}>
      {/* Stage header */}
      <div className="mb-4 space-y-2">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Badge variant="default" className="shrink-0 text-xs">
              STAGE {stageNumber}
            </Badge>
            <h2
              id={`stage-${stageNumber}-heading`}
              className="text-sm font-semibold text-navy-100 sm:text-base"
            >
              {STAGE_NAMES[stageNumber]}
            </h2>
          </div>
          <span className="shrink-0 text-sm tabular-nums">
            <span
              className={
                allDone ? "font-semibold text-emerald-400" : "font-semibold text-gold-400"
              }
            >
              {completed}
            </span>
            <span className="text-navy-500"> / {total}</span>
          </span>
        </div>

        {/* Stage progress bar */}
        <div className="h-1 w-full overflow-hidden rounded-full bg-navy-700">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-700",
              allDone ? "bg-emerald-500" : "bg-gold-500"
            )}
            style={{ width: `${stageProgress}%` }}
          />
        </div>
      </div>

      {/* Milestone cards */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {milestones.map((m) => (
          <MilestoneCard
            key={m.id}
            milestone={m}
            isPending={pendingIds.has(m.id)}
            onStatusChange={onStatusChange}
          />
        ))}
      </div>
    </section>
  );
}

// ── MilestonesSection ─────────────────────────────────────────────────────────

export function MilestonesSection() {
  const queryClient = useQueryClient();
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());

  const { data, isLoading, isError, error } = useQuery({
    queryKey: milestonesKeys.all,
    queryFn: fetchMilestones,
  });

  const { mutate } = useMutation({
    mutationFn: ({ id, status }: { id: string; status: MilestoneStatus }) =>
      updateMilestoneStatus(id, status),

    onMutate: async ({ id, status }) => {
      setPendingIds((prev) => new Set(prev).add(id));
      setMutationError(null);
      await queryClient.cancelQueries({ queryKey: milestonesKeys.all });
      const previous = queryClient.getQueryData<Milestone[]>(milestonesKeys.all);
      queryClient.setQueryData<Milestone[]>(milestonesKeys.all, (old) =>
        old?.map((m) => (m.id === id ? { ...m, status } : m)) ?? []
      );
      return { previous };
    },

    onError: (err, { id }, context) => {
      if (context?.previous) {
        queryClient.setQueryData(milestonesKeys.all, context.previous);
      }
      setMutationError(
        err instanceof Error ? err.message : "Failed to update status"
      );
      setPendingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    },

    onSuccess: (_data, { id }) => {
      setPendingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: milestonesKeys.all });
    },
  });

  const handleStatusChange = (id: string, status: MilestoneStatus) =>
    mutate({ id, status });

  // ── Loading ──────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-xl border border-navy-700 bg-navy-800/50 p-12 text-navy-300">
        <Loader2 className="h-5 w-5 animate-spin text-gold-500" />
        Loading milestones…
      </div>
    );
  }

  // ── Error ────────────────────────────────────────────────────────────────
  if (isError) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-red-500/30 bg-red-500/10 p-12 text-center">
        <AlertTriangle className="h-7 w-7 text-red-400" />
        <div>
          <p className="font-medium text-red-200">Couldn&apos;t load milestones</p>
          <p className="mt-1 text-sm text-red-300/80">
            {error instanceof Error ? error.message : "Unknown error"}
          </p>
        </div>
      </div>
    );
  }

  // ── Empty ────────────────────────────────────────────────────────────────
  if (!data || data.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-navy-600 bg-navy-800/50 p-12 text-center">
        <Flag className="h-7 w-7 text-gold-500" />
        <p className="text-navy-300">
          No milestones found. Run the seed migration to populate the 13
          milestones.
        </p>
      </div>
    );
  }

  // ── Data ─────────────────────────────────────────────────────────────────
  const grouped = groupByStage(data);
  const totalCompleted = data.filter((m) => m.status === "completed").length;
  const totalInProgress = data.filter((m) => m.status === "in_progress").length;
  const totalNotStarted = data.length - totalCompleted - totalInProgress;

  return (
    <div className="space-y-8">
      {/* Section header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-navy-50">
            Career Milestones
          </h1>
          <p className="mt-1 text-sm text-navy-400">
            {totalCompleted > 0 && (
              <span className="text-emerald-400">{totalCompleted} completed</span>
            )}
            {totalCompleted > 0 && totalInProgress > 0 && (
              <span className="text-navy-600"> · </span>
            )}
            {totalInProgress > 0 && (
              <span className="text-gold-400">{totalInProgress} in progress</span>
            )}
            {(totalCompleted > 0 || totalInProgress > 0) && totalNotStarted > 0 && (
              <span className="text-navy-600"> · </span>
            )}
            {totalNotStarted > 0 && (
              <span>{totalNotStarted} not started</span>
            )}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <span className="text-2xl font-bold tabular-nums text-gold-400">
            {totalCompleted}
          </span>
          <span className="text-sm text-navy-400"> / {data.length}</span>
          <p className="text-xs text-navy-500">milestones</p>
        </div>
      </div>

      {/* Mutation error */}
      {mutationError && (
        <div className="flex items-center gap-3 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          <AlertTriangle className="h-4 w-4 shrink-0 text-red-400" />
          <span className="flex-1">{mutationError}</span>
          <button
            onClick={() => setMutationError(null)}
            className="shrink-0 text-red-400 hover:text-red-200 transition-colors"
            aria-label="Dismiss error"
          >
            ✕
          </button>
        </div>
      )}

      {/* Stage groups */}
      {[1, 2, 3, 4].map((stageNum) => {
        const stageMilestones = grouped.get(stageNum) ?? [];
        if (stageMilestones.length === 0) return null;
        return (
          <StageGroup
            key={stageNum}
            stageNumber={stageNum}
            milestones={stageMilestones}
            pendingIds={pendingIds}
            onStatusChange={handleStatusChange}
          />
        );
      })}
    </div>
  );
}
