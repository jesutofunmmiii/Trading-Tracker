"use client";

// Data sources: milestones table (stage_number, order_index, title, status,
// account_size, payout_target, capital_threshold, est_timeline).
//
// This is the first live data read — it verifies the full path:
// auth gate -> TanStack Query -> Supabase browser client -> milestones table.
// Full milestone UI (progress bars, stage grouping, editing) comes later.

import { useQuery } from "@tanstack/react-query";
import { fetchMilestones, milestonesKeys } from "@/lib/queries/milestones";
import type { MilestoneStatus } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Flag, Loader2, AlertTriangle } from "lucide-react";

const STATUS_LABEL: Record<MilestoneStatus, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  completed: "Completed",
};

const STATUS_VARIANT: Record<
  MilestoneStatus,
  "muted" | "warning" | "success"
> = {
  not_started: "muted",
  in_progress: "warning",
  completed: "success",
};

export function MilestonesSection() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: milestonesKeys.all,
    queryFn: fetchMilestones,
  });

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-xl border border-navy-700 bg-navy-800/50 p-12 text-navy-300">
        <Loader2 className="h-5 w-5 animate-spin text-gold-500" />
        Loading milestones…
      </div>
    );
  }

  // Error state
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

  // Empty state
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

  // Data state — minimal list confirming the live read works.
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-navy-50">Career Milestones</h1>
        <Badge variant="navy">{data.length} loaded</Badge>
      </div>
      <ul className="divide-y divide-navy-700 overflow-hidden rounded-xl border border-navy-700 bg-navy-800">
        {data.map((m) => (
          <li
            key={m.id}
            className="flex items-center gap-3 px-4 py-3 hover:bg-navy-700/40"
          >
            <span className="w-8 shrink-0 text-center font-mono text-sm text-gold-500">
              {String(m.order_index).padStart(2, "0")}
            </span>
            <span className="flex-1 text-sm text-navy-100">{m.title}</span>
            <span className="hidden sm:inline text-xs text-navy-400">
              Stage {m.stage_number}
            </span>
            <Badge variant={STATUS_VARIANT[m.status]}>
              {STATUS_LABEL[m.status]}
            </Badge>
          </li>
        ))}
      </ul>
    </div>
  );
}
