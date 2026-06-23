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

**Location in code:** `src/components/sections/PreMarketPanel.tsx`, `tvWidgetRef` + the `useEffect` directly below the dropdown click-outside effect.

**Current provider:** [TradingView](https://www.tradingview.com) — `embed-widget-events.js` Economic Calendar widget.

> **Why TradingView instead of Investing.com?**
> `sslecal2.investing.com` sets `X-Frame-Options: SAMEORIGIN`, which causes a blank white box
> when embedded in a third-party domain. TradingView's widget is purpose-built for embedding
> and does not have this restriction.

### How the embed works

TradingView's widget is **not** a plain iframe src — it's a `<script>` tag that TradingView's CDN uses to inject an iframe itself. The React implementation:

1. A `<div ref={tvWidgetRef}>` is rendered in the JSX.
2. A `useEffect` (mount-only `[]`) creates a `<script>` element, sets `innerHTML` to the JSON config, and appends it to that div.
3. TradingView's script runs, creates an iframe inside the div, and renders the calendar.
4. The `useEffect` cleanup empties the div when the component unmounts.

### Config parameters

The config is the JSON object passed as `script.innerHTML` in the `useEffect`:

| Key | Current value | Meaning | How to change |
|-----|--------------|---------|---------------|
| `colorTheme` | `"dark"` | Widget colour theme | `"light"` for a light theme |
| `isTransparent` | `false` | Widget background | `true` to use the container's background colour |
| `width` | `"100%"` | Widget width | Fixed pixel value e.g. `"800"` |
| `height` | `450` | Widget height in pixels | Any integer — **also update `h-[450px]` on the `<div>`** |
| `locale` | `"en"` | Display language | Any TradingView locale string |
| `importanceFilter` | `"1"` | Impact filter: `-1`=low `0`=medium `1`=high | `"-1,0,1"` to show all; `"0,1"` for medium+high |

### Timezone

TradingView's economic calendar widget displays events in the **browser's local timezone** — there is no server-side timezone override in the widget config. Since the app is used in Nigeria (WAT = UTC+1), the browser timezone is already correct and no extra config is needed.

If you need to force a specific timezone regardless of the viewer's browser, you would need to switch to a provider that accepts an explicit timezone parameter (e.g. Investing.com's official JS widget — see "Swapping provider" below).

### Changing the height

Two places must stay in sync:

1. The `height` value in the JSON config inside the `useEffect` (e.g. `height: 450`)
2. The Tailwind class on the `<div>`: `h-[450px]`

Change both to the same value. `600` shows roughly a full day without internal scrolling.

### Swapping to a different provider

#### Option A — Investing.com official JS widget (supports explicit timezone)

Investing.com also provides a script-based embed (not a raw iframe) through their widget builder at `https://www.investing.com/webmaster-tools/economic-calendar`. The generated code creates an `InvestingEconomicCalendar_Widget` instance. To use it in React:

1. Replace the `useEffect` body with logic that loads `https://widget.investing.com/static/economic-calendar/index.js` and calls `new window.InvestingEconomicCalendar_Widget({...})` after the script loads.
2. Config accepts `timezone: "37"` for Africa/Lagos (WAT, UTC+1) — this is a real timezone override.
3. Update the attribution `<a>` link to point to `https://www.investing.com`.

#### Option B — plain iframe provider

If you find a provider that supplies a direct iframe URL (no scripting needed) and does **not** set `X-Frame-Options: SAMEORIGIN`, replace the `useEffect` + `<div>` approach with a plain `<iframe src="...">`. Remove the `tvWidgetRef` ref and both `useEffect` blocks.

#### General checklist for any swap

1. Update the `useEffect` body (or replace with `<iframe>` as appropriate).
2. Adjust `h-[450px]` on the container `<div>` to match the new widget's height.
3. Update the attribution `<a>` href and text to the new provider.
4. Update this section of MAINTENANCE.md.

**If a Content-Security-Policy is added to the project later**, add the provider's domains:

```js
// next.config.ts — headers()
"Content-Security-Policy": [
  "script-src 'self' https://s3.tradingview.com",         // TradingView widget script
  "frame-src  'self' https://s3.tradingview.com https://www.tradingview.com", // iframe it injects
].join("; ")
```

---

## Vision board

Images are uploaded manually to the `vision-board` Supabase Storage bucket. The bucket path convention is `{user_id}/{filename}`. There is no scraping or external API — images are supplied by the user.

---

## Economic Calendar tab

The standalone Economic Calendar tab (separate from the pre-market news block) is a full-page embed. To swap the provider there, find the `EconomicCalendarSection` component in `src/components/sections/` and apply the same approach described above.
