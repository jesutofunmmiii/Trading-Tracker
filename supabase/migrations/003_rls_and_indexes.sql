-- ── ROW LEVEL SECURITY ───────────────────────────────────────────────────────
ALTER TABLE profile             ENABLE ROW LEVEL SECURITY;
ALTER TABLE milestones          ENABLE ROW LEVEL SECURITY;
ALTER TABLE premarket_entries   ENABLE ROW LEVEL SECURITY;
ALTER TABLE trades              ENABLE ROW LEVEL SECURITY;
ALTER TABLE routine_items       ENABLE ROW LEVEL SECURITY;
ALTER TABLE routine_completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE propfirms           ENABLE ROW LEVEL SECURITY;

-- profile: user owns exactly one row
CREATE POLICY "profile: own row" ON profile
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- milestones: any authenticated user can read and update (single-user app;
-- status updates come from the owner of the dashboard)
CREATE POLICY "milestones: authenticated read" ON milestones
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "milestones: authenticated update" ON milestones
  FOR UPDATE USING (auth.role() = 'authenticated');

-- premarket_entries: user owns their rows
CREATE POLICY "premarket_entries: own rows" ON premarket_entries
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- trades: user owns their rows
CREATE POLICY "trades: own rows" ON trades
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- routine_items: global seed — any authenticated user can read
CREATE POLICY "routine_items: authenticated read" ON routine_items
  FOR SELECT USING (auth.role() = 'authenticated');

-- routine_completions: user owns their rows
CREATE POLICY "routine_completions: own rows" ON routine_completions
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- propfirms: user owns their rows
CREATE POLICY "propfirms: own rows" ON propfirms
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── INDEXES ──────────────────────────────────────────────────────────────────
-- Ordered by most-frequent query patterns: journal browsing, streak calculation,
-- milestone progress display.

CREATE INDEX idx_premarket_user_date     ON premarket_entries   (user_id, entry_date DESC);
CREATE INDEX idx_trades_user_date        ON trades              (user_id, trade_date DESC);
CREATE INDEX idx_trades_premarket        ON trades              (premarket_entry_id);
CREATE INDEX idx_completions_user_date   ON routine_completions (user_id, completion_date DESC);
CREATE INDEX idx_completions_user_item   ON routine_completions (user_id, routine_item_id);
CREATE INDEX idx_milestones_stage_order  ON milestones          (stage_number, order_index);
CREATE INDEX idx_propfirms_user          ON propfirms           (user_id);
