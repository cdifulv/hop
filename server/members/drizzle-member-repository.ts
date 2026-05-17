import { and, eq, inArray } from "drizzle-orm"

import { db } from "../db"
import { account, session, ssoProvider } from "../db/schema/better-auth.generated"
import { members } from "../db/schema/hop"
import type { MemberRecord, MemberRepository } from "./member-identity"
import type {
  MemberSessionInvalidator,
  MemberSuspensionRepository,
} from "./member-suspension"
import type { MemberStatusRepository } from "./member-status"

export function createDrizzleMemberRepository(): MemberRepository {
  return {
    async findBySsoIdentity(input) {
      const [member] = await db
        .select()
        .from(members)
        .where(
          and(
            eq(members.identityProviderIssuer, input.issuer),
            eq(members.identityProviderSubject, input.subject),
          ),
        )
        .limit(1)

      return member ? toMemberRecord(member) : null
    },
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

export function createDrizzleMemberStatusRepository(): MemberStatusRepository {
  return {
    async statusOf(member) {
      const [record] = await db
        .select({
          suspended: members.suspended,
        })
        .from(members)
        .where(eq(members.id, member.id))
        .limit(1)

      if (!record) {
        return null
      }

      return record.suspended ? "suspended" : "active"
    },
  }
}

export function createDrizzleMemberSuspensionRepository(): MemberSuspensionRepository {
  return {
    async suspendMember(id, suspendedAt) {
      const [member] = await db
        .update(members)
        .set({
          suspended: true,
          suspendedAt,
          updatedAt: suspendedAt,
        })
        .where(eq(members.id, id))
        .returning()

      return member ? toMemberRecord(member) : null
    },
    async unsuspendMember(id) {
      const [member] = await db
        .update(members)
        .set({
          suspended: false,
          suspendedAt: null,
          updatedAt: new Date(),
        })
        .where(eq(members.id, id))
        .returning()

      return member ? toMemberRecord(member) : null
    },
  }
}

export function createDrizzleMemberSessionInvalidator(): MemberSessionInvalidator {
  return {
    async invalidateSessions(member) {
      const betterAuthUsers = await db
        .select({
          userId: account.userId,
        })
        .from(account)
        .innerJoin(ssoProvider, eq(account.providerId, ssoProvider.providerId))
        .innerJoin(
          members,
          and(
            eq(members.identityProviderIssuer, ssoProvider.issuer),
            eq(members.identityProviderSubject, account.accountId),
          ),
        )
        .where(eq(members.id, member.id))

      const userIds = betterAuthUsers.map((user) => user.userId)

      if (userIds.length === 0) {
        return
      }

      await db.delete(session).where(inArray(session.userId, userIds))
    },
  }
}

export function createDrizzleAuthenticatedMemberResolver() {
  return {
    async memberForBetterAuthUser(userId: string) {
      const [member] = await db
        .select({
          id: members.id,
          isAdmin: members.isAdmin,
        })
        .from(account)
        .innerJoin(ssoProvider, eq(account.providerId, ssoProvider.providerId))
        .innerJoin(
          members,
          and(
            eq(members.identityProviderIssuer, ssoProvider.issuer),
            eq(members.identityProviderSubject, account.accountId),
          ),
        )
        .where(eq(account.userId, userId))
        .limit(1)

      return member ?? null
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
