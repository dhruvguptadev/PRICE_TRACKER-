'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

const MIN_QUERY = 2;

/** Search the synced catalog, pick a product and one exact option, then track it. */
export default function ProductSearch({ onTracked }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState({ q: '', status: 'idle', items: [] }); // results for query `q`
  const [selected, setSelected] = useState(null); // store product summary
  const [detail, setDetail] = useState({ status: 'idle' });
  const [optionKey, setOptionKey] = useState(null);
  const [trackState, setTrackState] = useState({ status: 'idle' });

  const q = query.trim();

  // Debounced search; empty or 1-char queries don't hit the API.
  useEffect(() => {
    if (q.length < MIN_QUERY) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const { data, meta } = await api.search(q, { signal: controller.signal });
        setResults({ q, status: 'done', items: data.items, catalogComplete: meta?.catalogComplete });
      } catch (error) {
        if (error.name !== 'AbortError') setResults({ q, status: 'error', items: [], message: error.message });
      }
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [q]);

  // Results only count for the query currently typed; anything else is idle or in flight.
  const shown = q.length < MIN_QUERY ? { status: 'idle', items: [] } : results.q === q ? results : { status: 'loading', items: [] };

  async function pick(product) {
    setSelected(product);
    setOptionKey(null);
    setTrackState({ status: 'idle' });
    setDetail({ status: 'loading' });
    try {
      const { data } = await api.product(product.storeProductId);
      setDetail({ status: 'done', product: data });
      if (data.options.length === 1) setOptionKey(data.options[0].key);
    } catch (error) {
      setDetail({ status: 'error', message: error.message });
    }
  }

  async function track() {
    if (!selected || !optionKey) return;
    setTrackState({ status: 'saving' });
    try {
      const { data } = await api.track(selected.storeProductId, optionKey);
      setTrackState({ status: 'done', message: `Now tracking ${data.productName} (${data.selectedOption}). The first price check is running in the background.` });
      onTracked?.(data);
    } catch (error) {
      setTrackState({ status: 'error', message: error.message });
    }
  }

  const product = detail.product;

  return (
    <section className="rounded-xl bg-surface p-5 ring-1 ring-line" aria-labelledby="search-heading">
      <h2 id="search-heading" className="text-lg font-semibold">Track a product</h2>
      <p className="mt-1 text-sm text-ink-2">Search by full or partial product name or brand, then choose the exact option to track.</p>

      <label htmlFor="product-search" className="sr-only">Search products</label>
      <input
        id="product-search"
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        maxLength={100}
        placeholder="e.g. filing cabinet, trekking poles, Halvard…"
        className="mt-4 w-full rounded-lg bg-page px-4 py-2.5 text-base ring-1 ring-line outline-none placeholder:text-muted focus:ring-2 focus:ring-accent"
        autoComplete="off"
      />

      <div className="mt-3 min-h-6 text-sm" aria-live="polite">
        {q.length > 0 && q.length < MIN_QUERY && <p className="text-muted">Keep typing…</p>}
        {shown.status === 'loading' && <p className="text-muted">Searching…</p>}
        {shown.status === 'error' && <p className="text-critical-ink">{shown.message}</p>}
        {shown.status === 'done' && shown.items.length === 0 && <p className="text-ink-2">No products match “{q}”.</p>}
      </div>

      {shown.items.length > 0 && (
        <ul className="mt-1 divide-y divide-line overflow-hidden rounded-lg ring-1 ring-line">
          {shown.items.map((item) => {
            const active = selected?.storeProductId === item.storeProductId;
            return (
              <li key={item.storeProductId}>
                <button
                  type="button"
                  onClick={() => pick(item)}
                  aria-pressed={active}
                  className={`flex w-full flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 py-2.5 text-left transition-colors hover:bg-surface-2 ${active ? 'bg-surface-2' : ''}`}
                >
                  <span className="font-medium">{item.name}</span>
                  <span className="text-xs text-muted">{item.brand} · {item.category} · #{item.storeProductId}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {selected && (
        <div className="mt-5 rounded-lg bg-page p-4 ring-1 ring-line">
          {detail.status === 'loading' && <p className="text-sm text-muted">Loading options from the store…</p>}
          {detail.status === 'error' && <p className="text-sm text-critical-ink">{detail.message}</p>}
          {product && (
            <>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="font-semibold">{product.name}</h3>
                <a href={product.url} target="_blank" rel="noreferrer" className="text-xs text-accent hover:underline">View on store ↗</a>
              </div>
              <p className="text-xs text-muted">{product.brand} · SKU {product.sku}</p>

              <fieldset className="mt-4">
                <legend className="text-sm font-medium">{product.optionAxis ?? 'Option'}</legend>
                <div className="mt-2 flex flex-wrap gap-2">
                  {product.options.map((o) => (
                    <button
                      key={o.key}
                      type="button"
                      onClick={() => { setOptionKey(o.key); setTrackState({ status: 'idle' }); }}
                      aria-pressed={optionKey === o.key}
                      className={`rounded-full px-3.5 py-1.5 text-sm ring-1 transition-colors ${
                        optionKey === o.key ? 'bg-accent text-accent-ink ring-accent' : 'bg-surface ring-line hover:bg-surface-2'
                      }`}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </fieldset>

              <div className="mt-4 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={track}
                  disabled={!optionKey || trackState.status === 'saving'}
                  className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-ink transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {trackState.status === 'saving' ? 'Adding…' : 'Track this option'}
                </button>
                {!optionKey && <span className="text-xs text-muted">Choose an option first. Each option is priced separately.</span>}
              </div>
              {trackState.status === 'done' && <p role="status" className="mt-3 text-sm text-good-ink">✓ {trackState.message}</p>}
              {trackState.status === 'error' && <p role="alert" className="mt-3 text-sm text-critical-ink">{trackState.message}</p>}
            </>
          )}
        </div>
      )}
    </section>
  );
}
