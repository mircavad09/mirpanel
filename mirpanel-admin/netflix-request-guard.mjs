export function createNetflixRequestGuard({ windowMs = 60_000, max = 5, cacheTtlMs = 30_000 } = {}) {
  const hits = new Map(); const inflight = new Map(); const cache = new Map();
  const keyFor = (key) => String(key || "").slice(0, 128);
  return Object.freeze({
    allow(key, now = Date.now()) { const k = keyFor(key); const list = (hits.get(k) || []).filter((t) => now - t < windowMs); if (list.length >= max) { hits.set(k, list); return false; } list.push(now); hits.set(k, list); return true; },
    async singleFlight(key, fn) { const k = keyFor(key); if (inflight.has(k)) return inflight.get(k); const p = Promise.resolve().then(fn).finally(() => inflight.delete(k)); inflight.set(k, p); return p; },
    getCached(key, now = Date.now()) { const item = cache.get(keyFor(key)); if (!item || item.expiresAt <= now) { cache.delete(keyFor(key)); return null; } return item.value; },
    setCached(key, value, now = Date.now()) { cache.set(keyFor(key), { value, expiresAt: now + cacheTtlMs }); return value; }
  });
}
