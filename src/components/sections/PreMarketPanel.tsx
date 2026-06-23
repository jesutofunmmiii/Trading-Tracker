"use client";

// Data sources: premarket_entries (one row per date, lazy-created on first screenshot upload),
// premarket_screenshots (many per entry, grouped by timeframe).
// Storage: journal-screenshots bucket, path {user_id}/premarket/{entry_id}/{file}.

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Maximize2,
  Newspaper,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  PREMARKET_TIMEFRAMES,
  premarketKeys,
  screenshotPublicUrl,
  fetchPremarketEntry,
  fetchPremarketScreenshots,
  addPremarketScreenshot,
  updateScreenshotNotes,
  deletePremarketScreenshot,
} from "@/lib/queries/premarket";
import type { PremarketScreenshot, PremarketTimeframe } from "@/lib/types";

// ── Constants ─────────────────────────────────────────────────────────────────

const ACCEPTED = "image/jpeg,image/png,image/webp,image/gif";
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_BYTES = 10 * 1024 * 1024;

// ── PreMarketPanel ────────────────────────────────────────────────────────────

export function PreMarketPanel({ date }: { date: string }) {
  const queryClient = useQueryClient();

  // ── Lightbox ───────────────────────────────────────────────────────────────
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  // ── Upload form state (one form open at a time, keyed by timeframe) ────────
  const [uploadTf, setUploadTf] = useState<PremarketTimeframe | null>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadFileError, setUploadFileError] = useState<string | null>(null);
  const [uploadNotes, setUploadNotes] = useState("");
  const [uploadError, setUploadError] = useState<string | null>(null);

  // ── Notes editing state (per screenshot) ──────────────────────────────────
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const [savedFlashIds, setSavedFlashIds] = useState<Set<string>>(new Set());
  const [noteErrors, setNoteErrors] = useState<Record<string, string>>({});

  // ── Delete state (per screenshot) ─────────────────────────────────────────
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // ── Queries ────────────────────────────────────────────────────────────────
  const {
    data: entry,
    isLoading: entryLoading,
    isError: entryError,
    error: entryErr,
  } = useQuery({
    queryKey: premarketKeys.entry(date),
    queryFn: () => fetchPremarketEntry(date),
  });

  const entryId = entry?.id ?? "";

  const {
    data: screenshots = [],
    isLoading: screenshotsLoading,
    isError: screenshotsError,
    error: screenshotsErr,
  } = useQuery({
    queryKey: premarketKeys.screenshots(entryId),
    queryFn: () => fetchPremarketScreenshots(entryId),
    enabled: !!entryId,
  });

  // Group screenshots by timeframe for rendering.
  const byTimeframe = new Map<PremarketTimeframe, PremarketScreenshot[]>();
  for (const tf of PREMARKET_TIMEFRAMES) byTimeframe.set(tf, []);
  for (const shot of screenshots) {
    byTimeframe.get(shot.timeframe as PremarketTimeframe)?.push(shot);
  }

  // ── Add screenshot mutation ────────────────────────────────────────────────
  const addMutation = useMutation({
    mutationFn: (vars: { timeframe: PremarketTimeframe; file: File; notes: string }) =>
      addPremarketScreenshot({ date, ...vars }),

    onSuccess: (newShot) => {
      // Refresh the entry (may have just been created) and the screenshots list.
      queryClient.invalidateQueries({ queryKey: premarketKeys.entry(date) });
      queryClient.invalidateQueries({
        queryKey: premarketKeys.screenshots(newShot.premarket_entry_id),
      });
      // Refresh calendar activity dots for all cached months.
      queryClient.invalidateQueries({ queryKey: ["journal", "activity"] });
      closeUploadForm();
    },

    onError: (err) => {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
    },
  });

  // ── Update notes mutation ──────────────────────────────────────────────────
  const updateNotesMutation = useMutation({
    mutationFn: ({ id, notes }: { id: string; notes: string; entryId: string }) =>
      updateScreenshotNotes(id, notes),

    onSuccess: (_, { id, notes, entryId: eid }) => {
      setSavingIds((p) => del(p, id));
      setNoteDrafts((p) => ({ ...p, [id]: notes }));
      setSavedFlashIds((p) => add(p, id));
      setTimeout(() => setSavedFlashIds((p) => del(p, id)), 2000);
      queryClient.invalidateQueries({ queryKey: premarketKeys.screenshots(eid) });
    },

    onError: (err, { id }) => {
      setSavingIds((p) => del(p, id));
      setNoteErrors((p) => ({
        ...p,
        [id]: err instanceof Error ? err.message : "Save failed",
      }));
    },
  });

  // ── Delete mutation ────────────────────────────────────────────────────────
  const deleteMutation = useMutation({
    mutationFn: ({ id, path }: { id: string; path: string; entryId: string }) =>
      deletePremarketScreenshot(id, path),

    onSuccess: (_, { id, entryId: eid }) => {
      setDeletingIds((p) => del(p, id));
      setConfirmDeleteId(null);
      queryClient.invalidateQueries({ queryKey: premarketKeys.screenshots(eid) });
      queryClient.invalidateQueries({ queryKey: ["journal", "activity"] });
    },

    onError: (err, { id }) => {
      setDeletingIds((p) => del(p, id));
      setDeleteError(err instanceof Error ? err.message : "Delete failed");
    },
  });

  // ── Helpers ────────────────────────────────────────────────────────────────
  function add(s: Set<string>, v: string) {
    const n = new Set(s);
    n.add(v);
    return n;
  }
  function del(s: Set<string>, v: string) {
    const n = new Set(s);
    n.delete(v);
    return n;
  }

  function openUploadForm(tf: PremarketTimeframe) {
    setUploadTf(tf);
    setUploadFile(null);
    setUploadFileError(null);
    setUploadNotes("");
    setUploadError(null);
  }

  function closeUploadForm() {
    setUploadTf(null);
    setUploadFile(null);
    setUploadFileError(null);
    setUploadNotes("");
    setUploadError(null);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setUploadFile(null);
    setUploadFileError(null);
    if (!f) return;
    if (f.size > MAX_BYTES) {
      setUploadFileError("File must be 10 MB or smaller");
      return;
    }
    if (!ACCEPTED_TYPES.includes(f.type)) {
      setUploadFileError("Only JPEG, PNG, WebP, or GIF images are accepted");
      return;
    }
    setUploadFile(f);
  }

  function handleUpload() {
    if (!uploadFile || !uploadTf) return;
    addMutation.mutate({ timeframe: uploadTf, file: uploadFile, notes: uploadNotes });
  }

  // ── Loading / error ────────────────────────────────────────────────────────
  const isLoading = entryLoading || (!!entryId && screenshotsLoading);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 py-8 text-navy-400">
        <Loader2 className="h-4 w-4 animate-spin text-gold-500" />
        Loading…
      </div>
    );
  }

  if (entryError || screenshotsError) {
    const msg =
      (entryErr instanceof Error ? entryErr.message : null) ??
      (screenshotsErr instanceof Error ? screenshotsErr.message : null) ??
      "Unknown error";
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-red-500/30 bg-red-500/10 p-8 text-center">
        <AlertTriangle className="h-6 w-6 text-red-400" />
        <p className="text-sm font-medium text-red-200">
          Couldn&apos;t load pre-market data
        </p>
        <p className="text-xs text-red-300/80">{msg}</p>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      {/* ── Lightbox ──────────────────────────────────────────────────────── */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4"
          onClick={() => setLightboxUrl(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightboxUrl}
            alt="Screenshot"
            className="max-h-[90vh] max-w-[90vw] rounded-xl object-contain shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            onClick={() => setLightboxUrl(null)}
            className="absolute right-5 top-5 rounded-full bg-navy-900/80 p-2 text-navy-200 transition-colors hover:bg-navy-800 hover:text-white"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      )}

      <div className="space-y-6">
        {/* ── News events placeholder ────────────────────────────────────── */}
        <div className="rounded-lg border border-dashed border-navy-700 bg-navy-900/30 p-4">
          <div className="flex items-center gap-2 text-navy-600">
            <Newspaper className="h-4 w-4 shrink-0" />
            <p className="text-xs font-semibold uppercase tracking-wider">
              High-Impact News
            </p>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-navy-700">
            Scheduled high-impact news events for this session will appear here.
            Data source will be wired in a later step.
          </p>
        </div>

        {/* ── Delete error banner ────────────────────────────────────────── */}
        {deleteError && (
          <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-sm text-red-300">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span className="flex-1">{deleteError}</span>
            <button
              onClick={() => setDeleteError(null)}
              className="text-red-400 transition-colors hover:text-red-200"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* ── Timeframe groups ───────────────────────────────────────────── */}
        {PREMARKET_TIMEFRAMES.map((tf) => {
          const shots = byTimeframe.get(tf) ?? [];
          const isUploadOpen = uploadTf === tf;

          return (
            <div key={tf} className="space-y-3">
              {/* Timeframe header row */}
              <div className="flex items-center gap-3">
                <span className="shrink-0 font-mono text-[11px] font-bold uppercase tracking-widest text-navy-500">
                  {tf}
                </span>
                <div className="h-px flex-1 bg-navy-800" />
                {!isUploadOpen && (
                  <button
                    onClick={() => openUploadForm(tf)}
                    className="flex shrink-0 items-center gap-1 rounded-md bg-navy-800 px-2.5 py-1 text-[11px] font-medium text-navy-400 transition-colors hover:bg-navy-700 hover:text-navy-200"
                  >
                    <Plus className="h-3 w-3" />
                    Add
                  </button>
                )}
              </div>

              {/* Inline upload form */}
              {isUploadOpen && (
                <div className="rounded-lg border border-navy-700 bg-navy-900/60 p-4">
                  <div className="space-y-3">
                    {/* File picker */}
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-navy-400">
                        Screenshot
                        <span className="ml-1 font-normal text-navy-600">
                          · JPEG, PNG, WebP, GIF · max 10 MB
                        </span>
                      </label>
                      <input
                        type="file"
                        accept={ACCEPTED}
                        onChange={handleFileChange}
                        className={cn(
                          "block w-full cursor-pointer rounded-lg border border-navy-700 bg-navy-900/40 text-sm text-navy-400",
                          "file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-navy-700",
                          "file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-navy-200 file:transition-colors file:hover:bg-navy-600",
                          "focus:outline-none"
                        )}
                      />
                      {uploadFileError && (
                        <p className="mt-1 text-xs text-red-400">{uploadFileError}</p>
                      )}
                      {uploadFile && !uploadFileError && (
                        <p className="mt-1 flex items-center gap-1 text-xs text-emerald-400">
                          <CheckCircle2 className="h-3 w-3" />
                          {uploadFile.name}
                        </p>
                      )}
                    </div>

                    {/* Notes */}
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-navy-400">
                        Notes{" "}
                        <span className="font-normal text-navy-600">optional</span>
                      </label>
                      <textarea
                        value={uploadNotes}
                        onChange={(e) => setUploadNotes(e.target.value)}
                        placeholder="What do you see on this timeframe?"
                        rows={2}
                        maxLength={2000}
                        className={cn(
                          "w-full resize-none rounded-lg border border-navy-700 bg-navy-900/40 px-3 py-2",
                          "text-sm text-navy-100 placeholder:text-navy-600",
                          "focus:border-gold-500/40 focus:outline-none focus:ring-1 focus:ring-gold-500/20",
                          "transition-colors"
                        )}
                      />
                    </div>

                    {uploadError && (
                      <p className="text-xs text-red-400">{uploadError}</p>
                    )}

                    {/* Form actions */}
                    <div className="flex items-center justify-end gap-2 border-t border-navy-800 pt-3">
                      <button
                        onClick={closeUploadForm}
                        disabled={addMutation.isPending}
                        className="rounded-md px-3 py-1.5 text-xs text-navy-400 transition-colors hover:text-navy-200 disabled:opacity-50"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleUpload}
                        disabled={
                          !uploadFile || !!uploadFileError || addMutation.isPending
                        }
                        className={cn(
                          "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                          "bg-gold-500/20 text-gold-300 ring-1 ring-gold-500/30 hover:bg-gold-500/30",
                          "disabled:pointer-events-none disabled:opacity-50"
                        )}
                      >
                        {addMutation.isPending && (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        )}
                        Upload
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Empty state (no screenshots, form closed) */}
              {shots.length === 0 && !isUploadOpen && (
                <div className="flex items-center justify-center rounded-lg border border-dashed border-navy-800 py-5">
                  <p className="text-[11px] text-navy-700">
                    No screenshots yet — click{" "}
                    <button
                      onClick={() => openUploadForm(tf)}
                      className="underline underline-offset-2 hover:text-navy-500 transition-colors"
                    >
                      Add
                    </button>{" "}
                    to upload
                  </p>
                </div>
              )}

              {/* Screenshot grid */}
              {shots.length > 0 && (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {shots.map((shot) => {
                    const imgUrl = screenshotPublicUrl(shot.storage_path);
                    const savedNote = shot.notes ?? "";
                    const draft =
                      shot.id in noteDrafts ? noteDrafts[shot.id] : savedNote;
                    const draftChanged = draft !== savedNote;
                    const isSaving = savingIds.has(shot.id);
                    const showFlash = savedFlashIds.has(shot.id);
                    const isDeleting = deletingIds.has(shot.id);
                    const confirmingDelete = confirmDeleteId === shot.id;
                    const noteError = noteErrors[shot.id];

                    return (
                      <div
                        key={shot.id}
                        className="overflow-hidden rounded-xl border border-navy-700 bg-navy-900/60"
                      >
                        {/* Thumbnail — click to enlarge */}
                        <button
                          onClick={() => setLightboxUrl(imgUrl)}
                          className="group relative block w-full overflow-hidden bg-navy-950"
                          aria-label="Enlarge screenshot"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={imgUrl}
                            alt={`${tf} screenshot`}
                            className="h-36 w-full object-cover transition-transform duration-200 group-hover:scale-105"
                          />
                          <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/35">
                            <Maximize2 className="h-5 w-5 text-white opacity-0 drop-shadow transition-opacity group-hover:opacity-100" />
                          </div>
                        </button>

                        {/* Notes + actions */}
                        <div className="space-y-2 p-3">
                          <textarea
                            value={draft}
                            onChange={(e) => {
                              setNoteDrafts((p) => ({
                                ...p,
                                [shot.id]: e.target.value,
                              }));
                              if (noteError)
                                setNoteErrors((p) => ({ ...p, [shot.id]: "" }));
                            }}
                            placeholder="Add notes…"
                            rows={2}
                            maxLength={2000}
                            className={cn(
                              "w-full resize-none rounded-md border bg-navy-900/40 px-2 py-1.5",
                              "text-xs text-navy-200 placeholder:text-navy-700",
                              "focus:outline-none focus:ring-1 transition-colors",
                              noteError
                                ? "border-red-500/50 focus:border-red-500/50 focus:ring-red-500/20"
                                : "border-navy-700/60 focus:border-gold-500/30 focus:ring-gold-500/10"
                            )}
                          />

                          {noteError && (
                            <p className="text-[10px] text-red-400">{noteError}</p>
                          )}

                          <div className="flex items-center justify-between gap-2">
                            {/* Save / flash */}
                            <div className="flex items-center gap-1">
                              {showFlash && (
                                <span className="flex items-center gap-0.5 text-[10px] text-emerald-400">
                                  <CheckCircle2 className="h-2.5 w-2.5" />
                                  Saved
                                </span>
                              )}
                              {draftChanged && !showFlash && (
                                <button
                                  onClick={() => {
                                    setSavingIds((p) => add(p, shot.id));
                                    updateNotesMutation.mutate({
                                      id: shot.id,
                                      notes: draft,
                                      entryId: shot.premarket_entry_id,
                                    });
                                  }}
                                  disabled={isSaving}
                                  className={cn(
                                    "flex items-center gap-0.5 rounded px-2 py-0.5 text-[10px] font-medium transition-colors",
                                    "bg-gold-500/20 text-gold-300 hover:bg-gold-500/30",
                                    "disabled:pointer-events-none disabled:opacity-50"
                                  )}
                                >
                                  {isSaving && (
                                    <Loader2 className="h-2.5 w-2.5 animate-spin" />
                                  )}
                                  Save
                                </button>
                              )}
                            </div>

                            {/* Delete */}
                            {confirmingDelete ? (
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => {
                                    setDeletingIds((p) => add(p, shot.id));
                                    deleteMutation.mutate({
                                      id: shot.id,
                                      path: shot.storage_path,
                                      entryId: shot.premarket_entry_id,
                                    });
                                  }}
                                  disabled={isDeleting}
                                  className="flex items-center gap-0.5 rounded bg-red-500/20 px-2 py-0.5 text-[10px] font-medium text-red-300 transition-colors hover:bg-red-500/30 disabled:opacity-50"
                                >
                                  {isDeleting && (
                                    <Loader2 className="h-2.5 w-2.5 animate-spin" />
                                  )}
                                  Delete
                                </button>
                                <button
                                  onClick={() => setConfirmDeleteId(null)}
                                  className="rounded p-0.5 text-navy-600 transition-colors hover:text-navy-400"
                                  aria-label="Cancel"
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setConfirmDeleteId(shot.id)}
                                className="rounded p-1 text-navy-700 transition-colors hover:text-red-400"
                                aria-label="Delete screenshot"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
