type Entry = { count: number; resetAt: number };

const STORE_KEY = "__pp_rate_limiter__";
const MAX_KEYS = 5_000;

function store(): Map<string, Entry> {
  const g = globalThis as typeof globalThis & Record<string, unknown>;
  const existing = g[STORE_KEY];
  if (!(existing instanceof Map)) {
    g[STORE_KEY] = new Map<string, Entry>();
  }
  return g[STORE_KEY] as Map<string, Entry>;
}

function pruneExpired(s: Map<string, Entry>, now: number) {
  for (const [key, entry] of s) {
    if (now >= entry.resetAt) s.delete(key);
  }
}

function evictOldest(s: Map<string, Entry>) {
  // Map iteration order is insertion order; drop the oldest entry.
  const first = s.keys().next();
  if (!first.done) s.delete(first.value);
}

export function checkRateLimit(params: {
  key: string;
  limit: number;
  windowMs: number;
}): { allowed: boolean; retryAfterSeconds?: number } {
  const now = Date.now();
  const s = store();

  // Bound memory: prune expired windows, then cap unique keys.
  if (s.size > MAX_KEYS || s.size % 64 === 0) {
    pruneExpired(s, now);
  }
  while (s.size >= MAX_KEYS) {
    evictOldest(s);
  }

  const e = s.get(params.key);

  if (!e || now >= e.resetAt) {
    s.set(params.key, { count: 1, resetAt: now + params.windowMs });
    return { allowed: true };
  }

  if (e.count >= params.limit) {
    return { allowed: false, retryAfterSeconds: Math.ceil((e.resetAt - now) / 1000) };
  }

  e.count += 1;
  s.set(params.key, e);
  return { allowed: true };
}
