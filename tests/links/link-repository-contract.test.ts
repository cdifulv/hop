import { afterAll, beforeAll, describe, expect, it } from "vitest"

import type { LinkRepository } from "../../server/links/link-lifecycle"
import { createMemoryLinkRepository } from "../support/memory-link-repository"

/**
 * One contract suite, parametrised over every `LinkRepository` adapter, that
 * pins the ADR-0003 Slug-retirement law so the in-memory fake can never again
 * drift from the Drizzle adapter on this exact boundary (plan #4):
 *
 *   after `tombstoneBySlugKey(slug)` →
 *     • `slugKeyExists(slug)` stays `true` (the Slug stays reserved)
 *     • `findBySlugKey(slug)` returns a `tombstoned` record
 *     • Tombstone is terminal: no transition leads back out of it
 *
 * The memory adapter always runs; the Drizzle adapter runs only when
 * DATABASE_URL is set (and is expected to point at a migrated database, like
 * the migration smoke test).
 */

const databaseUrl = process.env.DATABASE_URL

interface AdapterHarness {
  repository: LinkRepository
  teardown(): Promise<void>
}

interface Adapter {
  name: string
  enabled: boolean
  setup(slugKey: string): Promise<AdapterHarness>
}

const adapters: Adapter[] = [
  {
    name: "memory",
    enabled: true,
    async setup() {
      return {
        repository: createMemoryLinkRepository(),
        async teardown() {},
      }
    },
  },
  {
    name: "drizzle",
    enabled: Boolean(databaseUrl),
    async setup(slugKey) {
      const { createDrizzleLinkRepository } = await import(
        "../../server/links/drizzle-link-repository"
      )
      const { db } = await import("../../server/db")
      const { links } = await import("../../server/db/schema/hop")
      const { eq } = await import("drizzle-orm")

      return {
        repository: createDrizzleLinkRepository(),
        async teardown() {
          await db.delete(links).where(eq(links.slugKey, slugKey))
        },
      }
    },
  },
]

for (const adapter of adapters) {
  const runAdapter = adapter.enabled ? describe : describe.skip

  runAdapter(`LinkRepository contract — ${adapter.name} adapter`, () => {
    const slugKey = `contract-tombstone-${adapter.name}`
    let harness: AdapterHarness

    beforeAll(async () => {
      harness = await adapter.setup(slugKey)
      await harness.teardown()
      await harness.repository.insert({
        slug: slugKey,
        slugKey,
        destination: "https://docs.example.com/contract",
        expiresAt: null,
        ownerMemberId: null,
      })
    })

    afterAll(async () => {
      await harness?.teardown()
    })

    it("keeps the Slug reserved and the record Tombstoned after tombstoneBySlugKey", async () => {
      const tombstoned = await harness.repository.tombstoneBySlugKey(slugKey)

      expect(tombstoned?.lifecycleState).toBe("tombstoned")
      await expect(harness.repository.slugKeyExists(slugKey)).resolves.toBe(true)

      const found = await harness.repository.findBySlugKey(slugKey)
      expect(found?.lifecycleState).toBe("tombstoned")
    })

    it("treats Tombstone as terminal — no transition leads back out", async () => {
      await harness.repository.tombstoneBySlugKey(slugKey)

      await expect(
        harness.repository.suspendBySlugKey(slugKey),
      ).resolves.toBeNull()
      await expect(
        harness.repository.unsuspendBySlugKey(slugKey),
      ).resolves.toBeNull()
      await expect(
        harness.repository.updateExpirationBySlugKey(slugKey, new Date()),
      ).resolves.toBeNull()

      const found = await harness.repository.findBySlugKey(slugKey)
      expect(found?.lifecycleState).toBe("tombstoned")

      // Idempotent: re-tombstoning a Tombstone stays Tombstoned.
      const reTombstoned = await harness.repository.tombstoneBySlugKey(slugKey)
      expect(reTombstoned?.lifecycleState).toBe("tombstoned")
    })
  })
}
