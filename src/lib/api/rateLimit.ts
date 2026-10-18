/**
 * Minimal in-memory token bucket, keyed by client address. It limits abuse of
 * the paid AI provider and CPU on a single instance; it is not a distributed
 * limiter (each server process keeps its own buckets).
 */
export interface Bucket {
  tokens: number;
  updated: number;
}

export function createLimiter(opts: { capacity: number; refillPerMinute: number; maxKeys?: number }) {
  const buckets = new Map<string, Bucket>();
  const maxKeys = opts.maxKeys ?? 5000;
  return {
    take(key: string, now = Date.now()): { ok: boolean; retryAfterSec: number } {
      let b = buckets.get(key);
      if (!b) {
        if (buckets.size >= maxKeys) buckets.delete(buckets.keys().next().value as string);
        b = { tokens: opts.capacity, updated: now };
        buckets.set(key, b);
      }
      const refill = ((now - b.updated) / 60_000) * opts.refillPerMinute;
      b.tokens = Math.min(opts.capacity, b.tokens + refill);
      b.updated = now;
      if (b.tokens >= 1) {
        b.tokens -= 1;
        return { ok: true, retryAfterSec: 0 };
      }
      return { ok: false, retryAfterSec: Math.ceil(((1 - b.tokens) / opts.refillPerMinute) * 60) };
    },
  };
}

export function clientKey(req: Request) {
  // Behind a proxy (e.g. Render) the first X-Forwarded-For hop is the client.
  return req.headers.get("x-forwarded-for")?.split(",")[0].trim() || req.headers.get("x-real-ip") || "local";
}
