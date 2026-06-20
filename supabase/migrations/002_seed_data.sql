-- ── SEED: MILESTONES ─────────────────────────────────────────────────────────
-- Exact titles from CLAUDE.md. Do not paraphrase.
-- Numeric fields are NULL where the spec gives no concrete figure for that row.
INSERT INTO milestones
  (stage_number, order_index, title, account_size, payout_target, capital_threshold, est_timeline)
VALUES
  -- Stage 1 — Propfirm foundation
  (1,  1,  'Get & pass a $10k/$25k propfirm account',
           25000,    NULL,       NULL,       'Month 1–2'),
  (1,  2,  'Secure a payout from that account',
           NULL,     NULL,       NULL,       'Month 2–4'),
  (1,  3,  'Buy & pass a propfirm $200k account',
           200000,   NULL,       NULL,       'Month 4–6'),
  (1,  4,  'Get a payout. Possibly a $10k payout',
           200000,   10000,      NULL,       'Month 6–8'),
  (1,  5,  'Settle lock-in essentials [Rent, Device, Gym & Foodstuff]',
           NULL,     NULL,       NULL,       'Month 8'),

  -- Stage 2 — Scaling to $1m funding / $500k withdrawn
  (2,  6,  'Invest in 4 other $200k propfirm accounts',
           200000,   NULL,       NULL,       'Month 9–12'),
  (2,  7,  'Pass all 4 → 5× $200k accounts [$1m in funding]',
           1000000,  NULL,       1000000,    'Month 12–18'),
  (2,  8,  'Withdraw $50k collectively [$10k per $200k account] ×10',
           NULL,     50000,      NULL,       'Month 18–24'),
  (2,  9,  'Brings total withdrawal to $500k',
           NULL,     NULL,       500000,     'Month 24'),

  -- Stage 3 — Personal broker account
  (3,  10, 'Put $500k into a personal broker account, divide into 20 → $25k risk per trade',
           500000,   NULL,       500000,     'Year 2–3'),
  (3,  11, 'Grow personal capital from $500k to $2.3m',
           NULL,     NULL,       2300000,    'Year 3–4'),

  -- Stage 4 — Capital base & legacy
  (4,  12, 'Personal capital base = $2.3m, divide into 30 → $76.6k risk per trade',
           2300000,  NULL,       2300000,    'Year 4'),
  (4,  13, 'Build, Invest, Sponsor & Donate',
           NULL,     NULL,       NULL,       'Year 4–5');

-- ── SEED: ROUTINE ITEMS ───────────────────────────────────────────────────────
-- Exact text from CLAUDE.md.
INSERT INTO routine_items (order_index, title) VALUES
  (1, 'Go over the dashboard'),
  (2, 'Backtest & study (≥ 2 hours)'),
  (3, 'Pray'),
  (4, 'Morning and/or evening walk'),
  (5, 'Journal & reflect on past trades'),
  (6, 'Pre-market analysis'),
  (7, 'Read ≥ 10 pages of a book'),
  (8, 'Listen to ≥ 1 podcast');
