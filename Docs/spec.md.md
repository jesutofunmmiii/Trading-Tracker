# Trading Dashboard — Functional Spec

An interactive strategy dashboard that is both a tracking tool and a motivational hub for a
1–5 year trading career progression plan. It should feel like a **mission control center** the
user opens every morning and references throughout the trading day — not a passive document.

The build must be **production-ready**: proper error handling, input validation, and clear
documentation for maintenance and updates.

> Architecture, stack, and conventions live in `CLAUDE.md`. This file defines *what* to build,
> section by section.

---

## 1. Career Milestones (core tracking)

A visual progress tracker for all **13 milestones across 4 stages**.

### Stage 1 — Propfirm foundation
- **01:** Get & pass a $10k/$25k propfirm account
- **02:** Secure a payout from that account
- **03:** Buy & pass a propfirm $200k account
- **04:** Get a payout. Possibly a $10k payout
- **05:** Settle lock-in essentials [Rent, Device, Gym & Foodstuff]

### Stage 2 — Scaling to $1m funding / $500k withdrawn
- **06:** Invest in 4 other $200k propfirm accounts
- **07:** Pass all 4, to bring the total to 5 × $200k accounts [$1m in funding]
- **08:** Withdraw $50k collectively [$10k per $200k account] — 10 times
- **09:** Brings total withdrawal to $500k

### Stage 3 — Personal broker account
- **10:** Put that $500k into a personal broker account, divide into 20 → $25k risk per trade
- **11:** Grow personal capital from $500k to $2.3m

### Stage 4 — Capital base & legacy
- **12:** Personal capital base = $2.3m, divide into 30 → $76.6k risk per trade
- **13:** Build, Invest, Sponsor & Donate

**Each milestone displays:**
- Current status — *not started / in progress / completed*
- Key metrics — account size, payout targets, capital thresholds
- Checkbox or progress bar for visual completion tracking
- Estimated timeline within the 1–5 year window

Provide granular step definitions per stage (milestones, account sizes, payout targets,
capital thresholds specific to that stage).

---

## 2. Trading Strategy Reference

A dedicated section documenting the methodology:

- **Strategy name:** Buyside/Sellside Raid (short-term high/low into PDArray)
- **Core principle:** Target obvious short-term / middle-term / long-term liquidity draws
  within current dealing ranges
- **High-probability setup trigger:** Trades initiated from liquidity sweeps (producing strong
  lows/highs) into higher-timeframe points of interest
- Include visual placeholders for embedded setup screenshots, referenced as
  `[Trading Setup Screenshots]` (user provides the images)

---

## 3. Vision Board

A minimalist yet classy visual collection representing an ultra-successful trading lifestyle
and financial freedom. Should evoke:

- Wealth, success, and financial independence
- Trading / market mastery
- Lifestyle goals (family comfort, travel, legacy)

Arrange in an elegant grid or carousel with subtle spacing and typography. Aspirational but
professional — **never flashy**.

---

## 4. My Why

A motivational anchor displaying all five core purposes as inspirational cards or a statement
wall, easily visible when the dashboard opens. This is the emotional anchor that drives daily
trading decisions.

1. This gift that God has given me will not be buried. I will explore it to the fullest potential.
2. To be a blessing to God's work, and to humanity.
3. I have this insatiable desire to provide for my family [parents & siblings, & friends]. To be
   used by God as that ladder between where they are now, and their dreams.
4. To give my nuclear family [wife & kids] a very comfortable life.
5. To build & contribute capital to cool projects around the world!

---

## 5. Daily Routine Tracker

A functional tracker monitoring consistency across these daily commitments:

- Going over the dashboard daily
- Backtesting & studying for at least 2 hours
- Praying
- Morning and/or evening walks
- Journaling & reflecting on past trades
- Pre-market analysis
- Reading at least 10 pages of a book
- Listening to at least one podcast

**Requirements:**
- Check off completed activities each day
- Display streaks and/or completion percentages
- Visual feedback on routine adherence
- Reflection prompt / notes field for each activity

---

## 6. Trading Journal

Two subsections.

### Pre-Market Analysis
- Input fields: market conditions, key levels identified, planned trades, risk/reward ratios
- Time-stamped entries
- Ability to attach notes or sketches

### Post-Market Analysis
- Log each completed trade: entry price, exit price, P&L, setup quality (1–5 scale),
  lessons learned
- Reflection prompts for continuous improvement
- Performance metrics: win rate, average risk/reward, consistency notes

---

## 7. Live Market Data Integration

Embed a live economic calendar from **FXStreet or Forex Factory**. Display:

- Upcoming economic events and their scheduled times
- Impact level (high / medium / low)
- Previous / forecast / actual data
- Filtering by currency pair or impact level

---

## 8. Propfirm Tracker

A reference table of suggested propfirms.

| Propfirm | Status | Account size | Payout received | Amount withdrawn | Notes |
|---|---|---|---|---|---|
| FundingPips | applied / in progress / passed | | yes / no | | |
| Hola Prime | applied / in progress / passed | | yes / no | | |
| Funded Next | applied / in progress / passed | | yes / no | | |
| FTMO | applied / in progress / passed | | yes / no | | |
| Atlas Funded | applied / in progress / passed | | yes / no | | |

---

## 9. Design Requirements

- Interactive single-page or multi-tab dashboard
- Color scheme: professional and calming — navy, gold, white with subtle accents
- Typography: clean, readable, modern
- Mobile-responsive where possible
- **Interlinked sections** — clicking a milestone highlights related journal entries or vision
  elements
- **Summary statistics area** at the top showing: current stage, total capital accumulated,
  milestones completed, days remaining in the 5-year window
- Overall feel: a mission control center, opened every morning and referenced all day
