import { count, eq, lt } from "drizzle-orm"

import { db } from "../db"
import { clickEvents } from "../db/schema/hop"
import type {
  ClickEventRecord,
  ClickEventRepository,
} from "./click-recorder"

export function createDrizzleClickEventRepository(): ClickEventRepository {
  return {
    async insert(input) {
      const [event] = await db
        .insert(clickEvents)
        .values({
          linkId: input.linkId,
          occurredAt: input.occurredAt,
          coarseReferrer: input.coarseReferrer,
          userAgentFamily: input.userAgentFamily,
        })
        .returning()

      if (!event) {
        throw new Error("Click event insert did not return a row")
      }

      return toClickEventRecord(event)
    },
    async countForLink(linkId) {
      const [row] = await db
        .select({ value: count() })
        .from(clickEvents)
        .where(eq(clickEvents.linkId, linkId))

      return row?.value ?? 0
    },
    async prune(before) {
      const deleted = await db
        .delete(clickEvents)
        .where(lt(clickEvents.occurredAt, before))
        .returning({ id: clickEvents.id })

      return deleted.length
    },
  }
}

function toClickEventRecord(
  event: typeof clickEvents.$inferSelect,
): ClickEventRecord {
  return {
    id: event.id,
    linkId: event.linkId,
    occurredAt: event.occurredAt,
    coarseReferrer: event.coarseReferrer,
    userAgentFamily: event.userAgentFamily,
  }
}
