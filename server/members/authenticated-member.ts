export type MemberStatus = "active" | "suspended"

/**
 * The canonical "this request's live, non-Suspended Member" (ADR-0008). Its
 * existence is the proof that live status was checked at the request guard —
 * by construction a Member actor cannot reach authorization or a handler while
 * Suspended, so downstream authorization deliberately does not re-model
 * Suspension.
 */
export interface AuthenticatedMember {
  id: string
  isAdmin?: boolean
}

interface AuthenticatedRequest {
  headers: Headers
}

interface ResolvedSession {
  user?: {
    id?: string
  }
}

/**
 * Repository contract (ADR-0008 / plan #3): `statusOf` returns a concrete
 * `MemberStatus` and never null. A missing Member row resolves to "active" at
 * the repository boundary, not via a downstream `?? "active"` shim.
 */
export interface MemberStatusRepository {
  statusOf(member: { id: string }): Promise<MemberStatus>
}

export interface AuthenticatedMemberAccessOptions {
  sessionFor(request: AuthenticatedRequest): Promise<ResolvedSession | null>
  memberForSession(
    request: AuthenticatedRequest,
    session: ResolvedSession,
  ): Promise<AuthenticatedMember | null>
  statusOf(member: { id: string }): Promise<MemberStatus>
}

/**
 * The single Member seam the guard consumes. Session → identity → live status
 * is resolved as one atomic operation; the Member module owns it and stays
 * free of any Link dependency.
 */
export type AuthenticatedMemberResolution =
  | { status: "unauthenticated" }
  | { status: "suspended"; member: AuthenticatedMember }
  | { status: "authenticated"; member: AuthenticatedMember }

export interface AuthenticatedMemberAccess {
  authenticatedMemberFor(
    request: AuthenticatedRequest,
  ): Promise<AuthenticatedMemberResolution>
}

export function createAuthenticatedMemberAccess(
  options: AuthenticatedMemberAccessOptions,
): AuthenticatedMemberAccess {
  return {
    async authenticatedMemberFor(request) {
      const session = await options.sessionFor(request)

      if (!session?.user?.id) {
        return { status: "unauthenticated" }
      }

      const member = await options.memberForSession(request, session)

      if (!member) {
        return { status: "unauthenticated" }
      }

      const status = await options.statusOf(member)

      if (status === "suspended") {
        return { status: "suspended", member }
      }

      return { status: "authenticated", member }
    },
  }
}
