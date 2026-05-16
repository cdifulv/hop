import { validateDestination } from "./destination-validator"
import { createDrizzleLinkRepository } from "./drizzle-link-repository"
import { createLinkLifecycle } from "./link-lifecycle"
import { createSlugAllocator } from "./slug-allocator"

export function createProductionLinkLifecycle() {
  const repository = createDrizzleLinkRepository()

  return createLinkLifecycle({
    repository,
    validateDestination,
    slugAllocator: createSlugAllocator({
      repository,
    }),
  })
}
