import type {
  BrowserSessionRepository,
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
      expiresAt: input.expiresAt ?? null,
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
    async findById(id: string) {
      return [...links.values()].find((link) => link.id === id) ?? null
    },
    async tombstoneBySlugKey(slugKey: string) {
      const link = links.get(slugKey)

      if (!link) {
        return null
      }

      const tombstoned: LinkRecord = {
        ...link,
        lifecycleState: "tombstoned",
        updatedAt: now,
      }

      links.set(slugKey, tombstoned)
      return tombstoned
    },
  }
}

type MemoryLinkRepository = ReturnType<typeof createMemoryLinkRepository>

export function createMemoryBrowserSessionRepository(
  linkRepository: MemoryLinkRepository,
): BrowserSessionRepository {
  const sessionLinks = new Map<string, Set<string>>()

  function linksFor(token: string) {
    let linkIds = sessionLinks.get(token)

    if (!linkIds) {
      linkIds = new Set<string>()
      sessionLinks.set(token, linkIds)
    }

    return linkIds
  }

  async function listLinks(token: string) {
    const linkIds = sessionLinks.get(token)

    if (!linkIds) {
      return []
    }

    const links = await Promise.all(
      [...linkIds].map((linkId) => linkRepository.findById(linkId)),
    )

    return links.filter(
      (link): link is LinkRecord =>
        Boolean(link) && link.ownerMemberId === null && link.lifecycleState === "active",
    )
  }

  return {
    async track(token, linkId) {
      linksFor(token).add(linkId)
    },
    listLinks,
    async tombstoneLink(token, slugKey) {
      const links = await listLinks(token)
      const link = links.find((link) => link.slugKey === slugKey)

      if (!link) {
        return null
      }

      return linkRepository.tombstoneBySlugKey(slugKey)
    },
  }
}
