import { createError, defineEventHandler, readBody, toWebRequest } from "h3"

import { auth } from "../auth/config"
import { toLinkResponse } from "../links/response"
import { createProductionLinkLifecycle } from "../links/service"
import { createProductionAuthenticatedMemberResolver } from "../members/service"
import { getOrCreateBrowserSessionToken } from "../utils/browser-session-cookie"
import { isConfiguredHost } from "../utils/domains"

interface CreateLinkBody {
  destination?: unknown
  slug?: unknown
  expiresAt?: unknown
}

function parseExpiresAt(value: unknown) {
  if (value === undefined || value === null || value === "") {
    return null
  }

  if (typeof value !== "string") {
    throw createError({
      statusCode: 422,
      statusMessage: "expiration_invalid",
    })
  }

  const expiresAt = new Date(value)

  if (Number.isNaN(expiresAt.getTime())) {
    throw createError({
      statusCode: 422,
      statusMessage: "expiration_invalid",
    })
  }

  return expiresAt
}

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event)

  // App-domain-only in production (ADR-0002): the Short domain serves redirects
  // only. In dev the App and Short domains share `localhost`, so — like the
  // resolver middleware — the host guard is skipped and the create API stays
  // reachable regardless of NUXT_APP_DOMAIN.
  if (
    !import.meta.dev &&
    (isConfiguredHost(event, config.shortDomain) ||
      (config.appDomain && !isConfiguredHost(event, config.appDomain)))
  ) {
    throw createError({
      statusCode: 404,
      statusMessage: "Not Found",
    })
  }

  const body = await readBody<CreateLinkBody>(event)

  if (typeof body.destination !== "string" || body.destination.trim() === "") {
    throw createError({
      statusCode: 400,
      statusMessage: "Destination is required",
    })
  }

  const links = createProductionLinkLifecycle()
  const browserSessionToken = getOrCreateBrowserSessionToken(event)
  const request = toWebRequest(event)
  const session = await auth.api.getSession({
    headers: request.headers,
  })
  const authUserId = session?.user?.id
  const member = authUserId
    ? await createProductionAuthenticatedMemberResolver().memberForBetterAuthUser(authUserId)
    : null
  const result = await links.create({
    destination: body.destination.trim(),
    slug:
      typeof body.slug === "string" && body.slug.trim() !== ""
        ? body.slug.trim()
        : undefined,
    expiresAt: parseExpiresAt(body.expiresAt),
    browserSessionToken,
    ownerMemberId: member?.id ?? null,
  })

  if (result.status === "rejected") {
    throw createError({
      statusCode: 422,
      statusMessage: result.reason,
    })
  }

  const shortHost = config.public.shortDomain || config.shortDomain

  return {
    link: toLinkResponse(result.link, shortHost),
  }
})
