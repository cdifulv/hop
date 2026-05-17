import type { ClickRequestMeta } from "./click-recorder"
import type { DestinationValidationResult } from "./destination-validator"
import type { RateLimiter } from "./rate-limiter"
import type { SlugReservation } from "./slug-allocator"
import { can } from "./authorization-policy"

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

export type DashboardLinkRecord = LinkRecord & {
  clickCount: number
}

export type MemberLinkSort = "recent" | "clicks"

export interface ListMemberLinksOptions {
  search?: string
  sort?: MemberLinkSort
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
  listForMember(
    memberId: string,
    options?: ListMemberLinksOptions,
  ): Promise<DashboardLinkRecord[]>
  listAll(options?: ListMemberLinksOptions): Promise<DashboardLinkRecord[]>
  updateExpirationBySlugKey(
    slugKey: string,
    expiresAt: Date | null,
  ): Promise<LinkRecord | null>
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
  | {
      status: "rejected"
      reason: AnonymousCreationRejectionReason
      retryAfter?: Date
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
  | {
      status: "tombstoned"
    }

type DestinationRejectionReason = Extract<
  DestinationValidationResult,
  { status: "rejected" }
>["reason"]

type SlugRejectionReason = Exclude<
  Extract<SlugReservation, { status: "rejected" }>["reason"],
  "exhausted"
> | "slug_exhausted"

type AnonymousCreationRejectionReason =
  | "anonymous_creation_disabled"
  | "rate_limited"

interface LinkLifecycleOptions {
  repository: LinkRepository
  browserSessions?: BrowserSessionRepository
  clickRecorder?: {
    record(link: LinkRecord, meta: ClickRequestMeta): Promise<unknown>
  }
  anonymousCreation?: {
    enabled(): Promise<boolean> | boolean
  }
  anonymousCreationRateLimiter?: RateLimiter
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
      ownerMemberId?: string | null
      creationSourceKey?: string | null
    }): Promise<CreateLinkResult> {
      const ownerMemberId = input.ownerMemberId ?? null

      if (!ownerMemberId && options.anonymousCreation) {
        const anonymousCreationEnabled = await options.anonymousCreation.enabled()

        if (!anonymousCreationEnabled) {
          return {
            status: "rejected",
            reason: "anonymous_creation_disabled",
          }
        }
      }

      if (
        !ownerMemberId &&
        input.creationSourceKey &&
        options.anonymousCreationRateLimiter
      ) {
        const rateLimit = await options.anonymousCreationRateLimiter.check(
          input.creationSourceKey,
        )

        if (rateLimit.status === "limited") {
          return {
            status: "rejected",
            reason: "rate_limited",
            retryAfter: rateLimit.retryAfter,
          }
        }
      }

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
        ownerMemberId,
      })

      if (!ownerMemberId && input.browserSessionToken && options.browserSessions) {
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
    async listMemberLinks(
      member: { id: string },
      listOptions?: ListMemberLinksOptions,
    ): Promise<DashboardLinkRecord[]> {
      const actor = { type: "member" as const, memberId: member.id }
      const links = await options.repository.listForMember(member.id, listOptions)

      return links.filter((link) => can(actor, "view", link))
    },
    async listAdminLinks(
      member: { id: string; isAdmin?: boolean },
      listOptions?: ListMemberLinksOptions,
    ): Promise<DashboardLinkRecord[]> {
      if (!member.isAdmin) {
        return []
      }

      const actor = {
        type: "member" as const,
        memberId: member.id,
        isAdmin: member.isAdmin,
      }
      const links = await options.repository.listAll(listOptions)

      return links.filter((link) => can(actor, "view", link))
    },
    async deleteMemberLink(
      member: { id: string },
      slug: string,
    ): Promise<{ status: "deleted"; link: LinkRecord } | { status: "not_found" }> {
      const link = await options.repository.findBySlugKey(slug.toLowerCase())

      if (
        !link ||
        link.lifecycleState === "tombstoned" ||
        !can({ type: "member", memberId: member.id }, "delete", link)
      ) {
        return {
          status: "not_found",
        }
      }

      const deleted = await options.repository.tombstoneBySlugKey(link.slugKey)

      if (!deleted) {
        return {
          status: "not_found",
        }
      }

      return {
        status: "deleted",
        link: deleted,
      }
    },
    async deleteAdminLink(
      member: { id: string; isAdmin?: boolean },
      slug: string,
    ): Promise<{ status: "deleted"; link: LinkRecord } | { status: "not_found" }> {
      const link = await options.repository.findBySlugKey(slug.toLowerCase())

      if (
        !link ||
        link.lifecycleState === "tombstoned" ||
        !can(
          { type: "member", memberId: member.id, isAdmin: member.isAdmin },
          "delete",
          link,
        )
      ) {
        return {
          status: "not_found",
        }
      }

      const deleted = await options.repository.tombstoneBySlugKey(link.slugKey)

      if (!deleted) {
        return {
          status: "not_found",
        }
      }

      return {
        status: "deleted",
        link: deleted,
      }
    },
    async updateMemberLinkExpiration(
      member: { id: string },
      slug: string,
      expiresAt: Date | null,
    ): Promise<{ status: "updated"; link: LinkRecord } | { status: "not_found" }> {
      const link = await options.repository.findBySlugKey(slug.toLowerCase())

      if (
        !link ||
        link.lifecycleState === "tombstoned" ||
        !can({ type: "member", memberId: member.id }, "update_expiration", link)
      ) {
        return {
          status: "not_found",
        }
      }

      const updated = await options.repository.updateExpirationBySlugKey(
        link.slugKey,
        expiresAt,
      )

      if (!updated) {
        return {
          status: "not_found",
        }
      }

      return {
        status: "updated",
        link: updated,
      }
    },
    async resolve(
      slug: string,
      clickMeta: ClickRequestMeta = {},
    ): Promise<ResolveLinkResult> {
      const link = await options.repository.findBySlugKey(slug.toLowerCase())

      if (!link) {
        return {
          status: "not_found",
        }
      }

      if (link.lifecycleState === "tombstoned") {
        return {
          status: "tombstoned",
        }
      }

      if (link.lifecycleState !== "active") {
        return {
          status: "not_found",
        }
      }

      if (link.expiresAt && link.expiresAt <= clock.now()) {
        return {
          status: "expired",
        }
      }

      if (options.clickRecorder) {
        void options.clickRecorder.record(link, clickMeta).catch(() => {})
      }

      return {
        status: "redirect",
        destination: link.destination,
      }
    },
  }
}
