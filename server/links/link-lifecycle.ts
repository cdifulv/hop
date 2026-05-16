import type { DestinationValidationResult } from "./destination-validator"
import type { SlugReservation } from "./slug-allocator"

export type LinkLifecycleState = "active" | "suspended" | "tombstoned"

export interface LinkRecord {
  id: string
  slug: string
  slugKey: string
  destination: string
  ownerMemberId: string | null
  lifecycleState: LinkLifecycleState
  createdAt: Date
  updatedAt: Date
}

export interface CreateLinkInput {
  slug: string
  slugKey: string
  destination: string
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
      reason: DestinationRejectionReason | "slug_exhausted"
    }

export type ResolveLinkResult =
  | {
      status: "redirect"
      destination: string
    }
  | {
      status: "not_found"
    }

type DestinationRejectionReason = Extract<
  DestinationValidationResult,
  { status: "rejected" }
>["reason"]

interface LinkLifecycleOptions {
  repository: LinkRepository
  validateDestination(input: string): DestinationValidationResult
  slugAllocator: {
    reserve(): Promise<SlugReservation>
  }
}

export function createLinkLifecycle(options: LinkLifecycleOptions) {
  return {
    async create(input: { destination: string }): Promise<CreateLinkResult> {
      const destination = options.validateDestination(input.destination)

      if (destination.status === "rejected") {
        return destination
      }

      const slug = await options.slugAllocator.reserve()

      if (slug.status === "rejected") {
        return {
          status: "rejected",
          reason: "slug_exhausted",
        }
      }

      const link = await options.repository.insert({
        slug: slug.slug,
        slugKey: slug.slugKey,
        destination: destination.destination,
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

      return {
        status: "redirect",
        destination: link.destination,
      }
    },
  }
}
