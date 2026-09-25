'use client';

import { useEffect, useState } from 'react';
import HealthBanner from '@/components/HealthBanner';
import ProductSearch from '@/components/ProductSearch';
import TrackedTable from '@/components/TrackedTable';
import { api, exportCsvUrl } from '@/lib/api';

// Refresh faster while any target is waiting for its first scrape.
const FAST_POLL_MS = 10_000;
const SLOW_POLL_MS = 60_000;

export default function Dashboard() {
  const [tracked, setTracked] = useState({ status: 'loading', items: [] });
  const [busyId, setBusyId] = useState(null);

  const [refresh, setRefresh] = useState(0);
  const load = () => setRefresh((n) => n + 1);

  const pending = tracked.items.some((t) => !t.lastAttemptAt);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.listTracked();
        if (!cancelled) setTracked({ status: 'done', items: data.items });
      } catch (error) {
        if (!cancelled) setTracked((t) => ({ ...t, status: 'error', message: error.message }));
      }
    })();
    return () => { cancelled = true; };
  }, [refresh]);

  // Poll faster while any target is still waiting for its first scrape.
  useEffect(() => {
    const timer = setInterval(load, pending ? FAST_POLL_MS : SLOW_POLL_MS);
    return () => clearInterval(timer);
  }, [pending]);

  async function untrack(t) {
    if (!window.confirm(`Stop tracking ${t.productName} (${t.selectedOption})? Its history is kept and stays in the CSV export.`)) return;
    setBusyId(t.id);
    try {
      await api.untrack(t.id);
      load();
    } catch (error) {
      window.alert(error.message);
    } finally {
      setBusyId(null);
    }
  }

  const items = tracked.items;
  const inStock = items.filter((t) => t.stockQty > 0).length;
  const failing = items.filter((t) => t.consecutiveFailures >= 3).length;

  return (
    <div className="space-y-6">
      <HealthBanner />

      <ProductSearch onTracked={load} />

      <section aria-labelledby="tracked-heading" className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="tracked-heading" className="text-lg font-semibold">Tracked products</h2>
            {tracked.status === 'done' && items.length > 0 && (
              <p className="text-sm text-ink-2">
                {items.length} tracked · {inStock} in stock
                {failing > 0 && <span className="text-critical-ink"> · {failing} failing repeatedly</span>}
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={load} className="rounded-lg px-3 py-2 text-sm ring-1 ring-line hover:bg-surface-2">
              Refresh
            </button>
            <a href={exportCsvUrl} className="rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-accent-ink" download>
              Export CSV
            </a>
          </div>
        </div>

        {tracked.status === 'loading' && <p className="rounded-xl bg-surface p-6 text-sm text-muted ring-1 ring-line">Loading tracked products…</p>}
        {tracked.status === 'error' && (
          <p role="alert" className="rounded-xl bg-critical/10 p-4 text-sm text-critical-ink ring-1 ring-critical/30">
            Could not load tracked products: {tracked.message}
          </p>
        )}
        {tracked.status !== 'loading' && tracked.status !== 'error' && <TrackedTable items={items} onUntrack={untrack} busyId={busyId} />}
        {pending && <p className="text-xs text-muted">A first price check is running; this list refreshes automatically.</p>}
      </section>
    </div>
  );
}
