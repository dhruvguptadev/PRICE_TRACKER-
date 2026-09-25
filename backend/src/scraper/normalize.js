// Turns the store's display text into numbers. Pure functions, tested against fixtures.

// Zero-width characters the store injects to split the price (U+200B..U+200D, U+2060, U+FEFF).
const INVISIBLE = /[​-‍⁠﻿]/g;
// NBSP, narrow NBSP and any other whitespace.
const SPACES = /[\s  ]/g;

const CURRENCY_SYMBOLS = { '₹': 'INR', Rs: 'INR', 'Rs.': 'INR', INR: 'INR', $: 'USD', '€': 'EUR', '£': 'GBP' };

export function cleanText(text) {
  return String(text ?? '').replace(INVISIBLE, '').replace(SPACES, ' ').trim();
}

/**
 * "₹ 1,29,999.00" (possibly split with zero-width chars/NBSP) → { amount: 129999, currency: 'INR' }.
 * Returns null when the text is not exactly one well-formed amount.
 */
export function parsePrice(text) {
  const compact = cleanText(text).replace(/ /g, '');
  const match = compact.match(/^(₹|Rs\.?|INR|\$|€|£)?(\d{1,3}(?:,\d{2,3})*|\d+)(\.\d{1,2})?$/);
  if (!match) return null;
  const [, symbol, whole, fraction = ''] = match;
  const amount = Number(whole.replace(/,/g, '') + fraction);
  if (!Number.isFinite(amount)) return null;
  return { amount: Math.round(amount * 100) / 100, currency: symbol ? CURRENCY_SYMBOLS[symbol] : null };
}

/**
 * Stock pill text → integer units. "Sold out" → 0.
 * Known wordings: "7 units available", "Last few: 7", "Available (7)", "Stock: 7 remaining",
 * "Ready to ship · 7 available". Anything without exactly one integer is rejected (null).
 */
export function parseStock(text) {
  const clean = cleanText(text);
  if (!clean) return null;
  if (/sold\s*out|out\s*of\s*stock|unavailable/i.test(clean)) return 0;
  const numbers = clean.match(/\d[\d,]*/g);
  if (!numbers || numbers.length !== 1) return null;
  const qty = Number(numbers[0].replace(/,/g, ''));
  return Number.isInteger(qty) && qty >= 0 ? qty : null;
}

/** Exact-ish name comparison that ignores case, spacing and invisible characters. */
export function sameText(a, b) {
  const norm = (s) => cleanText(s).replace(/\s+/g, ' ').toLowerCase();
  return norm(a) === norm(b) && norm(a) !== '';
}
