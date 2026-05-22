import { createError, defineEventHandler, toWebRequest } from "h3"

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

  return createProductionAuthenticatedMemberRequestGuard()(
    toWebRequest(event),
    async ({ member }) => ({
      member: {
        id: member.id,
        isAdmin: Boolean(member.isAdmin),
      },
    }),
  )
})
