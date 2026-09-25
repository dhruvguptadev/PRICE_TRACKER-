import { query, withTransaction, getPool, toIso } from './pool.js';

/**
 * Insert a run; for a duplicate run_key (same cron slot) nothing is inserted and the
 * existing run is returned with duplicate = true.
 */
export async function claimRun({ runKey, triggerSource, targetCount = 0 }) {
  const inserted = await query(
    `insert into scrape_runs (run_key, trigger_source, target_count)
     values ($1, $2, $3)
     on conflict (run_key) do nothing
     returning *`,
    [runKey, triggerSource, targetCount],
  );
  if (inserted.rows[0]) return { run: inserted.rows[0], duplicate: false };
  const existing = await query('select * from scrape_runs where run_key = $1', [runKey]);
  return { run: existing.rows[0], duplicate: true };
}

export async function findRunByKey(runKey) {
  const { rows } = await query('select * from scrape_runs where run_key = $1', [runKey]);
  return rows[0] ?? null;
}

export async function setRunTargetCount(runId, targetCount) {
  await query('update scrape_runs set target_count = $2 where id = $1', [runId, targetCount]);
}

/** Close runs left `running` by a crash/restart (docs/architecture.md §8.1). */
export async function closeStuckRuns(olderThanMs, exceptRunId) {
  const { rows } = await query(
    `update scrape_runs set status = 'failed', finished_at = now()
      where status = 'running'
        and started_at < now() - ($1::int * interval '1 millisecond')
        and id <> $2
      returning run_key`,
    [olderThanMs, exceptRunId],
  );
  return rows.map((r) => r.run_key);
}

export async function finishRun(runId, { successCount, failureCount, status }) {
  await query(
    `update scrape_runs
        set status = $2, success_count = $3, failure_count = $4, finished_at = now()
      where id = $1`,
    [runId, status, successCount, failureCount],
  );
}

export async function failRun(runId) {
  await query(`update scrape_runs set status = 'failed', finished_at = now() where id = $1 and status = 'running'`, [runId]);
}

/** Success: attempt + observation + current state in one transaction (docs/database.md §10). */
export async function recordSuccess({ runId, trackedProductId, attemptNumber, startedAt, finishedAt, result }) {
  return withTransaction(async (client) => {
    const { rows } = await client.query(
      `insert into scrape_attempts
         (run_id, tracked_product_id, attempt_number, started_at, finished_at, duration_ms, outcome, method,
          manifest_revision, raw_price_text, raw_stock_text, extracted_price, extracted_stock_qty)
       values ($1, $2, $3, $4, $5, $6, 'success', 'browser', $7, $8, $9, $10, $11)
       returning id`,
      [runId, trackedProductId, attemptNumber, startedAt, finishedAt, finishedAt - startedAt,
        result.manifestRevision, result.rawPriceText, result.rawStockText, result.price, result.stockQty],
    );
    await client.query(
      `insert into price_observations (tracked_product_id, scrape_attempt_id, price, mrp, currency, stock_qty, captured_at)
       values ($1, $2, $3, $4, $5, $6, $7)`,
      [trackedProductId, rows[0].id, result.price, result.mrp, result.currency, result.stockQty, finishedAt],
    );
    await client.query(
      `update tracked_products
          set current_price = $2, current_mrp = $3, currency = $4, current_stock_qty = $5,
              last_success_at = $6, last_attempt_at = $6, last_outcome = 'success',
              consecutive_failures = 0, updated_at = now()
        where id = $1`,
      [trackedProductId, result.price, result.mrp, result.currency, result.stockQty, finishedAt],
    );
    return rows[0].id;
  });
}

/**
 * Retried / failed attempt: attempt row only; current price/stock are never touched.
 * A final failure also bumps consecutive_failures.
 */
export async function recordFailure({ runId, trackedProductId, attemptNumber, startedAt, finishedAt, outcome, method, error }) {
  return withTransaction(async (client) => {
    const { rows } = await client.query(
      `insert into scrape_attempts
         (run_id, tracked_product_id, attempt_number, started_at, finished_at, duration_ms, outcome, method,
          http_status, error_code, error_message, manifest_revision, raw_price_text, raw_stock_text)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       returning id`,
      [runId, trackedProductId, attemptNumber, startedAt, finishedAt, finishedAt - startedAt, outcome, method,
        error.httpStatus ?? null, error.code, String(error.message).slice(0, 1000), error.manifestRevision ?? null,
        error.rawPriceText ?? null, error.rawStockText ?? null],
    );
    await client.query(
      `update tracked_products
          set last_attempt_at = $2, last_outcome = $3,
              consecutive_failures = consecutive_failures + $4, updated_at = now()
        where id = $1`,
      [trackedProductId, finishedAt, outcome, outcome === 'failed' ? 1 : 0],
    );
    return rows[0].id;
  });
}

export async function getRunSummary(runId) {
  const { rows } = await query(
    `select r.*, (select count(*)::int from scrape_attempts a where a.run_id = r.id) as attempts
       from scrape_runs r where r.id = $1`,
    [runId],
  );
  const r = rows[0];
  if (!r) return null;
  return {
    runId: r.id,
    runKey: r.run_key,
    triggerSource: r.trigger_source,
    status: r.status,
    startedAt: toIso(r.started_at),
    finishedAt: toIso(r.finished_at),
    targets: r.target_count,
    successes: r.success_count,
    failures: r.failure_count,
    attempts: r.attempts,
  };
}

export async function getLastCronRun() {
  const { rows } = await query(
    `select started_at, status from scrape_runs where trigger_source = 'cron' order by started_at desc limit 1`,
  );
  return rows[0] ?? null;
}

/** Cross-instance guard: a session-level advisory lock held on a dedicated client for the whole batch. */
const BATCH_LOCK_KEY = 72_531_001;

export async function tryAcquireBatchLock() {
  const client = await getPool().connect();
  try {
    const { rows } = await client.query('select pg_try_advisory_lock($1) as locked', [BATCH_LOCK_KEY]);
    if (rows[0].locked) {
      return async () => {
        try { await client.query('select pg_advisory_unlock($1)', [BATCH_LOCK_KEY]); } finally { client.release(); }
      };
    }
    client.release();
    return null;
  } catch (error) {
    client.release();
    throw error;
  }
}

export async function* exportAttempts(batchSize = 2000) {
  for (let offset = 0; ; offset += batchSize) {
    const { rows } = await query(
      `select tp.store_product_id as product_id, tp.product_name, tp.selected_option,
              sa.started_at as timestamp, sa.extracted_price as price, sa.extracted_stock_qty as stock, sa.outcome
         from scrape_attempts sa
         join tracked_products tp on tp.id = sa.tracked_product_id
        order by sa.started_at asc, sa.attempt_number asc, sa.id asc
        limit $1 offset $2`,
      [batchSize, offset],
    );
    if (rows.length) yield rows;
    if (rows.length < batchSize) return;
  }
}
