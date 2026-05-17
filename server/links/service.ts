import { createClickRecorder } from "./click-recorder"
import { validateDestination } from "./destination-validator"
import { createDrizzleBrowserSessionRepository } from "./drizzle-browser-session-repository"
import { createDrizzleClickEventRepository } from "./drizzle-click-event-repository"
import { createDrizzleLinkRepository } from "./drizzle-link-repository"
import { createLinkLifecycle } from "./link-lifecycle"
import { createSlugAllocator } from "./slug-allocator"

export function createProductionLinkLifecycle() {
  const repository = createDrizzleLinkRepository()

  return createLinkLifecycle({
    repository,
    browserSessions: createDrizzleBrowserSessionRepository(),
    clickRecorder: createClickRecorder({
      repository: createDrizzleClickEventRepository(),
    }),
    validateDestination,
    slugAllocator: createSlugAllocator({
      repository,
    }),
  })
}
