// Tiny in-memory TTL cache so we don't hammer Yahoo on every request.
const store = new Map();

export async function cached(key, ttlMs, fetcher) {
  const hit = store.get(key);
  if (hit && hit.expires > Date.now()) return hit.value;

  const value = await fetcher();
  store.set(key, { value, expires: Date.now() + ttlMs });
  return value;
}
