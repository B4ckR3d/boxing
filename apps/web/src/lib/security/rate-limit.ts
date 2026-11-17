/**
 * Sliding-window rate limiter.
 * MVP store: in-process memory (single instance). For horizontal scaling, implement `RateLimitStore`
 * with Redis (INCR + PEXPIRE) — see docs/SCALABILITY.md. Account-level brute-force protection is
 * additionally enforced in the database (User.failedLoginCount / lockedUntil), so it is multi-instance safe.
 */
export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export interface RateLimitStore {
  hit(key: string, windowMs: number, limit: number): RateLimitResult;
  reset(key: string): void;
}

class MemoryStore implements RateLimitStore {
  private buckets = new Map<string, number[]>();
  private lastSweep = Date.now();

  hit(key: string, windowMs: number, limit: number): RateLimitResult {
    const now = Date.now();
    this.sweep(now, windowMs);
    const hits = (this.buckets.get(key) ?? []).filter((t) => now - t < windowMs);
    if (hits.length >= limit) {
      const oldest = hits[0] ?? now;
      this.buckets.set(key, hits);
      return { allowed: false, remaining: 0, retryAfterSeconds: Math.max(1, Math.ceil((oldest + windowMs - now) / 1000)) };
    }
    hits.push(now);
    this.buckets.set(key, hits);
    return { allowed: true, remaining: limit - hits.length, retryAfterSeconds: 0 };
  }

  reset(key: string) {
    this.buckets.delete(key);
  }

  private sweep(now: number, windowMs: number) {
    if (now - this.lastSweep < 60_000) return;
    this.lastSweep = now;
    for (const [k, v] of this.buckets) {
      if (v.every((t) => now - t >= windowMs)) this.buckets.delete(k);
    }
  }
}

const globalStore = globalThis as unknown as { __rateLimitStore?: RateLimitStore };
export const rateLimitStore: RateLimitStore = (globalStore.__rateLimitStore ??= new MemoryStore());

export const RATE_LIMITS = {
  login: { windowMs: 15 * 60_000, limit: 10 },
  loginIp: { windowMs: 15 * 60_000, limit: 30 },
  mfa: { windowMs: 5 * 60_000, limit: 10 },
  mutation: { windowMs: 60_000, limit: 120 },
  upload: { windowMs: 60_000, limit: 20 },
  publicApi: { windowMs: 60_000, limit: 120 },
} as const;

export type RateLimitName = keyof typeof RATE_LIMITS;

export function rateLimit(name: RateLimitName, identifier: string): RateLimitResult {
  const cfg = RATE_LIMITS[name];
  return rateLimitStore.hit(`${name}:${identifier}`, cfg.windowMs, cfg.limit);
}

