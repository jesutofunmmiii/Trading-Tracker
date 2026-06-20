// Data access for the milestones table.
// Source of truth: supabase/migrations (13 seeded rows across 4 stages).

import { z } from "zod";
import { createClient } from "@/lib/supabase/client";
import type { Milestone, MilestoneStatus } from "@/lib/types";

export const milestonesKeys = {
  all: ["milestones"] as const,
};

export async function fetchMilestones(): Promise<Milestone[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("milestones")
    .select("*")
    .order("order_index", { ascending: true });

  if (error) {
    throw new Error(`Failed to load milestones: ${error.message}`);
  }
  return (data ?? []) as Milestone[];
}

const StatusSchema = z.enum(["not_started", "in_progress", "completed"]);

export async function updateMilestoneStatus(
  id: string,
  status: MilestoneStatus
): Promise<void> {
  const validStatus = StatusSchema.parse(status);
  const supabase = createClient();
  const { error } = await supabase
    .from("milestones")
    .update({ status: validStatus })
    .eq("id", id);
  if (error) throw new Error(`Failed to update milestone: ${error.message}`);
}
