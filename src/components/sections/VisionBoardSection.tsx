// Data sources: Supabase Storage (user uploads images manually — no scraping).

import { Placeholder } from "./_Placeholder";
import { Image } from "lucide-react";

export function VisionBoardSection() {
  return (
    <Placeholder
      icon={Image}
      title="Vision Board"
      description="Upload aspirational images for wealth, trading mastery, and lifestyle goals. Elegant grid layout."
    />
  );
}
