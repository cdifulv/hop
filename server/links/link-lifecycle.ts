import type { DestinationValidationResult } from "./destination-validator"
import type { SlugReservation } from "./slug-allocator"

export type LinkLifecycleState = "active" | "suspended" | "tombstoned"

export interface LinkRecord {
  id: string
  slug: string
  slugKey: string
  destination: string
  expiresAt: Date | null
  ownerMemberId: string | null
  lifecycleState: LinkLifecycleState
  createdAt: Date
  updatedAt: Date
}

export interface CreateLinkInput {
  slug: string
  slugKey: string
  destination: string
  expiresAt?: Date | null
  ownerMemberId: string | null
}

export interface LinkRepository {
  slugKeyExists(slugKey: string): Promise<boolean>
  insert(input: CreateLinkInput): Promise<LinkRecord>
  findBySlugKey(slugKey: string): Promise<LinkRecord | null>
  findById(id: string): Promise<LinkRecord | null>
  tombstoneBySlugKey(slugKey: string): Promise<LinkRecord | null>
}

export interface BrowserSessionRepository {
  track(token: string, linkId: string): Promise<void>
  listLinks(token: string): Promise<LinkRecord[]>
  claimLinks(token: string, memberId: string): Promise<LinkRecord[]>
  tombstoneLink(token: string, slugKey: string): Promise<LinkRecord | null>
}

export type CreateLinkResult =
  | {
      status: "created"
      link: LinkRecord
    }
  | {
      status: "rejected"
      reason: DestinationRejectionReason | SlugRejectionReason
    }

export type ResolveLinkResult =
  | {
      status: "redirect"
      destination: string
    }
  | {
      status: "not_found"
    }
  | {
      status: "expired"
    }

type DestinationRejectionReason = Extract<
  DestinationValidationResult,
  { status: "rejected" }
>["reason"]

type SlugRejectionReason = Exclude<
  Extract<SlugReservation, { status: "rejected" }>["reason"],
  "exhausted"
> | "slug_exhausted"

interface LinkLifecycleOptions {
  repository: LinkRepository
  browserSessions?: BrowserSessionRepository
  validateDestination(
    input: string,
  ): DestinationValidationResult | Promise<DestinationValidationResult>
  slugAllocator: {
    reserve(customSlug?: string): Promise<SlugReservation>
  }
  clock?: {
    now(): Date
  }
}

export function createLinkLifecycle(options: LinkLifecycleOptions) {
  const clock = options.clock ?? {
    now: () => new Date(),
  }

  return {
    async create(input: {
      destination: string
      slug?: string
      expiresAt?: Date | null
      browserSessionToken?: string | null
    }): Promise<CreateLinkResult> {
      const destination = await options.validateDestination(input.destination)

      if (destination.status === "rejected") {
        return destination
      }

      const slug = await options.slugAllocator.reserve(input.slug)

      if (slug.status === "rejected") {
        return {
          status: "rejected",
          reason: slug.reason === "exhausted" ? "slug_exhausted" : slug.reason,
        }
      }

      const link = await options.repository.insert({
        slug: slug.slug,
        slugKey: slug.slugKey,
        destination: destination.destination,
        expiresAt: input.expiresAt ?? null,
        ownerMemberId: null,
      })

      if (input.browserSessionToken && options.browserSessions) {
        await options.browserSessions.track(input.browserSessionToken, link.id)
      }

      return {
        status: "created",
        link,
      }
    },
    async listBrowserSessionLinks(token: string): Promise<LinkRecord[]> {
      if (!options.browserSessions) {
        return []
      }

      return options.browserSessions.listLinks(token)
    },
    async deleteBrowserSessionLink(
      token: string,
      slug: string,
    ): Promise<{ status: "deleted"; link: LinkRecord } | { status: "not_found" }> {
      if (!options.browserSessions) {
        return {
          status: "not_found",
        }
      }

      const link = await options.browserSessions.tombstoneLink(token, slug.toLowerCase())

      if (!link) {
        return {
          status: "not_found",
        }
      }

      return {
        status: "deleted",
        link,
      }
    },
    async claimBrowserSessionLinks(
      token: string,
      member: { id: string },
    ): Promise<{ status: "claimed"; links: LinkRecord[] }> {
      if (!options.browserSessions) {
        return {
          status: "claimed",
          links: [],
        }
      }

      return {
        status: "claimed",
        links: await options.browserSessions.claimLinks(token, member.id),
      }
    },
    async resolve(slug: string): Promise<ResolveLinkResult> {
      const link = await options.repository.findBySlugKey(slug.toLowerCase())

      if (!link || link.lifecycleState !== "active") {
        return {
          status: "not_found",
        }
      }

      if (link.expiresAt && link.expiresAt <= clock.now()) {
        return {
          status: "expired",
        }
      }

      return {
        status: "redirect",
        destination: link.destination,
      }
    },
  }
}
