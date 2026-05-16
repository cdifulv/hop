import { createError, defineEventHandler, toWebRequest } from "h3"

import { toLinkResponse } from "../../links/response"
import { createProductionLinkLifecycle } from "../../links/service"
import { createProductionAuthenticatedMemberRequestGuard } from "../../members/production-authenticated-request-guard"
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

  const request = toWebRequest(event)
  const shortHost = config.public.shortDomain || config.shortDomain

  return createProductionAuthenticatedMemberRequestGuard()(request, async ({ member }) => {
    const links = await createProductionLinkLifecycle().listMemberLinks(member)

    return {
      links: links.map((link) => toLinkResponse(link, shortHost)),
    }
  })
})
