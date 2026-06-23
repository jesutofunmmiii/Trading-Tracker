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

export interface PremarketEntry {
  id: string;
  user_id: string;
  entry_date: string; // YYYY-MM-DD
  news_events: unknown | null; // JSONB — shape TBD when data source wired
  created_at: string;
  updated_at: string;
}

export type PremarketTimeframe = "Weekly" | "Daily" | "4H" | "2H" | "1H";

export interface PremarketScreenshot {
  id: string;
  user_id: string;
  premarket_entry_id: string;
  timeframe: PremarketTimeframe;
  storage_path: string;
  notes: string | null;
  display_order: number;
  created_at: string;
}

export interface RoutineItem {
  id: string;
  order_index: number;
  title: string;
  created_at: string;
}

export interface RoutineCompletion {
  id: string;
  user_id: string;
  routine_item_id: string;
  completion_date: string; // YYYY-MM-DD (browser local date)
  completed: boolean;
  note: string | null;
  created_at: string;
  updated_at: string;
}
