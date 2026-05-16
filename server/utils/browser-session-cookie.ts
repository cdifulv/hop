import { randomBytes } from "node:crypto"

import type { H3Event } from "h3"
import { getCookie, setCookie } from "h3"

const browserSessionCookieName = "hop_browser_session"
const browserSessionMaxAge = 60 * 60 * 24 * 365

export function getBrowserSessionToken(event: H3Event) {
  return getCookie(event, browserSessionCookieName) ?? null
}

export function getOrCreateBrowserSessionToken(event: H3Event) {
  const existing = getBrowserSessionToken(event)

  if (existing) {
    return existing
  }

  const token = randomBytes(32).toString("base64url")

  setCookie(event, browserSessionCookieName, token, {
    httpOnly: true,
    maxAge: browserSessionMaxAge,
    path: "/",
    sameSite: "lax",
    secure: !import.meta.dev,
  })

  return token
}
