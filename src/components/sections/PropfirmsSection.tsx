// Data sources: propfirms table (name, status, account_size, payout_received,
// amount_withdrawn, notes). 5 rows auto-seeded on user signup.

import { Placeholder } from "./_Placeholder";
import { BarChart2 } from "lucide-react";

export function PropfirmsSection() {
  return (
    <Placeholder
      icon={BarChart2}
      title="Propfirm Tracker"
      description="Track FundingPips, Hola Prime, Funded Next, FTMO, and Atlas Funded — status, payouts, withdrawals."
    />
  );
}
