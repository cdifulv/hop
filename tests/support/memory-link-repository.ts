import type {
  BrowserSessionRepository,
  CreateLinkInput,
  LinkSuspensionSource,
  ListMemberLinksOptions,
  LinkRecord,
  LinkRepository,
} from "../../server/links/link-lifecycle"

type MemoryLinkSeed = CreateLinkInput & {
  lifecycleState?: LinkRecord["lifecycleState"]
  suspension?: Partial<LinkRecord["suspension"]>
  clickCount?: number
  createdAt?: Date
}

// Sibling in-memory fakes (the Browser-session repository) need to coordinate
// over the same Link store. The store is exposed only through this
// module-private symbol so the returned value still satisfies *only* the
// `LinkRepository` interface for every external consumer — the off-interface
// `retireBySlugKey`/`retiredSlugKeys`/`replace` escape hatches are gone, so the
// fake can no longer diverge from the Drizzle adapter on the ADR-0003
// Slug-retirement boundary (plan #4).
const linkStore = Symbol("memoryLinkStore")

interface MemoryLinkStore {
  [linkStore]: Map<string, LinkRecord>
}

export function createMemoryLinkRepository(
  seeds: MemoryLinkSeed[] = [],
): LinkRepository {
  const links = new Map<string, LinkRecord>()
  const now = new Date("2026-05-16T00:00:00.000Z")

  function addLink(input: MemoryLinkSeed, index: number) {
    const suspension = {
      direct: input.suspension?.direct ?? null,
      owner: input.suspension?.owner ?? null,
    }
    const link: LinkRecord = {
      id: `link-${index + 1}`,
      slug: input.slug,
      slugKey: input.slugKey,
      destination: input.destination,
      expiresAt: input.expiresAt ?? null,
      ownerMemberId: input.ownerMemberId,
      lifecycleState:
        input.lifecycleState ??
        (suspension.direct || suspension.owner ? "suspended" : "active"),
      suspension,
      createdAt: input.createdAt ?? now,
      updatedAt: now,
    }

    links.set(input.slugKey, link)
    return link
  }

  seeds.forEach((seed, index) => addLink(seed, index))

  const repository: LinkRepository & MemoryLinkStore = {
    [linkStore]: links,
    async slugKeyExists(slugKey) {
      // A Tombstoned Link keeps its row (ADR-0003: the Slug stays reserved),
      // exactly like the Drizzle adapter — no separate retired-Slug set.
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

      if (!link || link.lifecycleState === "tombstoned") {
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
    async suspendBySlugKey(slugKey: string, source: LinkSuspensionSource) {
      const link = links.get(slugKey)

      if (!link || link.lifecycleState === "tombstoned") {
        return null
      }

      const suspended: LinkRecord = {
        ...link,
        lifecycleState: "suspended",
        suspension: {
          ...link.suspension,
          direct: source,
        },
        updatedAt: now,
      }

      links.set(slugKey, suspended)
      return suspended
    },
    async suspendByOwnerMemberId(memberId: string, source: LinkSuspensionSource) {
      const suspended: LinkRecord[] = []

      for (const link of links.values()) {
        if (
          link.ownerMemberId !== memberId ||
          link.lifecycleState === "tombstoned"
        ) {
          continue
        }

        const updated: LinkRecord = {
          ...link,
          lifecycleState: "suspended",
          suspension: {
            ...link.suspension,
            owner: source,
          },
          updatedAt: now,
        }

        links.set(link.slugKey, updated)
        suspended.push(updated)
      }

      return suspended
    },
    async unsuspendBySlugKey(slugKey: string) {
      const link = links.get(slugKey)

      if (!link || link.lifecycleState === "tombstoned") {
        return null
      }

      const active: LinkRecord = {
        ...link,
        lifecycleState: link.suspension.owner ? "suspended" : "active",
        suspension: {
          ...link.suspension,
          direct: null,
        },
        updatedAt: now,
      }

      links.set(slugKey, active)
      return active
    },
    async unsuspendByOwnerMemberId(memberId: string) {
      const unsuspended: LinkRecord[] = []

      for (const link of links.values()) {
        if (
          link.ownerMemberId !== memberId ||
          link.lifecycleState === "tombstoned"
        ) {
          continue
        }

        const updated: LinkRecord = {
          ...link,
          lifecycleState: link.suspension.direct ? "suspended" : "active",
          suspension: {
            ...link.suspension,
            owner: null,
          },
          updatedAt: now,
        }

        links.set(link.slugKey, updated)
        unsuspended.push(updated)
      }

      return unsuspended
    },
  }

  return repository
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

export function createMemoryBrowserSessionRepository(
  linkRepository: LinkRepository,
): BrowserSessionRepository {
  const links = (linkRepository as LinkRepository & MemoryLinkStore)[linkStore]
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

    const sessionLinkRecords = await Promise.all(
      [...linkIds].map((linkId) => linkRepository.findById(linkId)),
    )

    return sessionLinkRecords.filter(
      (link): link is LinkRecord =>
        link !== null &&
        link.ownerMemberId === null &&
        link.lifecycleState === "active",
    )
  }

  return {
    async track(token, linkId) {
      linksFor(token).add(linkId)
    },
    listLinks,
    async claimLinks(token, memberId) {
      const claimable = await listLinks(token)

      return claimable.map((link) => {
        const claimed: LinkRecord = {
          ...link,
          ownerMemberId: memberId,
          updatedAt: new Date("2026-05-16T00:00:00.000Z"),
        }

        links.set(claimed.slugKey, claimed)
        return claimed
      })
    },
    async tombstoneLink(token, slugKey) {
      // Go through the same `tombstoneBySlugKey` boundary as the Drizzle
      // adapter: the row is kept and marked Tombstoned, the Slug stays
      // reserved (ADR-0003), and resolution reports `tombstoned`.
      const owned = await listLinks(token)

      if (!owned.some((link) => link.slugKey === slugKey)) {
        return null
      }

      return linkRepository.tombstoneBySlugKey(slugKey)
    },
  }
}
