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
      slug: "release-notes",
      slugKey: "release-notes",
      destination: "https://product.example.com/changelog",
      ownerMemberId: "member-1",
      clickCount: 7,
      createdAt: new Date("2026-05-16T09:00:00.000Z"),
    },
    {
      slug: "finance",
      slugKey: "finance",
      destination: "https://reports.example.com/q2",
      ownerMemberId: "member-1",
      clickCount: 11,
      createdAt: new Date("2026-05-14T09:00:00.000Z"),
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
        slug: "release-notes",
        destination: "https://product.example.com/changelog",
        ownerMemberId: "member-1",
        clickCount: 7,
        createdAt: new Date("2026-05-16T09:00:00.000Z"),
      }),
      expect.objectContaining({
        slug: "mine",
      }),
      expect.objectContaining({
        slug: "finance",
      }),
    ])
  })

  it("searches the signed-in Member's Links by Slug, Destination host, or displayed title", async () => {
    const links = createDashboardLinks()

    await expect(
      links.listMemberLinks({ id: "member-1" }, { search: "release" }),
    ).resolves.toEqual([
      expect.objectContaining({
        slug: "release-notes",
      }),
    ])
    await expect(
      links.listMemberLinks({ id: "member-1" }, { search: "reports.example.com" }),
    ).resolves.toEqual([
      expect.objectContaining({
        slug: "finance",
      }),
    ])
    await expect(
      links.listMemberLinks({ id: "member-1" }, { search: "docs.example.com/mine" }),
    ).resolves.toEqual([
      expect.objectContaining({
        slug: "mine",
      }),
    ])
  })

  it("sorts the signed-in Member's Links by most recent or most clicked", async () => {
    const links = createDashboardLinks()

    await expect(
      links.listMemberLinks({ id: "member-1" }, { sort: "recent" }),
    ).resolves.toEqual([
      expect.objectContaining({ slug: "release-notes", clickCount: 7 }),
      expect.objectContaining({ slug: "mine", clickCount: 3 }),
      expect.objectContaining({ slug: "finance", clickCount: 11 }),
    ])
    await expect(
      links.listMemberLinks({ id: "member-1" }, { sort: "clicks" }),
    ).resolves.toEqual([
      expect.objectContaining({ slug: "finance", clickCount: 11 }),
      expect.objectContaining({ slug: "release-notes", clickCount: 7 }),
      expect.objectContaining({ slug: "mine", clickCount: 3 }),
    ])
  })

  it("searches and sorts only within the signed-in Member's own Links", async () => {
    const links = createDashboardLinks()

    await expect(
      links.listMemberLinks(
        { id: "member-1" },
        { search: "docs.example.com", sort: "clicks" },
      ),
    ).resolves.toEqual([
      expect.objectContaining({
        slug: "mine",
        clickCount: 3,
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
    await expect(links.listMemberLinks({ id: "member-1" })).resolves.toEqual([
      expect.objectContaining({
        slug: "release-notes",
      }),
      expect.objectContaining({
        slug: "finance",
      }),
    ])
  })
})
