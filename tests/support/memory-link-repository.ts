import type {
  BrowserSessionRepository,
  CreateLinkInput,
  ListMemberLinksOptions,
  LinkRecord,
  LinkRepository,
} from "../../server/links/link-lifecycle"

type MemoryLinkSeed = CreateLinkInput & {
  lifecycleState?: LinkRecord["lifecycleState"]
  clickCount?: number
  createdAt?: Date
}

type MutableMemoryLinkRepository = LinkRepository & {
  replace(link: LinkRecord): void
  retireBySlugKey(slugKey: string): Promise<LinkRecord | null>
}

export function createMemoryLinkRepository(
  seeds: MemoryLinkSeed[] = [],
): MutableMemoryLinkRepository {
  const links = new Map<string, LinkRecord>()
  const retiredSlugKeys = new Set<string>()
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
      createdAt: input.createdAt ?? now,
      updatedAt: now,
    }

    links.set(input.slugKey, link)
    return link
  }

  seeds.forEach((seed, index) => addLink(seed, index))

  return {
    async slugKeyExists(slugKey) {
      return links.has(slugKey) || retiredSlugKeys.has(slugKey)
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
    async listForMember(memberId: string, options: ListMemberLinksOptions = {}) {
      return [...links.values()]
        .filter(
          (link) => link.ownerMemberId === memberId && link.lifecycleState !== "tombstoned",
        )
        .filter((link) => matchesSearch(link, options.search))
        .map((link) => withClickCount(link, seeds))
        .sort((left, right) => compareDashboardLinks(left, right, options))
    },
    async listAll(options: ListMemberLinksOptions = {}) {
      return [...links.values()]
        .filter((link) => matchesSearch(link, options.search))
        .map((link) => withClickCount(link, seeds))
        .sort((left, right) => compareDashboardLinks(left, right, options))
    },
    async updateExpirationBySlugKey(slugKey: string, expiresAt: Date | null) {
      const link = links.get(slugKey)

      if (!link) {
        return null
      }

      const updated: LinkRecord = {
        ...link,
        expiresAt,
        updatedAt: now,
      }

      links.set(slugKey, updated)
      return updated
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
    async retireBySlugKey(slugKey: string) {
      const link = links.get(slugKey)

      if (!link) {
        return null
      }

      const tombstoned: LinkRecord = {
        ...link,
        lifecycleState: "tombstoned",
        updatedAt: now,
      }

      links.delete(slugKey)
      retiredSlugKeys.add(slugKey)
      return tombstoned
    },
    replace(link) {
      links.set(link.slugKey, link)
    },
  }
}

function withClickCount(link: LinkRecord, seeds: MemoryLinkSeed[]) {
  return {
    ...link,
    clickCount: seeds.find((seed) => seed.slugKey === link.slugKey)?.clickCount ?? 0,
  }
}

function compareDashboardLinks(
  left: LinkRecord & { clickCount: number },
  right: LinkRecord & { clickCount: number },
  options: ListMemberLinksOptions,
) {
  if (options.sort === "clicks") {
    const clickOrder = right.clickCount - left.clickCount

    if (clickOrder !== 0) {
      return clickOrder
    }
  }

  return right.createdAt.getTime() - left.createdAt.getTime()
}

function matchesSearch(link: LinkRecord, search?: string) {
  const query = search?.trim().toLowerCase()

  if (!query) {
    return true
  }

  return [
    link.slug,
    destinationHost(link.destination),
    link.destination,
  ].some((value) => value.toLowerCase().includes(query))
}

function destinationHost(destination: string) {
  try {
    return new URL(destination).host
  } catch {
    return destination
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
    async claimLinks(token, memberId) {
      const links = await listLinks(token)

      return links.map((link) => {
        const claimed: LinkRecord = {
          ...link,
          ownerMemberId: memberId,
          updatedAt: new Date("2026-05-16T00:00:00.000Z"),
        }

        linkRepository.replace(claimed)
        return claimed
      })
    },
    async tombstoneLink(token, slugKey) {
      const links = await listLinks(token)
      const link = links.find((link) => link.slugKey === slugKey)

      if (!link) {
        return null
      }

      return linkRepository.retireBySlugKey(slugKey)
    },
  }
}
