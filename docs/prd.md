# Product Requirements Document (PRD)

## 1. Document Control

| Field | Value |
|---|---|
| Project | Mock Storefront — Product Search & Scheduled Price Tracker |
| Document | Product Requirements Document |
| Status | Implementation Ready |
| Deadline | September 27, 2026 — 1:00 PM IST |
| Primary Target Store | https://demo.inelabteamdev.com/ |
| Primary Audience | Assignment reviewer / engineering team |

## 2. Problem Statement

Build a small full-stack application that lets a user search the provided mock storefront by partial or full product name, choose a specific product option/variant, and track that option's price and stock over time through scheduled scraping.

The primary engineering challenge is scraper reliability. The application must continue working across unattended runs, tolerate slow or failing requests, retry recoverable failures, and avoid silently storing incorrect or empty price/stock values.

## 3. Goals

### 3.1 Primary Goals

1. Allow product search by partial or full product name.
2. Allow the user to select one specific product option/variant to track.
3. Persist tracked products/options in PostgreSQL via Supabase.
4. Scrape current price and stock every 2 hours.
5. Handle slow responses, transient HTTP failures, asynchronous content, and page changes gracefully.
6. Persist an honest scrape attempt log for every attempt.
7. Display price/stock history as a chart and/or table.
8. Export the complete scrape history as CSV.
9. Provide a headed Playwright execution path that can be screen-recorded.
10. Deploy the frontend to Vercel and backend to Render using free-tier-compatible scheduling architecture.

### 3.2 Success Criteria

The system is successful when:

- At least 2–3 products/options are visibly tracked in the live submission environment.
- Scheduled runs occur every 2 hours using an external scheduler or scheduled function.
- Successful scrapes persist valid price and stock values.
- Failed attempts are persisted with empty price and stock rather than fabricated/previous values.
- Retry behavior is visible in scrape logs.
- Exported CSV contains one row per scrape attempt and includes failed attempts.
- The headed scraper demonstration shows a real run against the assigned store and demonstrates slow/failing-response handling.
- A repository reviewer can reproduce the system from README instructions.

## 4. Non-Goals

- Scraping real retailers or third-party stores.
- Building a production-scale retail aggregation platform.
- Multi-store support in the MVP.
- Complex account management/authentication unless required by deployment constraints.
- Mobile apps.
- Real-time price streaming.
- Advanced alerting unless implemented as a bonus.

## 5. Target User Journey

```text
Open dashboard
    ↓
Search product name
    ↓
Review matching products
    ↓
Open/select product
    ↓
Select exact option/variant
    ↓
Create tracking record
    ↓
Initial scrape
    ↓
Dashboard shows latest price + stock
    ↓
Every 2 hours: scheduler triggers scrape
    ↓
Scrape attempt is logged
    ↓
Successful result becomes history point
    ↓
Failure remains visible as failure; previous value is not overwritten
```

## 6. Functional Requirements

### FR-01 Product Search

The application shall allow partial or full product-name search against the provided storefront.

Acceptance criteria:

- Empty query does not trigger an unnecessary external scrape.
- Partial text can return matching products.
- Search results expose enough information to identify the correct product.
- Product page URL and the store product ID derived from the URL are retained.

### FR-02 Product Option Selection

The application shall allow the user to choose the exact product option/variant to track because options may have different prices.

Acceptance criteria:

- A tracked item contains the selected option label.
- The scraper reads the price/stock for that exact option.
- Changing an option creates a new tracking target or explicitly updates the tracked target; it must not silently mix histories.

### FR-03 Create Tracking Record

The user shall be able to add a selected product option to tracked items.

Acceptance criteria:

- Tracking target is persisted in Supabase.
- Duplicate tracking targets are prevented through an application-level check and database uniqueness constraint where practical.
- The tracking record retains the source URL and option information required by the scraper.

### FR-04 Scheduled Scraping

Each active tracked product option shall be scraped once every 2 hours.

Acceptance criteria:

- The system uses an external scheduler or scheduled function rather than depending on an always-running in-process timer.
- A scheduler-triggered run is safe to retry.
- A single target is not concurrently scraped twice by overlapping runs.
- One target failing does not prevent the remaining targets from being processed.

### FR-05 Scraper Reliability

The scraper shall use lightweight HTTP fetching and HTML parsing where sufficient, and Playwright only when JavaScript rendering is genuinely required.

Acceptance criteria:

- Explicit request timeouts are configured.
- Recoverable failures are retried with bounded exponential backoff.
- Non-recoverable failures terminate the target attempt cleanly.
- Dynamic content is given an explicit wait strategy rather than relying on arbitrary long sleeps.
- Extraction validates required fields before a successful history row is committed.
- A scraper parser mismatch results in failure, not guessed data.

### FR-06 Price and Stock History

The dashboard shall show historical price and stock observations for each tracked target.

Acceptance criteria:

- Only validated successful observations are shown as successful history points.
- History is ordered by observation time.
- Failed attempts remain visible through the scrape log.

### FR-07 Scrape Log

The dashboard shall expose every scrape attempt, including retries and final failures.

Required outcome values:

- `success`
- `retried`
- `failed`

Recommended implementation detail: store one log row per attempt, with `attempt_number`, `run_id`, and `outcome`. This preserves the assignment's required outcomes while still exposing retry detail.

### FR-08 CSV Export

An Export action shall download full scrape history as CSV.

Each row shall contain:

- store product ID as shown in the product-page URL
- product name
- selected option
- timestamp in ISO 8601 UTC
- price
- stock
- outcome

Failed rows shall have empty price and stock.

### FR-09 Headed Run

The backend shall expose a controlled way to start a scraper run in headed mode for demonstration/debugging.

Acceptance criteria:

- A developer can launch Playwright with a visible browser locally.
- The headed mode follows the same extraction logic as production as far as possible.
- A demo scenario can show a slow or failed response and the retry/failure handling.

## 7. Non-Functional Requirements

### NFR-01 Correctness

Never persist a successful price/stock observation unless required fields are present and pass validation.

### NFR-02 Reliability

A transient scrape error shall not terminate the complete batch.

### NFR-03 Observability

Each scrape attempt shall be traceable using a `run_id`, tracked target ID, attempt number, start/end timestamps, outcome, and error information when applicable.

### NFR-04 Performance

Dashboard reads should use stored data rather than scraping on every page request.

### NFR-05 Security

- Server-only secrets must never be exposed to the frontend.
- Scheduler-triggered endpoints must use a secret token.
- Input values must be validated before database access or scraping.
- Database access should use least-privilege credentials appropriate to the deployment model.

### NFR-06 Deployability

The application shall run on Vercel + Render + Supabase and work despite backend sleep/cold-start constraints.

### NFR-07 Maintainability

Scraper code should be separated from HTTP routes and persistence. The parser must be independently testable against saved fixtures.

## 8. Recommended MVP Scope

### Must Have

- Product search
- Product/option selection
- Tracking CRUD
- Initial scrape
- 2-hour scheduled scrape
- Retry/timeout handling
- Price/stock history
- Scrape logs including failures
- CSV export
- Headed run
- Vercel/Render/Supabase deployment

### Should Have

- Dashboard summary cards
- Last successful scrape time
- Last attempt status
- Consecutive failure count
- Scraper parser validation diagnostics
- Basic health endpoint

### Could Have

- Price-drop/back-in-stock alerts
- Structure-change detection
- Configurable frequency
- Multiple options per product in one scrape
- GitHub Actions CI/CD

## 9. Data Integrity Rules

1. A failed scrape must not create a successful history observation.
2. A failed scrape must not replace the latest known price with null inside the product's current-state record.
3. Failed attempts must exist in the scrape log.
4. A retry is an attempt, not a successful observation.
5. Only a validated successful extraction can update the latest state.
6. Source page/option identity is immutable for a tracking target unless an explicit update operation is performed.

## 10. Assumptions

These are design assumptions, not facts guaranteed by the assignment:

- The storefront exposes enough product information in a product listing/search page or predictable product pages to locate products.
- The exact CSS/XPath selectors may change; therefore the scraper should centralize selectors and include validation guards.
- A single backend deployment can handle the expected assignment-scale workload.
- Authentication for end users is unnecessary for the assignment unless the live environment requires it.

## 11. Traceability to Assignment Brief

| Assignment requirement | PRD coverage |
|---|---|
| Search by partial/full product name | FR-01 |
| Pick product + option | FR-02 |
| Persist tracked products in Supabase | FR-03 |
| 2-hour scraping | FR-04 |
| Reliable unattended scraping | FR-05, NFR-01, NFR-02 |
| Price + stock history | FR-06 |
| Per-product scrape log | FR-07 |
| CSV export | FR-08 |
| Headed recording | FR-09 |
| Vercel frontend | NFR-06 |
| Render backend | NFR-06 |
| Supabase PostgreSQL | NFR-06 |
| Free-tier scheduler strategy | FR-04, NFR-06 |
| Bonus capabilities | Section 8 |

## 12. Definition of Done

A feature is done only when implementation, error handling, database behavior, automated/manual validation, and documentation are complete. For scraper features, “done” additionally means that both success and failure paths have been tested.
