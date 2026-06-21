// Data access for routine_items and routine_completions.
// "Today" is always the browser's local calendar date (see localDateStr).

import { z } from "zod";
import { createClient } from "@/lib/supabase/client";
import type { RoutineItem, RoutineCompletion } from "@/lib/types";

// Formats a Date as YYYY-MM-DD in the local timezone.
export function localDateStr(d: Date): string {
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}

export const routineKeys = {
  items: ["routine", "items"] as const,
  completions: (days: number) => ["routine", "completions", days] as const,
};

export async function fetchRoutineItems(): Promise<RoutineItem[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("routine_items")
    .select("*")
    .order("order_index", { ascending: true });
  if (error) throw new Error(`Failed to load routine items: ${error.message}`);
  return (data ?? []) as RoutineItem[];
}

export async function fetchRecentCompletions(days: number): Promise<RoutineCompletion[]> {
  const supabase = createClient();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - (days - 1));
  const cutoffStr = localDateStr(cutoff);

  const { data, error } = await supabase
    .from("routine_completions")
    .select("*")
    .gte("completion_date", cutoffStr)
    .order("completion_date", { ascending: false });
  if (error) throw new Error(`Failed to load completions: ${error.message}`);
  return (data ?? []) as RoutineCompletion[];
}

const CompletionUpsertSchema = z.object({
  routine_item_id: z.string().uuid(),
  completion_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  completed: z.boolean(),
  note: z.string().max(1000).nullable(),
});

export type CompletionUpsertValues = z.infer<typeof CompletionUpsertSchema>;

export async function upsertCompletion(values: CompletionUpsertValues): Promise<RoutineCompletion> {
  const valid = CompletionUpsertSchema.parse(values);
  const supabase = createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("routine_completions")
    .upsert(
      { user_id: user.id, ...valid },
      { onConflict: "user_id,routine_item_id,completion_date" }
    )
    .select()
    .single();

  if (error) throw new Error(`Failed to save completion: ${error.message}`);
  return data as RoutineCompletion;
}
