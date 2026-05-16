import type { LinkRecord } from "./link-lifecycle"

export function toLinkResponse(link: LinkRecord, shortHost: string) {
  return {
    slug: link.slug,
    destination: link.destination,
    expiresAt: link.expiresAt?.toISOString() ?? null,
    shortUrl: shortHost ? `https://${shortHost}/${link.slug}` : `/${link.slug}`,
  }
}
