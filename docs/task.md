# TASK — Implementation Plan

## 1. Deadline

**September 27, 2026 — 1:00 PM IST**

The assignment is time-boxed. Prioritize the evaluated core: reliable scraping, honest logs, scheduled execution, persistence, deployment, and a convincing headed-mode demonstration.

**Critical path:** the deployed scraper must run unattended for as long as possible before submission (12 runs/day at a 2-hour interval). Deploy the scraper + scheduler early and polish afterwards.

## 2. Execution Strategy

Build in vertical slices instead of completing the frontend first:

```text
1. Inspect target store               ✅ done (research.md §3)
2. Lock scraper contract
3. Set up database
4. Build catalog client + price scraper + tests
5. Build scrape orchestration
6. Build API
7. Deploy backend + scheduler         ← start unattended runs ASAP
8. Build dashboard
9. Deploy frontend
10. Validate unattended behavior
11. Record demo
12. Final submission check
```

## 3. Phase 0 — Repository Bootstrap

- [x] Create repository.
- [x] Create `frontend/` (Next.js 16) and `backend/` (Express 5).
- [x] Add root `.gitignore`.
- [x] Add `README.md` at repo root.
- [x] Add `docs/` documentation.
- [ ] Add `backend/.env.example` and `frontend/.env.example`.
- [ ] Fix `backend/package.json` entry point (`main`/`start` → `src/server.js`).
- [ ] Add backend npm scripts: `dev`, `start`, `test`, `scrape:headed`.
- [ ] Pin Node version (`"engines": { "node": ">=20" }`).

## 4. Phase 1 — Inspect the Mock Store ✅

- [x] Open target homepage: SPA shell, no data in HTML.
- [x] Identify search flow: no server search; listings are shuffled per request.
- [x] Record product URL structure: `/item/:id`.
- [x] Extract store product ID from product URL: numeric `id`.
- [x] Identify options: `optionAxis` + `options[{id,label}]` from `/api/v2/items/:id`.
- [x] Identify price source: browser-only after challenge + hover.
- [x] Identify stock: count pill / "Sold out".
- [x] Inspect network/bundle: `/api/v2/listings`, `/api/v2/items/:id`, `/api/v2/ui/manifest`.
- [ ] Confirm option-selection UI and hover behavior in a headed browser.
- [ ] Save fixtures: manifest JSON, item JSON, rendered DOM snapshots (split price, sale price, sold out).

## 5. Phase 2 — Supabase Database

- [ ] Create Supabase project.
- [ ] Write `backend/db/schema.sql` from `database.md` §9 and run it.
- [ ] Connect via **session pooler** string (`DATABASE_URL`).
- [ ] Test success transaction (attempt + observation + current state).
- [ ] Test failed attempt leaves current state unchanged.
- [ ] Verify CHECK blocks price on non-success attempts.
- [ ] Verify history query ordering.

## 6. Phase 3 — Store Client + Scraper Core (Highest Priority)

### Store client (HTTP)

- [ ] `fetchJson` with timeout, retry on 429/5xx/network errors.
- [ ] `getListingsPage`, `getItem`, `getManifest`.
- [ ] Catalog sync: repeated full passes until unique IDs == `count` (max passes), upsert `catalog_products`, report completeness.

### Price scraper (Playwright)

- [ ] Install Playwright + Chromium.
- [ ] Browser lifecycle: one browser per batch, new context per target, close in `finally`. Block images/fonts.
- [ ] Navigate to `/item/:id`, wait for product name.
- [ ] Select the tracked option; confirm it is active.
- [ ] Hover the price panel with multiple `page.mouse.move` steps + dwell; repeat if the "Hover over the price area" message persists.
- [ ] Wait for the `priceTag.priceValue` element to be visible and not pending.
- [ ] Read visible price text (never `.price-value` decoy); read MRP; read stock.

### Normalization + validation

- [ ] Strip `​`, NBSP, currency symbol, Indian grouping → number.
- [ ] Stock text → integer (0 for "Sold out").
- [ ] Reject name mismatch, wrong active option, pending price, non-positive/NaN price, negative stock.
- [ ] Unit tests with fixtures.

### Retry + classification

- [ ] Max 3 attempts, exponential backoff with jitter.
- [ ] Transient: timeout, network, 408/429/5xx, challenge timeout, price not shown.
- [ ] Page shifted: locator miss → retry with fresh page + fresh manifest; `STRUCTURE_CHANGED` if all attempts miss.
- [ ] Permanent: product 404, option gone → fail immediately.

## 7. Phase 4 — Scrape Orchestration

- [ ] `run_key` = `cron-<UTC 2h slot>`; insert `scrape_runs` `ON CONFLICT DO NOTHING`.
- [ ] In-process "batch running" guard + `pg_try_advisory_lock`.
- [ ] Load active targets; process sequentially and independently.
- [ ] Write one attempt row per attempt (`retried` / `failed` / `success`).
- [ ] On success: attempt + observation + current state in one transaction.
- [ ] On final failure: attempt + `consecutive_failures++`, no current-state change.
- [ ] Finish run with counts and status (`completed` / `partial` / `failed`).
- [ ] At run start, close runs stuck `running` >30 min as `failed`.
- [ ] Health endpoint: `lastCronRunAt`, `schedulerStale` (>2 h 30 min); dashboard banner when stale.

## 8. Phase 5 — Backend API

- [ ] `GET /api/health`
- [ ] `GET /api/products/search` (catalog cache)
- [ ] `GET /api/products/:storeProductId` (live item + options)
- [ ] `POST /api/catalog/sync` (protected)
- [ ] `POST /api/tracked-products` (validate against store; reactivate if soft-deleted; queue initial scrape)
- [ ] `GET /api/tracked-products`
- [ ] `GET /api/tracked-products/:id`
- [ ] `DELETE /api/tracked-products/:id`
- [ ] `GET /api/tracked-products/:id/history`
- [ ] `GET /api/tracked-products/:id/scrape-logs`
- [ ] `POST /api/scrape/run` (protected, `202` + background)
- [ ] `POST /api/scrape/:trackedProductId` (protected)
- [ ] `GET /api/runs/:runId`
- [ ] `GET /api/export.csv`

- [ ] Centralized validation + error middleware + request ID.
- [ ] Bearer-secret middleware (constant-time compare).
- [ ] CORS limited to `FRONTEND_ORIGIN`.

## 9. Phase 6 — Headed CLI

- [ ] `npm run scrape:headed -- --tracked-product-id <id>` → same scraper with `headless: false`, `slowMo`, writes real attempt rows (`trigger_source = demo`).
- [ ] Optional `--simulate-timeout` flag that lowers the price-ready timeout to force a visible retry. Must be documented and labelled as a demo aid, not presented as a real store failure.

## 10. Phase 7 — Deploy Backend + Scheduler (do early)

### Render

- [ ] Web service, root `backend/`.
- [ ] Build: `npm install && npx playwright install --with-deps chromium`.
- [ ] Start: `npm start`.
- [ ] Env vars set.
- [ ] `/api/health` OK; catalog synced 960/960.
- [ ] Manual scrape succeeds on Render (check memory in Render metrics).

### cron-job.org

- [ ] Warm-up job: `GET /api/health` at `55 1-23/2 * * *` (5 min before each scrape).
- [ ] Scrape job: `POST https://<render>.onrender.com/api/scrape/run`, header `Authorization: Bearer …`, `0 */2 * * *`.
- [ ] Enable failure notifications on both jobs.
- [ ] Trigger once manually; confirm `202` and rows in `scrape_runs` / `scrape_attempts`.
- [ ] Track 2–3 products so unattended history starts accumulating.

## 11. Phase 8 — Frontend (Next.js)

Read `frontend/AGENTS.md` first. Next.js 16 has breaking changes.

### Dashboard

- [ ] `lib/api.js` using `NEXT_PUBLIC_API_BASE_URL`.
- [ ] Search input + results.
- [ ] Product detail + option selector.
- [ ] Track button.
- [ ] Tracked products table: current price, MRP, stock, last success, last outcome, failure count.
- [ ] Per-product page: history chart (price + stock) and table.
- [ ] Scrape log (all attempts, failures highlighted).
- [ ] Export button → `/api/export.csv`.

### UX states

- [ ] Loading (including Render cold start: "waking backend…")
- [ ] Empty search / no results
- [ ] No tracked products
- [ ] API error
- [ ] Never scraped
- [ ] Last scrape failed (show last known good price with its timestamp)

### Vercel

- [ ] Import repo, root `frontend/`, Next.js preset.
- [ ] Set `NEXT_PUBLIC_API_BASE_URL`.
- [ ] Update backend `FRONTEND_ORIGIN`.

## 12. Phase 9 — Production Validation

- [ ] 2–3 products/options tracked.
- [ ] Several scheduled (unattended) runs recorded.
- [ ] Chart/table data correct against the store in a browser.
- [ ] Logs show retries/failures honestly.
- [ ] CSV: failed/retried rows have blank price/stock; timestamps ISO UTC; opens in a spreadsheet.
- [ ] Last successful state unchanged after a failure.

## 13. Phase 10 — Reliability Test Matrix

| Scenario | Expected result |
|---|---|
| Price loads normally | `success`, observation created |
| Navigation timeout | retry; if exhausted → `failed` |
| HTTP 429/5xx from store | retry with backoff; if exhausted → `failed` |
| Challenge/hover not accepted, price never appears | retry (re-hover / reload); if exhausted → `failed` (`CHALLENGE_TIMEOUT`) |
| Price still pending (dimmed) | keep waiting until timeout; never read |
| Manifest classes changed | fresh manifest + retry; persistent miss → `failed` (`STRUCTURE_CHANGED`) |
| Decoy `.price-value` present | ignored |
| Split price with zero-width chars | normalized correctly |
| Product sold out | `success` with stock 0 |
| Option no longer offered | `failed` immediately (`OPTION_NOT_FOUND`) |
| One target fails in batch | remaining targets continue |
| Duplicate cron trigger in same slot | `200 duplicate`, no new run |
| Backend asleep before scrape | warm-up ping wakes it; scrape call returns `202` within 30 s |
| Scheduler stops firing | `schedulerStale = true`, dashboard banner, cron-job.org email |
| Instance restarts mid-batch | stuck run closed as `failed` by next run |
| Stock text in any of the 5 wordings | integer extracted correctly |

## 14. Phase 11 — Headed Demo (2–4 min)

1. Show the live dashboard with tracked products and history.
2. Search for a product, select an option, track it.
3. Run `npm run scrape:headed` locally.
4. Show the product page, option selection, and the hover unlocking the price.
5. Show a slow/failing case and the retry. Use a real store failure if one occurs; otherwise use the documented `--simulate-timeout` flag and say so on camera.
6. Show the final outcome.
7. Refresh the dashboard: history + log.
8. Click Export and show the CSV (including a retried/failed row).

## 15. Phase 12 — Documentation

- [x] Docs updated with store inspection results.
- [ ] `decision.md` design note: add real implementation-time AI mistakes and fixes.
- [ ] README setup tested from a clean clone.
- [ ] README: live URLs filled in.

## 16. Final Submission Checklist

- [ ] Live Vercel URL works.
- [ ] Render API reachable.
- [ ] Supabase contains tracked data.
- [ ] 2–3 tracked products/options exist.
- [ ] History contains real unattended/scheduled records.
- [ ] Scrape log contains failures/retries where they happened.
- [ ] CSV export works.
- [ ] Headed demo video recorded (2–4 min).
- [ ] Public GitHub repository accessible.
- [ ] README contains setup, schedule, env vars.
- [ ] Design note explains reliability, trade-offs, AI mistakes/corrections.
- [ ] Resume PDF provided.

## 17. Priority Order Under Time Pressure

```text
P0  Playwright price/stock scraper + validation
P0  Retry + timeout + classification
P0  Honest attempt logging
P0  Supabase persistence
P0  Deploy backend + cron (start unattended runs early)
P0  2–3 tracked targets
P0  Catalog sync + search
P0  Minimal dashboard: search, track, history, log, export
P0  Headed demo
P1  Dashboard polish
P1  CI (GitHub Actions: lint + unit tests)
P2  Alerts
P2  Structure-change flag in UI
P2  Configurable frequency / multi-option scrape
```

Do not spend time on P2 items while P0 reliability is incomplete.
