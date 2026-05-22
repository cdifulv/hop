/**
 * Provisions the deploy-time Bootstrap admin (ADR-0001, Issue 15).
 *
 * The Bootstrap admin is the one-time local credential that lets the very
 * first Admin sign in — before any Identity provider exists — to configure the
 * Deployment. It is the only password hop ever holds.
 *
 * This script creates three records from the environment:
 *   - a Better Auth `user` (email/password sign-up is disabled, so it is
 *     created through the internal adapter rather than the HTTP endpoint),
 *   - the matching `credential` `account` holding the hashed password,
 *   - a `members` row flagged `isBootstrapAdmin` + `isAdmin`, keyed on the
 *     sentinel Identity provider issuer (see server/members/bootstrap-admin.ts).
 *
 * Idempotent: re-running leaves existing records untouched (the password is
 * never overwritten). Run it once at deploy time:
 *
 *   npm run seed:bootstrap-admin
 *
 * Required environment (load via .env):
 *   NUXT_BOOTSTRAP_ADMIN_EMAIL     the bootstrap admin's email
 *   NUXT_BOOTSTRAP_ADMIN_PASSWORD  the bootstrap admin's password
 */
import { and, eq } from "drizzle-orm"

import { auth } from "../server/auth/config"
import { db, queryClient } from "../server/db"
import { account, user as authUser } from "../server/db/schema/better-auth.generated"
import { members } from "../server/db/schema/hop"
import { bootstrapIdentityProviderIssuer } from "../server/members/bootstrap-admin"

type AuthContext = Awaited<typeof auth.$context>

const credentialProviderId = "credential"
const bootstrapDisplayName = "Bootstrap admin"
const minPasswordLength = 8

async function main() {
  const email = requireEnv("NUXT_BOOTSTRAP_ADMIN_EMAIL").trim().toLowerCase()
  const password = requireEnv("NUXT_BOOTSTRAP_ADMIN_PASSWORD")

  if (password.length < minPasswordLength) {
    throw new Error(
      `NUXT_BOOTSTRAP_ADMIN_PASSWORD must be at least ${minPasswordLength} characters.`,
    )
  }

  const ctx = await auth.$context

  const userId = await ensureUser(ctx, email)
  await ensureCredentialAccount(ctx, userId, password)
  await ensureBootstrapMember(userId, email)

  console.log(`Bootstrap admin ready: ${email}`)
  console.log("Sign in at /sign-in with the bootstrap admin credential.")
}

/** Finds the Better Auth user for `email`, creating it if absent. */
async function ensureUser(ctx: AuthContext, email: string) {
  const [existing] = await db
    .select({ id: authUser.id })
    .from(authUser)
    .where(eq(authUser.email, email))
    .limit(1)

  if (existing) {
    console.log("- Better Auth user already exists; left unchanged.")
    return existing.id
  }

  const created = await ctx.internalAdapter.createUser({
    email,
    name: bootstrapDisplayName,
    emailVerified: true,
  })

  console.log("- Created Better Auth user.")
  return created.id
}

/** Creates the credential account holding the hashed password, if absent. */
async function ensureCredentialAccount(
  ctx: AuthContext,
  userId: string,
  password: string,
) {
  const [existing] = await db
    .select({ id: account.id })
    .from(account)
    .where(
      and(eq(account.userId, userId), eq(account.providerId, credentialProviderId)),
    )
    .limit(1)

  if (existing) {
    console.log("- Credential account already exists; password left unchanged.")
    return
  }

  await ctx.internalAdapter.createAccount({
    userId,
    providerId: credentialProviderId,
    accountId: userId,
    password: await ctx.password.hash(password),
  })

  console.log("- Created credential account.")
}

/** Inserts the Bootstrap admin's Member row, if absent. */
async function ensureBootstrapMember(userId: string, email: string) {
  const inserted = await db
    .insert(members)
    .values({
      identityProviderIssuer: bootstrapIdentityProviderIssuer,
      identityProviderSubject: userId,
      email,
      displayName: bootstrapDisplayName,
      isAdmin: true,
      isBootstrapAdmin: true,
    })
    .onConflictDoNothing({
      target: [members.identityProviderIssuer, members.identityProviderSubject],
    })
    .returning({ id: members.id })

  console.log(
    inserted.length > 0
      ? "- Created Bootstrap admin Member row."
      : "- Bootstrap admin Member row already exists; left unchanged.",
  )
}

function requireEnv(name: string) {
  const value = process.env[name]

  if (!value || !value.trim()) {
    throw new Error(`${name} must be set (load it via .env or the environment).`)
  }

  return value
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
  .finally(() => queryClient.end())
