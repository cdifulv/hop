import { describe, expect, it } from "vitest"

import { createLinkLifecycle } from "../../server/links/link-lifecycle"
import { createMemoryLinkRepository } from "../support/memory-link-repository"

function createDashboardLinks() {
  const repository = createMemoryLinkRepository([
    {
      slug: "mine",
      slugKey: "mine",
      destination: "https://docs.example.com/mine",
      ownerMemberId: "member-1",
      clickCount: 3,
      createdAt: new Date("2026-05-15T14:30:00.000Z"),
    },
    {
      slug: "theirs",
      slugKey: "theirs",
      destination: "https://docs.example.com/theirs",
      ownerMemberId: "member-2",
      clickCount: 9,
    },
    {
      slug: "anonymous",
      slugKey: "anonymous",
      destination: "https://docs.example.com/anonymous",
      ownerMemberId: null,
      clickCount: 1,
    },
  ])

  return createLinkLifecycle({
    repository,
    validateDestination: (destination) => ({ status: "accepted", destination }),
    slugAllocator: {
      async reserve() {
        return {
          status: "reserved",
          slug: "unused",
          slugKey: "unused",
        }
      },
    },
  })
}

describe("Member dashboard Links", () => {
  it("lists only the signed-in Member's Links with dashboard metadata", async () => {
    const links = createDashboardLinks()

    await expect(links.listMemberLinks({ id: "member-1" })).resolves.toEqual([
      expect.objectContaining({
        slug: "mine",
        destination: "https://docs.example.com/mine",
        ownerMemberId: "member-1",
        clickCount: 3,
        createdAt: new Date("2026-05-15T14:30:00.000Z"),
      }),
    ])
  })

  it("lets a Member delete only their own Links", async () => {
    const links = createDashboardLinks()

    await expect(
      links.deleteMemberLink({ id: "member-1" }, "theirs"),
    ).resolves.toEqual({
      status: "not_found",
    })
    await expect(links.deleteMemberLink({ id: "member-1" }, "mine")).resolves.toEqual(
      {
        status: "deleted",
        link: expect.objectContaining({
          slug: "mine",
          lifecycleState: "tombstoned",
        }),
      },
    )
    await expect(links.listMemberLinks({ id: "member-1" })).resolves.toEqual([])
  })
})
