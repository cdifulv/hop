import { createError } from "h3"

import type { MemberStatusLookup } from "./member-status"

interface AuthenticatedRequest {
  headers: Headers
}

interface AuthenticatedSession {
  user?: {
    id?: string
  }
}

interface GuardedMember {
  id: string
  isAdmin?: boolean
}

interface AuthenticatedRequestGuardOptions extends MemberStatusLookup {
  sessionFor(request: AuthenticatedRequest): Promise<AuthenticatedSession | null>
  memberForSession(
    request: AuthenticatedRequest,
    session: AuthenticatedSession,
  ): Promise<GuardedMember | null>
  forceSignOut(request: AuthenticatedRequest): Promise<void>
}

interface GuardedRequestContext {
  request: AuthenticatedRequest
  session: AuthenticatedSession
  member: GuardedMember
}

export function createAuthenticatedMemberRequestGuard(
  options: AuthenticatedRequestGuardOptions,
) {
  return async function guardAuthenticatedMemberRequest<Result>(
    request: AuthenticatedRequest,
    handle: (context: GuardedRequestContext) => Promise<Result>,
  ) {
    const session = await options.sessionFor(request)

    if (!session?.user?.id) {
      throw createError({
        statusCode: 401,
        statusMessage: "authentication_required",
      })
    }

    const member = await options.memberForSession(request, session)

    if (!member) {
      throw createError({
        statusCode: 401,
        statusMessage: "authentication_required",
      })
    }

    const status = await options.statusOf(member)

    if (status === "suspended") {
      await options.forceSignOut(request)
      throw createError({
        statusCode: 401,
        statusMessage: "member_suspended",
      })
    }

    return handle({
      request,
      session,
      member,
    })
  }
}
