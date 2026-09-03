
/**
 * Per-process token-bucket rate limiter. Stored in module state, so it resets
 * on every redeploy and is not shared across instances. Fine for MVP and local
 * dev; we'll swap the same `take()` API for a Redis-backed bucket in Sprint 8
 * when Upstash is wired up.
 */
type Bucket = {
  tokens: number;
  lastRefillMs: number;
};

const BUCKETS = new Map<string, Bucket>();

export type RateLimitResult =
  | { ok: true; remaining: number; resetMs: number }
  | { ok: false; retryAfterMs: number };

export type RateLimitConfig = {
  capacity: number; // max tokens
  refillPerSec: number; // tokens added per second
};

export function take(key: string, cfg: RateLimitConfig): RateLimitResult {
  const now = Date.now();
  const bucket = BUCKETS.get(key) ?? { tokens: cfg.capacity, lastRefillMs: now };

  // Refill since last check.
  const elapsedSec = Math.max(0, (now - bucket.lastRefillMs) / 1000);
  bucket.tokens = Math.min(cfg.capacity, bucket.tokens + elapsedSec * cfg.refillPerSec);
  bucket.lastRefillMs = now;

  if (bucket.tokens >= 1) {
    bucket.tokens -= 1;
    BUCKETS.set(key, bucket);
    const tokensToFull = cfg.capacity - bucket.tokens;
    return {
      ok: true,
      remaining: Math.floor(bucket.tokens),
      resetMs: Math.ceil((tokensToFull / cfg.refillPerSec) * 1000),
    };
  }

  BUCKETS.set(key, bucket);
  const need = 1 - bucket.tokens;
  return { ok: false, retryAfterMs: Math.ceil((need / cfg.refillPerSec) * 1000) };
}

/** Default per-user invocation budget — 30 req/min, burst of 30. */
export const INVOKE_LIMIT: RateLimitConfig = { capacity: 30, refillPerSec: 30 / 60 };
