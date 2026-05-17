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

describe("anonymous Link creation and resolution", () => {
  it("creates an anonymous Link with an auto-generated Slug and resolves it to a redirect", async () => {
    const repository = createMemoryLinkRepository()
    const links = createLinkLifecycle({
      repository,
      validateDestination,
      slugAllocator: createSlugAllocator({
        repository,
        randomBase62: () => "a1B2c3",
      }),
    })

    const created = await links.create({
      destination: "https://docs.example.com/deck",
    })

    expect(created).toEqual({
      status: "created",
      link: expect.objectContaining({
        slug: "a1B2c3",
        destination: "https://docs.example.com/deck",
        ownerMemberId: null,
      }),
    })

    await expect(links.resolve("a1B2c3")).resolves.toEqual({
      status: "redirect",
      destination: "https://docs.example.com/deck",
    })
  })

  it("resolves a Link past its Expiration to an expired result", async () => {
    const repository = createMemoryLinkRepository()
    const links = createLinkLifecycle({
      repository,
      validateDestination,
      slugAllocator: createSlugAllocator({
        repository,
        randomBase62: () => "a1B2c3",
      }),
      clock: {
        now: () => new Date("2026-05-17T00:00:00.000Z"),
      },
    })

    const created = await links.create({
      destination: "https://docs.example.com/deck",
      expiresAt: new Date("2026-05-16T23:59:59.000Z"),
    })

    expect(created).toEqual({
      status: "created",
      link: expect.objectContaining({
        slug: "a1B2c3",
        expiresAt: new Date("2026-05-16T23:59:59.000Z"),
      }),
    })

    await expect(links.resolve("a1B2c3")).resolves.toEqual({
      status: "expired",
    })
  })

  it("uses the injected clock to resolve active and Expired Links deterministically", async () => {
    let now = new Date("2026-05-16T12:00:00.000Z")
    const repository = createMemoryLinkRepository()
    const links = createLinkLifecycle({
      repository,
      validateDestination,
      slugAllocator: createSlugAllocator({
        repository,
        randomBase62: () => "a1B2c3",
      }),
      clock: {
        now: () => now,
      },
    })

    await links.create({
      destination: "https://docs.example.com/deck",
      expiresAt: new Date("2026-05-16T13:00:00.000Z"),
    })

    await expect(links.resolve("a1B2c3")).resolves.toEqual({
      status: "redirect",
      destination: "https://docs.example.com/deck",
    })

    now = new Date("2026-05-16T13:00:00.000Z")

    await expect(links.resolve("a1B2c3")).resolves.toEqual({
      status: "expired",
    })

    now = new Date("2026-05-16T12:30:00.000Z")

    await expect(links.resolve("a1B2c3")).resolves.toEqual({
      status: "redirect",
      destination: "https://docs.example.com/deck",
    })
  })

  it("creates an anonymous Link with a custom Slug and matches it case-insensitively", async () => {
    const repository = createMemoryLinkRepository()
    const links = createLinkLifecycle({
      repository,
      validateDestination,
      slugAllocator: createSlugAllocator({
        repository,
        randomBase62: () => "a1B2c3",
      }),
    })

    const created = await links.create({
      destination: "https://docs.example.com/roadmap",
      slug: "Roadmap-2026",
    })

    expect(created).toEqual({
      status: "created",
      link: expect.objectContaining({
        slug: "Roadmap-2026",
        slugKey: "roadmap-2026",
      }),
    })

    await expect(links.resolve("roadmap-2026")).resolves.toEqual({
      status: "redirect",
      destination: "https://docs.example.com/roadmap",
    })
  })

  it("returns a predictable not-found result for an unknown Slug", async () => {
    const repository = createMemoryLinkRepository()
    const links = createLinkLifecycle({
      repository,
      validateDestination,
      slugAllocator: createSlugAllocator({
        repository,
        randomBase62: () => "a1B2c3",
      }),
    })

    await expect(links.resolve("missing")).resolves.toEqual({
      status: "not_found",
    })
  })

  it("rejects non-http destinations before reserving a Slug", async () => {
    const repository = createMemoryLinkRepository()
    const links = createLinkLifecycle({
      repository,
      validateDestination,
      slugAllocator: createSlugAllocator({
        repository,
        randomBase62: () => "a1B2c3",
      }),
    })

    await expect(links.create({ destination: "mailto:ops@example.com" })).resolves.toEqual({
      status: "rejected",
      reason: "unsupported_scheme",
    })
  })

  it("rejects an invalid custom Slug with a specific reason", async () => {
    const repository = createMemoryLinkRepository()
    const links = createLinkLifecycle({
      repository,
      validateDestination,
      slugAllocator: createSlugAllocator({
        repository,
        randomBase62: () => "a1B2c3",
      }),
    })

    await expect(
      links.create({
        destination: "https://docs.example.com/deck",
        slug: "bad slug",
      }),
    ).resolves.toEqual({
      status: "rejected",
      reason: "slug_invalid_characters",
    })
  })

  it("rejects a custom Slug outside the allowed length", async () => {
    const repository = createMemoryLinkRepository()
    const links = createLinkLifecycle({
      repository,
      validateDestination,
      slugAllocator: createSlugAllocator({
        repository,
        randomBase62: () => "a1B2c3",
      }),
    })

    await expect(
      links.create({
        destination: "https://docs.example.com/deck",
        slug: "ab",
      }),
    ).resolves.toEqual({
      status: "rejected",
      reason: "slug_too_short",
    })
  })

  it("rejects a custom Slug longer than 64 characters", async () => {
    const repository = createMemoryLinkRepository()
    const links = createLinkLifecycle({
      repository,
      validateDestination,
      slugAllocator: createSlugAllocator({
        repository,
        randomBase62: () => "a1B2c3",
      }),
    })

    await expect(
      links.create({
        destination: "https://docs.example.com/deck",
        slug: "a".repeat(65),
      }),
    ).resolves.toEqual({
      status: "rejected",
      reason: "slug_too_long",
    })
  })

  it("rejects a custom Slug already used by a live Link", async () => {
    const repository = createMemoryLinkRepository()
    await repository.insert({
      slug: "Roadmap",
      slugKey: "roadmap",
      destination: "https://docs.example.com/existing",
      ownerMemberId: null,
    })

    const links = createLinkLifecycle({
      repository,
      validateDestination,
      slugAllocator: createSlugAllocator({
        repository,
        randomBase62: () => "a1B2c3",
      }),
    })

    await expect(
      links.create({
        destination: "https://docs.example.com/new",
        slug: "roadmap",
      }),
    ).resolves.toEqual({
      status: "rejected",
      reason: "slug_taken",
    })
  })

  it("rejects a custom Slug that belongs to a Tombstone", async () => {
    const repository = createMemoryLinkRepository([
      {
        slug: "old-deck",
        slugKey: "old-deck",
        destination: "https://docs.example.com/old",
        ownerMemberId: null,
        lifecycleState: "tombstoned",
      },
    ])

    const links = createLinkLifecycle({
      repository,
      validateDestination,
      slugAllocator: createSlugAllocator({
        repository,
        randomBase62: () => "a1B2c3",
      }),
    })

    await expect(
      links.create({
        destination: "https://docs.example.com/new",
        slug: "OLD-DECK",
      }),
    ).resolves.toEqual({
      status: "rejected",
      reason: "slug_taken",
    })
  })

  it("resolves a Tombstoned Link to a no-longer-available result", async () => {
    const repository = createMemoryLinkRepository([
      {
        slug: "old-deck",
        slugKey: "old-deck",
        destination: "https://docs.example.com/old",
        ownerMemberId: null,
        lifecycleState: "tombstoned",
      },
    ])
    const links = createLinkLifecycle({
      repository,
      validateDestination,
      slugAllocator: createSlugAllocator({
        repository,
        randomBase62: () => "a1B2c3",
      }),
    })

    await expect(links.resolve("old-deck")).resolves.toEqual({
      status: "tombstoned",
    })
  })

  it("tries another base62 Slug when the first generated Slug is already reserved", async () => {
    const repository = createMemoryLinkRepository()
    await repository.insert({
      slug: "a1B2c3",
      slugKey: "a1b2c3",
      destination: "https://docs.example.com/existing",
      ownerMemberId: null,
    })

    const generated = ["a1B2c3", "d4E5f6"]
    const links = createLinkLifecycle({
      repository,
      validateDestination,
      slugAllocator: createSlugAllocator({
        repository,
        randomBase62: () => generated.shift() ?? "z9Y8x7",
      }),
    })

    const created = await links.create({
      destination: "https://docs.example.com/new",
    })

    expect(created).toEqual({
      status: "created",
      link: expect.objectContaining({
        slug: "d4E5f6",
        slugKey: "d4e5f6",
      }),
    })
  })
})
