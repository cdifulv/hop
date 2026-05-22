import { createError } from "h3"

import type {
  AuthenticatedMember,
  AuthenticatedMemberAccess,
} from "./authenticated-member"

interface AuthenticatedRequest {
  headers: Headers
}

interface AuthenticatedRequestGuardOptions {
  access: AuthenticatedMemberAccess
  forceSignOut(request: AuthenticatedRequest): Promise<void>
}

interface GuardedRequestContext {
  request: AuthenticatedRequest
  member: AuthenticatedMember
}

/**
 * The single ADR-0008 enforcement point. The guard resolves the one Member
 * seam, rejects (and reactively force-signs-out a Suspended Member, ADR-0007)
 * before any handler runs, and otherwise emits an `AuthenticatedMember` whose
 * existence *is* the proof that live status was checked.
 */
export function createAuthenticatedMemberRequestGuard(
  options: AuthenticatedRequestGuardOptions,
) {
  return async function guardAuthenticatedMemberRequest<Result>(
    request: AuthenticatedRequest,
    handle: (context: GuardedRequestContext) => Promise<Result>,
  ) {
    const resolution = await options.access.authenticatedMemberFor(request)

    if (resolution.status === "unauthenticated") {
      throw createError({
        statusCode: 401,
        statusMessage: "authentication_required",
      })
    }

    if (resolution.status === "suspended") {
      await options.forceSignOut(request)
      throw createError({
        statusCode: 401,
        statusMessage: "member_suspended",
      })
    }

    return handle({
      request,
      member: resolution.member,
    })
  }
}
