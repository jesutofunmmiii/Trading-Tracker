# Maintenance Guide

Operational reference for the Trading Dashboard. Written for the person doing maintenance, not for new developers — for architecture context see `CLAUDE.md`.

---

## Running locally

```bash
npm install
cp .env.local.example .env.local   # fill in NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY
npm run dev                         # http://localhost:3000
```

Database migrations live in `supabase/migrations/`. Run them in order in the Supabase SQL Editor (project dashboard → SQL Editor) or via the Supabase CLI:

```bash
supabase db push   # requires supabase CLI and linked project
```

---

## Adding a milestone

1. Open the Supabase SQL Editor.
2. Insert a row into `milestones`:

```sql
INSERT INTO milestones (stage_number, order_index, title, status)
VALUES (1, 14, 'My new milestone', 'not_started');
```

- `stage_number` 1–4 maps to the four roadmap stages.
- `order_index` controls sort order within the stage (integers, gaps are fine).
- `status` is `not_started | in_progress | completed`.

---

## Changing the 5-year window start date

1. Open the Supabase SQL Editor.
2. Update the `profile` table:

```sql
UPDATE profile SET window_start = '2024-01-01' WHERE user_id = '<your-user-id>';
```

The `window_start` value drives the progress bar and timeline calculations throughout the dashboard.

---

## Adding a routine item

Routine items are stored in the `routine_items` table and seeded with 8 entries. To add a ninth:

```sql
INSERT INTO routine_items (order_index, title)
VALUES (9, 'New habit description');
```

`order_index` sets the display order in the Daily Routine section. Items are unique by title per the app convention (no DB constraint, but duplicates look confusing).

---

## Economic calendar (High-Impact News block)

**Location in code:** `src/components/sections/PreMarketPanel.tsx`, the `{/* High-Impact News */}` block inside the render section.

**Current approach:** Link-out only — no embed. Both Investing.com (blocked by `X-Frame-Options: SAMEORIGIN`) and TradingView's script-inject widget produced blank boxes on the deployed domain. The block now renders a compact panel with a button that opens Forex Factory in a new tab.

### Changing the destination URL

Find the `<a>` element in the High-Impact News block:

```tsx
<a
  href="https://www.forexfactory.com/calendar"
  target="_blank"
  rel="noopener noreferrer"
  ...
>
```

Replace the `href` value with any calendar URL you prefer (e.g. `https://www.myfxbook.com/economic-calendar` or `https://fxstreet.com/economic-calendar`).

### Switching to an embed in the future

If you find a provider whose embed works on your deployed domain:

1. Replace the link-out `<div>` block with the embed implementation (iframe or script-inject).
2. Size the container to match the widget height.
3. Update this section of MAINTENANCE.md.

> **Known non-starters:**
> - `sslecal2.investing.com` — sets `X-Frame-Options: SAMEORIGIN`, blank on third-party domains.
> - TradingView `embed-widget-events.js` script-inject — rendered blank on the deployed Vercel domain.

---

## Vision board

Images are uploaded manually to the `vision-board` Supabase Storage bucket. The bucket path convention is `{user_id}/{filename}`. There is no scraping or external API — images are supplied by the user.

---

## Economic Calendar tab

The standalone Economic Calendar tab (separate from the pre-market news block) is a full-page embed. To swap the provider there, find the `EconomicCalendarSection` component in `src/components/sections/` and apply the same approach described above.
