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

      return {
        status: "created",
        link,
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
