import { describe, expect, it } from "vitest"

import { createLinkLifecycle } from "../../server/links/link-lifecycle"
import { createSlugAllocator } from "../../server/links/slug-allocator"
import { createMemoryLinkRepository } from "../support/memory-link-repository"

function createAdminModerationLinks(now = new Date("2026-05-16T12:00:00.000Z")) {
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
    clock: {
      now: () => now,
    },
  })
}

describe("Admin Link moderation", () => {
  it("lets an Admin suspend and unsuspend a Link without retiring its Slug", async () => {
    const links = createAdminModerationLinks()
    const cases = [
      {
        slug: "anonymous-link",
        destination: "https://docs.example.com/anonymous",
      },
      {
        slug: "member-link",
        destination: "https://docs.example.com/member",
      },
    ]

    for (const link of cases) {
      await expect(
        links.suspendAdminLink({ id: "admin-1", isAdmin: true }, link.slug),
      ).resolves.toEqual({
        status: "suspended",
        link: expect.objectContaining({
          slug: link.slug,
          lifecycleState: "suspended",
        }),
      })

      await expect(links.resolve(link.slug)).resolves.toEqual({
        status: "suspended",
      })
      await expect(
        links.create({
          destination: "https://docs.example.com/reuse",
          slug: link.slug.toUpperCase(),
        }),
      ).resolves.toEqual({
        status: "rejected",
        reason: "slug_taken",
      })

      await expect(
        links.unsuspendAdminLink({ id: "admin-1", isAdmin: true }, link.slug),
      ).resolves.toEqual({
        status: "unsuspended",
        link: expect.objectContaining({
          slug: link.slug,
          lifecycleState: "active",
        }),
      })
      await expect(links.resolve(link.slug)).resolves.toEqual({
        status: "redirect",
        destination: link.destination,
      })
    }
  })

  it("returns Suspended before Expired for a suspended Link past its Expiration", async () => {
    const now = { value: new Date("2026-05-16T12:00:00.000Z") }
    const repository = createMemoryLinkRepository([
      {
        slug: "expired-suspended",
        slugKey: "expired-suspended",
        destination: "https://docs.example.com/expired-suspended",
        ownerMemberId: "member-1",
        expiresAt: new Date("2026-05-16T11:00:00.000Z"),
      },
    ])
    const links = createLinkLifecycle({
      repository,
      validateDestination: (destination) => ({ status: "accepted", destination }),
      slugAllocator: createSlugAllocator({
        repository,
        randomBase62: () => "unused",
      }),
      clock: {
        now: () => now.value,
      },
    })

    await links.suspendAdminLink(
      { id: "admin-1", isAdmin: true },
      "expired-suspended",
    )

    await expect(links.resolve("expired-suspended")).resolves.toEqual({
      status: "suspended",
    })
  })

  it("exposes direct and owner suspension provenance to Admins", async () => {
    const links = createAdminModerationLinks(
      new Date("2026-05-18T12:00:00.000Z"),
    )

    await links.suspendAdminLink(
      { id: "admin-direct", isAdmin: true },
      "member-link",
    )
    await links.suspendMemberLinks(
      { id: "member-1" },
      { id: "admin-owner" },
    )

    await expect(
      links.listAdminLinks({ id: "admin-1", isAdmin: true }),
    ).resolves.toEqual([
      expect.objectContaining({
        slug: "anonymous-link",
        suspension: {
          direct: null,
          owner: null,
        },
      }),
      expect.objectContaining({
        slug: "member-link",
        lifecycleState: "suspended",
        suspension: {
          direct: {
            adminMemberId: "admin-direct",
            suspendedAt: new Date("2026-05-18T12:00:00.000Z"),
          },
          owner: {
            adminMemberId: "admin-owner",
            suspendedAt: new Date("2026-05-18T12:00:00.000Z"),
          },
        },
      }),
    ])
  })

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
    await expect(
      links.suspendAdminLink({ id: "member-1", isAdmin: false }, "anonymous-link"),
    ).resolves.toEqual({
      status: "not_found",
    })
    await expect(
      links.unsuspendAdminLink({ id: "member-1", isAdmin: false }, "anonymous-link"),
    ).resolves.toEqual({
      status: "not_found",
    })
  })
})
