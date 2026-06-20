// Data sources: routine_items (order_index, title),
// routine_completions (completed, note, completion_date)

import { Placeholder } from "./_Placeholder";
import { CheckSquare } from "lucide-react";

export function RoutineSection() {
  return (
    <Placeholder
      icon={CheckSquare}
      title="Daily Routine Tracker"
      description="Check off your 8 daily commitments, track streaks, and add a reflection note for each activity."
    />
  );
}
