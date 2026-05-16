import { createError, defineEventHandler, getRouterParam, toWebRequest } from "h3"

import { createProductionLinkLifecycle } from "../../../links/service"
import { createProductionAuthenticatedMemberRequestGuard } from "../../../members/production-authenticated-request-guard"
import { isConfiguredHost } from "../../../utils/domains"

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

  return createProductionAuthenticatedMemberRequestGuard()(
    toWebRequest(event),
    async ({ member }) => {
      const result = await createProductionLinkLifecycle().deleteMemberLink(member, slug)

      if (result.status === "not_found") {
        throw createError({
          statusCode: 404,
          statusMessage: "Link Not Found",
        })
      }

      return {
        status: "deleted",
      }
    },
  )
})
