"use client";

// Data sources: premarket_entries (Pre-Market tab), trades (Post-Market — stub for next step).
// File attachments stored in Supabase Storage bucket: premarket-attachments.

import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  BarChart2,
  BookOpen,
  CheckCircle2,
  FileText,
  Loader2,
  Paperclip,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Placeholder } from "./_Placeholder";
import {
  premarketKeys,
  fetchPremarketEntries,
  upsertPremarketEntry,
  deletePremarketEntry,
  PremarketFormSchema,
  type PremarketFormValues,
} from "@/lib/queries/premarket";
import type { PremarketEntry } from "@/lib/types";

// ── Date helpers ──────────────────────────────────────────────────────────────

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatEntryDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function isImageFile(name: string | null): boolean {
  return /\.(jpg|jpeg|png|webp|gif)$/i.test(name ?? "");
}

// ── Sub-components ────────────────────────────────────────────────────────────

function FieldBlock({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div>
      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-navy-500">
        {label}
      </p>
      <p className="whitespace-pre-wrap text-sm leading-relaxed text-navy-200">{value}</p>
    </div>
  );
}

function EntryCard({
  entry,
  onEdit,
  onDelete,
  isDeleting,
}: {
  entry: PremarketEntry;
  onEdit: () => void;
  onDelete: () => void;
  isDeleting: boolean;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <article className="space-y-4 rounded-xl border border-navy-700 bg-navy-800/60 p-5">
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-navy-50">{formatEntryDate(entry.entry_date)}</p>
          <p className="mt-0.5 text-xs text-navy-500">
            Logged at {formatTimestamp(entry.created_at)}
            {entry.updated_at !== entry.created_at && " · edited"}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            onClick={onEdit}
            className="flex items-center gap-1.5 rounded-lg border border-navy-700 bg-navy-700/50 px-2.5 py-1.5 text-xs font-medium text-navy-300 transition-colors hover:border-navy-600 hover:text-navy-100"
          >
            <Pencil className="h-3 w-3" />
            Edit
          </button>

          {confirmDelete ? (
            <div className="flex items-center gap-1">
              <button
                onClick={() => { onDelete(); setConfirmDelete(false); }}
                disabled={isDeleting}
                className="flex items-center gap-1 rounded-lg bg-red-500/20 px-2.5 py-1.5 text-xs font-medium text-red-300 transition-colors hover:bg-red-500/30 disabled:pointer-events-none disabled:opacity-50"
              >
                {isDeleting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                Confirm
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="rounded-lg p-1.5 text-navy-500 transition-colors hover:text-navy-300"
                aria-label="Cancel delete"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              className="rounded-lg p-1.5 text-navy-600 transition-colors hover:text-red-400"
              aria-label="Delete entry"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Content grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FieldBlock label="Market Conditions" value={entry.market_conditions} />
        <FieldBlock label="Key Levels" value={entry.key_levels} />
        <FieldBlock label="Planned Trades" value={entry.planned_trades} />
        <FieldBlock label="Risk / Reward" value={entry.risk_reward_ratio} />
      </div>

      {entry.notes && (
        <div className="border-t border-navy-700/60 pt-4">
          <FieldBlock label="Notes" value={entry.notes} />
        </div>
      )}

      {/* Attachment */}
      {entry.attachment_url && (
        <div className="flex items-center gap-3 border-t border-navy-700/60 pt-4">
          {isImageFile(entry.attachment_name) ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={entry.attachment_url}
              alt={entry.attachment_name ?? "attachment"}
              className="h-14 w-14 rounded-lg border border-navy-600 object-cover"
            />
          ) : (
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-navy-700">
              <FileText className="h-5 w-5 text-navy-400" />
            </div>
          )}
          <a
            href={entry.attachment_url}
            target="_blank"
            rel="noopener noreferrer"
            className="min-w-0 truncate text-sm text-gold-400 underline-offset-2 transition-colors hover:text-gold-300 hover:underline"
          >
            {entry.attachment_name ?? "View attachment"}
          </a>
        </div>
      )}
    </article>
  );
}

// ── JournalSection ────────────────────────────────────────────────────────────

type Tab = "pre-market" | "post-market";

const ACCEPTED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
];

const BLANK_FORM = {
  entry_date: todayStr(),
  market_conditions: "",
  key_levels: "",
  planned_trades: "",
  risk_reward_ratio: "",
  notes: "",
};

export function JournalSection() {
  const queryClient = useQueryClient();
  const formRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Tab state ──────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<Tab>("pre-market");

  // ── Form state ─────────────────────────────────────────────────────────────
  const [formOpen, setFormOpen] = useState(false);
  const [formValues, setFormValues] = useState(BLANK_FORM);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  // ── Delete state ───────────────────────────────────────────────────────────
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // ── Query ──────────────────────────────────────────────────────────────────
  const {
    data: entries = [],
    isLoading,
    isError,
    error: fetchErr,
  } = useQuery({
    queryKey: premarketKeys.list(),
    queryFn: fetchPremarketEntries,
  });

  // Derived: does the currently-selected form date already have an entry?
  const existingForDate =
    entries.find((e) => e.entry_date === formValues.entry_date) ?? null;

  // ── Upsert mutation ────────────────────────────────────────────────────────
  const upsertMutation = useMutation({
    mutationFn: ({
      values,
      file,
      existing,
    }: {
      values: PremarketFormValues;
      file: File | null;
      existing?: { attachment_url: string | null; attachment_name: string | null };
    }) => upsertPremarketEntry(values, file, existing),

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: premarketKeys.list() });
      setFormOpen(false);
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setFieldErrors({});
      setSubmitError(null);
    },

    onError: (err) => {
      setSubmitError(err instanceof Error ? err.message : "Failed to save entry");
    },
  });

  // ── Delete mutation ────────────────────────────────────────────────────────
  const deleteMutation = useMutation({
    mutationFn: ({ id, url }: { id: string; url: string | null }) =>
      deletePremarketEntry(id, url),

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: premarketKeys.list() });
    },

    onError: (err) => {
      setDeleteError(err instanceof Error ? err.message : "Failed to delete entry");
    },

    onSettled: () => {
      setDeletingId(null);
    },
  });

  // ── Handlers ───────────────────────────────────────────────────────────────
  function openNewForm() {
    setFormValues({ ...BLANK_FORM, entry_date: todayStr() });
    setSelectedFile(null);
    setFileError(null);
    setFieldErrors({});
    setSubmitError(null);
    setFormOpen(true);
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
  }

  function openEditForm(entry: PremarketEntry) {
    setFormValues({
      entry_date: entry.entry_date,
      market_conditions: entry.market_conditions ?? "",
      key_levels: entry.key_levels ?? "",
      planned_trades: entry.planned_trades ?? "",
      risk_reward_ratio: entry.risk_reward_ratio ?? "",
      notes: entry.notes ?? "",
    });
    setSelectedFile(null);
    setFileError(null);
    setFieldErrors({});
    setSubmitError(null);
    setFormOpen(true);
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    if (!f) { setSelectedFile(null); setFileError(null); return; }
    if (f.size > 10 * 1024 * 1024) {
      setFileError("File must be 10 MB or smaller");
      setSelectedFile(null);
      e.target.value = "";
      return;
    }
    if (!ACCEPTED_TYPES.includes(f.type)) {
      setFileError("Only images (JPEG, PNG, WebP, GIF) and PDFs are accepted");
      setSelectedFile(null);
      e.target.value = "";
      return;
    }
    setFileError(null);
    setSelectedFile(f);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const raw = {
      ...formValues,
      notes: formValues.notes.trim() || null,
    };

    const result = PremarketFormSchema.safeParse(raw);
    if (!result.success) {
      const errs: Record<string, string> = {};
      for (const issue of result.error.issues) {
        errs[String(issue.path[0])] = issue.message;
      }
      setFieldErrors(errs);
      return;
    }
    setFieldErrors({});

    const existing = existingForDate
      ? {
          attachment_url: existingForDate.attachment_url,
          attachment_name: existingForDate.attachment_name,
        }
      : undefined;

    upsertMutation.mutate({ values: result.data, file: selectedFile, existing });
  }

  function field(name: keyof typeof formValues, value: string) {
    setFormValues((p) => ({ ...p, [name]: value }));
    if (fieldErrors[name]) setFieldErrors((p) => ({ ...p, [name]: "" }));
  }

  // ── Textarea className helper ──────────────────────────────────────────────
  const textareaClass = (hasError: boolean) =>
    cn(
      "w-full resize-none rounded-lg border bg-navy-900/60 px-3 py-2.5 text-sm text-navy-100",
      "placeholder:text-navy-600 focus:outline-none focus:ring-1 transition-colors",
      hasError
        ? "border-red-500/60 focus:border-red-500/60 focus:ring-red-500/20"
        : "border-navy-700 focus:border-gold-500/40 focus:ring-gold-500/20"
    );

  const inputClass = (hasError: boolean) =>
    cn(
      "w-full rounded-lg border bg-navy-900/60 px-3 py-2.5 text-sm text-navy-100",
      "placeholder:text-navy-600 focus:outline-none focus:ring-1 transition-colors",
      hasError
        ? "border-red-500/60 focus:border-red-500/60 focus:ring-red-500/20"
        : "border-navy-700 focus:border-gold-500/40 focus:ring-gold-500/20"
    );

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Section header */}
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gold-500/15 ring-1 ring-gold-500/25">
          <BookOpen className="h-5 w-5 text-gold-400" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-navy-50">Trading Journal</h1>
          <p className="mt-1 text-sm text-navy-400">
            Pre-market analysis and post-market trade logs.
          </p>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex rounded-lg border border-navy-700 bg-navy-800/60 p-0.5 w-fit">
        {(["pre-market", "post-market"] as Tab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "rounded-md px-4 py-2 text-sm font-medium capitalize transition-colors",
              activeTab === tab
                ? "bg-navy-600 text-navy-100"
                : "text-navy-400 hover:text-navy-200"
            )}
          >
            {tab === "pre-market" ? "Pre-Market" : "Post-Market"}
          </button>
        ))}
      </div>

      {/* ── PRE-MARKET TAB ─────────────────────────────────────────────────── */}
      {activeTab === "pre-market" && (
        <div className="space-y-5">
          {/* Action bar */}
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-navy-400">
              Log your market read before the session opens.
            </p>
            {!formOpen && (
              <button
                onClick={openNewForm}
                className="flex items-center gap-1.5 rounded-lg bg-gold-500/15 px-3 py-2 text-sm font-medium text-gold-300 ring-1 ring-gold-500/25 transition-colors hover:bg-gold-500/25"
              >
                <Plus className="h-4 w-4" />
                New Entry
              </button>
            )}
          </div>

          {/* ── Form ─────────────────────────────────────────────────────── */}
          {formOpen && (
            <div ref={formRef} className="rounded-xl border border-navy-600 bg-navy-800/80 p-5">
              <div className="mb-4 flex items-center justify-between">
                <p className="text-sm font-semibold text-navy-100">
                  {existingForDate ? "Edit Entry" : "New Entry"}
                </p>
                <button
                  onClick={() => { setFormOpen(false); setFieldErrors({}); setSubmitError(null); }}
                  className="text-navy-500 transition-colors hover:text-navy-300"
                  aria-label="Close form"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Existing-entry warning */}
              {existingForDate && (
                <div className="mb-4 flex items-center gap-2 rounded-lg border border-gold-500/30 bg-gold-500/10 px-3 py-2.5 text-sm text-gold-300">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  An entry already exists for this date — saving will update it.
                </div>
              )}

              <form onSubmit={handleSubmit} noValidate className="space-y-4">
                {/* Entry date */}
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-navy-400">
                    Entry Date
                  </label>
                  <input
                    type="date"
                    value={formValues.entry_date}
                    onChange={(e) => field("entry_date", e.target.value)}
                    max={todayStr()}
                    className={inputClass(!!fieldErrors.entry_date)}
                  />
                  {fieldErrors.entry_date && (
                    <p className="mt-1 text-xs text-red-400">{fieldErrors.entry_date}</p>
                  )}
                </div>

                {/* Market Conditions */}
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-navy-400">
                    Market Conditions <span className="text-red-400">*</span>
                  </label>
                  <textarea
                    value={formValues.market_conditions}
                    onChange={(e) => field("market_conditions", e.target.value)}
                    placeholder="Overall market bias, session context, macro backdrop…"
                    rows={4}
                    maxLength={3000}
                    className={textareaClass(!!fieldErrors.market_conditions)}
                  />
                  {fieldErrors.market_conditions && (
                    <p className="mt-1 text-xs text-red-400">{fieldErrors.market_conditions}</p>
                  )}
                </div>

                {/* Key Levels */}
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-navy-400">
                    Key Levels Identified <span className="text-red-400">*</span>
                  </label>
                  <textarea
                    value={formValues.key_levels}
                    onChange={(e) => field("key_levels", e.target.value)}
                    placeholder="Support / resistance, liquidity zones, PDH/PDL, weekly highs…"
                    rows={3}
                    maxLength={2000}
                    className={textareaClass(!!fieldErrors.key_levels)}
                  />
                  {fieldErrors.key_levels && (
                    <p className="mt-1 text-xs text-red-400">{fieldErrors.key_levels}</p>
                  )}
                </div>

                {/* Planned Trades */}
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-navy-400">
                    Planned Trades <span className="text-red-400">*</span>
                  </label>
                  <textarea
                    value={formValues.planned_trades}
                    onChange={(e) => field("planned_trades", e.target.value)}
                    placeholder="Setups to watch, pairs, entry criteria, invalidation…"
                    rows={4}
                    maxLength={3000}
                    className={textareaClass(!!fieldErrors.planned_trades)}
                  />
                  {fieldErrors.planned_trades && (
                    <p className="mt-1 text-xs text-red-400">{fieldErrors.planned_trades}</p>
                  )}
                </div>

                {/* Risk / Reward */}
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-navy-400">
                    Risk / Reward <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={formValues.risk_reward_ratio}
                    onChange={(e) => field("risk_reward_ratio", e.target.value)}
                    placeholder="e.g. 1:3, minimum 1:2, avg ≥ 1:2.5"
                    maxLength={100}
                    className={inputClass(!!fieldErrors.risk_reward_ratio)}
                  />
                  {fieldErrors.risk_reward_ratio && (
                    <p className="mt-1 text-xs text-red-400">{fieldErrors.risk_reward_ratio}</p>
                  )}
                </div>

                {/* Notes (optional) */}
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-navy-400">
                    Notes{" "}
                    <span className="font-normal text-navy-600">optional</span>
                  </label>
                  <textarea
                    value={formValues.notes}
                    onChange={(e) => field("notes", e.target.value)}
                    placeholder="Additional thoughts, reminders, mindset cues…"
                    rows={3}
                    maxLength={3000}
                    className={textareaClass(false)}
                  />
                </div>

                {/* File attachment */}
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-navy-400">
                    Attachment{" "}
                    <span className="font-normal text-navy-600">
                      optional · images or PDF · max 10 MB
                    </span>
                  </label>

                  {/* Show existing attachment if editing */}
                  {existingForDate?.attachment_url && !selectedFile && (
                    <div className="mb-2 flex items-center gap-2 rounded-lg border border-navy-700 bg-navy-900/40 px-3 py-2">
                      <Paperclip className="h-3.5 w-3.5 shrink-0 text-navy-500" />
                      <span className="min-w-0 truncate text-xs text-navy-400">
                        {existingForDate.attachment_name ?? "Existing attachment"}
                      </span>
                      <span className="ml-auto whitespace-nowrap text-[11px] text-navy-600">
                        Upload new to replace
                      </span>
                    </div>
                  )}

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
                    onChange={handleFileChange}
                    className={cn(
                      "block w-full cursor-pointer rounded-lg border border-navy-700 bg-navy-900/40 text-sm text-navy-400",
                      "file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-navy-700 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-navy-200",
                      "file:transition-colors file:hover:bg-navy-600",
                      "focus:outline-none"
                    )}
                  />
                  {selectedFile && (
                    <p className="mt-1 text-xs text-emerald-400">
                      <CheckCircle2 className="mr-1 inline h-3 w-3" />
                      {selectedFile.name}
                    </p>
                  )}
                  {fileError && (
                    <p className="mt-1 text-xs text-red-400">{fileError}</p>
                  )}
                </div>

                {/* Submit error */}
                {submitError && (
                  <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-sm text-red-300">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    {submitError}
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center justify-end gap-3 border-t border-navy-700 pt-4">
                  <button
                    type="button"
                    onClick={() => { setFormOpen(false); setFieldErrors({}); setSubmitError(null); }}
                    className="rounded-lg px-4 py-2 text-sm text-navy-400 transition-colors hover:text-navy-200"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={upsertMutation.isPending || !!fileError}
                    className={cn(
                      "flex items-center gap-2 rounded-lg px-5 py-2 text-sm font-medium transition-colors",
                      "bg-gold-500/20 text-gold-300 ring-1 ring-gold-500/30 hover:bg-gold-500/30",
                      "disabled:pointer-events-none disabled:opacity-50"
                    )}
                  >
                    {upsertMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                    {existingForDate ? "Update Entry" : "Save Entry"}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Delete error banner */}
          {deleteError && (
            <div className="flex items-center gap-3 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              <AlertTriangle className="h-4 w-4 shrink-0 text-red-400" />
              <span className="flex-1">{deleteError}</span>
              <button
                onClick={() => setDeleteError(null)}
                className="text-red-400 transition-colors hover:text-red-200"
                aria-label="Dismiss"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* ── Entry list states ────────────────────────────────────────── */}
          {isLoading && (
            <div className="flex items-center justify-center gap-2 rounded-xl border border-navy-700 bg-navy-800/50 p-12 text-navy-300">
              <Loader2 className="h-5 w-5 animate-spin text-gold-500" />
              Loading entries…
            </div>
          )}

          {isError && (
            <div className="flex flex-col items-center gap-3 rounded-xl border border-red-500/30 bg-red-500/10 p-12 text-center">
              <AlertTriangle className="h-7 w-7 text-red-400" />
              <p className="font-medium text-red-200">Couldn&apos;t load journal entries</p>
              <p className="mt-1 text-sm text-red-300/80">
                {fetchErr instanceof Error ? fetchErr.message : "Unknown error"}
              </p>
            </div>
          )}

          {!isLoading && !isError && entries.length === 0 && (
            <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-navy-600 bg-navy-800/50 p-12 text-center">
              <BookOpen className="h-7 w-7 text-gold-500" />
              <p className="text-navy-300">No entries yet.</p>
              <p className="text-sm text-navy-500">
                Hit <strong className="text-navy-400">New Entry</strong> above to log your first pre-market analysis.
              </p>
            </div>
          )}

          {!isLoading && !isError && entries.length > 0 && (
            <div className="space-y-4">
              {entries.map((entry) => (
                <EntryCard
                  key={entry.id}
                  entry={entry}
                  onEdit={() => openEditForm(entry)}
                  onDelete={() => {
                    setDeletingId(entry.id);
                    deleteMutation.mutate({ id: entry.id, url: entry.attachment_url });
                  }}
                  isDeleting={deletingId === entry.id}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── POST-MARKET TAB (stub) ──────────────────────────────────────────── */}
      {activeTab === "post-market" && (
        <Placeholder
          icon={BarChart2}
          title="Post-Market Log"
          description="Log completed trades: entry / exit, P&L, setup quality (1–5), and lessons learned. Coming in the next build step."
        />
      )}
    </div>
  );
}
