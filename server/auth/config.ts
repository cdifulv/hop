import { betterAuth } from "better-auth"
import { createAuthMiddleware } from "better-auth/api"
import { drizzleAdapter } from "@better-auth/drizzle-adapter"
import { sso } from "@better-auth/sso"

import { db } from "../db/index"
import { createProductionLinkLifecycle } from "../links/service"
import {
  createProductionAuthenticatedMemberResolver,
  createProductionMemberIdentity,
} from "../members/service"
import { browserSessionCookieName } from "../utils/browser-session-cookie"

const memberIdentity = createProductionMemberIdentity()
const authenticatedMembers = createProductionAuthenticatedMemberResolver()
const links = createProductionLinkLifecycle()

export const auth = betterAuth({
  baseURL: authBaseUrl(),
  trustedOrigins: trustedOrigins(),
  database: drizzleAdapter(db, {
    provider: "pg",
  }),
  emailAndPassword: {
    enabled: true,
  },
  hooks: {
    after: createAuthMiddleware(async (ctx) => {
      const newSession = ctx.context.newSession
      const browserSessionToken = ctx.getCookie(browserSessionCookieName)

      if (!newSession || !browserSessionToken) {
        return
      }

      const member = await authenticatedMembers.memberForBetterAuthUser(newSession.user.id)

      if (!member) {
        return
      }

      await links.claimBrowserSessionLinks(browserSessionToken, member)
    }),
  },
  plugins: [
    sso({
      provisionUserOnEveryLogin: true,
      async provisionUser(context) {
        await memberIdentity.memberForSsoIdentity(toSsoMemberInput(context))
      },
    }),
  ],
})

interface SsoProvisionUserContext {
  user?: {
    id?: string
    email?: string | null
    name?: string | null
  }
  userInfo?: {
    sub?: string
    email?: string | null
    name?: string | null
  }
  provider?: {
    issuer?: string
    providerId?: string
  }
}

function toSsoMemberInput(context: SsoProvisionUserContext) {
  const issuer = context.provider?.issuer ?? context.provider?.providerId ?? ""
  const subject = context.userInfo?.sub ?? context.user?.id ?? ""

  return {
    issuer,
    subject,
    email: context.userInfo?.email ?? context.user?.email ?? null,
    displayName: context.userInfo?.name ?? context.user?.name ?? null,
  }
}

function authBaseUrl() {
  const value = process.env.BETTER_AUTH_URL ?? process.env.NUXT_APP_DOMAIN

  if (!value) {
    return undefined
  }

  return value.startsWith("http://") || value.startsWith("https://")
    ? value
    : `https://${value}`
}

function trustedOrigins() {
  const origins = [
    process.env.BETTER_AUTH_URL,
    process.env.NUXT_APP_DOMAIN,
    process.env.BETTER_AUTH_TRUSTED_ORIGINS,
  ]
    .filter((value): value is string => Boolean(value))
    .flatMap((value) => value.split(","))
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) =>
      value.startsWith("http://") || value.startsWith("https://")
        ? value
        : `https://${value}`,
    )

  return [...new Set(origins)]
}
