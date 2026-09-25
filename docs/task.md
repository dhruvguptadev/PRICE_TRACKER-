# TASK — Implementation Plan

## 1. Deadline

**September 27, 2026 — 1:00 PM IST**

The assignment is time-boxed. Prioritize the evaluated core: reliable scraping, honest logs, scheduled execution, persistence, deployment, and a convincing headed-mode demonstration.

## 2. Execution Strategy

Build in vertical slices instead of completing the frontend first:

```text
1. Inspect target store
2. Lock scraper contract
3. Set up database
4. Build scraper + tests
5. Build scrape orchestration
6. Build API
7. Build dashboard
8. Add scheduler
9. Deploy
10. Validate unattended behavior
11. Record demo
12. Final submission check
```

## 3. Phase 0 — Repository Bootstrap

- [ ] Create repository.
- [ ] Create `frontend/` and `backend/`.
- [ ] Add root `.gitignore`.
- [ ] Add `README.md`.
- [ ] Add `docs/` documentation.
- [ ] Add `.env.example` for frontend/backend.
- [ ] Use Node.js version documented by the local environment and hosted runtime.
- [ ] Configure ESLint/Prettier if time permits.
- [ ] Add npm scripts: `dev`, `build`, `start`, `test`.

Deliverable:

```text
repo boots locally
```

## 4. Phase 1 — Inspect the Mock Store (Critical)

Do this before finalizing selectors or schema assumptions.

- [ ] Open target homepage.
- [ ] Identify search flow.
- [ ] Search by partial product name.
- [ ] Record product-card structure.
- [ ] Record product URL structure.
- [ ] Extract store product ID from product URL.
- [ ] Open at least 3 products.
- [ ] Identify all selectable options on each.
- [ ] Identify exact price element or JSON source.
- [ ] Identify stock element/state.
- [ ] Inspect Network tab for XHR/fetch requests.
- [ ] Determine whether initial HTML contains price/stock.
- [ ] Record slow/failing behavior observed.
- [ ] Save representative HTML as fixtures.

**Important:** do not invent selectors, product IDs, or dynamic behavior before this inspection.

## 5. Phase 2 — Supabase Database

- [ ] Create Supabase project.
- [ ] Create tables from `DATABASE.md`.
- [ ] Create indexes.
- [ ] Add constraints/checks.
- [ ] Test insert success attempt.
- [ ] Test insert failed attempt.
- [ ] Test transaction for successful observation + current-state update.
- [ ] Verify failed attempt does not change current state.
- [ ] Verify history query ordering.

## 6. Phase 3 — Scraper Core (Highest Priority)

### HTTP Path

- [ ] Implement fetcher with timeout.
- [ ] Set a realistic User-Agent.
- [ ] Capture status and duration.
- [ ] Parse HTML.
- [ ] Extract target product.
- [ ] Extract selected option.
- [ ] Extract price.
- [ ] Extract stock.

### Validation

- [ ] Reject missing product identity.
- [ ] Reject wrong option.
- [ ] Reject missing price.
- [ ] Reject invalid price.
- [ ] Reject unknown stock unless the business rule permits `unknown`.
- [ ] Return structured result.

### Retry

- [ ] Implement max-attempt limit.
- [ ] Implement exponential backoff.
- [ ] Add jitter.
- [ ] Classify retryable errors.
- [ ] Classify permanent parsing/identity errors.
- [ ] Record each retry.

### Browser Fallback

- [ ] Install Playwright.
- [ ] Verify browsers can launch locally.
- [ ] Implement browser path only for JS-required pages.
- [ ] Use locators/condition-based waits.
- [ ] Set navigation/action timeouts.
- [ ] Close browser/context in `finally`.

## 7. Phase 4 — Scrape Orchestration

- [ ] Create `scrape_runs` record.
- [ ] Load all active tracking targets.
- [ ] Process targets independently.
- [ ] Create attempt row for every attempt.
- [ ] On success: insert observation + update current state transactionally.
- [ ] On retry: write `retried` attempt row.
- [ ] On final failure: write `failed` row.
- [ ] Continue processing after target-level failure.
- [ ] Return aggregate run summary.

### Idempotency

- [ ] Generate stable `run_key`.
- [ ] Prevent duplicate attempt insertion.
- [ ] Prevent duplicate success observation for the same logical run/target.

## 8. Phase 5 — Backend API

- [ ] `GET /api/health`
- [ ] `GET /api/products/search`
- [ ] `GET /api/products/:storeProductId`
- [ ] `POST /api/tracked-products`
- [ ] `GET /api/tracked-products`
- [ ] `GET /api/tracked-products/:id`
- [ ] `DELETE /api/tracked-products/:id`
- [ ] `GET /api/tracked-products/:id/history`
- [ ] `GET /api/tracked-products/:id/scrape-logs`
- [ ] `POST /api/scrape/run`
- [ ] `POST /api/scrape/:trackedProductId`
- [ ] `GET /api/export.csv`

- [ ] Add centralized validation.
- [ ] Add centralized error middleware.
- [ ] Add request ID.
- [ ] Add scheduler secret middleware.
- [ ] Restrict scrape URLs to target host.

## 9. Phase 6 — Frontend

### Dashboard

- [ ] Header + project description.
- [ ] Search input.
- [ ] Search results.
- [ ] Product details/option selector.
- [ ] Track button.
- [ ] Tracked products cards/table.
- [ ] Current price.
- [ ] Current stock.
- [ ] Last success time.
- [ ] Failure count.
- [ ] History chart/table.
- [ ] Scrape log.
- [ ] Export button.

### UX States

- [ ] Loading
- [ ] Empty search
- [ ] No tracked products
- [ ] API error
- [ ] Failed scrape status
- [ ] Never scraped
- [ ] Last successful observation

## 10. Phase 7 — Scheduler

- [ ] Create cron-job.org account/configuration.
- [ ] Schedule request every 2 hours.
- [ ] Configure `POST /api/scrape/run`.
- [ ] Add `Authorization: Bearer ...` header.
- [ ] Test scheduler manually.
- [ ] Confirm Render wakes for the request.
- [ ] Confirm database records are written.
- [ ] Document scheduler setup in README.

Alternative:

- [ ] Use Render Cron Job if chosen and document why.

## 11. Phase 8 — Deployment

### Supabase

- [ ] Production database schema migrated.
- [ ] Production credentials stored securely.

### Render

- [ ] Connect repository.
- [ ] Configure Node service.
- [ ] Configure build/start commands.
- [ ] Add environment variables.
- [ ] Verify Playwright runtime dependencies if used.
- [ ] Verify `/api/health`.

### Vercel

- [ ] Connect frontend repository.
- [ ] Configure build command.
- [ ] Configure output directory.
- [ ] Set public API URL.
- [ ] Verify search and dashboard.

## 12. Phase 9 — Production Validation

- [ ] Track at least 2–3 products/options.
- [ ] Trigger manual scrape.
- [ ] Confirm successful observations.
- [ ] Confirm chart/table data.
- [ ] Confirm logs.
- [ ] Trigger failure scenario.
- [ ] Confirm retry rows.
- [ ] Confirm final failure row.
- [ ] Confirm failed rows have blank price/stock in CSV.
- [ ] Confirm last successful state remains unchanged after failure.
- [ ] Confirm export opens correctly in spreadsheet software.

## 13. Phase 10 — Reliability Test Matrix

| Scenario | Expected result |
|---|---|
| HTTP 200 + valid data | `success`, history row created |
| HTTP timeout | retry; if exhausted → `failed` |
| HTTP 503 | retry; if exhausted → `failed` |
| HTTP 429 | retry with backoff; respect `Retry-After` when practical |
| Product selector missing | fail honestly; no successful observation |
| Price missing | fail honestly; no successful observation |
| Stock delayed | browser wait/fallback or final failure |
| Product not found | no blind retry unless transient reason is known |
| One target fails in batch | remaining targets continue |
| Scheduler sends duplicate trigger | idempotency prevents duplicate logical success |
| Backend wakes from sleep | request still starts run correctly |

## 14. Phase 11 — Headed Demo

Target duration: 2–4 minutes.

Suggested recording sequence:

1. Show the live dashboard.
2. Search for a product.
3. Select an option.
4. Add it to tracking.
5. Start headed scraper run.
6. Show product page in browser.
7. Show slow/failing behavior.
8. Show retry.
9. Show final success or honest failure.
10. Refresh dashboard and show history/log.
11. Click Export and show CSV.

Do not fake a failure. Use a reproducible target-store behavior or a clearly documented local test mode for the demo.

## 15. Phase 12 — Documentation

- [ ] PRD updated with final behavior.
- [ ] ARCHITECTURE updated with actual deployed topology.
- [ ] API updated with actual routes/status codes.
- [ ] DATABASE updated with final schema.
- [ ] DECISION updated with real trade-offs.
- [ ] README setup tested from a clean machine/session.
- [ ] Research note includes external sources and unresolved assumptions.

## 16. Final Submission Checklist

- [ ] Live Vercel URL works.
- [ ] Render API reachable.
- [ ] Supabase database contains tracked data.
- [ ] 2–3 tracked products/options exist.
- [ ] Scrape history contains real unattended/scheduled records.
- [ ] Scrape log contains failures/retries where demonstrated.
- [ ] CSV export works.
- [ ] Headed demo video recorded.
- [ ] Public GitHub repository is accessible.
- [ ] README contains required environment variables and schedule.
- [ ] Design decision note explains reliability choices and AI mistakes/corrections.
- [ ] Resume PDF included/provided separately.

## 17. Priority Order Under Time Pressure

```text
P0  Target-store inspection
P0  Scraper correctness
P0  Retry + timeout + validation
P0  Honest attempt logging
P0  Supabase persistence
P0  2-hour scheduling
P0  Live deployment
P0  2–3 tracked targets
P0  Headed demo
P1  Dashboard polish
P1  CSV export polish
P1  CI/CD
P2  Alerts
P2  Structure-change detection
P2  Configurable frequency
```

The project should not spend significant time on P2 items while P0 reliability is incomplete.
