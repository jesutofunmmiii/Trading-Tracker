-- ── UPDATED_AT TRIGGER ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ── PROFILE ─────────────────────────────────────────────────────────────────
-- One row per user; tracks the 5-year window start date and current capital.
CREATE TABLE IF NOT EXISTS profile (
  id            uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid          UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  window_start  date          NOT NULL,           -- day the 5-year journey began
  total_capital numeric(15,2) NOT NULL DEFAULT 0,
  created_at    timestamptz   NOT NULL DEFAULT now(),
  updated_at    timestamptz   NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_profile_updated_at
  BEFORE UPDATE ON profile
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── MILESTONES ───────────────────────────────────────────────────────────────
-- 13 fixed rows seeded in 002_seed_data.sql.
-- No user_id: global for this single-user personal dashboard.
CREATE TABLE IF NOT EXISTS milestones (
  id                uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  stage_number      smallint      NOT NULL CHECK (stage_number BETWEEN 1 AND 4),
  order_index       smallint      NOT NULL UNIQUE CHECK (order_index BETWEEN 1 AND 13),
  title             text          NOT NULL,
  status            text          NOT NULL DEFAULT 'not_started'
                                  CHECK (status IN ('not_started', 'in_progress', 'completed')),
  account_size      numeric(15,2),    -- NULL where no specific account size applies
  payout_target     numeric(15,2),    -- NULL where no payout target is defined
  capital_threshold numeric(15,2),    -- NULL where no capital threshold is defined
  est_timeline      text,             -- e.g. "Month 1–3", "Year 2–3"
  created_at        timestamptz   NOT NULL DEFAULT now(),
  updated_at        timestamptz   NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_milestones_updated_at
  BEFORE UPDATE ON milestones
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── PREMARKET_ENTRIES ────────────────────────────────────────────────────────
-- One entry per trading day per user (UNIQUE enforced).
CREATE TABLE IF NOT EXISTS premarket_entries (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entry_date        date        NOT NULL,
  market_conditions text,
  key_levels        text,
  planned_trades    text,
  risk_reward_ratio text,           -- free text: "3:1", ">2:1", etc.
  notes             text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, entry_date)
);

CREATE TRIGGER trg_premarket_updated_at
  BEFORE UPDATE ON premarket_entries
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── TRADES ──────────────────────────────────────────────────────────────────
-- Post-market trade log. Optional FK to same-day premarket_entry for linking
-- pre- and post-market analysis. ON DELETE SET NULL preserves trade records
-- if the premarket entry is ever deleted.
CREATE TABLE IF NOT EXISTS trades (
  id                 uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            uuid          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  trade_date         date          NOT NULL,
  instrument         text          NOT NULL,        -- e.g. "EURUSD"
  direction          text          CHECK (direction IN ('long', 'short')),
  entry_price        numeric(15,5),
  exit_price         numeric(15,5),
  stop_loss          numeric(15,5),
  take_profit        numeric(15,5),
  lot_size           numeric(10,4),
  pnl                numeric(15,2),
  setup_quality      smallint      CHECK (setup_quality BETWEEN 1 AND 5),
  lessons_learned    text,
  notes              text,
  premarket_entry_id uuid          REFERENCES premarket_entries(id) ON DELETE SET NULL,
  created_at         timestamptz   NOT NULL DEFAULT now(),
  updated_at         timestamptz   NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_trades_updated_at
  BEFORE UPDATE ON trades
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── ROUTINE_ITEMS ────────────────────────────────────────────────────────────
-- 8 fixed rows seeded in 002_seed_data.sql. Global, no user_id.
-- No updated_at: seed rows are treated as immutable.
CREATE TABLE IF NOT EXISTS routine_items (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  order_index smallint    NOT NULL UNIQUE CHECK (order_index BETWEEN 1 AND 8),
  title       text        NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ── ROUTINE_COMPLETIONS ──────────────────────────────────────────────────────
-- One row per (user × routine_item × calendar day).
-- UNIQUE constraint enables safe upserts for daily check-offs.
CREATE TABLE IF NOT EXISTS routine_completions (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  routine_item_id uuid        NOT NULL REFERENCES routine_items(id) ON DELETE CASCADE,
  completion_date date        NOT NULL,
  completed       boolean     NOT NULL DEFAULT false,
  note            text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, routine_item_id, completion_date)
);

CREATE TRIGGER trg_routine_completions_updated_at
  BEFORE UPDATE ON routine_completions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── PROPFIRMS ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS propfirms (
  id               uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name             text          NOT NULL,
  status           text          NOT NULL DEFAULT 'none'
                                 CHECK (status IN ('none', 'applied', 'in_progress', 'passed', 'failed')),
  account_size     numeric(15,2),
  payout_received  boolean       NOT NULL DEFAULT false,
  amount_withdrawn numeric(15,2) NOT NULL DEFAULT 0,
  notes            text,
  created_at       timestamptz   NOT NULL DEFAULT now(),
  updated_at       timestamptz   NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_propfirms_updated_at
  BEFORE UPDATE ON propfirms
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── AUTO-SEED PROPFIRMS ON SIGNUP ────────────────────────────────────────────
-- The 5 firms from the spec appear automatically the moment the user account
-- is created, so they are ready to track on first login.
CREATE OR REPLACE FUNCTION seed_propfirms_for_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO propfirms (user_id, name, status) VALUES
    (NEW.id, 'FundingPips',  'none'),
    (NEW.id, 'Hola Prime',   'none'),
    (NEW.id, 'Funded Next',  'none'),
    (NEW.id, 'FTMO',         'none'),
    (NEW.id, 'Atlas Funded', 'none');
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_seed_propfirms_on_signup
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION seed_propfirms_for_new_user();
