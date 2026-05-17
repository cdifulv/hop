import { describe, expect, it } from "vitest"

import { createDestinationValidator } from "../../server/links/destination-validator"
import { createLinkLifecycle } from "../../server/links/link-lifecycle"
import { createSlugAllocator } from "../../server/links/slug-allocator"
import { createMemoryLinkRepository } from "../support/memory-link-repository"

const validateDestination = createDestinationValidator({
  async resolve() {
    return ["93.184.216.34"]
  },
}).validate

function createLinks(options: {
  anonymousCreationEnabled?: boolean
  rateLimitStatus?: "allowed" | "limited"
}) {
  const repository = createMemoryLinkRepository([
    {
      slug: "existing",
      slugKey: "existing",
      destination: "https://docs.example.com/existing",
      ownerMemberId: null,
    },
  ])

  return createLinkLifecycle({
    repository,
    validateDestination,
    anonymousCreation: {
      async enabled() {
        return options.anonymousCreationEnabled ?? true
      },
    },
    anonymousCreationRateLimiter: {
      async check() {
        if (options.rateLimitStatus === "limited") {
          return {
            status: "limited",
            retryAfter: new Date("2026-05-17T12:01:00.000Z"),
          }
        }

        return {
          status: "allowed",
        }
      },
    },
    slugAllocator: createSlugAllocator({
      repository,
      randomBase62: () => "a1B2c3",
    }),
  })
}

describe("anonymous Link creation guards", () => {
  it("rejects anonymous creation when the Admin kill switch is disabled while existing redirects still resolve", async () => {
    const links = createLinks({
      anonymousCreationEnabled: false,
    })

    await expect(
      links.create({
        destination: "https://docs.example.com/deck",
        creationSourceKey: "203.0.113.10",
      }),
    ).resolves.toEqual({
      status: "rejected",
      reason: "anonymous_creation_disabled",
    })

    await expect(links.resolve("existing")).resolves.toEqual({
      status: "redirect",
      destination: "https://docs.example.com/existing",
    })
  })

  it("rejects anonymous creation over the per-source rate limit with a distinct reason", async () => {
    const links = createLinks({
      rateLimitStatus: "limited",
    })

    await expect(
      links.create({
        destination: "https://docs.example.com/deck",
        creationSourceKey: "203.0.113.10",
      }),
    ).resolves.toEqual({
      status: "rejected",
      reason: "rate_limited",
      retryAfter: new Date("2026-05-17T12:01:00.000Z"),
    })
  })

  it("exempts Members from anonymous creation guards", async () => {
    const links = createLinks({
      anonymousCreationEnabled: false,
      rateLimitStatus: "limited",
    })

    const created = await links.create({
      destination: "https://docs.example.com/member",
      ownerMemberId: "member-1",
      creationSourceKey: "203.0.113.10",
    })

    expect(created).toEqual({
      status: "created",
      link: expect.objectContaining({
        destination: "https://docs.example.com/member",
        ownerMemberId: "member-1",
      }),
    })
  })
})
