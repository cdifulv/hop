import { auth } from "../auth/config"
import { createAuthenticatedMemberAccess } from "./authenticated-member"
import { createAuthenticatedMemberRequestGuard } from "./authenticated-request-guard"
import {
  createDrizzleAuthenticatedMemberResolver,
  createDrizzleMemberStatusRepository,
} from "./drizzle-member-repository"

/**
 * Production composition root for the request guard. Kept separate from the
 * pure guard/seam modules so unit tests can exercise them without pulling in
 * Better Auth or the database (`server/db` throws when DATABASE_URL is unset).
 */
export function createProductionAuthenticatedMemberRequestGuard() {
  const statusRepository = createDrizzleMemberStatusRepository()
  const authenticatedMembers = createDrizzleAuthenticatedMemberResolver()

  const access = createAuthenticatedMemberAccess({
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
    statusOf: (member) => statusRepository.statusOf(member),
  })

  return createAuthenticatedMemberRequestGuard({
    access,
    async forceSignOut(request) {
      await auth.api.signOut({
        headers: request.headers,
      })
    },
  })
}
