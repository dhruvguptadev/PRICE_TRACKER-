import { query, withTransaction } from './pool.js';

const UPSERT_CHUNK = 200;

export async function upsertCatalog(products) {
  await withTransaction(async (client) => {
    for (let i = 0; i < products.length; i += UPSERT_CHUNK) {
      const chunk = products.slice(i, i + UPSERT_CHUNK);
      const values = [];
      const params = [];
      chunk.forEach((p, j) => {
        const o = j * 6;
        values.push(`($${o + 1}, $${o + 2}, $${o + 3}, $${o + 4}, $${o + 5}, $${o + 6}, now())`);
        params.push(p.id, p.slug ?? String(p.id), p.name, p.brand ?? null, p.category ?? null, p.sku ?? null);
      });
      await client.query(
        `insert into catalog_products (store_product_id, slug, name, brand, category, sku, last_seen_at)
         values ${values.join(', ')}
         on conflict (store_product_id) do update set
           slug = excluded.slug, name = excluded.name, brand = excluded.brand,
           category = excluded.category, sku = excluded.sku, last_seen_at = now()`,
        params,
      );
    }
  });
}

export async function countCatalog() {
  const { rows } = await query('select count(*)::int as count from catalog_products');
  return rows[0].count;
}

/** Case-insensitive partial match on name or brand; prefix matches rank first. */
export async function searchCatalog(q, limit) {
  const escaped = q.replace(/[\\%_]/g, (c) => `\\${c}`);
  const { rows } = await query(
    `select store_product_id, name, brand, category
       from catalog_products
      where name ilike $1 or brand ilike $1
      order by (lower(name) like lower($2)) desc, name asc
      limit $3`,
    [`%${escaped}%`, `${escaped}%`, limit],
  );
  return rows;
}
