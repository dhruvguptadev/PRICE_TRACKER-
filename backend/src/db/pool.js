import pg from 'pg';
import { config } from '../config.js';

// numeric(12,2) comes back as a string ("12999.00"); keep it exact and convert at the edges.
let pool = null;

export function getPool() {
  if (!config.databaseUrl) throw new Error('DATABASE_URL is not configured');
  if (!pool) {
    const local = /@(localhost|127\.0\.0\.1)(:|\/)/.test(config.databaseUrl) || config.databaseUrl.includes('host=/');
    pool = new pg.Pool({
      connectionString: config.databaseUrl,
      // Supabase pooler requires TLS; its cert chain isn't in Node's default store.
      ssl: local ? false : { rejectUnauthorized: false },
      max: 5,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    });
    pool.on('error', (err) => console.error('[db] idle client error', err.message));
  }
  return pool;
}

export const query = (text, params) => getPool().query(text, params);

/** Runs fn(client) inside BEGIN/COMMIT; rolls back on any error so nothing is partially committed. */
export async function withTransaction(fn) {
  const client = await getPool().connect();
  try {
    await client.query('begin');
    const result = await fn(client);
    await client.query('commit');
    return result;
  } catch (error) {
    await client.query('rollback').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

export async function closePool() {
  if (pool) await pool.end();
  pool = null;
}

export const toNumber = (v) => (v === null || v === undefined ? null : Number(v));
export const toIso = (v) => (v ? new Date(v).toISOString() : null);
