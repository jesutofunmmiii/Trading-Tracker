// Data sources: premarket_entries (pre-market tab),
// trades (post-market tab — entry/exit prices, P&L, setup quality, lessons)

import { Placeholder } from "./_Placeholder";
import { BookOpen } from "lucide-react";

export function JournalSection() {
  return (
    <Placeholder
      icon={BookOpen}
      title="Trading Journal"
      description="Pre-market analysis and post-market trade logs. Log conditions, key levels, P&L, and lessons learned."
    />
  );
}
