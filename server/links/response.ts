import type { LinkRecord } from "./link-lifecycle"

export function toLinkResponse(link: LinkRecord, shortHost: string, now = new Date()) {
  return {
    slug: link.slug,
    destination: link.destination,
    expiresAt: link.expiresAt?.toISOString() ?? null,
    expirationStatus: expirationStatus(link, now),
    createdAt: link.createdAt.toISOString(),
    clickCount: clickCount(link),
    shortUrl: shortHost ? `https://${shortHost}/${link.slug}` : `/${link.slug}`,
  }
}

function expirationStatus(link: LinkRecord, now: Date) {
  if (!link.expiresAt) {
    return "none"
  }

  return link.expiresAt <= now ? "expired" : "active"
}

function clickCount(link: LinkRecord) {
  if ("clickCount" in link && typeof link.clickCount === "number") {
    return link.clickCount
  }

  return 0
}
