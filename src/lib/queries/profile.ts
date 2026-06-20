// Data access for the profile table.
// One row per authenticated user: 5-year window start date and total capital.

import { z } from "zod";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/types";

export const profileKeys = {
  me: ["profile", "me"] as const,
};

export const ProfileFormSchema = z.object({
  window_start: z.string().min(1, "Start date is required"),
  total_capital: z.coerce
    .number({ error: "Enter a valid amount" })
    .min(0, "Must be 0 or more")
    .max(1_000_000_000, "Amount is too large"),
});

export type ProfileFormValues = z.infer<typeof ProfileFormSchema>;

export async function fetchProfile(): Promise<Profile | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("profile")
    .select("*")
    .maybeSingle();
  if (error) throw new Error(`Failed to load profile: ${error.message}`);
  return data as Profile | null;
}

export async function upsertProfile(values: ProfileFormValues): Promise<Profile> {
  const valid = ProfileFormSchema.parse(values);
  const supabase = createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("profile")
    .upsert(
      {
        user_id: user.id,
        window_start: valid.window_start,
        total_capital: valid.total_capital,
      },
      { onConflict: "user_id" }
    )
    .select()
    .single();

  if (error) throw new Error(`Failed to save profile: ${error.message}`);
  return data as Profile;
}
