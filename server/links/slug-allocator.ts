import { randomInt } from "node:crypto"

export type SlugReservation =
  | {
      status: "reserved"
      slug: string
      slugKey: string
    }
  | {
      status: "rejected"
      reason: "exhausted"
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
    async reserve(): Promise<SlugReservation> {
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
