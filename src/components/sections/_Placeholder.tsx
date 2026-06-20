// Shared placeholder shell used by every section until data is wired.

import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface PlaceholderProps {
  title: string;
  description: string;
  icon: LucideIcon;
  className?: string;
}

export function Placeholder({ title, description, icon: Icon, className }: PlaceholderProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-navy-600 bg-navy-800/50 p-12 text-center",
        className
      )}
    >
      <div className="rounded-full bg-navy-700 p-4">
        <Icon className="h-8 w-8 text-gold-500" />
      </div>
      <div className="space-y-1">
        <h2 className="text-xl font-semibold text-navy-100">{title}</h2>
        <p className="max-w-sm text-sm text-navy-400">{description}</p>
      </div>
      <span className="inline-flex items-center rounded-full border border-navy-600 px-3 py-1 text-xs text-navy-500">
        Coming soon
      </span>
    </div>
  );
}
