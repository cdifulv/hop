import { describe, expect, it } from "vitest"

import { createLinkLifecycle } from "../../server/links/link-lifecycle"
import { createSlugAllocator } from "../../server/links/slug-allocator"
import { createMemoryLinkRepository } from "../support/memory-link-repository"

function createAdminModerationLinks() {
  const repository = createMemoryLinkRepository([
    {
      slug: "member-link",
      slugKey: "member-link",
      destination: "https://docs.example.com/member",
      ownerMemberId: "member-1",
      clickCount: 4,
      createdAt: new Date("2026-05-15T10:00:00.000Z"),
    },
    {
      slug: "anonymous-link",
      slugKey: "anonymous-link",
      destination: "https://docs.example.com/anonymous",
      ownerMemberId: null,
      clickCount: 7,
      createdAt: new Date("2026-05-16T10:00:00.000Z"),
    },
  ])

  return createLinkLifecycle({
    repository,
    validateDestination: (destination) => ({ status: "accepted", destination }),
    slugAllocator: createSlugAllocator({
      repository,
      randomBase62: () => "unused",
    }),
  })
}

describe("Admin Link moderation", () => {
  it("lists every Link across the Deployment, including the Anonymous pool", async () => {
    const links = createAdminModerationLinks()

    await expect(
      links.listAdminLinks({ id: "admin-1", isAdmin: true }),
    ).resolves.toEqual([
      expect.objectContaining({
        slug: "anonymous-link",
        ownerMemberId: null,
        clickCount: 7,
      }),
      expect.objectContaining({
        slug: "member-link",
        ownerMemberId: "member-1",
        clickCount: 4,
      }),
    ])
  })

  it("lets an Admin delete any Link and keeps the Tombstone visible to Admins", async () => {
    const links = createAdminModerationLinks()

    await expect(
      links.deleteAdminLink({ id: "admin-1", isAdmin: true }, "anonymous-link"),
    ).resolves.toEqual({
      status: "deleted",
      link: expect.objectContaining({
        slug: "anonymous-link",
        lifecycleState: "tombstoned",
      }),
    })

    await expect(
      links.listAdminLinks({ id: "admin-1", isAdmin: true }),
    ).resolves.toEqual([
      expect.objectContaining({
        slug: "anonymous-link",
        lifecycleState: "tombstoned",
        clickCount: 7,
      }),
      expect.objectContaining({
        slug: "member-link",
        lifecycleState: "active",
      }),
    ])

    await expect(
      links.create({
        destination: "https://docs.example.com/reuse",
        slug: "ANONYMOUS-LINK",
      }),
    ).resolves.toEqual({
      status: "rejected",
      reason: "slug_taken",
    })
  })

  it("does not let a non-Admin use Admin moderation actions", async () => {
    const links = createAdminModerationLinks()

    await expect(
      links.listAdminLinks({ id: "member-1", isAdmin: false }),
    ).resolves.toEqual([])
    await expect(
      links.deleteAdminLink({ id: "member-1", isAdmin: false }, "anonymous-link"),
    ).resolves.toEqual({
      status: "not_found",
    })
  })
})
