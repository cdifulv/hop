import { eq } from "drizzle-orm"

import { db } from "../db"
import { links } from "../db/schema/hop"
import type { LinkRecord, LinkRepository } from "./link-lifecycle"

export function createDrizzleLinkRepository(): LinkRepository {
  return {
    async slugKeyExists(slugKey) {
      const [link] = await db
        .select({ id: links.id })
        .from(links)
        .where(eq(links.slugKey, slugKey))
        .limit(1)

      return Boolean(link)
    },
    async insert(input) {
      const [link] = await db
        .insert(links)
        .values({
          slug: input.slug,
          slugKey: input.slugKey,
          destination: input.destination,
          expiresAt: input.expiresAt ?? null,
          ownerMemberId: input.ownerMemberId,
        })
        .returning()

      if (!link) {
        throw new Error("Link insert did not return a row")
      }

      return toLinkRecord(link)
    },
    async findBySlugKey(slugKey) {
      const [link] = await db
        .select()
        .from(links)
        .where(eq(links.slugKey, slugKey))
        .limit(1)

      return link ? toLinkRecord(link) : null
    },
    async findById(id) {
      const [link] = await db.select().from(links).where(eq(links.id, id)).limit(1)

      return link ? toLinkRecord(link) : null
    },
    async tombstoneBySlugKey(slugKey) {
      const [link] = await db
        .update(links)
        .set({
          lifecycleState: "tombstoned",
          tombstonedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(links.slugKey, slugKey))
        .returning()

      return link ? toLinkRecord(link) : null
    },
  }
}

export function toLinkRecord(link: typeof links.$inferSelect): LinkRecord {
  return {
    id: link.id,
    slug: link.slug,
    slugKey: link.slugKey,
    destination: link.destination,
    expiresAt: link.expiresAt,
    ownerMemberId: link.ownerMemberId,
    lifecycleState: link.lifecycleState,
    createdAt: link.createdAt,
    updatedAt: link.updatedAt,
  }
}
