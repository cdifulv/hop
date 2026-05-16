import { validateDestination } from "./destination-validator"
import { createDrizzleBrowserSessionRepository } from "./drizzle-browser-session-repository"
import { createDrizzleLinkRepository } from "./drizzle-link-repository"
import { createLinkLifecycle } from "./link-lifecycle"
import { createSlugAllocator } from "./slug-allocator"

export function createProductionLinkLifecycle() {
  const repository = createDrizzleLinkRepository()

  return createLinkLifecycle({
    repository,
    browserSessions: createDrizzleBrowserSessionRepository(),
    validateDestination,
    slugAllocator: createSlugAllocator({
      repository,
    }),
  })
}
