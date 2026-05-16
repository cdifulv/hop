import { defineEventHandler } from "h3"

import { createProductionAuthenticatedMemberRequestGuard } from "../members/production-authenticated-request-guard"

const guardAuthenticatedMemberRequest =
  createProductionAuthenticatedMemberRequestGuard()

export default defineEventHandler((event) => {
  return guardAuthenticatedMemberRequest(event, async () => undefined).catch((error) => {
    if (error?.statusCode === 401 && error?.statusMessage === "authentication_required") {
      return undefined
    }

    throw error
  })
})
