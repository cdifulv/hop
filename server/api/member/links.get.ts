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

  const request = toWebRequest(event)
  const shortHost = config.public.shortDomain || config.shortDomain
  const query = getQuery(event)
  const listOptions = memberLinkListOptions(query)

  return createProductionAuthenticatedMemberRequestGuard()(request, async ({ member }) => {
    const links = await createProductionLinkLifecycle().listMemberLinks(member, listOptions)

    return {
      links: links.map((link) => toLinkResponse(link, shortHost)),
    }
  })
})

function memberLinkListOptions(query: { search?: unknown; sort?: unknown }): ListMemberLinksOptions {
  const listOptions: ListMemberLinksOptions = {}
  const search = stringQueryValue(query.search)
  const sort = memberLinkSortQueryValue(query.sort)

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

function memberLinkSortQueryValue(value: unknown): MemberLinkSort | undefined {
  const sort = stringQueryValue(value)

  if (sort === "recent" || sort === "clicks") {
    return sort
  }

  return undefined
}
