import { createClickRecorder } from "./click-recorder"
import { createDrizzleDeploymentConfigRepository } from "./drizzle-deployment-config-repository"
import { validateDestination } from "./destination-validator"
import { createDrizzleBrowserSessionRepository } from "./drizzle-browser-session-repository"
import { createDrizzleClickEventRepository } from "./drizzle-click-event-repository"
import { createDrizzleLinkRepository } from "./drizzle-link-repository"
import { createLinkLifecycle } from "./link-lifecycle"
import { createFixedWindowRateLimiter } from "./rate-limiter"
import { createSlugAllocator } from "./slug-allocator"

const productionAnonymousCreationRateLimiter = createFixedWindowRateLimiter({
  threshold: positiveIntegerEnv("HOP_ANONYMOUS_CREATE_RATE_LIMIT", 10),
  windowMs: positiveIntegerEnv("HOP_ANONYMOUS_CREATE_RATE_LIMIT_WINDOW_MS", 60_000),
})

export function createProductionLinkLifecycle() {
  const repository = createDrizzleLinkRepository()
  const deploymentConfig = createDrizzleDeploymentConfigRepository()

  return createLinkLifecycle({
    repository,
    browserSessions: createDrizzleBrowserSessionRepository(),
    clickRecorder: createClickRecorder({
      repository: createDrizzleClickEventRepository(),
    }),
    anonymousCreation: {
      enabled: () => deploymentConfig.anonymousCreationEnabled(),
    },
    anonymousCreationRateLimiter: productionAnonymousCreationRateLimiter,
    validateDestination,
    slugAllocator: createSlugAllocator({
      repository,
    }),
  })
}

function positiveIntegerEnv(name: string, fallback: number) {
  const value = Number(process.env[name])

  return Number.isInteger(value) && value > 0 ? value : fallback
}
