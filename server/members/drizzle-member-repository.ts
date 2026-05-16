import { db } from "../db"
import { members } from "../db/schema/hop"
import type { MemberRecord, MemberRepository } from "./member-identity"

export function createDrizzleMemberRepository(): MemberRepository {
  return {
    async upsertFromSso(input) {
      const [member] = await db
        .insert(members)
        .values({
          identityProviderIssuer: input.issuer,
          identityProviderSubject: input.subject,
          email: input.email ?? null,
          displayName: input.displayName ?? null,
        })
        .onConflictDoUpdate({
          target: [members.identityProviderIssuer, members.identityProviderSubject],
          set: {
            email: input.email ?? null,
            displayName: input.displayName ?? null,
            updatedAt: new Date(),
          },
        })
        .returning()

      if (!member) {
        throw new Error("Member upsert did not return a row")
      }

      return toMemberRecord(member)
    },
  }
}

export function toMemberRecord(member: typeof members.$inferSelect): MemberRecord {
  return {
    id: member.id,
    identityProviderIssuer: member.identityProviderIssuer,
    identityProviderSubject: member.identityProviderSubject,
    email: member.email,
    displayName: member.displayName,
    isAdmin: member.isAdmin,
    isBootstrapAdmin: member.isBootstrapAdmin,
    suspended: member.suspended,
    suspendedAt: member.suspendedAt,
    createdAt: member.createdAt,
    updatedAt: member.updatedAt,
  }
}
