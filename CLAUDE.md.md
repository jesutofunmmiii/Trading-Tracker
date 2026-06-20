# Trading Dashboard — Project Context

This file is read automatically by Claude Code at the start of every session.
It encodes decisions that are **already made**. Do not re-litigate them; if a change
seems necessary, ask first.

---

## Stack (decided — do not change without asking)

- **Next.js** (App Router) + **React** + **TypeScript**
- **Tailwind CSS** + **shadcn/ui** for all components
- **Supabase** — Postgres DB, auth, and file storage
- **TanStack Query** for all data fetching / caching
- **Zod** for input validation
- **Recharts** for performance charts
- Deploy to **Vercel**; ship as an installable **PWA**

## Design language

- Palette: **navy** (primary), **gold** (accent), **white** (surface), subtle grays
- Clean modern sans-serif; generous spacing; calm, not flashy
- "Mission control" feel — information-dense but legible
- Mobile-responsive throughout

## Code conventions

- Server components by default; client components only where interactivity requires it
- All persistent data lives in Supabase tables — never hardcode what should be stored
- One section = one component under `/components/sections`
- Commit after each working section (clean restore points)
- For any non-trivial section, explain the plan **before** writing code
- Keep guardrails tight: when working a section, don't refactor or touch others

---

## Production standards — apply to EVERY section, don't ask each time

- Every data-fetching component handles three states: **loading, empty, error**
- Validate all user input with **Zod** before it touches Supabase; show inline field errors
- Wrap Supabase calls in try/catch with user-facing messages; no uncaught rejections
- Each section component gets a header comment naming its data sources
- Keep `docs/MAINTENANCE.md` current as you build (how to add a milestone, change the
  start date, swap the calendar embed, add a routine item, run locally)

---

## Data model (high level)

| Table | Purpose |
|---|---|
| `profile` | 5-year window start date, current total capital |
| `milestones` | 13 rows across 4 stages (seed below) |
| `premarket_entries` | timestamped pre-market analysis |
| `trades` | post-market trade logs + source for metrics |
| `routine_items` | the 8 daily commitments (seed below) |
| `routine_completions` | per item, per calendar day, with optional note |
| `propfirms` | tracker rows (5 firms seeded) |

---

## Seed data — milestones (exact text, do not paraphrase)

**Stage 1 — Propfirm foundation**
- 01: Get & pass a $10k/$25k propfirm account
- 02: Secure a payout from that account
- 03: Buy & pass a propfirm $200k account
- 04: Get a payout. Possibly a $10k payout
- 05: Settle lock-in essentials [Rent, Device, Gym & Foodstuff]

**Stage 2 — Scaling to $1m funding / $500k withdrawn**
- 06: Invest in 4 other $200k propfirm accounts
- 07: Pass all 4 → 5× $200k accounts [$1m in funding]
- 08: Withdraw $50k collectively [$10k per $200k account] ×10
- 09: Brings total withdrawal to $500k

**Stage 3 — Personal broker account**
- 10: Put $500k into a personal broker account, divide into 20 → $25k risk per trade
- 11: Grow personal capital from $500k to $2.3m

**Stage 4 — Capital base & legacy**
- 12: Personal capital base = $2.3m, divide into 30 → $76.6k risk per trade
- 13: Build, Invest, Sponsor & Donate

## Seed data — routine items (8)

1. Go over the dashboard
2. Backtest & study (≥ 2 hours)
3. Pray
4. Morning and/or evening walk
5. Journal & reflect on past trades
6. Pre-market analysis
7. Read ≥ 10 pages of a book
8. Listen to ≥ 1 podcast

---

## Deferred / stub for now

- **Economic calendar** → embed Forex Factory / FXStreet widget (iframe). Do **not** build a
  custom calendar API. Record the embed source in MAINTENANCE.md so it can be swapped later.
- **Vision board** → manual image upload to Supabase Storage. Do **not** scrape Instagram or
  Pinterest (no public API; against their terms).
- **[Trading Setup Screenshots]** → leave image placeholders; user supplies images later.

---

## Section → tab map (for the nav shell)

Summary bar (top, always visible) · Milestones · Daily Routine · Journal (Pre / Post) ·
Strategy Reference · My Why · Vision Board · Economic Calendar · Propfirm Tracker
