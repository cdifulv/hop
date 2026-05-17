import {
  createError,
  defineEventHandler,
  getRouterParam,
  readBody,
  toWebRequest,
} from "h3"

import { createProductionLinkLifecycle } from "../../../links/service"
import { createProductionAuthenticatedMemberRequestGuard } from "../../../members/production-authenticated-request-guard"
import { isConfiguredHost } from "../../../utils/domains"

interface UpdateAdminLinkBody {
  lifecycleState?: "active" | "suspended"
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

  const body = await readBody<UpdateAdminLinkBody | null>(event)
  const lifecycleState = body?.lifecycleState

  if (lifecycleState !== "active" && lifecycleState !== "suspended") {
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid Link lifecycle state",
    })
  }

  return createProductionAuthenticatedMemberRequestGuard()(
    toWebRequest(event),
    async ({ member }) => {
      if (!member.isAdmin) {
        throw createError({
          statusCode: 403,
          statusMessage: "Admin privileges are required",
        })
      }

      const lifecycle = createProductionLinkLifecycle()
      const result =
        lifecycleState === "suspended"
          ? await lifecycle.suspendAdminLink(member, slug)
          : await lifecycle.unsuspendAdminLink(member, slug)

      if (result.status === "not_found") {
        throw createError({
          statusCode: 404,
          statusMessage: "Link Not Found",
        })
      }

      return {
        status: result.status,
      }
    },
  )
})
