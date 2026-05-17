import { describe, expect, it } from "vitest"

import { createClickRecorder } from "../../server/links/click-recorder"
import { createDestinationValidator } from "../../server/links/destination-validator"
import { createLinkLifecycle } from "../../server/links/link-lifecycle"
import { createSlugAllocator } from "../../server/links/slug-allocator"
import { createMemoryClickEventRepository } from "../support/memory-click-event-repository"
import { createMemoryLinkRepository } from "../support/memory-link-repository"

const validateDestination = createDestinationValidator({
  async resolve() {
    return ["93.184.216.34"]
  },
}).validate

describe("Click events on Link resolution", () => {
  it("records a Click event only for a successful redirect", async () => {
    const linkRepository = createMemoryLinkRepository([
      {
        slug: "suspended",
        slugKey: "suspended",
        destination: "https://docs.example.com/suspended",
        ownerMemberId: null,
        lifecycleState: "suspended",
      },
      {
        slug: "deleted",
        slugKey: "deleted",
        destination: "https://docs.example.com/deleted",
        ownerMemberId: null,
        lifecycleState: "tombstoned",
      },
    ])
    const clickRepository = createMemoryClickEventRepository()
    const clicks = createClickRecorder({
      repository: clickRepository,
      clock: {
        now: () => new Date("2026-05-16T12:00:00.000Z"),
      },
    })
    const links = createLinkLifecycle({
      repository: linkRepository,
      validateDestination,
      slugAllocator: createSlugAllocator({
        repository: linkRepository,
        randomBase62: () => "a1B2c3",
      }),
      clickRecorder: clicks,
      clock: {
        now: () => new Date("2026-05-16T12:00:00.000Z"),
      },
    })

    const created = await links.create({
      destination: "https://docs.example.com/deck",
      expiresAt: new Date("2026-05-16T13:00:00.000Z"),
      ownerMemberId: "member-1",
    })

    if (created.status !== "created") {
      throw new Error("expected Link creation to succeed")
    }

    await links.resolve("a1B2c3", {
      referrer: "https://ref.example.com/path?token=secret",
      userAgent: "Mozilla/5.0 Firefox/125.0",
      ip: "203.0.113.10",
    })
    await links.resolve("missing", {})
    await links.resolve("suspended", {})
    await links.resolve("deleted", {})

    await links.updateMemberLinkExpiration(
      { id: "member-1" },
      "a1B2c3",
      new Date("2026-05-16T11:00:00.000Z"),
    )
    await links.resolve("a1B2c3", {})

    expect(await clicks.countFor(created.link)).toBe(1)
  })

  it("does not block or fail a redirect when the Click write is slow or fails", async () => {
    const linkRepository = createMemoryLinkRepository()
    let releaseWrite: () => void = () => {}
    let markWriteStarted: () => void = () => {}
    const writeStarted = new Promise<void>((resolve) => {
      markWriteStarted = resolve
    })
    const clickRecorder = {
      async record() {
        markWriteStarted()
        await new Promise<void>((release) => {
          releaseWrite = release
        })
        throw new Error("analytics unavailable")
      },
    }
    const links = createLinkLifecycle({
      repository: linkRepository,
      validateDestination,
      slugAllocator: createSlugAllocator({
        repository: linkRepository,
        randomBase62: () => "a1B2c3",
      }),
      clickRecorder,
    })

    await links.create({ destination: "https://docs.example.com/deck" })

    await expect(links.resolve("a1B2c3", {})).resolves.toEqual({
      status: "redirect",
      destination: "https://docs.example.com/deck",
    })
    await writeStarted
    releaseWrite()
  })
})
