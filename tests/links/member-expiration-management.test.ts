import { describe, expect, it } from "vitest"

import { createLinkLifecycle } from "../../server/links/link-lifecycle"
import { createMemoryLinkRepository } from "../support/memory-link-repository"

function createMemberLinks(now: { value: Date }) {
  const repository = createMemoryLinkRepository([
    {
      slug: "deck",
      slugKey: "deck",
      destination: "https://docs.example.com/deck",
      ownerMemberId: "member-1",
      expiresAt: new Date("2026-05-16T13:00:00.000Z"),
    },
    {
      slug: "theirs",
      slugKey: "theirs",
      destination: "https://docs.example.com/theirs",
      ownerMemberId: "member-2",
      expiresAt: new Date("2026-05-16T13:00:00.000Z"),
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
    clock: {
      now: () => now.value,
    },
  })
}

describe("Member Expiration management", () => {
  it("lets a Member extend the Expiration of a Link they own", async () => {
    const now = { value: new Date("2026-05-16T12:00:00.000Z") }
    const links = createMemberLinks(now)

    await expect(
      links.updateMemberLinkExpiration(
        { id: "member-1" },
        "deck",
        new Date("2026-05-16T14:00:00.000Z"),
      ),
    ).resolves.toEqual({
      status: "updated",
      link: expect.objectContaining({
        slug: "deck",
        destination: "https://docs.example.com/deck",
        expiresAt: new Date("2026-05-16T14:00:00.000Z"),
      }),
    })

    now.value = new Date("2026-05-16T13:30:00.000Z")

    await expect(links.resolve("deck")).resolves.toEqual({
      status: "redirect",
      destination: "https://docs.example.com/deck",
    })
  })

  it("lets a Member remove Expiration from a Link they own", async () => {
    const now = { value: new Date("2026-05-16T12:00:00.000Z") }
    const links = createMemberLinks(now)

    await expect(
      links.updateMemberLinkExpiration({ id: "member-1" }, "deck", null),
    ).resolves.toEqual({
      status: "updated",
      link: expect.objectContaining({
        slug: "deck",
        destination: "https://docs.example.com/deck",
        expiresAt: null,
      }),
    })

    now.value = new Date("2026-05-17T00:00:00.000Z")

    await expect(links.resolve("deck")).resolves.toEqual({
      status: "redirect",
      destination: "https://docs.example.com/deck",
    })
  })

  it("lets a Member re-activate an Expired Link by setting a future Expiration", async () => {
    const now = { value: new Date("2026-05-16T14:00:00.000Z") }
    const links = createMemberLinks(now)

    await expect(links.resolve("deck")).resolves.toEqual({
      status: "expired",
    })

    await expect(
      links.updateMemberLinkExpiration(
        { id: "member-1" },
        "deck",
        new Date("2026-05-17T00:00:00.000Z"),
      ),
    ).resolves.toEqual({
      status: "updated",
      link: expect.objectContaining({
        slug: "deck",
        destination: "https://docs.example.com/deck",
        expiresAt: new Date("2026-05-17T00:00:00.000Z"),
      }),
    })

    await expect(links.resolve("deck")).resolves.toEqual({
      status: "redirect",
      destination: "https://docs.example.com/deck",
    })
  })

  it("does not let a Member manage another Member's Link Expiration", async () => {
    const now = { value: new Date("2026-05-16T12:00:00.000Z") }
    const links = createMemberLinks(now)

    await expect(
      links.updateMemberLinkExpiration(
        { id: "member-1" },
        "theirs",
        new Date("2026-05-17T00:00:00.000Z"),
      ),
    ).resolves.toEqual({
      status: "not_found",
    })
  })
})
