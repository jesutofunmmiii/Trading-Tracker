// Data sources: static content — five core purposes from spec, no DB table needed.

import { Heart } from "lucide-react";
import { cn } from "@/lib/utils";

const REASONS: { id: number; text: string }[] = [
  {
    id: 1,
    text: "This gift that God has given me will not be buried. I will explore it to the fullest potential.",
  },
  {
    id: 2,
    text: "To be a blessing to God's work, and to humanity.",
  },
  {
    id: 3,
    text: "I have this insatiable desire to provide for my family [parents & siblings, & friends]. To be used by God as that ladder between where they are now, and their dreams.",
  },
  {
    id: 4,
    text: "To give my nuclear family [wife & kids] a very comfortable life.",
  },
  {
    id: 5,
    text: "To build & contribute capital to cool projects around the world!",
  },
];

function StatementCard({
  id,
  text,
  featured = false,
}: {
  id: number;
  text: string;
  featured?: boolean;
}) {
  return (
    <article
      className={cn(
        "group relative overflow-hidden rounded-xl border border-navy-700 bg-navy-800/70 p-6 transition-colors duration-200 hover:border-navy-600 sm:p-8",
        featured && "md:col-span-2"
      )}
    >
      {/* Gold left accent bar — gradient from full to faint */}
      <div
        className="absolute inset-y-0 left-0 w-[3px] rounded-l-xl bg-gradient-to-b from-gold-500/90 via-gold-500/50 to-gold-500/10"
        aria-hidden="true"
      />

      {/* Decorative large quote mark — very subtle background watermark */}
      <div
        className="pointer-events-none absolute bottom-0 right-2 select-none font-serif text-[9rem] leading-none text-gold-500/5"
        aria-hidden="true"
      >
        &ldquo;
      </div>

      <div
        className={cn(
          "relative",
          featured
            ? "flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6"
            : "space-y-4"
        )}
      >
        {/* Number badge */}
        <div className="shrink-0">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gold-500/15 font-mono text-sm font-bold text-gold-400 ring-1 ring-gold-500/25">
            {String(id).padStart(2, "0")}
          </span>
        </div>

        {/* Statement text */}
        <p
          className={cn(
            "leading-relaxed text-navy-100",
            featured
              ? "text-xl font-medium sm:text-2xl"
              : "text-base sm:text-lg"
          )}
        >
          {text}
        </p>
      </div>
    </article>
  );
}

export function MyWhySection() {
  return (
    <div className="space-y-8">
      {/* Section header */}
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gold-500/15 ring-1 ring-gold-500/25">
          <Heart className="h-5 w-5 text-gold-400" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-navy-50">My Why</h1>
          <p className="mt-1 text-sm text-navy-400">
            The five core purposes that anchor every trade and define this mission.
          </p>
        </div>
      </div>

      {/* Statement wall */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {REASONS.map((reason) => (
          <StatementCard
            key={reason.id}
            id={reason.id}
            text={reason.text}
            featured={reason.id === 5}
          />
        ))}
      </div>
    </div>
  );
}
