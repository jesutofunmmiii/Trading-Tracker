// Data access for the journal calendar view.
// Queries premarket_entries, postmarket_entries, and trades for a given month
// and returns a Map<YYYY-MM-DD, JournalDayActivity> for O(1) day-card lookup.

import { createClient } from "@/lib/supabase/client";

export const journalKeys = {
  activityByMonth: (year: number, month: number) =>
    ["journal", "activity", year, month] as const,
};

export interface JournalDayActivity {
  hasPremarket: boolean;
  hasPostmarket: boolean;
  tradeCount: number;
}

export async function fetchJournalActivityForMonth(
  year: number,
  month: number
): Promise<Map<string, JournalDayActivity>> {
  const supabase = createClient();

  const mm = String(month).padStart(2, "0");
  const startDate = `${year}-${mm}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const endDate = `${year}-${mm}-${String(lastDay).padStart(2, "0")}`;

  const [preResult, postResult, tradeResult] = await Promise.all([
    supabase
      .from("premarket_entries")
      .select("entry_date")
      .gte("entry_date", startDate)
      .lte("entry_date", endDate),
    supabase
      .from("postmarket_entries")
      .select("entry_date")
      .gte("entry_date", startDate)
      .lte("entry_date", endDate),
    supabase
      .from("trades")
      .select("trade_date")
      .gte("trade_date", startDate)
      .lte("trade_date", endDate),
  ]);

  if (preResult.error)
    throw new Error(`Failed to load pre-market data: ${preResult.error.message}`);
  if (postResult.error)
    throw new Error(`Failed to load post-market data: ${postResult.error.message}`);
  if (tradeResult.error)
    throw new Error(`Failed to load trade data: ${tradeResult.error.message}`);

  const map = new Map<string, JournalDayActivity>();

  function ensureDay(date: string): JournalDayActivity {
    if (!map.has(date))
      map.set(date, { hasPremarket: false, hasPostmarket: false, tradeCount: 0 });
    return map.get(date)!;
  }

  for (const row of preResult.data ?? []) ensureDay(row.entry_date).hasPremarket = true;
  for (const row of postResult.data ?? []) ensureDay(row.entry_date).hasPostmarket = true;
  for (const row of tradeResult.data ?? []) ensureDay(row.trade_date).tradeCount++;

  return map;
}
