// Data access for the milestones table.
// Source of truth: supabase/migrations (13 seeded rows across 4 stages).

import { createClient } from "@/lib/supabase/client";
import type { Milestone } from "@/lib/types";

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
