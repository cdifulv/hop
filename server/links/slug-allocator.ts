import { randomInt } from "node:crypto"

export type SlugReservation =
  | {
      status: "reserved"
      slug: string
      slugKey: string
    }
  | {
      status: "rejected"
      reason:
        | "exhausted"
        | "slug_too_short"
        | "slug_too_long"
        | "slug_invalid_characters"
        | "slug_taken"
    }

export interface SlugRepository {
  slugKeyExists(slugKey: string): Promise<boolean>
}

export interface SlugAllocatorOptions {
  repository: SlugRepository
  randomBase62?: () => string
  maxAttempts?: number
}

const base62 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"

export function createSlugAllocator(options: SlugAllocatorOptions) {
  const randomBase62 = options.randomBase62 ?? generateBase62Slug
  const maxAttempts = options.maxAttempts ?? 12

  return {
    async reserve(customSlug?: string): Promise<SlugReservation> {
      if (customSlug !== undefined) {
        const slug = customSlug.trim()

        if (slug.length < 3) {
          return {
            status: "rejected",
            reason: "slug_too_short",
          }
        }

        if (slug.length > 64) {
          return {
            status: "rejected",
            reason: "slug_too_long",
          }
        }

        if (!/^[A-Za-z0-9-]+$/.test(slug)) {
          return {
            status: "rejected",
            reason: "slug_invalid_characters",
          }
        }

        const slugKey = normalizeSlug(slug)

        if (await options.repository.slugKeyExists(slugKey)) {
          return {
            status: "rejected",
            reason: "slug_taken",
          }
        }

        return {
          status: "reserved",
          slug,
          slugKey,
        }
      }

      for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        const slug = randomBase62()
        const slugKey = normalizeSlug(slug)

        if (!(await options.repository.slugKeyExists(slugKey))) {
          return {
            status: "reserved",
            slug,
            slugKey,
          }
        }
      }

      return {
        status: "rejected",
        reason: "exhausted",
      }
    },
  }
}

export function normalizeSlug(slug: string) {
  return slug.toLowerCase()
}

function generateBase62Slug(length = 6) {
  return Array.from({ length }, () => base62[randomInt(base62.length)]).join("")
}
