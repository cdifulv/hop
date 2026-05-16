import type {
  CreateLinkInput,
  LinkRecord,
  LinkRepository,
} from "../../server/links/link-lifecycle"

type MemoryLinkSeed = CreateLinkInput & {
  lifecycleState?: LinkRecord["lifecycleState"]
}

export function createMemoryLinkRepository(seeds: MemoryLinkSeed[] = []): LinkRepository {
  const links = new Map<string, LinkRecord>()
  const now = new Date("2026-05-16T00:00:00.000Z")

  function addLink(input: MemoryLinkSeed, index: number) {
    const link: LinkRecord = {
      id: `link-${index + 1}`,
      slug: input.slug,
      slugKey: input.slugKey,
      destination: input.destination,
      ownerMemberId: input.ownerMemberId,
      lifecycleState: input.lifecycleState ?? "active",
      createdAt: now,
      updatedAt: now,
    }

    links.set(input.slugKey, link)
    return link
  }

  seeds.forEach((seed, index) => addLink(seed, index))

  return {
    async slugKeyExists(slugKey) {
      return links.has(slugKey)
    },
    async insert(input: CreateLinkInput) {
      return addLink(input, links.size)
    },
    async findBySlugKey(slugKey) {
      return links.get(slugKey) ?? null
    },
  }
}
