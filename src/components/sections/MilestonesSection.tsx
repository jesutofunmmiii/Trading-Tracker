// Data sources: milestones table (stage_number, order_index, title, status,
// account_size, payout_target, capital_threshold, est_timeline)

import { Placeholder } from "./_Placeholder";
import { Flag } from "lucide-react";

export function MilestonesSection() {
  return (
    <Placeholder
      icon={Flag}
      title="Career Milestones"
      description="13 milestones across 4 stages tracking your journey from first propfirm account to $2.3m personal capital base."
    />
  );
}
