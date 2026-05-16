import { describe, expect, it } from "vitest"

import { validateDestination } from "../../server/links/destination-validator"
import { createLinkLifecycle } from "../../server/links/link-lifecycle"
import { createSlugAllocator } from "../../server/links/slug-allocator"
import { createMemoryLinkRepository } from "../support/memory-link-repository"

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
