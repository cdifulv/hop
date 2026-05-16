import { createError, defineEventHandler, getRouterParam } from "h3"

import { createProductionLinkLifecycle } from "../../links/service"
import { getBrowserSessionToken } from "../../utils/browser-session-cookie"
import { isConfiguredHost } from "../../utils/domains"

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

  const token = getBrowserSessionToken(event)
  const slug = getRouterParam(event, "slug")

  if (!token || !slug) {
    throw createError({
      statusCode: 404,
      statusMessage: "Link Not Found",
    })
  }

  const result = await createProductionLinkLifecycle().deleteBrowserSessionLink(token, slug)

  if (result.status === "not_found") {
    throw createError({
      statusCode: 404,
      statusMessage: "Link Not Found",
    })
  }

  return {
    status: "deleted",
  }
})
