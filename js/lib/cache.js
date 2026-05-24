// In-memory + sessionStorage cache with TTL.
// Memory cache is fastest; sessionStorage survives page navigation within the same tab.

const mem = new Map();

export async function withCache(key, ttlMs, fn) {
  const now = Date.now();
  const memHit = mem.get(key);
  if (memHit && now < memHit.exp) return memHit.data;

  try {
    const raw = sessionStorage.getItem('cent:' + key);
    if (raw) {
      const { data, exp } = JSON.parse(raw);
      if (now < exp) {
        mem.set(key, { data, exp });
        return data;
      }
    }
  } catch { /* sessionStorage unavailable */ }

  const data = await fn();
  const exp = now + ttlMs;
  mem.set(key, { data, exp });
  try { sessionStorage.setItem('cent:' + key, JSON.stringify({ data, exp })); } catch {}
  return data;
}

export function invalidate(...keys) {
  for (const key of keys) {
    mem.delete(key);
    try { sessionStorage.removeItem('cent:' + key); } catch {}
  }
}

export function invalidatePrefix(prefix) {
  for (const key of [...mem.keys()]) {
    if (key.startsWith(prefix)) mem.delete(key);
  }
  try {
    for (let i = sessionStorage.length - 1; i >= 0; i--) {
      const k = sessionStorage.key(i);
      if (k?.startsWith('cent:' + prefix)) sessionStorage.removeItem(k);
    }
  } catch {}
}
