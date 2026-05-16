import type {
  CreateLinkInput,
  LinkRecord,
  LinkRepository,
} from "../../server/links/link-lifecycle"

export function createMemoryLinkRepository(): LinkRepository {
  const links = new Map<string, LinkRecord>()

  return {
    async slugKeyExists(slugKey) {
      return links.has(slugKey)
    },
    async insert(input: CreateLinkInput) {
      const now = new Date("2026-05-16T00:00:00.000Z")
      const link: LinkRecord = {
        id: `link-${links.size + 1}`,
        slug: input.slug,
        slugKey: input.slugKey,
        destination: input.destination,
        ownerMemberId: input.ownerMemberId,
        lifecycleState: "active",
        createdAt: now,
        updatedAt: now,
      }

      links.set(input.slugKey, link)
      return link
    },
    async findBySlugKey(slugKey) {
      return links.get(slugKey) ?? null
    },
  }
}
