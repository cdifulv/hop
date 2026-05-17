export interface MemberRecord {
  id: string
  identityProviderIssuer: string
  identityProviderSubject: string
  email: string | null
  displayName: string | null
  isAdmin: boolean
  isBootstrapAdmin: boolean
  suspended: boolean
  suspendedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface SsoMemberInput {
  issuer: string
  subject: string
  email?: string | null
  displayName?: string | null
}

export interface MemberRepository {
  findBySsoIdentity(
    input: Pick<SsoMemberInput, "issuer" | "subject">,
  ): Promise<MemberRecord | null>
  upsertFromSso(input: SsoMemberInput): Promise<MemberRecord>
}

interface MemberIdentityOptions {
  repository: MemberRepository
}

export function createMemberIdentity(options: MemberIdentityOptions) {
  return {
    async memberForSsoIdentity(input: SsoMemberInput): Promise<MemberRecord> {
      assertPresent(input.issuer, "Identity provider issuer is required")
      assertPresent(input.subject, "Identity provider subject is required")

      const existing = await options.repository.findBySsoIdentity(input)

      if (existing?.suspended) {
        throw new Error("Member is suspended")
      }

      const member = await options.repository.upsertFromSso({
        issuer: input.issuer,
        subject: input.subject,
        email: input.email ?? null,
        displayName: input.displayName ?? null,
      })

      if (member.suspended) {
        throw new Error("Member is suspended")
      }

      return member
    },
  }
}

function assertPresent(value: string, message: string) {
  if (!value.trim()) {
    throw new Error(message)
  }
}
