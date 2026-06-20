"use client";

// Data sources:
//   profile table  → window_start (5-year clock), total_capital
//   milestones table → status counts for "completed", stage_number for current stage

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Layers,
  TrendingUp,
  Target,
  Calendar,
  Pencil,
  Loader2,
  X,
} from "lucide-react";
import {
  fetchProfile,
  upsertProfile,
  profileKeys,
  ProfileFormSchema,
  type ProfileFormValues,
} from "@/lib/queries/profile";
import { fetchMilestones, milestonesKeys } from "@/lib/queries/milestones";
import type { Milestone, Profile } from "@/lib/types";
import { UserMenu } from "@/components/layout/UserMenu";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtCapital(n: number): string {
  if (n === 0) return "$0";
  if (n >= 1_000_000)
    return `$${n % 1_000_000 === 0 ? n / 1_000_000 : (n / 1_000_000).toFixed(1)}m`;
  if (n >= 1_000)
    return `$${n % 1_000 === 0 ? n / 1_000 : (n / 1_000).toFixed(1)}k`;
  return `$${n.toLocaleString("en-US")}`;
}

// Current stage = stage of the first milestone not yet completed.
// Advances automatically as milestones are ticked off.
function computeCurrentStage(milestones: Milestone[]): number {
  const sorted = [...milestones].sort((a, b) => a.order_index - b.order_index);
  const first = sorted.find((m) => m.status !== "completed");
  return first?.stage_number ?? sorted[sorted.length - 1]?.stage_number ?? 1;
}

function computeDaysRemaining(windowStart: string): number {
  const start = new Date(windowStart + "T00:00:00Z");
  const end = new Date(start);
  end.setUTCFullYear(end.getUTCFullYear() + 5);
  return Math.max(0, Math.ceil((end.getTime() - Date.now()) / 86_400_000));
}

// ── ProfileEditModal ──────────────────────────────────────────────────────────

function ProfileEditModal({
  profile,
  isPending,
  serverError,
  onSubmit,
  onClose,
}: {
  profile: Profile | null;
  isPending: boolean;
  serverError: string | null;
  onSubmit: (values: ProfileFormValues) => void;
  onClose: () => void;
}) {
  const [windowStart, setWindowStart] = useState(
    profile?.window_start ?? ""
  );
  const [totalCapital, setTotalCapital] = useState(
    profile != null ? String(profile.total_capital) : "0"
  );
  const [errors, setErrors] = useState<
    Partial<Record<keyof ProfileFormValues, string>>
  >({});

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const result = ProfileFormSchema.safeParse({
      window_start: windowStart,
      total_capital: totalCapital,
    });
    if (!result.success) {
      const fe: Partial<Record<keyof ProfileFormValues, string>> = {};
      result.error.issues.forEach((issue) => {
        const key = issue.path[0] as keyof ProfileFormValues;
        if (!fe[key]) fe[key] = issue.message;
      });
      setErrors(fe);
      return;
    }
    setErrors({});
    onSubmit(result.data);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-navy-950/80 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      {/* Dialog */}
      <Card className="relative z-10 w-full max-w-sm shadow-2xl">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <CardTitle>5-Year Window Setup</CardTitle>
              <CardDescription className="mt-1">
                Set your journey start date and current capital to populate
                the summary bar.
              </CardDescription>
            </div>
            <button
              onClick={onClose}
              className="mt-0.5 shrink-0 rounded p-1 text-navy-400 transition-colors hover:bg-navy-700 hover:text-navy-100"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {/* window_start */}
            <div className="space-y-1.5">
              <Label htmlFor="ps-window-start">Journey start date</Label>
              <Input
                id="ps-window-start"
                type="date"
                value={windowStart}
                onChange={(e) => setWindowStart(e.target.value)}
                aria-invalid={!!errors.window_start}
              />
              {errors.window_start && (
                <p className="text-xs text-red-400">{errors.window_start}</p>
              )}
              <p className="text-xs text-navy-500">
                The date your 5-year trading journey began.
              </p>
            </div>

            {/* total_capital */}
            <div className="space-y-1.5">
              <Label htmlFor="ps-total-capital">Total capital (USD)</Label>
              <Input
                id="ps-total-capital"
                type="number"
                min="0"
                step="0.01"
                value={totalCapital}
                onChange={(e) => setTotalCapital(e.target.value)}
                placeholder="0"
                aria-invalid={!!errors.total_capital}
              />
              {errors.total_capital && (
                <p className="text-xs text-red-400">{errors.total_capital}</p>
              )}
              <p className="text-xs text-navy-500">
                Your current total trading capital across all accounts.
              </p>
            </div>

            {/* Server error */}
            {serverError && (
              <p className="rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                {serverError}
              </p>
            )}

            <Button type="submit" disabled={isPending} className="w-full">
              {isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              {isPending ? "Saving…" : "Save"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Stat chip ─────────────────────────────────────────────────────────────────

function Stat({
  icon,
  label,
  value,
  faded,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  faded?: boolean;
}) {
  return (
    <div className="flex items-center gap-1.5 text-sm">
      <span className="text-gold-500">{icon}</span>
      <span className="text-navy-400">{label}:</span>
      <span
        className={cn(
          "font-medium tabular-nums",
          faded ? "text-navy-500" : "text-navy-100"
        )}
      >
        {value}
      </span>
    </div>
  );
}

// ── SummaryBar ────────────────────────────────────────────────────────────────

export function SummaryBar() {
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [mutationError, setMutationError] = useState<string | null>(null);

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: profileKeys.me,
    queryFn: fetchProfile,
  });

  const { data: milestones, isLoading: milestonesLoading } = useQuery({
    queryKey: milestonesKeys.all,
    queryFn: fetchMilestones,
  });

  const { mutate: saveProfile, isPending: saving } = useMutation({
    mutationFn: upsertProfile,

    onMutate: async (values) => {
      await queryClient.cancelQueries({ queryKey: profileKeys.me });
      const previous = queryClient.getQueryData<Profile | null>(profileKeys.me);
      if (previous) {
        queryClient.setQueryData<Profile | null>(
          profileKeys.me,
          (old) =>
            old
              ? { ...old, window_start: values.window_start, total_capital: values.total_capital }
              : old ?? null
        );
      }
      return { previous };
    },

    onError: (err, _vars, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData(profileKeys.me, context.previous);
      }
      setMutationError(err instanceof Error ? err.message : "Failed to save");
    },

    onSuccess: () => {
      setMutationError(null);
      setShowModal(false);
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: profileKeys.me });
    },
  });

  // ── Computed stats ──────────────────────────────────────────────────────────
  const loading = profileLoading || milestonesLoading;

  const currentStage =
    milestones && milestones.length > 0
      ? computeCurrentStage(milestones)
      : null;

  const milestonesCompleted =
    milestones != null
      ? milestones.filter((m) => m.status === "completed").length
      : null;

  const totalMilestones = milestones?.length ?? 13;

  const daysLeft =
    profile?.window_start != null
      ? computeDaysRemaining(profile.window_start)
      : null;

  const capitalStr =
    profile != null ? fmtCapital(profile.total_capital) : null;

  // Stats are "faded" when still loading or genuinely unset
  const statFaded = loading;

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-navy-700 bg-navy-900/95 backdrop-blur-sm">
        <div className="mx-auto max-w-screen-2xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-14 items-center justify-between gap-4">
            {/* Brand */}
            <div className="shrink-0">
              <span className="text-sm font-bold uppercase tracking-wider text-gold-400">
                Mission Control
              </span>
            </div>

            {/* Summary stats — desktop */}
            <div className="hidden items-center gap-6 md:flex">
              <Stat
                icon={<Layers className="h-3.5 w-3.5" />}
                label="Stage"
                value={
                  loading
                    ? "—"
                    : currentStage != null
                    ? `Stage ${currentStage}`
                    : "—"
                }
                faded={statFaded || currentStage == null}
              />
              <Stat
                icon={<TrendingUp className="h-3.5 w-3.5" />}
                label="Capital"
                value={loading ? "—" : capitalStr ?? "—"}
                faded={statFaded || capitalStr == null}
              />
              <Stat
                icon={<Target className="h-3.5 w-3.5" />}
                label="Milestones"
                value={
                  loading
                    ? "—"
                    : milestonesCompleted != null
                    ? `${milestonesCompleted} / ${totalMilestones}`
                    : "—"
                }
                faded={statFaded || milestonesCompleted == null}
              />
              <Stat
                icon={<Calendar className="h-3.5 w-3.5" />}
                label="Days remaining"
                value={
                  loading
                    ? "—"
                    : daysLeft != null
                    ? daysLeft.toLocaleString("en-US")
                    : "—"
                }
                faded={statFaded || daysLeft == null}
              />
            </div>

            {/* Right: edit button + UserMenu */}
            <div className="flex shrink-0 items-center gap-1.5">
              <button
                onClick={() => {
                  setMutationError(null);
                  setShowModal(true);
                }}
                className="rounded p-1.5 text-navy-400 transition-colors hover:bg-navy-800 hover:text-gold-400"
                aria-label="Edit start date and capital"
                title="Edit start date & capital"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <UserMenu />
            </div>
          </div>
        </div>
      </header>

      {showModal && (
        <ProfileEditModal
          profile={profile ?? null}
          isPending={saving}
          serverError={mutationError}
          onSubmit={saveProfile}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  );
}
