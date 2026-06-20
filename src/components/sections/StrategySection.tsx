// Data sources: static content (strategy name, core principle, setup trigger).
// Image placeholders for [Trading Setup Screenshots] — user supplies images later.

import { Placeholder } from "./_Placeholder";
import { TrendingUp } from "lucide-react";

export function StrategySection() {
  return (
    <Placeholder
      icon={TrendingUp}
      title="Trading Strategy Reference"
      description="Buyside/Sellside Raid — targeting liquidity sweeps into higher-timeframe points of interest."
    />
  );
}
