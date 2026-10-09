import { describe, expect, it } from "vitest";
import { RateLimiter } from "../server/rateLimit";

describe("RateLimiter", () => {
  it("allows up to the limit per window and key", () => {
    let now = 0;
    const limiter = new RateLimiter(2, 1000, () => now);
    expect(limiter.take("a").ok).toBe(true);
    expect(limiter.take("a").ok).toBe(true);
    expect(limiter.take("a")).toEqual({ ok: false, retryAfterSec: 1 });
    expect(limiter.take("b").ok).toBe(true);
  });

  it("frees capacity once old requests leave the window", () => {
    let now = 0;
    const limiter = new RateLimiter(1, 60_000, () => now);
    expect(limiter.take("a").ok).toBe(true);
    now = 30_000;
    expect(limiter.take("a")).toEqual({ ok: false, retryAfterSec: 30 });
    now = 60_001;
    expect(limiter.take("a").ok).toBe(true);
  });
});
