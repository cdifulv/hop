export type RateLimitResult =
  | {
      status: "allowed"
    }
  | {
      status: "limited"
      retryAfter: Date
    }

export interface RateLimiter {
  check(
    input: string | { sourceKey: string; memberId?: string | null },
  ): Promise<RateLimitResult>
}

interface FixedWindowRateLimiterOptions {
  threshold: number
  windowMs: number
  clock?: {
    now(): Date
  }
}

export function createFixedWindowRateLimiter(
  options: FixedWindowRateLimiterOptions,
): RateLimiter {
  const windows = new Map<string, { count: number; resetAt: number }>()
  const clock = options.clock ?? {
    now: () => new Date(),
  }

  return {
    async check(input) {
      const request = typeof input === "string" ? { sourceKey: input } : input

      if (request.memberId) {
        return {
          status: "allowed",
        }
      }

      const now = clock.now().getTime()
      const current = windows.get(request.sourceKey)

      if (!current || current.resetAt <= now) {
        windows.set(request.sourceKey, {
          count: 1,
          resetAt: now + options.windowMs,
        })

        return {
          status: "allowed",
        }
      }

      if (current.count >= options.threshold) {
        return {
          status: "limited",
          retryAfter: new Date(current.resetAt),
        }
      }

      current.count += 1

      return {
        status: "allowed",
      }
    },
  }
}
