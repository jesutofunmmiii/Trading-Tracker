// Data access for premarket_entries and the premarket-attachments Storage bucket.
// One entry per (user, entry_date) — upsert semantics on conflict.

import { z } from "zod";
import { createClient } from "@/lib/supabase/client";
import type { PremarketEntry } from "@/lib/types";

export const premarketKeys = {
  list: () => ["premarket", "list"] as const,
};

export async function fetchPremarketEntries(): Promise<PremarketEntry[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("premarket_entries")
    .select("*")
    .order("entry_date", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Failed to load journal entries: ${error.message}`);
  return (data ?? []) as PremarketEntry[];
}

export const PremarketFormSchema = z.object({
  entry_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Valid date required"),
  market_conditions: z.string().min(1, "Market conditions are required").max(3000),
  key_levels: z.string().min(1, "Key levels are required").max(2000),
  planned_trades: z.string().min(1, "Planned trades are required").max(3000),
  risk_reward_ratio: z.string().min(1, "Risk/reward ratio is required").max(100),
  notes: z.string().max(3000).nullable(),
});

export type PremarketFormValues = z.infer<typeof PremarketFormSchema>;

const BUCKET = "premarket-attachments";
const MAX_FILE_BYTES = 10 * 1024 * 1024;

function storagePathFromUrl(url: string): string | null {
  try {
    const marker = `/object/public/${BUCKET}/`;
    const idx = url.indexOf(marker);
    return idx >= 0 ? decodeURIComponent(url.slice(idx + marker.length)) : null;
  } catch {
    return null;
  }
}

// file = null  → keep existing attachment (or no attachment for new entries)
// file = File  → upload new, replace existing if present
export async function upsertPremarketEntry(
  values: PremarketFormValues,
  file: File | null,
  existing?: { attachment_url: string | null; attachment_name: string | null }
): Promise<PremarketEntry> {
  const valid = PremarketFormSchema.parse(values);
  const supabase = createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) throw new Error("Not authenticated");

  let attachment_url: string | null = existing?.attachment_url ?? null;
  let attachment_name: string | null = existing?.attachment_name ?? null;

  if (file) {
    if (file.size > MAX_FILE_BYTES) throw new Error("File must be 10 MB or smaller");

    // Remove old file best-effort before uploading the replacement
    if (existing?.attachment_url) {
      try {
        const oldPath = storagePathFromUrl(existing.attachment_url);
        if (oldPath) await supabase.storage.from(BUCKET).remove([oldPath]);
      } catch {
        // Cleanup is best-effort; don't block the save
      }
    }

    const ext = file.name.split(".").pop()?.toLowerCase() ?? "bin";
    const path = `${user.id}/${Date.now()}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, { upsert: true });
    if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

    attachment_url = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
    attachment_name = file.name;
  }

  const { data, error } = await supabase
    .from("premarket_entries")
    .upsert(
      {
        user_id: user.id,
        entry_date: valid.entry_date,
        market_conditions: valid.market_conditions,
        key_levels: valid.key_levels,
        planned_trades: valid.planned_trades,
        risk_reward_ratio: valid.risk_reward_ratio,
        notes: valid.notes,
        attachment_url,
        attachment_name,
      },
      { onConflict: "user_id,entry_date" }
    )
    .select()
    .single();

  if (error) throw new Error(`Failed to save entry: ${error.message}`);
  return data as PremarketEntry;
}

export async function deletePremarketEntry(
  id: string,
  attachmentUrl?: string | null
): Promise<void> {
  const supabase = createClient();

  if (attachmentUrl) {
    try {
      const path = storagePathFromUrl(attachmentUrl);
      if (path) await supabase.storage.from(BUCKET).remove([path]);
    } catch {
      // Best-effort
    }
  }

  const { error } = await supabase.from("premarket_entries").delete().eq("id", id);
  if (error) throw new Error(`Failed to delete entry: ${error.message}`);
}
