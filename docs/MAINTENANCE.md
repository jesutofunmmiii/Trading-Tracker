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

## Economic calendar embed (High-Impact News block)

**Location in code:** `src/components/sections/PreMarketPanel.tsx`, inside the `{/* High-impact news */}` block.

**Current provider:** [Investing.com](https://www.investing.com) — embeddable calendar via `sslecal2.investing.com`.

**Current embed URL:**

```
https://sslecal2.investing.com?importance=3&timeZone=37&calType=day&timeframe=day&lang=56
```

### URL parameter reference

| Parameter | Current value | Meaning | How to change |
|-----------|--------------|---------|---------------|
| `importance` | `3` | Event impact filter: `1`=low, `2`=medium, `3`=high only | Change to `1,2,3` to show all impacts |
| `timeZone` | `37` | Investing.com timezone ID for **Africa/Lagos (WAT, UTC+1)** | See timezone IDs below |
| `calType` | `day` | View mode: `day` shows a single day | `week` for the full week |
| `timeframe` | `day` | Same as calType; both are needed | Set to `week` together with `calType` |
| `lang` | `56` | Display language (56 = English/US) | Other lang IDs on Investing.com widget builder |

**Common Investing.com timezone IDs:**

| Timezone | ID |
|----------|----|
| UTC | `0` |
| Africa/Lagos (WAT, UTC+1) | `37` |
| Europe/London (GMT/BST) | `4` |
| America/New_York (ET) | `8` |
| Europe/Berlin (CET/CEST) | `72` |

To find any other timezone ID, use Investing.com's widget builder at `https://www.investing.com/webmaster-tools/economic-calendar`, configure the timezone, and inspect the generated iframe `src`.

### Changing the height

The iframe height is set in the Tailwind class `h-[480px]` on the `<iframe>` element. Adjust to taste — `h-[600px]` shows more events without scrolling.

### Adding a currency/country filter

Append a `countries` query parameter with comma-separated Investing.com country IDs:

```
&countries=5,22,32,72,26,36,43
```

Common IDs: `5`=US, `22`=UK, `32`=EU, `72`=Japan, `26`=Germany, `36`=Australia, `43`=Canada.

### Swapping to a different provider

To replace Investing.com with another embed:

1. Obtain the new provider's iframe URL (FXStreet, MyFXBook, TradingEconomics, etc.).
2. In `PreMarketPanel.tsx`, replace the `src` attribute on the `<iframe>`.
3. Adjust `h-[480px]` if the new widget renders at a different natural height.
4. Update the attribution link (the `<a>` tag below the header icon).
5. Update this section of MAINTENANCE.md to reflect the new provider and its parameters.

If the new provider uses a JavaScript/script-tag embed rather than a plain iframe, you will need to extract or construct a direct iframe URL from their widget builder, or use a `dangerouslySetInnerHTML` wrapper component — avoid the latter if possible.

**If a Content-Security-Policy is added to the project later**, add the provider's domain to `frame-src`. For the current Investing.com embed:

```js
// next.config.ts headers()
"Content-Security-Policy": "... frame-src 'self' https://sslecal2.investing.com ..."
```

---

## Vision board

Images are uploaded manually to the `vision-board` Supabase Storage bucket. The bucket path convention is `{user_id}/{filename}`. There is no scraping or external API — images are supplied by the user.

---

## Economic Calendar tab

The standalone Economic Calendar tab (separate from the pre-market news block) is a full-page iframe embed. The embed source is currently set to the same Investing.com widget. To swap it, find the `EconomicCalendarSection` component in `src/components/sections/` and update the `src` there. See the parameter reference above.
