# Research Notes

## 1. Source Hierarchy

This document separates three categories:

1. **Assignment facts** — directly required by the supplied PDF.
2. **External technical guidance** — official documentation or researched implementation guidance.
3. **Project decisions** — choices made for this implementation and therefore subject to change after target-site inspection.

## 2. Assignment Facts

The brief requires:

- React or Vue frontend on Vercel.
- Node.js/Express or Django backend on Render.
- Supabase PostgreSQL.
- Scraping via lightweight HTTP + HTML parsing where possible, with Playwright/Puppeteer only where genuinely needed.
- Scraping every 2 hours.
- Retries and handling for slow/error responses.
- Price and stock history.
- Per-product scrape logs.
- CSV export with a specified set of columns.
- A headed scraper run for a short screen recording.
- At least 2–3 tracked products/options in the submitted dashboard.
- Public GitHub repository, live site, README, design note, and resume PDF.

These facts are taken directly from the assignment brief.

## 3. External Research Findings

### Express

Express uses middleware and routing as the main request/response composition model. Error-handling middleware is defined separately and should be placed after routes. Async route errors can be propagated by Promise-returning handlers in current Express guidance.

Sources:

- https://expressjs.com/en/guide/using-middleware.html
- https://expressjs.com/en/guide/error-handling.html
- https://expressjs.com/en/guide/routing.html

### Playwright

Playwright recommends locators as the central abstraction for element interactions, with built-in auto-waiting/retry behavior. This supports a more deterministic browser scraper than relying only on large fixed delays.

Source:

- https://playwright.dev/docs/locators

### Render

Render currently exposes multiple service types, including web services and cron jobs. Render's cron jobs run a command on a defined schedule and provide run history/logs. This means Render Cron Job is technically an alternative scheduling design, although the assignment explicitly allows external cron scheduling and was written with sleeping free-tier backends in mind.

Sources:

- https://render.com/docs/service-types
- https://render.com/docs/cronjobs

### Supabase

Supabase provides PostgreSQL and database-level Row Level Security capabilities. Supabase's RLS documentation recommends enabling RLS for exposed-schema tables and defining policies for access control.

Source:

- https://supabase.com/docs/guides/database/postgres/row-level-security

### API Documentation

OpenAPI is a language-agnostic interface description format for HTTP APIs. Using a clear endpoint/response contract makes the backend easier to review and test.

Source:

- https://swagger.io/specification/

### Observability

For this assignment, the most useful observability layer is structured application logs plus scrape-attempt rows in PostgreSQL. Full distributed tracing is unnecessary for the assignment's scale.

## 4. Target-Store Research Constraint

The assignment states that the mock storefront is intentionally awkward to scrape and that prices may change, some content may load asynchronously, and responses may occasionally be slow or fail.

However, these are assignment-provided expectations. They should not be converted into more specific claims about selectors, request endpoints, HTML structure, or exact failure patterns until the store is personally inspected.

Therefore:

- selectors are intentionally not hard-coded in these docs
- product URL formats are intentionally not invented
- exact API/XHR endpoints are intentionally not invented
- exact option identifiers are intentionally not invented

Those values belong in the implementation after live inspection.

## 5. Why the Recommended Architecture Fits

### Modularity without microservices

The scraper is the core challenge, but splitting it into a separate network service would make the assignment harder to operate. Internal modules provide most of the organizational benefit without adding another deployment.

### HTTP first, browser second

HTTP parsing is lighter than a browser. Browser automation is retained for genuinely client-rendered content. This directly follows the assignment's preference and keeps scheduled runs efficient.

### Explicit validation

The dangerous failure mode is not “the request failed”; it is “the request succeeded but the parser extracted the wrong value.” Therefore, validation has to be part of the success condition.

### Append-only attempt history

A scrape log is an audit trail. Treating every attempt as a row lets the reviewer distinguish a transient failure, a retried attempt, and a final failure.

## 6. Research Questions to Resolve During Implementation

1. Does product search happen on the server via a predictable listing/search page or by direct page traversal?
2. Does the selected option alter the DOM or generate a network request?
3. Is price present in initial HTML, embedded JSON, or loaded asynchronously?
4. Is stock textual, attribute-based, or encoded in JavaScript state?
5. Can the option be selected without a browser?
6. What exact failure behavior can be reproduced for the video?
7. What selectors remain stable across multiple products?
8. Can parser fixtures capture enough variants to prevent regressions?

## 7. Recommended Validation Evidence

Before submission, retain evidence of:

- successful HTTP scrape
- successful browser scrape, if required
- retry after timeout/error
- final failure path
- failure preserved in DB
- successful historical observation
- CSV export including a failure row
- scheduled run executed by external scheduler
- 2–3 tracked products visible on the live dashboard

## 8. Sources

Official/current technical sources used for this research:

- Express middleware: https://expressjs.com/en/guide/using-middleware.html
- Express error handling: https://expressjs.com/en/guide/error-handling.html
- Express routing: https://expressjs.com/en/guide/routing.html
- Playwright locators: https://playwright.dev/docs/locators
- Render service types: https://render.com/docs/service-types
- Render Cron Jobs: https://render.com/docs/cronjobs
- Supabase RLS: https://supabase.com/docs/guides/database/postgres/row-level-security
- OpenAPI Specification: https://swagger.io/specification/
- Vercel docs: https://vercel.com/docs
- React docs: https://react.dev/
- Vite guide: https://vite.dev/guide/
