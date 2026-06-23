-- Add daily_notes to premarket_entries for the "Thoughts for the day?" field.
-- The trg_premarket_updated_at trigger (from 001) will set updated_at on any UPDATE.
ALTER TABLE premarket_entries ADD COLUMN IF NOT EXISTS daily_notes TEXT;
