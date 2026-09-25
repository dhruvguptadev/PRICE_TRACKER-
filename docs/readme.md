# Mock Storefront — Product Search & Scheduled Price Tracker

A full-stack price/stock tracker for the provided mock storefront:

**Target:** https://demo.inelabteamdev.com/

The application allows a user to search for a product, select a specific option/variant, track it, and view scheduled price/stock history and scrape logs.

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React + Vite |
| Frontend hosting | Vercel |
| Backend | Node.js + Express |
| Backend hosting | Render |
| Database | Supabase PostgreSQL |
| Lightweight scraper | Node fetch + HTML parser |
| Browser scraper | Playwright, only where required |
| Scheduler | cron-job.org or equivalent scheduled function |

## Why This Architecture

The assignment's central challenge is reliable scraping across unattended runs. The implementation therefore prioritizes:

- timeouts
- bounded retries
- validation before persistence
- target-level failure isolation
- per-attempt logging
- separate current state and historical observations
- external scheduling because free-tier backends may sleep

## Repository Structure

```text
price-tracker/
├── frontend/
├── backend/
├── fixtures/
├── docs/
│   ├── PRD.md
│   ├── ARCHITECTURE.md
│   ├── API.md
│   ├── DATABASE.md
│   ├── DECISION.md
│   ├── TASK.md
│   └── RESEARCH.md
└── README.md
```

## Local Requirements

- Node.js 20+
- npm
- Git
- Supabase project
- Playwright browser dependencies if browser mode is used

## Environment Variables

### Backend

```env
PORT=3000
NODE_ENV=development
SUPABASE_DATABASE_URL=postgresql://...
SCRAPE_TRIGGER_SECRET=replace-me
TARGET_STORE_BASE_URL=https://demo.inelabteamdev.com
HTTP_TIMEOUT_MS=15000
SCRAPE_MAX_ATTEMPTS=3
```

### Frontend

```env
VITE_API_BASE_URL=http://localhost:3000/api
```

Never put privileged Supabase credentials in the frontend.

## Installation

### Backend

```bash
cd backend
npm install
```

### Frontend

```bash
cd frontend
npm install
```

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

Open the Vite development URL shown in the terminal.

## Testing

Run backend tests:

```bash
cd backend
npm test
```

Recommended test layers:

1. parser unit tests using HTML fixtures
2. scraper/retry tests
3. API integration tests
4. database integration tests
5. live-store smoke test

## Scraping Schedule

Production schedule:

**Every 2 hours.**

Recommended scheduler request:

```http
POST /api/scrape/run
Authorization: Bearer <SCRAPE_TRIGGER_SECRET>
```

The scheduler should call the Render backend. Do not depend on `setInterval()` inside a free-tier web server as the production scheduler.

## Scraping Behavior

The scraper uses the following decision path:

```text
Fetch HTML
   ↓
Parse
   ↓
Validate required fields
   ↓
Valid? ── yes → persist success
   │
   no
   ↓
Does the page require JS?
   │
   ├── yes → Playwright
   │            ↓
   │          validate
   │
   └── no → classify failure
```

Retry only transient failures such as timeouts, network errors, HTTP 429, and temporary 5xx responses.

Never treat a missing price or wrong option as a valid price.

## Data Rules

A successful scrape writes:

```text
scrape_attempt
price_observation
tracked_products current state
```

A final failed scrape writes:

```text
scrape_attempt only
```

The previous successful price/stock remains the current known state after a failure.

## CSV Export

The dashboard contains an Export action.

Required columns:

```text
product_id
product_name
selected_option
timestamp
price
stock
outcome
```

Timestamp is exported in ISO 8601 UTC. Failed attempts are included with blank price and stock.

## Deployment

### 1. Supabase

- Create project.
- Apply schema from `DATABASE.md`.
- Configure production database credentials.

### 2. Render

Deploy `backend/` as a Node web service.

Set environment variables from the backend list.

Verify:

```text
GET /api/health
```

### 3. Vercel

Deploy `frontend/`.

Set:

```env
VITE_API_BASE_URL=https://<render-service>.onrender.com/api
```

### 4. Scheduler

Configure an external scheduler to call the protected scrape endpoint every 2 hours.

## Headed Mode

Run Playwright in headed mode locally for the required demonstration.

A recommended developer command is:

```bash
npm run scrape:headed -- --tracked-product-id <id>
```

The exact script name may be adjusted to the final implementation.

The demo should show:

- the real mock storefront
- a scrape attempt
- slow/failing handling
- retry
- final outcome
- resulting dashboard/log state

## API

See [`docs/API.md`](./docs/API.md).

## Database

See [`docs/DATABASE.md`](./docs/DATABASE.md).

## Architecture

See [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md).

## Requirements

See [`docs/PRD.md`](./docs/PRD.md).

## Decisions

See [`docs/DECISION.md`](./docs/DECISION.md).

## Implementation Plan

See [`docs/TASK.md`](./docs/TASK.md).

## Research Notes

See [`docs/RESEARCH.md`](./docs/RESEARCH.md).

## Assignment Mapping

The implementation follows the provided brief:

- React/Vue frontend on Vercel
- Node/Express or Django backend on Render
- Supabase PostgreSQL
- 2-hour scheduled scraping
- lightweight HTTP/HTML parsing preferred
- Playwright/Puppeteer only when required
- price + stock history
- per-product scrape logs
- CSV export
- headed run
- 2–3 tracked products at submission
- public GitHub repository + live URL + recording + documentation

## Reliability Principles

1. **Fail closed:** invalid extraction is a failure, not a guess.
2. **Retry boundedly:** never retry forever.
3. **Record everything:** attempts and failures are visible.
4. **Preserve last known good state:** failures do not erase the last successful price/stock.
5. **Keep targets isolated:** one product failure should not abort the entire scheduled run.
6. **Test parsers against fixtures:** prevent silent selector regressions.

## External Documentation

- React: https://react.dev/
- Vite: https://vite.dev/guide/
- Express: https://expressjs.com/
- Supabase PostgreSQL: https://supabase.com/docs/guides/database
- Supabase RLS: https://supabase.com/docs/guides/database/postgres/row-level-security
- Playwright: https://playwright.dev/docs/intro
- Playwright locators: https://playwright.dev/docs/locators
- Render services: https://render.com/docs/service-types
- Render cron jobs: https://render.com/docs/cronjobs
- Vercel: https://vercel.com/docs
- cron-job.org: https://cron-job.org/

## Important Scope Rule

Only scrape the mock storefront assigned in the brief. Do not generalize the scraper to unrelated retailers during the assignment.
