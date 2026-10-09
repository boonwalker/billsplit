/**
 * Sliding-window rate limiter kept in memory. Good enough for the single server
 * instance billsplit runs on; counters reset on restart.
 */
export class RateLimiter {
  private hits = new Map<string, number[]>();

  constructor(
    readonly limit: number,
    readonly windowMs: number,
    private readonly now: () => number = Date.now,
  ) {}

  /** Counts one request for `key`; returns how long to wait when the limit is reached. */
  take(key: string): { ok: true } | { ok: false; retryAfterSec: number } {
    const now = this.now();
    const since = now - this.windowMs;
    const recent = (this.hits.get(key) ?? []).filter((t) => t > since);
    if (recent.length >= this.limit) {
      this.hits.set(key, recent);
      return { ok: false, retryAfterSec: Math.max(1, Math.ceil((recent[0] + this.windowMs - now) / 1000)) };
    }
    recent.push(now);
    this.hits.set(key, recent);
    if (this.hits.size > 10_000) this.sweep(since);
    return { ok: true };
  }

  private sweep(since: number): void {
    for (const [key, times] of this.hits) {
      if (times.every((t) => t <= since)) this.hits.delete(key);
    }
  }
}

function envInt(name: string, fallback: number): number {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

export interface Limits {
  /** Receipt photos per client and hour. */
  receiptPerClient: RateLimiter;
  /** Receipt photos per day across all clients – caps the AI costs. */
  receiptTotal: RateLimiter;
  /** New bills per client and hour. */
  billsPerClient: RateLimiter;
}

const HOUR = 60 * 60 * 1000;

export function limitsFromEnv(): Limits {
  return {
    receiptPerClient: new RateLimiter(envInt("RECEIPT_LIMIT_PER_HOUR", 10), HOUR),
    receiptTotal: new RateLimiter(envInt("RECEIPT_LIMIT_PER_DAY", 300), 24 * HOUR),
    billsPerClient: new RateLimiter(envInt("BILL_LIMIT_PER_HOUR", 30), HOUR),
  };
}
