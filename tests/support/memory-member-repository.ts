import type {
  MemberRecord,
  MemberRepository,
  SsoMemberInput,
} from "../../server/members/member-identity"

export function createMemoryMemberRepository(seeds: SsoMemberInput[] = []): MemberRepository {
  const members = new Map<string, MemberRecord>()
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
    return member
  }

  seeds.forEach((seed, index) => createMember(seed, index))

  return {
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
      return updated
    },
  }
}
