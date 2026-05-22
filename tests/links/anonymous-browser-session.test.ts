import { describe, expect, it } from "vitest"

import { createDestinationValidator } from "../../server/links/destination-validator"
import { createLinkLifecycle } from "../../server/links/link-lifecycle"
import { createSlugAllocator } from "../../server/links/slug-allocator"
import {
  createMemoryBrowserSessionRepository,
  createMemoryLinkRepository,
} from "../support/memory-link-repository"

const validateDestination = createDestinationValidator({
  async resolve() {
    return ["93.184.216.34"]
  },
}).validate

function createLinks() {
  const repository = createMemoryLinkRepository()

  return createLinkLifecycle({
    repository,
    browserSessions: createMemoryBrowserSessionRepository(repository),
    validateDestination,
    slugAllocator: createSlugAllocator({
      repository,
      randomBase62: () => "a1B2c3",
    }),
  })
}

describe("anonymous Browser session management", () => {
  it("tracks an anonymous Link against the Browser session that created it", async () => {
    const links = createLinks()

    const created = await links.create({
      destination: "https://docs.example.com/deck",
      browserSessionToken: "browser-a",
    })

    expect(created.status).toBe("created")

    await expect(links.listBrowserSessionLinks("browser-a")).resolves.toEqual([
      expect.objectContaining({
        slug: "a1B2c3",
        destination: "https://docs.example.com/deck",
      }),
    ])

    await expect(links.listBrowserSessionLinks("browser-b")).resolves.toEqual([])
  })

  it("allows only the creating Browser session to delete its anonymous Link", async () => {
    const links = createLinks()

    await links.create({
      destination: "https://docs.example.com/deck",
      slug: "session-deck",
      browserSessionToken: "browser-a",
    })

    await expect(
      links.deleteBrowserSessionLink("browser-b", "session-deck"),
    ).resolves.toEqual({
      status: "not_found",
    })

    await expect(links.resolve("session-deck")).resolves.toEqual({
      status: "redirect",
      destination: "https://docs.example.com/deck",
    })

    await expect(
      links.deleteBrowserSessionLink("browser-a", "session-deck"),
    ).resolves.toEqual({
      status: "deleted",
      link: expect.objectContaining({
        slug: "session-deck",
        lifecycleState: "tombstoned",
      }),
    })

    await expect(links.listBrowserSessionLinks("browser-a")).resolves.toEqual([])
    await expect(links.resolve("session-deck")).resolves.toEqual({
      status: "tombstoned",
    })
  })
})
