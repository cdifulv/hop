import { auth } from "../auth/config"
import { createAuthenticatedMemberRequestGuard } from "./authenticated-request-guard"
import {
  createProductionAuthenticatedMemberResolver,
  createProductionMemberStatus,
} from "./service"

export function createProductionAuthenticatedMemberRequestGuard() {
  const memberStatus = createProductionMemberStatus()
  const authenticatedMembers = createProductionAuthenticatedMemberResolver()

  return createAuthenticatedMemberRequestGuard({
    async sessionFor(request) {
      return auth.api.getSession({
        headers: request.headers,
      })
    },
    async memberForSession(_request, session) {
      const authUserId = session.user?.id

      if (!authUserId) {
        return null
      }

      return (
        (await authenticatedMembers.memberForBetterAuthUser(authUserId)) ?? {
          id: authUserId,
        }
      )
    },
    statusOf: (member) => memberStatus.statusOf(member),
    async forceSignOut(request) {
      await auth.api.signOut({
        headers: request.headers,
      })
    },
  })
}
