import { createHash } from "node:crypto"

import { and, desc, eq, isNull } from "drizzle-orm"

import { db } from "../db"
import { browserSessionLinks, browserSessions, links } from "../db/schema/hop"
import type { BrowserSessionRepository } from "./link-lifecycle"
import { toLinkRecord } from "./drizzle-link-repository"

export function createDrizzleBrowserSessionRepository(): BrowserSessionRepository {
  return {
    async track(token, linkId) {
      const session = await findOrCreateSession(hashToken(token))

      await db
        .insert(browserSessionLinks)
        .values({
          browserSessionId: session.id,
          linkId,
        })
        .onConflictDoNothing({
          target: [browserSessionLinks.browserSessionId, browserSessionLinks.linkId],
        })
    },
    async listLinks(token) {
      const rows = await db
        .select({ link: links })
        .from(browserSessionLinks)
        .innerJoin(browserSessions, eq(browserSessionLinks.browserSessionId, browserSessions.id))
        .innerJoin(links, eq(browserSessionLinks.linkId, links.id))
        .where(
          and(
            eq(browserSessions.tokenHash, hashToken(token)),
            isNull(links.ownerMemberId),
            eq(links.lifecycleState, "active"),
          ),
        )
        .orderBy(desc(links.createdAt))

      return rows.map((row) => toLinkRecord(row.link))
    },
    async tombstoneLink(token, slugKey) {
      const [row] = await db
        .select({ link: links })
        .from(browserSessionLinks)
        .innerJoin(browserSessions, eq(browserSessionLinks.browserSessionId, browserSessions.id))
        .innerJoin(links, eq(browserSessionLinks.linkId, links.id))
        .where(
          and(
            eq(browserSessions.tokenHash, hashToken(token)),
            eq(links.slugKey, slugKey),
            isNull(links.ownerMemberId),
            eq(links.lifecycleState, "active"),
          ),
        )
        .limit(1)

      if (!row) {
        return null
      }

      const now = new Date()
      const [link] = await db
        .update(links)
        .set({
          lifecycleState: "tombstoned",
          tombstonedAt: now,
          updatedAt: now,
        })
        .where(eq(links.id, row.link.id))
        .returning()

      return link ? toLinkRecord(link) : null
    },
  }
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex")
}

async function findOrCreateSession(tokenHash: string) {
  const [created] = await db
    .insert(browserSessions)
    .values({ tokenHash })
    .onConflictDoNothing({
      target: browserSessions.tokenHash,
    })
    .returning()

  if (created) {
    return created
  }

  const [existing] = await db
    .select()
    .from(browserSessions)
    .where(eq(browserSessions.tokenHash, tokenHash))
    .limit(1)

  if (!existing) {
    throw new Error("Browser session insert did not return a row")
  }

  return existing
}
