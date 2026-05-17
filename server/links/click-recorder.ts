import type { LinkRecord } from "./link-lifecycle"

export const CLICK_EVENT_RETENTION_DAYS = 365
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000

export interface ClickRequestMeta {
  referrer?: string | null
  userAgent?: string | null
  ip?: string | null
}

export interface CreateClickEventInput {
  linkId: string
  occurredAt: Date
  coarseReferrer: string | null
  userAgentFamily: string | null
}

export type ClickEventRecord = CreateClickEventInput & {
  id: string
}

export interface ClickEventRepository {
  insert(input: CreateClickEventInput): Promise<ClickEventRecord>
  countForLink(linkId: string): Promise<number>
  prune(before: Date): Promise<number>
}

interface ClickRecorderOptions {
  repository: ClickEventRepository
  clock?: {
    now(): Date
  }
}

export function createClickRecorder(options: ClickRecorderOptions) {
  const clock = options.clock ?? {
    now: () => new Date(),
  }

  return {
    record(link: LinkRecord, meta: ClickRequestMeta): Promise<ClickEventRecord> {
      return options.repository.insert({
        linkId: link.id,
        occurredAt: clock.now(),
        coarseReferrer: coarseReferrer(meta.referrer),
        userAgentFamily: userAgentFamily(meta.userAgent),
      })
    },
    countFor(link: LinkRecord): Promise<number> {
      return options.repository.countForLink(link.id)
    },
    prune(before: Date): Promise<number> {
      return options.repository.prune(before)
    },
  }
}

export function clickRetentionBoundary(
  now: Date,
  retentionDays = CLICK_EVENT_RETENTION_DAYS,
) {
  return new Date(now.getTime() - retentionDays * MILLISECONDS_PER_DAY)
}

function coarseReferrer(referrer: string | null | undefined) {
  if (!referrer) {
    return null
  }

  try {
    return new URL(referrer).hostname.toLowerCase()
  } catch {
    return null
  }
}

function userAgentFamily(userAgent: string | null | undefined) {
  if (!userAgent) {
    return null
  }

  if (/edg\//i.test(userAgent)) {
    return "Edge"
  }

  if (/opr\//i.test(userAgent)) {
    return "Opera"
  }

  if (/firefox\//i.test(userAgent)) {
    return "Firefox"
  }

  if (/chrome\//i.test(userAgent) || /chromium\//i.test(userAgent)) {
    return "Chrome"
  }

  if (/safari\//i.test(userAgent)) {
    return "Safari"
  }

  if (/bot|crawler|spider/i.test(userAgent)) {
    return "Bot"
  }

  return "Other"
}
