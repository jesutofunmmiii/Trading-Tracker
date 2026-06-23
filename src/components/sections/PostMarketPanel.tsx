"use client";

// Data sources: postmarket_entries (one per date, lazy-created on first upload or note save),
// postmarket_screenshots (many per entry, grouped by timeframe).
// Storage: journal-screenshots bucket, path {user_id}/postmarket/{entry_id}/{file}.

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  BarChart2,
  CheckCircle2,
  ChevronDown,
  Loader2,
  Maximize2,
  Plus,
  TrendingUp,
  Trash2,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PREMARKET_TIMEFRAMES } from "@/lib/queries/premarket";
import {
  postmarketKeys,
  postmarketScreenshotPublicUrl,
  fetchPostmarketEntry,
  fetchPostmarketScreenshots,
  addPostmarketScreenshot,
  updatePostmarketScreenshotNotes,
  deletePostmarketScreenshot,
  deleteMultiplePostmarketScreenshots,
  saveFollowupNotes,
} from "@/lib/queries/postmarket";
import type { PostmarketScreenshot, PremarketTimeframe } from "@/lib/types";

// ── Constants ─────────────────────────────────────────────────────────────────

const ACCEPTED = "image/jpeg,image/png,image/webp,image/gif";
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_BYTES = 10 * 1024 * 1024;

// ── PostMarketPanel ───────────────────────────────────────────────────────────

export function PostMarketPanel({ date }: { date: string }) {
  const queryClient = useQueryClient();

  // ── Lightbox ───────────────────────────────────────────────────────────────
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  // ── Timeframe visibility: user-explicitly-opened + those with screenshots ──
  const [openTimeframes, setOpenTimeframes] = useState<Set<PremarketTimeframe>>(
    new Set()
  );
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [confirmRemoveTf, setConfirmRemoveTf] =
    useState<PremarketTimeframe | null>(null);

  // ── Follow-up notes ("How did the session actually play out?") ─────────────
  // null = use entry value (not yet edited this session)
  const [followupNotesDraft, setFollowupNotesDraft] = useState<string | null>(
    null
  );
  const [followupNotesSaving, setFollowupNotesSaving] = useState(false);
  const [followupNotesFlash, setFollowupNotesFlash] = useState(false);
  const [followupNotesError, setFollowupNotesError] = useState<string | null>(
    null
  );

  // ── Upload form state (one open at a time, keyed by timeframe) ─────────────
  const [uploadTf, setUploadTf] = useState<PremarketTimeframe | null>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadFileError, setUploadFileError] = useState<string | null>(null);
  const [uploadNotes, setUploadNotes] = useState("");
  const [uploadError, setUploadError] = useState<string | null>(null);

  // ── Per-screenshot notes editing ───────────────────────────────────────────
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const [savedFlashIds, setSavedFlashIds] = useState<Set<string>>(new Set());
  const [noteErrors, setNoteErrors] = useState<Record<string, string>>({});

  // ── Per-screenshot delete ──────────────────────────────────────────────────
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // ── Queries ────────────────────────────────────────────────────────────────
  const {
    data: entry,
    isLoading: entryLoading,
    isError: entryIsError,
    error: entryErr,
  } = useQuery({
    queryKey: postmarketKeys.entry(date),
    queryFn: () => fetchPostmarketEntry(date),
  });

  const entryId = entry?.id ?? "";

  const {
    data: screenshots = [],
    isLoading: screenshotsLoading,
    isError: screenshotsIsError,
    error: screenshotsErr,
  } = useQuery({
    queryKey: postmarketKeys.screenshots(entryId),
    queryFn: () => fetchPostmarketScreenshots(entryId),
    enabled: !!entryId,
  });

  // ── Derived state ──────────────────────────────────────────────────────────

  const byTimeframe = useMemo(() => {
    const map = new Map<PremarketTimeframe, PostmarketScreenshot[]>();
    for (const tf of PREMARKET_TIMEFRAMES) map.set(tf, []);
    for (const shot of screenshots)
      map.get(shot.timeframe as PremarketTimeframe)?.push(shot);
    return map;
  }, [screenshots]);

  // Active = user-opened union screenshots-derived, rendered in canonical order.
  const activeTimeframes = useMemo(() => {
    const result = new Set(openTimeframes);
    for (const shot of screenshots) result.add(shot.timeframe as PremarketTimeframe);
    return result;
  }, [openTimeframes, screenshots]);

  const availableToAdd = PREMARKET_TIMEFRAMES.filter(
    (tf) => !activeTimeframes.has(tf)
  );

  // Follow-up notes: null draft → read from loaded entry.
  const savedFollowupNotes = entry?.followup_notes ?? "";
  const effectiveFollowupNotes = followupNotesDraft ?? savedFollowupNotes;
  const followupNotesDraftChanged = effectiveFollowupNotes !== savedFollowupNotes;

  // ── Dropdown click-outside ─────────────────────────────────────────────────
  useEffect(() => {
    if (!dropdownOpen) return;
    function handler(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [dropdownOpen]);

  // ── Mutations ──────────────────────────────────────────────────────────────

  const saveFollowupNotesMutation = useMutation({
    mutationFn: ({ notes }: { notes: string }) => saveFollowupNotes(date, notes),
    onSuccess: () => {
      setFollowupNotesSaving(false);
      setFollowupNotesDraft(null);
      setFollowupNotesFlash(true);
      setTimeout(() => setFollowupNotesFlash(false), 2000);
      queryClient.invalidateQueries({ queryKey: postmarketKeys.entry(date) });
      queryClient.invalidateQueries({ queryKey: ["journal", "activity"] });
    },
    onError: (err) => {
      setFollowupNotesSaving(false);
      setFollowupNotesError(err instanceof Error ? err.message : "Save failed");
    },
  });

  const addMutation = useMutation({
    mutationFn: (vars: {
      timeframe: PremarketTimeframe;
      file: File;
      notes: string;
    }) => addPostmarketScreenshot({ date, ...vars }),
    onSuccess: (newShot) => {
      queryClient.invalidateQueries({ queryKey: postmarketKeys.entry(date) });
      queryClient.invalidateQueries({
        queryKey: postmarketKeys.screenshots(newShot.postmarket_entry_id),
      });
      queryClient.invalidateQueries({ queryKey: ["journal", "activity"] });
      closeUploadForm();
    },
    onError: (err) => {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
    },
  });

  const updateNotesMutation = useMutation({
    mutationFn: ({
      id,
      notes,
    }: {
      id: string;
      notes: string;
      entryId: string;
    }) => updatePostmarketScreenshotNotes(id, notes),
    onSuccess: (_, { id, notes, entryId: eid }) => {
      setSavingIds((p) => del(p, id));
      setNoteDrafts((p) => ({ ...p, [id]: notes }));
      setSavedFlashIds((p) => add(p, id));
      setTimeout(() => setSavedFlashIds((p) => del(p, id)), 2000);
      queryClient.invalidateQueries({
        queryKey: postmarketKeys.screenshots(eid),
      });
    },
    onError: (err, { id }) => {
      setSavingIds((p) => del(p, id));
      setNoteErrors((p) => ({
        ...p,
        [id]: err instanceof Error ? err.message : "Save failed",
      }));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: ({
      id,
      path,
    }: {
      id: string;
      path: string;
      entryId: string;
    }) => deletePostmarketScreenshot(id, path),
    onSuccess: (_, { id, entryId: eid }) => {
      setDeletingIds((p) => del(p, id));
      setConfirmDeleteId(null);
      queryClient.invalidateQueries({
        queryKey: postmarketKeys.screenshots(eid),
      });
      queryClient.invalidateQueries({ queryKey: ["journal", "activity"] });
    },
    onError: (err, { id }) => {
      setDeletingIds((p) => del(p, id));
      setDeleteError(err instanceof Error ? err.message : "Delete failed");
    },
  });

  const deleteTimeframeMutation = useMutation({
    mutationFn: ({
      shots,
    }: {
      shots: PostmarketScreenshot[];
      tf: PremarketTimeframe;
    }) => deleteMultiplePostmarketScreenshots(shots),
    onSuccess: (_, { tf }) => {
      setConfirmRemoveTf(null);
      setOpenTimeframes((p) => {
        const n = new Set(p);
        n.delete(tf);
        return n;
      });
      if (entryId) {
        queryClient.invalidateQueries({
          queryKey: postmarketKeys.screenshots(entryId),
        });
        queryClient.invalidateQueries({ queryKey: ["journal", "activity"] });
      }
    },
    onError: (err) => {
      setDeleteError(
        err instanceof Error ? err.message : "Failed to remove timeframe"
      );
      setConfirmRemoveTf(null);
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
    addMutation.mutate({
      timeframe: uploadTf,
      file: uploadFile,
      notes: uploadNotes,
    });
  }

  function initiateRemoveTf(tf: PremarketTimeframe) {
    const shots = byTimeframe.get(tf) ?? [];
    if (shots.length === 0) {
      setOpenTimeframes((p) => {
        const n = new Set(p);
        n.delete(tf);
        return n;
      });
    } else {
      setConfirmRemoveTf(tf);
    }
  }

  // ── Loading / error guard ──────────────────────────────────────────────────
  const isLoading = entryLoading || (!!entryId && screenshotsLoading);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 py-8 text-navy-400">
        <Loader2 className="h-4 w-4 animate-spin text-gold-500" />
        Loading…
      </div>
    );
  }

  if (entryIsError || screenshotsIsError) {
    const msg =
      (entryErr instanceof Error ? entryErr.message : null) ??
      (screenshotsErr instanceof Error ? screenshotsErr.message : null) ??
      "Unknown error";
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-red-500/30 bg-red-500/10 p-8 text-center">
        <AlertTriangle className="h-6 w-6 text-red-400" />
        <p className="text-sm font-medium text-red-200">
          Couldn&apos;t load post-market data
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
            alt="Screenshot enlarged"
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
        {/* ── Section header ─────────────────────────────────────────────── */}
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-sky-500/15">
            <BarChart2 className="h-4 w-4 text-sky-400" />
          </div>
          <h3 className="text-sm font-semibold text-navy-100">
            Post-Market Log
          </h3>
        </div>

        {/* ══ Section 1 — Session Review ════════════════════════════════════ */}
        <div className="space-y-5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-navy-500">
            Section 1 — Session Review
          </p>

          {/* ── Follow-up notes ─────────────────────────────────────────── */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold uppercase tracking-wider text-navy-500">
              How did the session actually play out?
            </label>
            <textarea
              value={effectiveFollowupNotes}
              onChange={(e) => {
                setFollowupNotesDraft(e.target.value);
                if (followupNotesError) setFollowupNotesError(null);
              }}
              placeholder="Compare vs your pre-market plan — what happened, what did you learn?"
              rows={3}
              maxLength={4000}
              className={cn(
                "w-full resize-none rounded-lg border bg-navy-900/40 px-3 py-2.5",
                "text-sm text-navy-100 placeholder:text-navy-600",
                "focus:outline-none focus:ring-1 transition-colors",
                followupNotesError
                  ? "border-red-500/50 focus:border-red-500/50 focus:ring-red-500/20"
                  : "border-navy-700 focus:border-sky-500/40 focus:ring-sky-500/20"
              )}
            />
            {followupNotesError && (
              <p className="text-xs text-red-400">{followupNotesError}</p>
            )}
            <div className="flex items-center justify-end gap-2 min-h-[24px]">
              {followupNotesFlash && (
                <span className="flex items-center gap-1 text-xs text-emerald-400">
                  <CheckCircle2 className="h-3 w-3" />
                  Saved
                </span>
              )}
              {followupNotesDraftChanged && !followupNotesFlash && (
                <button
                  onClick={() => {
                    setFollowupNotesSaving(true);
                    saveFollowupNotesMutation.mutate({
                      notes: effectiveFollowupNotes,
                    });
                  }}
                  disabled={followupNotesSaving}
                  className={cn(
                    "flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                    "bg-sky-500/15 text-sky-300 ring-1 ring-sky-500/30 hover:bg-sky-500/25",
                    "disabled:pointer-events-none disabled:opacity-50"
                  )}
                >
                  {followupNotesSaving && (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  )}
                  Save
                </button>
              )}
            </div>
          </div>

          {/* ── Error banner (delete failures) ──────────────────────────── */}
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

          {/* ── No-timeframe hint ────────────────────────────────────────── */}
          {activeTimeframes.size === 0 && (
            <p className="text-center text-xs text-navy-700">
              Add a timeframe section below to upload follow-up screenshots.
            </p>
          )}

          {/* ── Active timeframe sections ────────────────────────────────── */}
          {PREMARKET_TIMEFRAMES.filter((tf) => activeTimeframes.has(tf)).map(
            (tf) => {
              const shots = byTimeframe.get(tf) ?? [];
              const isUploadOpen = uploadTf === tf;
              const isConfirmingRemove = confirmRemoveTf === tf;
              const isRemovingTf =
                deleteTimeframeMutation.isPending &&
                deleteTimeframeMutation.variables?.tf === tf;

              return (
                <div key={tf} className="space-y-3">
                  {/* Timeframe header */}
                  <div className="flex items-center gap-2">
                    <span className="shrink-0 font-mono text-[11px] font-bold uppercase tracking-widest text-navy-500">
                      {tf}
                    </span>
                    <div className="h-px flex-1 bg-navy-800" />
                    {/* Remove timeframe control */}
                    {isConfirmingRemove ? (
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-navy-500">
                          Remove {shots.length} screenshot
                          {shots.length !== 1 ? "s" : ""}?
                        </span>
                        <button
                          onClick={() =>
                            deleteTimeframeMutation.mutate({ shots, tf })
                          }
                          disabled={isRemovingTf}
                          className="flex items-center gap-0.5 rounded bg-red-500/20 px-2 py-0.5 text-[10px] font-medium text-red-300 transition-colors hover:bg-red-500/30 disabled:opacity-50"
                        >
                          {isRemovingTf && (
                            <Loader2 className="h-2.5 w-2.5 animate-spin" />
                          )}
                          Yes
                        </button>
                        <button
                          onClick={() => setConfirmRemoveTf(null)}
                          className="rounded p-0.5 text-navy-600 transition-colors hover:text-navy-400"
                          aria-label="Cancel"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => initiateRemoveTf(tf)}
                        className="rounded p-0.5 text-navy-800 transition-colors hover:text-navy-500"
                        aria-label={`Remove ${tf} timeframe`}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                    {!isUploadOpen && !isConfirmingRemove && (
                      <button
                        onClick={() => openUploadForm(tf)}
                        className="flex shrink-0 items-center gap-1 rounded-md bg-navy-800 px-2.5 py-1 text-[11px] font-medium text-navy-400 transition-colors hover:bg-navy-700 hover:text-navy-200"
                      >
                        <Plus className="h-3 w-3" />
                        Add
                      </button>
                    )}
                  </div>

                  {/* Upload form */}
                  {isUploadOpen && (
                    <div className="rounded-lg border border-navy-700 bg-navy-900/60 p-4">
                      <div className="space-y-3">
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
                            <p className="mt-1 text-xs text-red-400">
                              {uploadFileError}
                            </p>
                          )}
                          {uploadFile && !uploadFileError && (
                            <p className="mt-1 flex items-center gap-1 text-xs text-emerald-400">
                              <CheckCircle2 className="h-3 w-3" />
                              {uploadFile.name}
                            </p>
                          )}
                        </div>
                        <div>
                          <label className="mb-1.5 block text-xs font-medium text-navy-400">
                            Notes{" "}
                            <span className="font-normal text-navy-600">
                              optional
                            </span>
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
                              "focus:border-sky-500/40 focus:outline-none focus:ring-1 focus:ring-sky-500/20",
                              "transition-colors"
                            )}
                          />
                        </div>
                        {uploadError && (
                          <p className="text-xs text-red-400">{uploadError}</p>
                        )}
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
                              !uploadFile ||
                              !!uploadFileError ||
                              addMutation.isPending
                            }
                            className={cn(
                              "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                              "bg-sky-500/15 text-sky-300 ring-1 ring-sky-500/30 hover:bg-sky-500/25",
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

                  {/* Empty state */}
                  {shots.length === 0 && !isUploadOpen && (
                    <div className="flex items-center justify-center rounded-lg border border-dashed border-navy-800 py-5">
                      <p className="text-[11px] text-navy-700">
                        No screenshots yet —{" "}
                        <button
                          onClick={() => openUploadForm(tf)}
                          className="underline underline-offset-2 transition-colors hover:text-navy-500"
                        >
                          Add
                        </button>{" "}
                        to upload
                      </p>
                    </div>
                  )}

                  {/* Screenshot grid — square 1:1 thumbnails */}
                  {shots.length > 0 && (
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                      {shots.map((shot) => {
                        const imgUrl = postmarketScreenshotPublicUrl(
                          shot.storage_path
                        );
                        const savedNote = shot.notes ?? "";
                        const draft =
                          shot.id in noteDrafts
                            ? noteDrafts[shot.id]
                            : savedNote;
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
                            {/* Square thumbnail */}
                            <button
                              onClick={() => setLightboxUrl(imgUrl)}
                              className="group relative block w-full overflow-hidden bg-navy-950"
                              aria-label="Enlarge screenshot"
                            >
                              <div className="aspect-square w-full overflow-hidden">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={imgUrl}
                                  alt={`${tf} screenshot`}
                                  className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
                                />
                              </div>
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
                                    setNoteErrors((p) => ({
                                      ...p,
                                      [shot.id]: "",
                                    }));
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
                                    : "border-navy-700/60 focus:border-sky-500/30 focus:ring-sky-500/10"
                                )}
                              />
                              {noteError && (
                                <p className="text-[10px] text-red-400">
                                  {noteError}
                                </p>
                              )}
                              <div className="flex items-center justify-between gap-2">
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
                                        setSavingIds((p) =>
                                          add(p, shot.id)
                                        );
                                        updateNotesMutation.mutate({
                                          id: shot.id,
                                          notes: draft,
                                          entryId:
                                            shot.postmarket_entry_id,
                                        });
                                      }}
                                      disabled={isSaving}
                                      className={cn(
                                        "flex items-center gap-0.5 rounded px-2 py-0.5 text-[10px] font-medium transition-colors",
                                        "bg-sky-500/15 text-sky-300 hover:bg-sky-500/25",
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
                                {confirmingDelete ? (
                                  <div className="flex items-center gap-1">
                                    <button
                                      onClick={() => {
                                        setDeletingIds((p) =>
                                          add(p, shot.id)
                                        );
                                        deleteMutation.mutate({
                                          id: shot.id,
                                          path: shot.storage_path,
                                          entryId:
                                            shot.postmarket_entry_id,
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
                                      onClick={() =>
                                        setConfirmDeleteId(null)
                                      }
                                      className="rounded p-0.5 text-navy-600 transition-colors hover:text-navy-400"
                                      aria-label="Cancel"
                                    >
                                      <X className="h-3 w-3" />
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() =>
                                      setConfirmDeleteId(shot.id)
                                    }
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
            }
          )}

          {/* ── Add timeframe dropdown ───────────────────────────────────── */}
          {availableToAdd.length > 0 && (
            <div ref={dropdownRef} className="relative">
              <button
                onClick={() => setDropdownOpen((o) => !o)}
                className={cn(
                  "flex items-center gap-2 rounded-lg border border-dashed px-4 py-2.5 text-xs font-medium transition-colors",
                  dropdownOpen
                    ? "border-navy-600 text-navy-300"
                    : "border-navy-700 text-navy-500 hover:border-navy-600 hover:text-navy-300"
                )}
              >
                <Plus className="h-3.5 w-3.5" />
                Add timeframe
                <ChevronDown
                  className={cn(
                    "h-3 w-3 transition-transform",
                    dropdownOpen && "rotate-180"
                  )}
                />
              </button>
              {dropdownOpen && (
                <div className="absolute left-0 top-full z-20 mt-1 min-w-[140px] overflow-hidden rounded-lg border border-navy-700 bg-navy-900 shadow-xl">
                  {availableToAdd.map((tf) => (
                    <button
                      key={tf}
                      onClick={() => {
                        setOpenTimeframes((p) => {
                          const n = new Set(p);
                          n.add(tf);
                          return n;
                        });
                        setDropdownOpen(false);
                      }}
                      className="w-full px-4 py-2 text-left font-mono text-xs font-bold uppercase tracking-widest text-navy-400 transition-colors hover:bg-navy-800 hover:text-navy-200"
                    >
                      {tf}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ══ Section 2 placeholder — Trade Log (next build step) ══════════ */}
        <div className="border-t border-navy-800 pt-5">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-navy-500">
            Section 2 — Trade Log
          </p>
          <div className="flex items-start gap-3 rounded-xl border border-dashed border-navy-700/50 bg-navy-800/30 px-4 py-5">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-navy-700/60">
              <TrendingUp className="h-4 w-4 text-navy-500" />
            </div>
            <div>
              <p className="text-sm font-medium text-navy-400">Trade Log</p>
              <p className="mt-1 text-xs leading-relaxed text-navy-600">
                Individual trade entries (pair, P&amp;L, session, entry type,
                screenshots) will be logged here — coming in the next build
                step.
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
