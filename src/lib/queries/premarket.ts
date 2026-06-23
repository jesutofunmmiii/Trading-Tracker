// Data access for premarket_entries and premarket_screenshots.
// Storage bucket: journal-screenshots
// Path convention: {user_id}/premarket/{entry_id}/{timestamp}.{ext}
// RLS: first path segment must equal auth.uid() — enforced by owner-scoped policies.

import { createClient } from "@/lib/supabase/client";
import type { PremarketEntry, PremarketScreenshot, PremarketTimeframe } from "@/lib/types";

export const PREMARKET_TIMEFRAMES: PremarketTimeframe[] = [
  "Weekly",
  "Daily",
  "4H",
  "2H",
  "1H",
];

const BUCKET = "journal-screenshots";
const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB

export const premarketKeys = {
  entry: (date: string) => ["premarket", "entry", date] as const,
  screenshots: (entryId: string) => ["premarket", "screenshots", entryId] as const,
};

// Returns the public URL for a screenshot stored at storagePath.
// getPublicUrl is synchronous — no network request.
export function screenshotPublicUrl(storagePath: string): string {
  const supabase = createClient();
  return supabase.storage.from(BUCKET).getPublicUrl(storagePath).data.publicUrl;
}

// Returns the premarket_entry for (current user, date), or null if none exists yet.
export async function fetchPremarketEntry(
  date: string
): Promise<PremarketEntry | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("premarket_entries")
    .select("*")
    .eq("entry_date", date)
    .maybeSingle();
  if (error) throw new Error(`Failed to load pre-market entry: ${error.message}`);
  return data as PremarketEntry | null;
}

// Returns all screenshots for an entry, ordered by display_order then created_at.
export async function fetchPremarketScreenshots(
  entryId: string
): Promise<PremarketScreenshot[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("premarket_screenshots")
    .select("*")
    .eq("premarket_entry_id", entryId)
    .order("display_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw new Error(`Failed to load screenshots: ${error.message}`);
  return (data ?? []) as PremarketScreenshot[];
}

// Uploads a screenshot for the given date + timeframe.
// Creates the premarket_entries row first (upsert — idempotent), then uploads
// the file to storage, then inserts the premarket_screenshots row.
export async function addPremarketScreenshot({
  date,
  timeframe,
  file,
  notes,
}: {
  date: string;
  timeframe: PremarketTimeframe;
  file: File;
  notes: string;
}): Promise<PremarketScreenshot> {
  if (file.size > MAX_FILE_BYTES) throw new Error("File must be 10 MB or smaller");

  const supabase = createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) throw new Error("Not authenticated");

  // Ensure the parent premarket_entry row exists for this date.
  const { data: entry, error: entryError } = await supabase
    .from("premarket_entries")
    .upsert({ user_id: user.id, entry_date: date }, { onConflict: "user_id,entry_date" })
    .select()
    .single();
  if (entryError || !entry)
    throw new Error(`Failed to create entry: ${entryError?.message ?? "unknown"}`);

  // Upload the file. Path first segment = user ID → satisfies RLS foldername policy.
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "bin";
  const storagePath = `${user.id}/premarket/${entry.id}/${Date.now()}.${ext}`;
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, file, { upsert: false });
  if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

  // Insert the screenshot row.
  const { data: screenshot, error: insertError } = await supabase
    .from("premarket_screenshots")
    .insert({
      user_id: user.id,
      premarket_entry_id: entry.id,
      timeframe,
      storage_path: storagePath,
      notes: notes.trim() || null,
      display_order: 0,
    })
    .select()
    .single();

  if (insertError) {
    // Best-effort: remove the uploaded file so storage doesn't orphan.
    try {
      await supabase.storage.from(BUCKET).remove([storagePath]);
    } catch {
      // ignore cleanup failure
    }
    throw new Error(`Failed to save screenshot: ${insertError.message}`);
  }

  return screenshot as PremarketScreenshot;
}

// Updates the notes field for a single screenshot.
export async function updateScreenshotNotes(
  screenshotId: string,
  notes: string
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("premarket_screenshots")
    .update({ notes: notes.trim() || null })
    .eq("id", screenshotId);
  if (error) throw new Error(`Failed to update notes: ${error.message}`);
}

// Deletes a screenshot: removes the storage file (best-effort) then the DB row.
export async function deletePremarketScreenshot(
  screenshotId: string,
  storagePath: string
): Promise<void> {
  const supabase = createClient();
  try {
    await supabase.storage.from(BUCKET).remove([storagePath]);
  } catch {
    // Storage cleanup is best-effort — don't block the row deletion.
  }
  const { error } = await supabase
    .from("premarket_screenshots")
    .delete()
    .eq("id", screenshotId);
  if (error) throw new Error(`Failed to delete screenshot: ${error.message}`);
}
