import { describe, expect, it } from "vitest"

import { createFixedWindowRateLimiter } from "../../server/links/rate-limiter"

describe("anonymous Link creation rate limiter", () => {
  it("allows anonymous creation under the per-source threshold and limits over it until the window resets", async () => {
    let now = new Date("2026-05-17T12:00:00.000Z")
    const limiter = createFixedWindowRateLimiter({
      threshold: 2,
      windowMs: 60_000,
      clock: {
        now: () => now,
      },
    })

    await expect(limiter.check("203.0.113.10")).resolves.toEqual({
      status: "allowed",
    })
    await expect(limiter.check("203.0.113.10")).resolves.toEqual({
      status: "allowed",
    })
    await expect(limiter.check("203.0.113.10")).resolves.toEqual({
      status: "limited",
      retryAfter: new Date("2026-05-17T12:01:00.000Z"),
    })

    await expect(limiter.check("198.51.100.4")).resolves.toEqual({
      status: "allowed",
    })

    now = new Date("2026-05-17T12:01:00.000Z")

    await expect(limiter.check("203.0.113.10")).resolves.toEqual({
      status: "allowed",
    })
  })

  it("exempts Members from anonymous creation throttling", async () => {
    const limiter = createFixedWindowRateLimiter({
      threshold: 1,
      windowMs: 60_000,
    })

    await expect(
      limiter.check({ sourceKey: "203.0.113.10", memberId: "member-1" }),
    ).resolves.toEqual({
      status: "allowed",
    })
    await expect(
      limiter.check({ sourceKey: "203.0.113.10", memberId: "member-1" }),
    ).resolves.toEqual({
      status: "allowed",
    })
  })
})
