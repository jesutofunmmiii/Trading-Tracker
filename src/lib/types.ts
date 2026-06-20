// Shared domain types mirroring the Supabase schema.
// Keep in sync with supabase/migrations.

export type MilestoneStatus = "not_started" | "in_progress" | "completed";

export interface Milestone {
  id: string;
  stage_number: number;
  order_index: number;
  title: string;
  status: MilestoneStatus;
  account_size: number | null;
  payout_target: number | null;
  capital_threshold: number | null;
  est_timeline: string | null;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  user_id: string;
  window_start: string; // ISO date "YYYY-MM-DD"
  total_capital: number;
  created_at: string;
  updated_at: string;
}
