# API Documentation

## 1. API Overview

Base URL:

```text
https://<render-service>.onrender.com/api
```

Local:

```text
http://localhost:3000/api
```

The API is REST-style JSON over HTTPS in production.

## 2. Authentication Model

Public dashboard read endpoints may be unauthenticated for the assignment.

Protected endpoints:

- Scheduler trigger
- Manual scrape trigger, if exposed
- Any admin/maintenance endpoint

Scheduler authentication:

```http
Authorization: Bearer <SCRAPE_TRIGGER_SECRET>
```

The secret must exist only on the scheduler/backend side.

## 3. Standard Response Shape

Success:

```json
{
  "data": {},
  "meta": {}
}
```

Error:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request.",
    "details": {},
    "requestId": "req_123"
  }
}
```

## 4. Endpoints

### GET `/api/health`

Purpose: deployment health check.

Response:

```json
{
  "data": {
    "status": "ok",
    "service": "price-tracker-api",
    "timestamp": "2026-09-25T12:00:00.000Z"
  }
}
```

### GET `/api/products/search`

Search the assigned mock storefront by partial/full product name.

Query parameters:

| Parameter | Type | Required | Description |
|---|---|---|---|
| `q` | string | yes | Search phrase |
| `limit` | integer | no | Default 10, max 25 |

Example:

```http
GET /api/products/search?q=keyboard&limit=10
```

Response:

```json
{
  "data": {
    "items": [
      {
        "storeProductId": "123",
        "name": "Example Keyboard",
        "url": "https://demo.inelabteamdev.com/products/123",
        "options": [
          {
            "label": "White / 128GB",
            "value": "white-128gb"
          }
        ]
      }
    ]
  }
}
```

Important: field names above are the proposed API contract. The exact source-store option structure must be adapted to the real target-page HTML after inspection.

### GET `/api/products/:storeProductId`

Return a product/option view used before tracking.

Response:

```json
{
  "data": {
    "storeProductId": "123",
    "name": "Example Keyboard",
    "url": "https://demo.inelabteamdev.com/products/123",
    "options": []
  }
}
```

### POST `/api/tracked-products`

Create a tracked product option.

Request:

```json
{
  "storeProductId": "123",
  "productName": "Example Keyboard",
  "productUrl": "https://demo.inelabteamdev.com/products/123",
  "selectedOption": "White / 128GB",
  "selectedOptionKey": "white-128gb"
}
```

Response `201`:

```json
{
  "data": {
    "id": "tp_123",
    "storeProductId": "123",
    "selectedOption": "White / 128GB",
    "active": true,
    "createdAt": "2026-09-25T12:00:00.000Z"
  }
}
```

Validation rules:

- product URL must belong to the configured target host
- product ID must be non-empty
- product name must be non-empty
- selected option must be non-empty

### GET `/api/tracked-products`

List tracked products.

Query parameters:

- `active=true|false`
- `limit`
- `offset`

Response:

```json
{
  "data": {
    "items": [
      {
        "id": "tp_123",
        "storeProductId": "123",
        "productName": "Example Keyboard",
        "selectedOption": "White / 128GB",
        "currentPrice": 1299.00,
        "stockStatus": "in_stock",
        "lastSuccessfulScrapeAt": "2026-09-25T10:00:00.000Z",
        "lastAttemptOutcome": "success"
      }
    ]
  },
  "meta": {
    "limit": 25,
    "offset": 0,
    "total": 3
  }
}
```

### GET `/api/tracked-products/:id`

Return a tracked product plus latest state and summary.

### DELETE `/api/tracked-products/:id`

Deactivate a tracking target.

Recommended behavior: soft delete using `active=false` so historical data remains available.

Response:

```json
{
  "data": {
    "id": "tp_123",
    "active": false
  }
}
```

### GET `/api/tracked-products/:id/history`

Return successful price/stock observations.

Query parameters:

| Parameter | Type | Required |
|---|---|---|
| `from` | ISO timestamp | no |
| `to` | ISO timestamp | no |
| `limit` | integer | no |

Response:

```json
{
  "data": {
    "items": [
      {
        "capturedAt": "2026-09-25T10:00:00.000Z",
        "price": 1299.00,
        "stockStatus": "in_stock"
      }
    ]
  }
}
```

### GET `/api/tracked-products/:id/scrape-logs`

Return every scrape attempt, including failures.

Response:

```json
{
  "data": {
    "items": [
      {
        "runId": "run_20260925_1000",
        "attemptNumber": 1,
        "startedAt": "2026-09-25T10:00:00.000Z",
        "finishedAt": "2026-09-25T10:00:03.000Z",
        "outcome": "retried",
        "httpStatus": 503,
        "errorCode": "UPSTREAM_5XX",
        "errorMessage": "Store returned HTTP 503"
      },
      {
        "runId": "run_20260925_1000",
        "attemptNumber": 2,
        "startedAt": "2026-09-25T10:00:05.000Z",
        "finishedAt": "2026-09-25T10:00:08.000Z",
        "outcome": "success",
        "httpStatus": 200,
        "errorCode": null,
        "errorMessage": null
      }
    ]
  }
}
```

### POST `/api/scrape/run`

Protected scheduler endpoint.

Request:

```http
POST /api/scrape/run
Authorization: Bearer <SCRAPE_TRIGGER_SECRET>
Content-Type: application/json
```

Optional body for controlled debugging:

```json
{
  "trackedProductId": "tp_123"
}
```

Without a body, scrape all active tracked products.

Response `202` is recommended if the run is started asynchronously. If the assignment implementation is synchronous, return `200` with the completed summary.

Suggested response:

```json
{
  "data": {
    "runId": "run_20260925_1000",
    "status": "completed",
    "targets": 3,
    "successes": 2,
    "failures": 1,
    "attempts": 5
  }
}
```

### POST `/api/scrape/:trackedProductId`

Protected manual scrape for one tracking target.

Body:

```json
{
  "headed": false
}
```

`headed=true` should only be supported in a local/dev execution path unless the Render environment explicitly supports visible browser display.

### GET `/api/export.csv`

Download all scrape attempt history as CSV.

Response headers:

```http
Content-Type: text/csv; charset=utf-8
Content-Disposition: attachment; filename="scrape-history.csv"
```

Required CSV columns:

```text
product_id,product_name,selected_option,timestamp,price,stock,outcome
```

For failed attempts, `price` and `stock` are blank.

## 5. HTTP Status Codes

| Status | Use |
|---|---|
| 200 | Successful read/update or synchronous action |
| 201 | Resource created |
| 202 | Async scrape/run accepted |
| 400 | Invalid input |
| 401 | Missing/invalid scheduler secret |
| 404 | Resource not found |
| 409 | Duplicate/conflicting operation |
| 429 | Rate-limited request |
| 500 | Unexpected server error |
| 502 | Upstream storefront failure represented to caller |
| 503 | Temporary service unavailable |

## 6. Scraper Outcome Semantics

The database may store lower-level error metadata, but the assignment-facing `outcome` values are:

- `success`: validated extraction and history observation persisted
- `retried`: this attempt failed but another attempt will be made
- `failed`: final attempt failed; no successful price/stock observation persisted

A retry sequence can therefore appear as:

```text
attempt 1 → retried
attempt 2 → retried
attempt 3 → failed
```

or:

```text
attempt 1 → retried
attempt 2 → success
```

## 7. API Security Rules

- Reject scheduler calls without the configured secret.
- Never expose `SUPABASE_SERVICE_ROLE_KEY` or database passwords to the frontend.
- Validate any target URL against the allowed mock-store hostname.
- Do not accept arbitrary URLs for scraping.
- Limit search query length.
- Limit export size or stream CSV generation if the dataset grows.

## 8. Suggested Express Route Layout

```text
src/routes/
├── health.routes.js
├── products.routes.js
├── tracking.routes.js
├── scrape.routes.js
└── export.routes.js
```

Express routes map HTTP methods and URIs to route handlers; keep business logic outside the route file. [Express routing](https://expressjs.com/en/guide/routing.html)
