type Entry = { count: number; resetAt: number };

const STORE_KEY = "__pp_rate_limiter__";

function store(): Map<string, Entry> {
  const g = globalThis as any;
  if (!g[STORE_KEY]) g[STORE_KEY] = new Map<string, Entry>();
  return g[STORE_KEY] as Map<string, Entry>;
}

export function checkRateLimit(params: {
  key: string;
  limit: number;
  windowMs: number;
}): { allowed: boolean; retryAfterSeconds?: number } {
  const now = Date.now();
  const s = store();
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

