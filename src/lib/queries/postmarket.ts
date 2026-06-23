// Data access for postmarket_entries and postmarket_screenshots.
// Storage bucket: journal-screenshots
// Path convention: {user_id}/postmarket/{entry_id}/{timestamp}.{ext}
// RLS: first path segment must equal auth.uid() — enforced by owner-scoped policies.

import { createClient } from "@/lib/supabase/client";
import type {
  PostmarketEntry,
  PostmarketScreenshot,
  PremarketTimeframe,
} from "@/lib/types";

const BUCKET = "journal-screenshots";
const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB

export const postmarketKeys = {
  entry: (date: string) => ["postmarket", "entry", date] as const,
  screenshots: (entryId: string) =>
    ["postmarket", "screenshots", entryId] as const,
};

// Returns the public URL for a screenshot stored at storagePath.
// getPublicUrl is synchronous — no network request.
export function postmarketScreenshotPublicUrl(storagePath: string): string {
  const supabase = createClient();
  return supabase.storage.from(BUCKET).getPublicUrl(storagePath).data.publicUrl;
}

// Returns the postmarket_entry for (current user, date), or null if none exists yet.
export async function fetchPostmarketEntry(
  date: string
): Promise<PostmarketEntry | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("postmarket_entries")
    .select("*")
    .eq("entry_date", date)
    .maybeSingle();
  if (error) throw new Error(`Failed to load post-market entry: ${error.message}`);
  return data as PostmarketEntry | null;
}

// Returns all screenshots for a postmarket entry, ordered by display_order then created_at.
export async function fetchPostmarketScreenshots(
  entryId: string
): Promise<PostmarketScreenshot[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("postmarket_screenshots")
    .select("*")
    .eq("postmarket_entry_id", entryId)
    .order("display_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw new Error(`Failed to load screenshots: ${error.message}`);
  return (data ?? []) as PostmarketScreenshot[];
}

// Uploads a screenshot for the given date + timeframe.
// Creates the postmarket_entries row first (upsert — idempotent), then uploads
// the file to storage, then inserts the postmarket_screenshots row.
export async function addPostmarketScreenshot({
  date,
  timeframe,
  file,
  notes,
}: {
  date: string;
  timeframe: PremarketTimeframe;
  file: File;
  notes: string;
}): Promise<PostmarketScreenshot> {
  if (file.size > MAX_FILE_BYTES) throw new Error("File must be 10 MB or smaller");

  const supabase = createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) throw new Error("Not authenticated");

  // Ensure the parent postmarket_entry row exists for this date.
  const { data: entry, error: entryError } = await supabase
    .from("postmarket_entries")
    .upsert(
      { user_id: user.id, entry_date: date },
      { onConflict: "user_id,entry_date" }
    )
    .select()
    .single();
  if (entryError || !entry)
    throw new Error(
      `Failed to create entry: ${entryError?.message ?? "unknown"}`
    );

  // Upload the file. Path first segment = user ID → satisfies RLS foldername policy.
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "bin";
  const storagePath = `${user.id}/postmarket/${entry.id}/${Date.now()}.${ext}`;
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, file, { upsert: false });
  if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

  // Insert the screenshot row.
  const { data: screenshot, error: insertError } = await supabase
    .from("postmarket_screenshots")
    .insert({
      user_id: user.id,
      postmarket_entry_id: entry.id,
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

  return screenshot as PostmarketScreenshot;
}

// Updates the notes field for a single screenshot.
export async function updatePostmarketScreenshotNotes(
  screenshotId: string,
  notes: string
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("postmarket_screenshots")
    .update({ notes: notes.trim() || null })
    .eq("id", screenshotId);
  if (error) throw new Error(`Failed to update notes: ${error.message}`);
}

// Deletes a screenshot: removes the storage file (best-effort) then the DB row.
export async function deletePostmarketScreenshot(
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
    .from("postmarket_screenshots")
    .delete()
    .eq("id", screenshotId);
  if (error) throw new Error(`Failed to delete screenshot: ${error.message}`);
}

// Deletes a batch of screenshots (e.g. all shots in a timeframe).
// Storage removals run in parallel best-effort; DB rows deleted in a single .in() call.
export async function deleteMultiplePostmarketScreenshots(
  shots: PostmarketScreenshot[]
): Promise<void> {
  if (shots.length === 0) return;
  const supabase = createClient();
  await Promise.allSettled(
    shots.map((s) => supabase.storage.from(BUCKET).remove([s.storage_path]))
  );
  const ids = shots.map((s) => s.id);
  const { error } = await supabase
    .from("postmarket_screenshots")
    .delete()
    .in("id", ids);
  if (error) throw new Error(`Failed to delete screenshots: ${error.message}`);
}

// Saves the follow-up notes on the postmarket_entry for a date.
// Upserts the entry (creating it if it doesn't exist yet) with followup_notes set.
export async function saveFollowupNotes(
  date: string,
  notes: string
): Promise<PostmarketEntry> {
  const supabase = createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) throw new Error("Not authenticated");

  const { data: entry, error } = await supabase
    .from("postmarket_entries")
    .upsert(
      {
        user_id: user.id,
        entry_date: date,
        followup_notes: notes.trim() || null,
      },
      { onConflict: "user_id,entry_date" }
    )
    .select()
    .single();
  if (error || !entry)
    throw new Error(`Failed to save notes: ${error?.message ?? "unknown"}`);
  return entry as PostmarketEntry;
}
