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

describe("claim anonymous Links on sign-in", () => {
  it("transfers only the current Browser session's anonymous Links to the Member", async () => {
    const links = createLinks()

    await links.create({
      destination: "https://docs.example.com/deck",
      slug: "session-deck",
      browserSessionToken: "browser-a",
    })
    await links.create({
      destination: "https://docs.example.com/memo",
      slug: "session-memo",
      browserSessionToken: "browser-a",
    })
    await links.create({
      destination: "https://docs.example.com/other",
      slug: "other-browser",
      browserSessionToken: "browser-b",
    })

    await expect(
      links.claimBrowserSessionLinks("browser-a", { id: "member-1" }),
    ).resolves.toEqual({
      status: "claimed",
      links: [
        expect.objectContaining({
          slug: "session-deck",
          ownerMemberId: "member-1",
        }),
        expect.objectContaining({
          slug: "session-memo",
          ownerMemberId: "member-1",
        }),
      ],
    })

    await expect(links.listBrowserSessionLinks("browser-a")).resolves.toEqual([])
    await expect(links.listBrowserSessionLinks("browser-b")).resolves.toEqual([
      expect.objectContaining({
        slug: "other-browser",
        ownerMemberId: null,
      }),
    ])
  })

  it("is idempotent after the Browser session's Links have already been claimed", async () => {
    const links = createLinks()

    await links.create({
      destination: "https://docs.example.com/deck",
      slug: "session-deck",
      browserSessionToken: "browser-a",
    })

    await expect(
      links.claimBrowserSessionLinks("browser-a", { id: "member-1" }),
    ).resolves.toEqual({
      status: "claimed",
      links: [
        expect.objectContaining({
          slug: "session-deck",
          ownerMemberId: "member-1",
        }),
      ],
    })

    await expect(
      links.claimBrowserSessionLinks("browser-a", { id: "member-1" }),
    ).resolves.toEqual({
      status: "claimed",
      links: [],
    })
  })
})
