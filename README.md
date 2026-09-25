# Mock Storefront — Product Search & Scheduled Price Tracker

A full-stack price/stock tracker for the provided mock storefront:

**Target:** https://demo.inelabteamdev.com/

The application allows a user to search for a product, select a specific option/variant, track it, and view scheduled price/stock history and scrape logs.

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16 (React 19, App Router, Tailwind CSS 4) |
| Frontend hosting | Vercel |
| Backend | Node.js + Express (ES Modules) |
| Backend hosting | Render (free web service) |
| Database | Supabase PostgreSQL via Prisma 7 (`@prisma/adapter-pg`) through the Supabase session pooler |
| Catalog / options | Store JSON API over plain HTTP (no browser) |
| Price / stock | Playwright (Chromium) — the store only reveals price after a browser-side challenge |
| Scheduler | cron-job.org → protected backend endpoint, every 2 hours |

## How the Target Store Works (verified 2026-09-25)

Summary of the inspection in [`docs/research.md`](./docs/research.md):

- The site is a client-rendered SPA. The HTML is an empty shell, so HTML parsing alone cannot extract anything.
- Catalog and product/option data come from a JSON API (`/api/v2/listings`, `/api/v2/items/:id`) that is cheap to call over HTTP.
- **Price and stock are not in that API.** They load only after a browser-side proof-of-work challenge plus real mouse-hover telemetry over the price area. This is the part that genuinely requires a browser.
- The page has anti-scraping traps: a hidden decoy `.price-value` element, CSS class names that rotate per `/api/v2/ui/manifest` revision, a price that may be split with invisible characters, and MRP/sale/member prices displayed side by side.
- Product page URL: `https://demo.inelabteamdev.com/item/<id>`. The numeric `<id>` is the store product ID used in the CSV.

## Why This Architecture

The assignment's central challenge is reliable scraping across unattended runs. The implementation therefore prioritizes:

- lightweight HTTP for everything that does not need a browser (search, options)
- Playwright only for price/stock, where the store requires it
- timeouts and bounded retries
- validation before persistence (never a decoy, stale, or partial price)
- target-level failure isolation
- per-attempt logging
- separate current state and historical observations
- external scheduling because free-tier backends sleep

## Repository Structure

```text
price-tracker/
├── frontend/          Next.js dashboard (Vercel)
├── backend/           Express API + scraper (Render)
├── fixtures/          Saved store responses/DOM snapshots for parser tests
├── docs/
│   ├── prd.md
│   ├── architecture.md
│   ├── api.md
│   ├── database.md
│   ├── decision.md    includes the design note
│   ├── task.md
│   └── research.md
└── README.md
```

## Local Requirements

- npm
- Git
- Supabase project
- Playwright Chromium (`npx playwright install chromium`)
- Node.js 22.18+ (the generated Prisma client is TypeScript, which Node runs natively from 22.18)

## Environment Variables

### Backend (`backend/.env`)

```env
PORT=3000
NODE_ENV=development

# Supabase → Project Settings → Database → Connection string → "Session pooler".
# Use the pooler string: Supabase's direct connection is IPv6-only and Render has no outbound IPv6.
DATABASE_URL=postgresql://postgres.<project-ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres

SCRAPE_TRIGGER_SECRET=replace-me
TARGET_STORE_BASE_URL=https://demo.inelabteamdev.com
FRONTEND_ORIGIN=http://localhost:3001

HTTP_TIMEOUT_MS=15000
BROWSER_NAV_TIMEOUT_MS=30000
PRICE_READY_TIMEOUT_MS=20000
SCRAPE_MAX_ATTEMPTS=3
```

### Frontend (`frontend/.env.local`)

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:3000/api
```

`NEXT_PUBLIC_*` values are shipped to the browser. Never put database or Supabase service credentials in the frontend.

## Installation

```bash
cd backend && npm install && npx playwright install chromium
cd ../frontend && npm install
```

Apply the database schema from `backend/db/schema.sql` (see [`docs/database.md`](./docs/database.md)) in the Supabase SQL editor, or from the backend with `DATABASE_URL` set (idempotent):

```bash
cd backend && npm run db:schema
```

`db:schema` runs `schema.sql`, then `prisma db pull` + `prisma generate` so `prisma/schema.prisma` and the client match the database. `schema.sql` stays the source of truth: it holds the CHECK constraints that Prisma's schema language cannot express. `npm install` regenerates the client (`postinstall`).

The catalog syncs automatically on first start when `catalog_products` is empty. `npm run catalog:sync` forces a refresh from the CLI.

## Development

Start backend:

```bash
cd backend
npm run dev
```

Start frontend in another terminal:

```bash
cd frontend
npm run dev
```

The frontend's scripts pin port 3001, because the backend uses 3000.

Open http://localhost:3001.

## Testing

```bash
cd backend
npm test
```

Test layers:

1. parser/validator unit tests using saved fixtures (`fixtures/`)
2. retry/classification tests
3. API integration tests
4. database integration tests
5. live-store smoke test (manual)

## Scraping Schedule

**Every 2 hours**, triggered by cron-job.org:

```http
POST https://<render-service>.onrender.com/api/scrape/run
Authorization: Bearer <SCRAPE_TRIGGER_SECRET>
```

Two cron-job.org jobs handle Render's free-tier sleep:

| Job | Schedule (UTC) | Request |
|---|---|---|
| Warm-up | `55 1-23/2 * * *` (5 min before each scrape) | `GET /api/health` |
| Scrape | `0 */2 * * *` | `POST /api/scrape/run` with bearer secret |

- A sleeping Render instance takes ~50 s to wake, which is longer than cron-job.org's ~30 s timeout. The warm-up ping wakes it first, and the instance stays awake for ~15 minutes.
- The scrape endpoint responds `202 Accepted` immediately and runs the batch in the background, because a Playwright batch also takes longer than 30 s.
- Runs are keyed by their 2-hour slot, so a duplicate trigger cannot create a duplicate run.

**Missed-run detection (never silently stop):**

- `GET /api/health` reports the last scheduled run and `schedulerStale: true` when no cron run has started for more than 2 h 30 min. The dashboard shows a warning banner in that case.
- A run left `running` by a crash or restart is closed as `failed` at the start of the next run.
- cron-job.org failure notifications are enabled for both jobs.

Do not rely on `setInterval()` inside the web server as the scheduler — the free instance sleeps.

## Scraping Behavior

```text
Catalog + options (search, pick)       Price + stock (scheduled)
────────────────────────────────       ─────────────────────────────────────────
HTTP GET /api/v2/listings              Playwright: open /item/<id>
HTTP GET /api/v2/items/<id>                ↓
   ↓                                   select tracked option
cache in catalog_products                  ↓
                                       hover price area (real mouse moves + dwell)
                                           ↓
                                       wait until price visible and not pending
                                           ↓
                                       read price/stock via current manifest classes
                                           ↓
                                       validate ── invalid/transient → retry (max 3)
                                           ↓                     exhausted → failed
                                       persist success
```

Retry transient failures: timeouts, network errors, HTTP 429/5xx, challenge not completing, price not appearing in time, and selector misses after a manifest change (retried with a fresh page load and freshly fetched manifest). Do not retry permanent failures: product 404, tracked option no longer exists.

Never treat a missing, decoy, stale, or wrong-option price as valid.

## Outcome Semantics

Each row in the scrape log / CSV is one **attempt**:

- `success` — validated price/stock extracted and stored
- `retried` — this attempt failed and another attempt followed
- `failed` — this was the final attempt and it failed; price and stock are blank

Example: `retried → retried → success` or `retried → retried → failed`.

## Data Rules

A successful scrape writes, in one transaction:

```text
scrape_attempt (success)
price_observation
tracked_products current state
```

A retried or failed attempt writes:

```text
scrape_attempt only
```

The previous successful price/stock remains the current known state after a failure.

## CSV Export

The dashboard's Export button downloads `GET /api/export.csv`:

```text
product_id,product_name,selected_option,timestamp,price,stock,outcome
```

- `product_id` — numeric store ID from `/item/<id>`
- `timestamp` — ISO 8601 UTC
- `stock` — units in stock as shown by the store (`0` = sold out)
- retried/failed attempts are included with blank price and stock

## Deployment

### 1. Supabase

- Create project.
- Run `backend/db/schema.sql`.
- Copy the **Session pooler** connection string into `DATABASE_URL`.

### 2. Render

- New Web Service → connect the GitHub repo → **Root Directory** `backend`, **Language/Runtime** `Docker` (uses `backend/Dockerfile`).
- The image installs Chromium and its system libraries as root. Render's native Node runtime can't install them, so don't use it for this service.
- Set the backend environment variables (Render supplies `PORT` itself).
- Verify `GET /api/health`.

Render free instances have 512 MB RAM, so the scraper runs one browser and one target at a time and always closes the browser.

### 3. Vercel

- Import the repo → root directory `frontend/` (Next.js preset).
- Set `NEXT_PUBLIC_API_BASE_URL=https://<render-service>.onrender.com/api`.
- Set the backend's `FRONTEND_ORIGIN` to the Vercel URL (CORS).

### 4. Scheduler (cron-job.org)

Warm-up job:

- URL: `https://<render-service>.onrender.com/api/health`, method `GET`
- Schedule: 5 minutes before each scrape (`55 1-23/2 * * *`)

Scrape job:

- URL: `https://<render-service>.onrender.com/api/scrape/run`, method `POST`
- Header: `Authorization: Bearer <SCRAPE_TRIGGER_SECRET>`
- Schedule: every 2 hours (`0 */2 * * *`)

Enable failure notifications on both jobs.

## Headed Mode

Headed runs are local only (Render has no display):

```bash
cd backend
npm run scrape:headed -- --tracked-product-id <id>
```

This uses the same scraper code as production with `headless: false` and slowed-down actions so the run can be watched and recorded.

The demo recording should show:

- the real mock storefront
- option selection and the hover that unlocks the price
- a slow or failing response and the retry
- the final outcome
- the resulting dashboard/log state and CSV

## Documentation

- Requirements: [`docs/prd.md`](./docs/prd.md)
- Architecture: [`docs/architecture.md`](./docs/architecture.md)
- API: [`docs/api.md`](./docs/api.md)
- Database: [`docs/database.md`](./docs/database.md)
- Decisions + design note: [`docs/decision.md`](./docs/decision.md)
- Implementation plan: [`docs/task.md`](./docs/task.md)
- Research / store inspection: [`docs/research.md`](./docs/research.md)

## Reliability Principles

1. **Fail closed:** invalid extraction is a failure, not a guess.
2. **Retry boundedly:** never retry forever.
3. **Record everything:** attempts and failures are visible.
4. **Preserve last known good state:** failures do not erase the last successful price/stock.
5. **Keep targets isolated:** one product failure does not abort the scheduled run.
6. **Don't hard-code volatile selectors:** read class names from the store's manifest on every run.
7. **Test parsers against fixtures:** prevent silent selector regressions.

## Important Scope Rule

Only scrape the mock storefront assigned in the brief. Do not scrape real retailers or third-party sites.
