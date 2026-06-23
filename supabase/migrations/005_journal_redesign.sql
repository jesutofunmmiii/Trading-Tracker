-- ── 005_journal_redesign.sql ─────────────────────────────────────────────────
-- Redesigns the journal data model from scratch.
--
-- TABLES CREATED / MODIFIED:
--   premarket_entries    – strips old text columns, adds news_events JSONB
--   postmarket_entries   – new (one per day, Section 1 notes + screenshots)
--   premarket_screenshots  – new (timeframe screenshots for pre-market)
--   postmarket_screenshots – new (timeframe screenshots for post-market S1)
--   trades               – DROPPED and recreated with new trading fields
--   trade_screenshots    – new (Entry / Exits / Proof of Execution groups)
--   trade_entry_types    – new lookup table seeded with 9 entry type suggestions
--
-- EXISTING DATA:
--   premarket_entries rows are PRESERVED (id/user_id/entry_date kept).
--   Old text columns and their data are DROPPED (IF EXISTS — safe if 004 never ran).
--   trades table is DROPPED — any existing trade rows are lost.
--   Files in premarket-attachments bucket are orphaned (not deleted automatically).
--
-- STORAGE:
--   Creates journal-screenshots bucket (public read, owner-only write).
--   Path layout: {user_id}/{context}/{parent_id}/...
--   Owner policy: (storage.foldername(name))[1] = auth.uid()::text
-- ─────────────────────────────────────────────────────────────────────────────


-- ── STEP 1: DROP OLD TRADES TABLE ─────────────────────────────────────────────
-- Must come first — it holds an FK referencing premarket_entries.
-- CASCADE also removes the old "trades: own rows" RLS policy and its indexes.
DROP TABLE IF EXISTS trades CASCADE;


-- ── STEP 2: STRIP OLD COLUMNS FROM premarket_entries ─────────────────────────
-- The row itself (id, user_id, entry_date, created_at, updated_at) is kept.
-- IF EXISTS on each column so this is safe even if migration 004 never ran.
ALTER TABLE premarket_entries
  DROP COLUMN IF EXISTS market_conditions,
  DROP COLUMN IF EXISTS key_levels,
  DROP COLUMN IF EXISTS planned_trades,
  DROP COLUMN IF EXISTS risk_reward_ratio,
  DROP COLUMN IF EXISTS notes,
  DROP COLUMN IF EXISTS attachment_url,
  DROP COLUMN IF EXISTS attachment_name;

-- Add the news events block.
-- Expected JSONB shape (array): [{ time, currency, impact, title, actual, forecast, previous }]
-- Source wired later; for now the column accepts NULL or a pre-fetched payload.
ALTER TABLE premarket_entries
  ADD COLUMN IF NOT EXISTS news_events jsonb;


-- ── STEP 3: POST-MARKET ENTRIES ───────────────────────────────────────────────
-- One per user per day. Section 1 = follow-up notes + timeframe screenshots.
-- Section 2 = trades (separate table, linked via postmarket_entry_id).
CREATE TABLE IF NOT EXISTS postmarket_entries (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entry_date          date        NOT NULL,
  -- Optional link to same-day pre-market entry (NULL if no pre-market was written)
  premarket_entry_id  uuid        REFERENCES premarket_entries(id) ON DELETE SET NULL,
  followup_notes      text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, entry_date)
);

CREATE TRIGGER trg_postmarket_updated_at
  BEFORE UPDATE ON postmarket_entries
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ── STEP 4: PREMARKET TIMEFRAME SCREENSHOTS ───────────────────────────────────
-- One or more screenshots per timeframe per premarket entry.
-- storage_path is relative to the journal-screenshots bucket root.
CREATE TABLE IF NOT EXISTS premarket_screenshots (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  premarket_entry_id  uuid        NOT NULL REFERENCES premarket_entries(id) ON DELETE CASCADE,
  timeframe           text        NOT NULL
                                  CHECK (timeframe IN ('Weekly','Daily','4H','2H','1H')),
  storage_path        text        NOT NULL,
  notes               text,
  display_order       smallint    NOT NULL DEFAULT 0,
  created_at          timestamptz NOT NULL DEFAULT now()
);


-- ── STEP 5: POSTMARKET TIMEFRAME SCREENSHOTS (SECTION 1) ─────────────────────
CREATE TABLE IF NOT EXISTS postmarket_screenshots (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  postmarket_entry_id  uuid        NOT NULL REFERENCES postmarket_entries(id) ON DELETE CASCADE,
  timeframe            text        NOT NULL
                                   CHECK (timeframe IN ('Weekly','Daily','4H','2H','1H')),
  storage_path         text        NOT NULL,
  notes                text,
  display_order        smallint    NOT NULL DEFAULT 0,
  created_at           timestamptz NOT NULL DEFAULT now()
);


-- ── STEP 6: TRADES (REBUILT) ──────────────────────────────────────────────────
-- Many per day. trade_date is the calendar date — never derived, always explicit.
-- Weekly grouping : to_char(trade_date, 'IYYY-IW')   e.g. "2026-W25"
-- Monthly grouping: to_char(trade_date, 'YYYY-MM')   e.g. "2026-06"
-- entry_type is free text backed by the trade_entry_types lookup table for UI
-- autocomplete; the CHECK constraint is intentionally absent so new types can be
-- added without a schema change.
CREATE TABLE IF NOT EXISTS trades (
  id                  uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Link to the postmarket entry for this day (nullable — trade can exist standalone)
  postmarket_entry_id uuid         REFERENCES postmarket_entries(id) ON DELETE SET NULL,
  trade_date          date         NOT NULL,
  pair                text         NOT NULL,
  pnl                 numeric(10,2),
  time                text,        -- e.g. "09:30" — kept as text per spec
  risk_reward         text,        -- e.g. "1:3"
  duration            text,        -- e.g. "2h 30m"
  position            text         CHECK (position IN ('Long','Short')),
  result              text         CHECK (result IN ('Win','Loss','Break-even')),
  fcr                 text         CHECK (fcr IN ('Yes','No')),
  session             text         CHECK (session IN ('Asian','London','NY','Outside')),
  entry_timeframe     text         CHECK (entry_timeframe IN ('4H','2H','1H','45M','30M','15M')),
  entry_type          text,
  created_at          timestamptz  NOT NULL DEFAULT now(),
  updated_at          timestamptz  NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_trades_updated_at
  BEFORE UPDATE ON trades
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ── STEP 7: TRADE SCREENSHOTS ─────────────────────────────────────────────────
-- Three named groups per trade. Each group can hold multiple screenshots.
CREATE TABLE IF NOT EXISTS trade_screenshots (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  trade_id         uuid        NOT NULL REFERENCES trades(id) ON DELETE CASCADE,
  screenshot_group text        NOT NULL
                               CHECK (screenshot_group IN ('Entry','Exits','Proof of Execution')),
  storage_path     text        NOT NULL,
  notes            text,
  display_order    smallint    NOT NULL DEFAULT 0,
  created_at       timestamptz NOT NULL DEFAULT now()
);


-- ── STEP 8: ENTRY TYPE LOOKUP TABLE ──────────────────────────────────────────
-- Read-only reference for UI autocomplete. Add rows here to offer new suggestions
-- without any code change. trades.entry_type is plain text, not a FK, so any
-- value is accepted even if it doesn't appear in this table.
CREATE TABLE IF NOT EXISTS trade_entry_types (
  id            serial      PRIMARY KEY,
  label         text        NOT NULL UNIQUE,
  display_order smallint    NOT NULL DEFAULT 0
);

INSERT INTO trade_entry_types (label, display_order) VALUES
  ('Inducement',            1),
  ('Breaker Block',         2),
  ('SnR',                   3),
  ('Order Block',           4),
  ('Rejection Block',       5),
  ('Rec. Order Block',      6),
  ('Open-Close',            7),
  ('Rec. Rejection Block',  8),
  ('Mitigation Block',      9)
ON CONFLICT (label) DO NOTHING;


-- ── STEP 9: ROW LEVEL SECURITY ────────────────────────────────────────────────

ALTER TABLE postmarket_entries    ENABLE ROW LEVEL SECURITY;
ALTER TABLE premarket_screenshots  ENABLE ROW LEVEL SECURITY;
ALTER TABLE postmarket_screenshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE trades                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE trade_screenshots      ENABLE ROW LEVEL SECURITY;
ALTER TABLE trade_entry_types      ENABLE ROW LEVEL SECURITY;

-- Each user sees and writes only their own rows.
CREATE POLICY "postmarket_entries: own rows" ON postmarket_entries
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "premarket_screenshots: own rows" ON premarket_screenshots
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "postmarket_screenshots: own rows" ON postmarket_screenshots
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "trades: own rows" ON trades
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "trade_screenshots: own rows" ON trade_screenshots
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- trade_entry_types is a global lookup — any authenticated user may read.
CREATE POLICY "trade_entry_types: authenticated read" ON trade_entry_types
  FOR SELECT USING (auth.role() = 'authenticated');


-- ── STEP 10: INDEXES ──────────────────────────────────────────────────────────
-- idx_premarket_user_date already exists on premarket_entries from migration 003.

CREATE INDEX IF NOT EXISTS idx_postmarket_user_date
  ON postmarket_entries    (user_id, entry_date DESC);

CREATE INDEX IF NOT EXISTS idx_postmarket_premarket
  ON postmarket_entries    (premarket_entry_id);

CREATE INDEX IF NOT EXISTS idx_pre_screenshots_entry
  ON premarket_screenshots  (premarket_entry_id, timeframe);

CREATE INDEX IF NOT EXISTS idx_post_screenshots_entry
  ON postmarket_screenshots (postmarket_entry_id, timeframe);

CREATE INDEX IF NOT EXISTS idx_trades_user_date
  ON trades                (user_id, trade_date DESC);

CREATE INDEX IF NOT EXISTS idx_trades_postmarket
  ON trades                (postmarket_entry_id);

CREATE INDEX IF NOT EXISTS idx_trade_screenshots_trade
  ON trade_screenshots     (trade_id, screenshot_group);


-- ── STEP 11: STORAGE — journal-screenshots BUCKET ─────────────────────────────
-- Single bucket for all journal images (premarket, postmarket, trade screenshots).
--
-- Path conventions (enforced by application, not DB):
--   premarket : {user_id}/premarket/{premarket_entry_id}/{filename}
--   postmarket: {user_id}/postmarket/{postmarket_entry_id}/{filename}
--   trades    : {user_id}/trades/{trade_id}/{group}/{filename}
--
-- The owner-only RLS policy checks that the first path segment equals the
-- authenticated user's UUID — so the path MUST start with the user's id.

INSERT INTO storage.buckets (id, name, public)
VALUES ('journal-screenshots', 'journal-screenshots', true)
ON CONFLICT (id) DO NOTHING;

-- Drop stale versions of these policies before creating (idempotent re-run safety).
DROP POLICY IF EXISTS "journal-screenshots: owner select" ON storage.objects;
DROP POLICY IF EXISTS "journal-screenshots: owner insert" ON storage.objects;
DROP POLICY IF EXISTS "journal-screenshots: owner update" ON storage.objects;
DROP POLICY IF EXISTS "journal-screenshots: owner delete" ON storage.objects;

CREATE POLICY "journal-screenshots: owner select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'journal-screenshots'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "journal-screenshots: owner insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'journal-screenshots'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "journal-screenshots: owner update" ON storage.objects
  FOR UPDATE TO authenticated
  USING  (bucket_id = 'journal-screenshots' AND auth.uid()::text = (storage.foldername(name))[1])
  WITH CHECK (bucket_id = 'journal-screenshots' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "journal-screenshots: owner delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'journal-screenshots'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
