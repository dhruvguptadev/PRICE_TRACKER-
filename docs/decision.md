# Engineering Decision Log / Design Note

## Decision 001 — React + Vite for frontend

**Decision:** Use React.js with Vite.

**Why:** The assignment allows React.js or Vue.js. React + Vite keeps the frontend straightforward and matches the team's likely JavaScript ecosystem without adding a large framework requirement.

**Trade-off:** Another contributor could prefer Vue; no major technical requirement depends on framework choice.

## Decision 002 — Node.js + Express for backend

**Decision:** Use Node.js + Express with ES Modules.

**Why:** The assignment permits Node.js/Express or Django. A JavaScript backend aligns with a JavaScript frontend and allows scraper code, Playwright, API routes, and shared validation patterns to live in one language.

**Trade-off:** Django has stronger batteries-included conventions, but the assignment's small scope does not require them.

## Decision 003 — Modular monolith instead of microservices

**Decision:** Keep API, scrape orchestration, scraper adapters, and persistence in one deployable backend, with clear internal modules.

**Why:** The workload is small and the assignment is time-boxed. A microservice split would add network calls, deployment complexity, failure modes, and operational overhead without a demonstrated need.

**Trade-off:** All backend concerns share one deployment. This is acceptable for the assignment scale.

## Decision 004 — HTTP + HTML parsing before Playwright

**Decision:** Attempt lightweight HTTP fetching and HTML parsing first; use Playwright only for content that genuinely requires browser rendering.

**Why:** This directly follows the assignment's preferred approach and reduces browser startup/runtime cost. Playwright remains available as a controlled fallback for JavaScript-rendered pages.

**Trade-off:** Maintaining two extraction paths increases code complexity, but it improves reliability and makes the lightweight path fast when it works.

## Decision 005 — External scheduler

**Decision:** Use cron-job.org (or equivalent external scheduler) to trigger the backend every 2 hours.

**Why:** The assignment explicitly calls for external scheduling because free-tier backends may sleep.

**Trade-off:** The scheduler becomes an external dependency. Protect the trigger endpoint with a shared secret and make the run idempotent.

## Decision 006 — Keep current state separate from history

**Decision:** Store the latest successful price/stock on `tracked_products` and all valid historical observations in `price_observations`.

**Why:** Dashboard reads become simple and fast, while historical data stays append-oriented.

**Trade-off:** There is duplicated state, so success updates should occur in a transaction.

## Decision 007 — Failed scrape never overwrites last known successful value

**Decision:** A failure updates attempt metadata but does not overwrite the latest successful price/stock.

**Why:** The assignment explicitly says failed attempts must be included with price/stock empty. Keeping last known successful state separate prevents a temporary outage from looking like a product price of “null”.

## Decision 008 — One row per scrape attempt

**Decision:** Record every actual attempt, including retry attempts.

**Why:** This produces an honest audit trail and allows reviewers to see retry behavior.

**Trade-off:** The log grows faster than a one-row-per-run design, but the assignment explicitly values honest logging.

## Decision 009 — Retry only transient/recoverable failures

**Decision:** Retry timeouts, network failures, rate limiting, and temporary 5xx responses; do not blindly retry parser mismatches or “product not found”.

**Why:** Retrying a broken selector three times does not fix the underlying problem and can hide scraper regressions.

## Decision 010 — Validate before persistence

**Decision:** The scraper returns a typed/structured result only after product identity, option, price, and stock checks pass.

**Why:** The evaluator prioritizes correctness and explicitly rejects incorrect/empty success data.

## Decision 011 — Fixtures for parser tests

**Decision:** Save representative storefront HTML/DOM fixtures for parser tests.

**Why:** It makes parser behavior deterministic and allows regression testing without depending on the live store for every unit test.

## Decision 012 — No arbitrary long sleeps

**Decision:** Prefer explicit browser waits or HTTP readiness conditions.

**Why:** Fixed sleeps increase run time and remain unreliable when the target's latency varies.

## Decision 013 — Soft deactivate tracked products

**Decision:** Deleting a tracked product means `active=false` rather than physically deleting its history.

**Why:** History and logs remain available for the dashboard and export.

## Decision 014 — Scheduler endpoint is internal/admin-like

**Decision:** No public UI secret is used. The scheduled scrape endpoint requires a server-side secret.

**Why:** Anyone who can trigger the route could increase load on the storefront or create duplicate runs.

## Open Decisions After Target-Site Inspection

The following must be confirmed by inspecting the provided mock store and should not be invented before verification:

1. Exact product listing/search URL.
2. Exact product page URL shape.
3. How product IDs are encoded in URLs.
4. Exact option/variant selectors.
5. Exact price element/JSON source.
6. Exact stock representation.
7. Whether price or stock is loaded after initial HTML.
8. Whether an API/XHR request is responsible for dynamic data.
9. Which failures are reproducibly simulated by the storefront.
