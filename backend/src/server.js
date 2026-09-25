import { config } from './config.js';
import { createApp } from './app.js';
import { closePool } from './db/pool.js';
import { ensureCatalog } from './services/catalogService.js';

const app = createApp();
const server = app.listen(config.port, () => {
  console.log(`[server] price-tracker-api listening on :${config.port} (${config.nodeEnv})`);
  if (!config.databaseUrl) {
    console.warn('[server] DATABASE_URL is not set; database-backed endpoints will fail.');
    return;
  }
  if (!config.scrapeTriggerSecret) console.warn('[server] SCRAPE_TRIGGER_SECRET is not set; protected endpoints are disabled.');
  ensureCatalog().catch((e) => console.error('[catalog] startup check failed:', e.message));
});

function shutdown(signal) {
  console.log(`[server] ${signal} received, shutting down`);
  server.close(() => closePool().finally(() => process.exit(0)));
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('unhandledRejection', (reason) => console.error('[server] unhandled rejection', reason));
