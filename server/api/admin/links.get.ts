import { createError, defineEventHandler, getQuery, toWebRequest } from "h3"

import { toLinkResponse } from "../../links/response"
import { createProductionLinkLifecycle } from "../../links/service"
import type { ListMemberLinksOptions, MemberLinkSort } from "../../links/link-lifecycle"
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

  const shortHost = config.public.shortDomain || config.shortDomain
  const listOptions = linkListOptions(getQuery(event))

  return createProductionAuthenticatedMemberRequestGuard()(
    toWebRequest(event),
    async ({ member }) => {
      if (!member.isAdmin) {
        throw createError({
          statusCode: 403,
          statusMessage: "Admin privileges are required",
        })
      }

      const links = await createProductionLinkLifecycle().listAdminLinks(
        member,
        listOptions,
      )

      return {
        links: links.map((link) => ({
          ...toLinkResponse(link, shortHost),
          ownerMemberId: link.ownerMemberId,
          lifecycleState: link.lifecycleState,
        })),
      }
    },
  )
})

function linkListOptions(query: { search?: unknown; sort?: unknown }): ListMemberLinksOptions {
  const listOptions: ListMemberLinksOptions = {}
  const search = stringQueryValue(query.search)
  const sort = linkSortQueryValue(query.sort)

  if (search) {
    listOptions.search = search
  }

  if (sort) {
    listOptions.sort = sort
  }

  return listOptions
}

function stringQueryValue(value: unknown) {
  if (Array.isArray(value)) {
    return typeof value[0] === "string" ? value[0] : undefined
  }

  return typeof value === "string" ? value : undefined
}

function linkSortQueryValue(value: unknown): MemberLinkSort | undefined {
  const sort = stringQueryValue(value)

  if (sort === "recent" || sort === "clicks") {
    return sort
  }

  return undefined
}
