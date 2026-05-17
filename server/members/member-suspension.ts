import type { LinkRecord } from "../links/link-lifecycle"
import type { MemberRecord } from "./member-identity"

export interface MemberSuspensionRepository {
  suspendMember(id: string, suspendedAt: Date): Promise<MemberRecord | null>
  unsuspendMember(id: string): Promise<MemberRecord | null>
}

interface MemberLinkSuspension {
  suspendMemberLinks(member: { id: string }): Promise<LinkRecord[]>
  unsuspendMemberLinks(member: { id: string }): Promise<LinkRecord[]>
}

export interface MemberSessionInvalidator {
  invalidateSessions(member: { id: string }): Promise<void>
}

interface MemberSuspensionOptions {
  members: MemberSuspensionRepository
  links: MemberLinkSuspension
  sessions: MemberSessionInvalidator
  clock?: {
    now(): Date
  }
}

type MemberSuspensionResult =
  | {
      status: "suspended"
      member: MemberRecord
      links: LinkRecord[]
    }
  | {
      status: "not_found"
    }

type MemberUnsuspensionResult =
  | {
      status: "unsuspended"
      member: MemberRecord
      links: LinkRecord[]
    }
  | {
      status: "not_found"
    }

export function createMemberSuspension(options: MemberSuspensionOptions) {
  const clock = options.clock ?? {
    now: () => new Date(),
  }

  return {
    async suspendMember(
      actor: { id: string; isAdmin?: boolean },
      memberId: string,
    ): Promise<MemberSuspensionResult> {
      if (!actor.isAdmin) {
        return {
          status: "not_found",
        }
      }

      const member = await options.members.suspendMember(memberId, clock.now())

      if (!member) {
        return {
          status: "not_found",
        }
      }

      const links = await options.links.suspendMemberLinks(member)
      await options.sessions.invalidateSessions(member)

      return {
        status: "suspended",
        member,
        links,
      }
    },
    async unsuspendMember(
      actor: { id: string; isAdmin?: boolean },
      memberId: string,
    ): Promise<MemberUnsuspensionResult> {
      if (!actor.isAdmin) {
        return {
          status: "not_found",
        }
      }

      const member = await options.members.unsuspendMember(memberId)

      if (!member) {
        return {
          status: "not_found",
        }
      }

      return {
        status: "unsuspended",
        member,
        links: await options.links.unsuspendMemberLinks(member),
      }
    },
  }
}
