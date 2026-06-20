// Data sources: static content (5 core purposes from spec — no DB table needed).

import { Placeholder } from "./_Placeholder";
import { Heart } from "lucide-react";

export function MyWhySection() {
  return (
    <Placeholder
      icon={Heart}
      title="My Why"
      description="5 motivational anchors — your core purposes displayed as an inspirational statement wall."
    />
  );
}
