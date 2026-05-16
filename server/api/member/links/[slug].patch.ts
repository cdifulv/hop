import {
  createError,
  defineEventHandler,
  getRouterParam,
  readBody,
  toWebRequest,
} from "h3"

import { toLinkResponse } from "../../../links/response"
import { createProductionLinkLifecycle } from "../../../links/service"
import { createProductionAuthenticatedMemberRequestGuard } from "../../../members/production-authenticated-request-guard"
import { isConfiguredHost } from "../../../utils/domains"

interface UpdateMemberLinkExpirationBody {
  expiresAt?: unknown
}

function parseExpiresAt(value: unknown) {
  if (value === null || value === "") {
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

  const slug = getRouterParam(event, "slug")

  if (!slug) {
    throw createError({
      statusCode: 404,
      statusMessage: "Link Not Found",
    })
  }

  const body = await readBody<UpdateMemberLinkExpirationBody | null>(event)

  if (!body || !("expiresAt" in body)) {
    throw createError({
      statusCode: 400,
      statusMessage: "Expiration is required",
    })
  }

  return createProductionAuthenticatedMemberRequestGuard()(
    toWebRequest(event),
    async ({ member }) => {
      const result = await createProductionLinkLifecycle().updateMemberLinkExpiration(
        member,
        slug,
        parseExpiresAt(body.expiresAt),
      )

      if (result.status === "not_found") {
        throw createError({
          statusCode: 404,
          statusMessage: "Link Not Found",
        })
      }

      const shortHost = config.public.shortDomain || config.shortDomain

      return {
        link: toLinkResponse(result.link, shortHost),
      }
    },
  )
})
