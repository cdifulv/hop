import { and, desc, eq, ilike, ne, or, sql } from "drizzle-orm"

import { db } from "../db"
import { clickEvents, links } from "../db/schema/hop"
import type {
  DashboardLinkRecord,
  LinkRecord,
  LinkRepository,
  ListMemberLinksOptions,
} from "./link-lifecycle"

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
    async listForMember(memberId, options = {}) {
      const search = memberLinkSearch(options)
      const rows = await db
        .select({
          link: links,
          clickCount: sql<number>`count(${clickEvents.id})::int`,
        })
        .from(links)
        .leftJoin(clickEvents, eq(clickEvents.linkId, links.id))
        .where(and(eq(links.ownerMemberId, memberId), search))
        .groupBy(links.id)
        .orderBy(...memberLinkOrder(options))

      return rows
        .map((row): DashboardLinkRecord => ({
          ...toLinkRecord(row.link),
          clickCount: row.clickCount,
        }))
        .filter((link) => link.lifecycleState !== "tombstoned")
    },
    async listAll(options = {}) {
      const search = memberLinkSearch(options)
      const rows = await db
        .select({
          link: links,
          clickCount: sql<number>`count(${clickEvents.id})::int`,
        })
        .from(links)
        .leftJoin(clickEvents, eq(clickEvents.linkId, links.id))
        .where(search)
        .groupBy(links.id)
        .orderBy(...memberLinkOrder(options))

      return rows.map((row): DashboardLinkRecord => ({
        ...toLinkRecord(row.link),
        clickCount: row.clickCount,
      }))
    },
    async updateExpirationBySlugKey(slugKey, expiresAt) {
      const [link] = await db
        .update(links)
        .set({
          expiresAt,
          updatedAt: new Date(),
        })
        .where(
          and(eq(links.slugKey, slugKey), ne(links.lifecycleState, "tombstoned")),
        )
        .returning()

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
    async suspendBySlugKey(slugKey, source) {
      const now = new Date()
      const [link] = await db
        .update(links)
        .set({
          lifecycleState: "suspended",
          suspendedAt: now,
          directSuspendedByMemberId: source.adminMemberId,
          directSuspendedAt: source.suspendedAt,
          updatedAt: now,
        })
        .where(
          and(eq(links.slugKey, slugKey), ne(links.lifecycleState, "tombstoned")),
        )
        .returning()

      return link ? toLinkRecord(link) : null
    },
    async suspendByOwnerMemberId(memberId, source) {
      const now = new Date()
      const suspended = await db
        .update(links)
        .set({
          lifecycleState: "suspended",
          suspendedAt: now,
          ownerSuspendedByMemberId: source.adminMemberId,
          ownerSuspendedAt: source.suspendedAt,
          updatedAt: now,
        })
        .where(
          and(eq(links.ownerMemberId, memberId), ne(links.lifecycleState, "tombstoned")),
        )
        .returning()

      return suspended.map(toLinkRecord)
    },
    async unsuspendBySlugKey(slugKey) {
      const now = new Date()
      const [link] = await db
        .update(links)
        .set({
          lifecycleState: sql`case when ${links.ownerSuspendedAt} is null then 'active'::link_lifecycle_state else 'suspended'::link_lifecycle_state end`,
          suspendedAt: sql`case when ${links.ownerSuspendedAt} is null then null else ${links.ownerSuspendedAt} end`,
          directSuspendedByMemberId: null,
          directSuspendedAt: null,
          updatedAt: now,
        })
        .where(
          and(eq(links.slugKey, slugKey), ne(links.lifecycleState, "tombstoned")),
        )
        .returning()

      return link ? toLinkRecord(link) : null
    },
    async unsuspendByOwnerMemberId(memberId) {
      const now = new Date()
      const unsuspended = await db
        .update(links)
        .set({
          lifecycleState: sql`case when ${links.directSuspendedAt} is null then 'active'::link_lifecycle_state else 'suspended'::link_lifecycle_state end`,
          suspendedAt: sql`case when ${links.directSuspendedAt} is null then null else ${links.directSuspendedAt} end`,
          ownerSuspendedByMemberId: null,
          ownerSuspendedAt: null,
          updatedAt: now,
        })
        .where(
          and(eq(links.ownerMemberId, memberId), ne(links.lifecycleState, "tombstoned")),
        )
        .returning()

      return unsuspended.map(toLinkRecord)
    },
  }
}

function memberLinkSearch(options: ListMemberLinksOptions) {
  const search = options.search?.trim()

  if (!search) {
    return undefined
  }

  const pattern = `%${escapeLike(search)}%`

  return or(ilike(links.slug, pattern), ilike(links.destination, pattern))
}

function memberLinkOrder(options: ListMemberLinksOptions) {
  const recentOrder = desc(links.createdAt)

  if (options.sort === "clicks") {
    return [desc(sql<number>`count(${clickEvents.id})::int`), recentOrder]
  }

  return [recentOrder]
}

function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, (character) => `\\${character}`)
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
    suspension: {
      direct:
        link.directSuspendedByMemberId && link.directSuspendedAt
          ? {
              adminMemberId: link.directSuspendedByMemberId,
              suspendedAt: link.directSuspendedAt,
            }
          : null,
      owner:
        link.ownerSuspendedByMemberId && link.ownerSuspendedAt
          ? {
              adminMemberId: link.ownerSuspendedByMemberId,
              suspendedAt: link.ownerSuspendedAt,
            }
          : null,
    },
    createdAt: link.createdAt,
    updatedAt: link.updatedAt,
  }
}
