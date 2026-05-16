import { createError, defineEventHandler } from "h3"

import { toLinkResponse } from "../links/response"
import { createProductionLinkLifecycle } from "../links/service"
import { getBrowserSessionToken } from "../utils/browser-session-cookie"
import { isConfiguredHost } from "../utils/domains"

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

  if (!token) {
    return {
      links: [],
    }
  }

  const shortHost = config.public.shortDomain || config.shortDomain
  const links = await createProductionLinkLifecycle().listBrowserSessionLinks(token)

  return {
    links: links.map((link) => toLinkResponse(link, shortHost)),
  }
})
