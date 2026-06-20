// Data sources: profile (window_start, total_capital), milestones (status counts)
// This component is intentionally static for now — data wiring comes in a later section.

import { TrendingUp, Target, Calendar, Layers } from "lucide-react";
import { UserMenu } from "@/components/layout/UserMenu";

export function SummaryBar() {
  return (
    <header className="sticky top-0 z-40 border-b border-navy-700 bg-navy-900/95 backdrop-blur-sm">
      <div className="mx-auto max-w-screen-2xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-14 items-center justify-between gap-4">
          {/* Brand */}
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-gold-400 font-bold tracking-wider text-sm uppercase">
              Mission Control
            </span>
          </div>

          {/* Summary stats */}
          <div className="hidden md:flex items-center gap-6 text-sm">
            <Stat
              icon={<Layers className="h-3.5 w-3.5" />}
              label="Stage"
              value="—"
            />
            <Stat
              icon={<TrendingUp className="h-3.5 w-3.5" />}
              label="Capital"
              value="—"
            />
            <Stat
              icon={<Target className="h-3.5 w-3.5" />}
              label="Milestones"
              value="—"
            />
            <Stat
              icon={<Calendar className="h-3.5 w-3.5" />}
              label="Days remaining"
              value="—"
            />
          </div>

          {/* User menu + sign out */}
          <div className="shrink-0">
            <UserMenu />
          </div>
        </div>
      </div>
    </header>
  );
}

function Stat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-1.5 text-navy-300">
      <span className="text-gold-500">{icon}</span>
      <span className="text-navy-400">{label}:</span>
      <span className="font-medium text-navy-100">{value}</span>
    </div>
  );
}
