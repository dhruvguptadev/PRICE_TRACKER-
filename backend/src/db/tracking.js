import { query, toNumber, toIso } from './pool.js';

const TRACKED_COLUMNS = `
  id, store_product_id, product_name, product_url, option_axis, selected_option, selected_option_key,
  active, current_price, current_mrp, currency, current_stock_qty, last_success_at, last_attempt_at,
  last_outcome, consecutive_failures, created_at, updated_at`;

export function mapTracked(r) {
  return {
    id: r.id,
    storeProductId: r.store_product_id,
    productName: r.product_name,
    productUrl: r.product_url,
    optionAxis: r.option_axis,
    selectedOption: r.selected_option,
    selectedOptionKey: r.selected_option_key,
    active: r.active,
    currentPrice: toNumber(r.current_price),
    currentMrp: toNumber(r.current_mrp),
    currency: r.currency,
    stockQty: r.current_stock_qty,
    stockStatus: r.current_stock_qty === null ? null : r.current_stock_qty > 0 ? 'in_stock' : 'out_of_stock',
    lastSuccessAt: toIso(r.last_success_at),
    lastAttemptAt: toIso(r.last_attempt_at),
    lastOutcome: r.last_outcome,
    consecutiveFailures: r.consecutive_failures,
    createdAt: toIso(r.created_at),
    updatedAt: toIso(r.updated_at),
  };
}

export async function findByTarget(storeProductId, optionKey) {
  // Prefer the active row; otherwise the most recently updated inactive one (to reactivate).
  const { rows } = await query(
    `select ${TRACKED_COLUMNS} from tracked_products
      where store_product_id = $1 and selected_option_key = $2
      order by active desc, updated_at desc limit 1`,
    [storeProductId, optionKey],
  );
  return rows[0] ?? null;
}

export async function insertTracked(t) {
  const { rows } = await query(
    `insert into tracked_products
       (store_product_id, product_name, product_url, option_axis, selected_option, selected_option_key)
     values ($1, $2, $3, $4, $5, $6)
     returning ${TRACKED_COLUMNS}`,
    [t.storeProductId, t.productName, t.productUrl, t.optionAxis, t.selectedOption, t.selectedOptionKey],
  );
  return rows[0];
}

/** Reactivate a soft-deleted target, refreshing its name/label snapshot from the store. */
export async function reactivateTracked(id, t) {
  const { rows } = await query(
    `update tracked_products
        set active = true, product_name = $2, product_url = $3, option_axis = $4,
            selected_option = $5, updated_at = now()
      where id = $1
      returning ${TRACKED_COLUMNS}`,
    [id, t.productName, t.productUrl, t.optionAxis, t.selectedOption],
  );
  return rows[0];
}

export async function listTracked({ active, limit, offset }) {
  const where = active === undefined ? '' : 'where active = $3';
  const params = active === undefined ? [limit, offset] : [limit, offset, active];
  const [{ rows }, { rows: countRows }] = await Promise.all([
    query(`select ${TRACKED_COLUMNS} from tracked_products ${where} order by created_at asc limit $1 offset $2`, params),
    query(`select count(*)::int as total from tracked_products ${active === undefined ? '' : 'where active = $1'}`,
      active === undefined ? [] : [active]),
  ]);
  return { rows, total: countRows[0].total };
}

export async function listActiveTargets() {
  const { rows } = await query(`select ${TRACKED_COLUMNS} from tracked_products where active order by created_at asc`);
  return rows;
}

export async function getTracked(id) {
  const { rows } = await query(`select ${TRACKED_COLUMNS} from tracked_products where id = $1`, [id]);
  return rows[0] ?? null;
}

export async function getAttemptSummary(id) {
  const { rows } = await query(
    `select count(*)::int as attempts,
            count(*) filter (where outcome = 'success')::int as successes,
            count(*) filter (where outcome = 'retried')::int as retries,
            count(*) filter (where outcome = 'failed')::int as failures
       from scrape_attempts where tracked_product_id = $1`,
    [id],
  );
  return rows[0];
}

export async function deactivateTracked(id) {
  const { rows } = await query(
    `update tracked_products set active = false, updated_at = now() where id = $1 returning id, active`,
    [id],
  );
  return rows[0] ?? null;
}

export async function getHistory(id, { from, to, limit }) {
  const { rows } = await query(
    `select captured_at, price, mrp, currency, stock_qty
       from price_observations
      where tracked_product_id = $1
        and ($2::timestamptz is null or captured_at >= $2)
        and ($3::timestamptz is null or captured_at <= $3)
      order by captured_at asc
      limit $4`,
    [id, from ?? null, to ?? null, limit],
  );
  return rows.map((r) => ({
    capturedAt: toIso(r.captured_at),
    price: toNumber(r.price),
    mrp: toNumber(r.mrp),
    currency: r.currency,
    stockQty: r.stock_qty,
  }));
}

export async function getScrapeLogs(id, { limit, offset }) {
  const { rows } = await query(
    `select sa.*, sr.run_key, sr.trigger_source
       from scrape_attempts sa join scrape_runs sr on sr.id = sa.run_id
      where sa.tracked_product_id = $1
      order by sa.started_at desc, sa.attempt_number desc
      limit $2 offset $3`,
    [id, limit, offset],
  );
  return rows.map((r) => ({
    id: r.id,
    runId: r.run_id,
    runKey: r.run_key,
    triggerSource: r.trigger_source,
    attemptNumber: r.attempt_number,
    startedAt: toIso(r.started_at),
    finishedAt: toIso(r.finished_at),
    durationMs: r.duration_ms,
    outcome: r.outcome,
    method: r.method,
    httpStatus: r.http_status,
    price: toNumber(r.extracted_price),
    stockQty: r.extracted_stock_qty,
    errorCode: r.error_code,
    errorMessage: r.error_message,
    manifestRevision: r.manifest_revision,
    rawPriceText: r.raw_price_text,
    rawStockText: r.raw_stock_text,
  }));
}
