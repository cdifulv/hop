import type {
  MemberRecord,
  MemberRepository,
  SsoMemberInput,
} from "../../server/members/member-identity"
import type { MemberStatusRepository } from "../../server/members/member-status"
import type { MemberSuspensionRepository } from "../../server/members/member-suspension"

export function createMemoryMemberRepository(
  seeds: SsoMemberInput[] = [],
): MemberRepository & MemberStatusRepository & MemberSuspensionRepository {
  const members = new Map<string, MemberRecord>()
  const membersById = new Map<string, MemberRecord>()
  const now = new Date("2026-05-16T00:00:00.000Z")

  function identityKey(input: Pick<SsoMemberInput, "issuer" | "subject">) {
    return `${input.issuer}\0${input.subject}`
  }

  function createMember(input: SsoMemberInput, index: number): MemberRecord {
    const member: MemberRecord = {
      id: `member-${index + 1}`,
      identityProviderIssuer: input.issuer,
      identityProviderSubject: input.subject,
      email: input.email ?? null,
      displayName: input.displayName ?? null,
      isAdmin: false,
      isBootstrapAdmin: false,
      suspended: false,
      suspendedAt: null,
      createdAt: now,
      updatedAt: now,
    }

    members.set(identityKey(input), member)
    membersById.set(member.id, member)
    return member
  }

  seeds.forEach((seed, index) => createMember(seed, index))

  return {
    async findBySsoIdentity(input) {
      return members.get(identityKey(input)) ?? null
    },
    async upsertFromSso(input) {
      const key = identityKey(input)
      const existing = members.get(key)

      if (!existing) {
        return createMember(input, members.size)
      }

      const updated: MemberRecord = {
        ...existing,
        email: input.email ?? null,
        displayName: input.displayName ?? null,
        updatedAt: now,
      }

      members.set(key, updated)
      membersById.set(updated.id, updated)
      return updated
    },
    async statusOf(member) {
      const record = membersById.get(member.id)

      if (!record) {
        return null
      }

      return record.suspended ? "suspended" : "active"
    },
    async suspendMember(id, suspendedAt) {
      const member = membersById.get(id)

      if (!member) {
        return null
      }

      const updated: MemberRecord = {
        ...member,
        suspended: true,
        suspendedAt,
        updatedAt: suspendedAt,
      }

      membersById.set(id, updated)
      members.set(
        identityKey({
          issuer: updated.identityProviderIssuer,
          subject: updated.identityProviderSubject,
        }),
        updated,
      )
      return updated
    },
    async unsuspendMember(id) {
      const member = membersById.get(id)

      if (!member) {
        return null
      }

      const updated: MemberRecord = {
        ...member,
        suspended: false,
        suspendedAt: null,
        updatedAt: now,
      }

      membersById.set(id, updated)
      members.set(
        identityKey({
          issuer: updated.identityProviderIssuer,
          subject: updated.identityProviderSubject,
        }),
        updated,
      )
      return updated
    },
  } satisfies MemberRepository & MemberStatusRepository & MemberSuspensionRepository
}
