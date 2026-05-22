import { describe, expect, it } from "vitest"

import {
  CLICK_EVENT_RETENTION_DAYS,
  clickRetentionBoundary,
  createClickRecorder,
} from "../../server/links/click-recorder"
import type { LinkRecord } from "../../server/links/link-lifecycle"
import { createMemoryClickEventRepository } from "../support/memory-click-event-repository"

const link: LinkRecord = {
  id: "link-1",
  slug: "deck",
  slugKey: "deck",
  destination: "https://docs.example.com/deck",
  expiresAt: null,
  ownerMemberId: "member-1",
  lifecycleState: "active",
  suspension: {
    direct: null,
    owner: null,
  },
  createdAt: new Date("2026-05-16T00:00:00.000Z"),
  updatedAt: new Date("2026-05-16T00:00:00.000Z"),
}

describe("Click recorder", () => {
  it("records only timestamp, coarse referrer, and user-agent family", async () => {
    const repository = createMemoryClickEventRepository()
    const clicks = createClickRecorder({
      repository,
      clock: {
        now: () => new Date("2026-05-16T12:00:00.000Z"),
      },
    })

    const event = await clicks.record(link, {
      referrer: "https://alice@example.com/campaign?email=alice@example.com",
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36",
      ip: "203.0.113.10",
    })

    expect(event).toEqual({
      id: "click-1",
      linkId: "link-1",
      occurredAt: new Date("2026-05-16T12:00:00.000Z"),
      coarseReferrer: "example.com",
      userAgentFamily: "Chrome",
    })
  })

  it("derives counts by aggregating recorded Click events", async () => {
    const repository = createMemoryClickEventRepository()
    const clicks = createClickRecorder({ repository })

    await clicks.record(link, {})
    await clicks.record(link, {})

    expect(await clicks.countFor(link)).toBe(2)
  })

  it("prunes only Click events older than the retention boundary", async () => {
    const repository = createMemoryClickEventRepository()
    let now = new Date("2026-05-16T12:00:00.000Z")
    const clicks = createClickRecorder({
      repository,
      clock: {
        now: () => now,
      },
    })

    await clicks.record(link, {})
    now = new Date("2026-05-17T12:00:00.000Z")
    await clicks.record(link, {})
    now = new Date("2026-05-18T12:00:00.000Z")
    await clicks.record(link, {})

    const boundary = clickRetentionBoundary(
      new Date("2027-05-17T12:00:00.000Z"),
      CLICK_EVENT_RETENTION_DAYS,
    )
    const pruned = await clicks.prune(boundary)

    expect(pruned).toBe(1)
    expect(await clicks.countFor(link)).toBe(2)
  })
})
