// Data sources: embedded Forex Factory / FXStreet iframe widget (no custom API).
// See MAINTENANCE.md for how to swap the embed source.

import { Placeholder } from "./_Placeholder";
import { Calendar } from "lucide-react";

export function CalendarSection() {
  return (
    <Placeholder
      icon={Calendar}
      title="Economic Calendar"
      description="Live FXStreet / Forex Factory embed showing upcoming events, impact levels, and forecast data."
    />
  );
}
