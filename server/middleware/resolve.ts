import {
  defineEventHandler,
  getHeader,
  getRequestURL,
  send,
  sendRedirect,
  setHeader,
  setResponseStatus,
} from "h3"

import { createProductionLinkLifecycle } from "../links/service"
import { isConfiguredHost } from "../utils/domains"

/**
 * Slug resolver (ADR-0002).
 *
 * Lives as middleware, not a `server/routes/[slug]` handler, so it can decline
 * a request and let the Nuxt app render it. A top-level `[slug]` route would
 * shadow every single-segment app path (incl. `/`) on a single host, which is
 * exactly what breaks local dev where the Short and App domains share
 * `localhost`.
 *
 * - On the Short domain (prod): authoritative — resolve or render Not Found.
 * - On the App domain / any other host (prod): never resolve; serve the app.
 * - In dev (single host): resolve on a real hit, otherwise fall through so the
 *   app route still works.
 */
function renderNotFound(event: Parameters<typeof setResponseStatus>[0]) {
  setResponseStatus(event, 404, "Link Not Found")
  setHeader(event, "content-type", "text/html; charset=utf-8")

  return send(
    event,
    [
      "<!doctype html>",
      '<html lang="en">',
      "<head>",
      '<meta charset="utf-8">',
      '<meta name="viewport" content="width=device-width, initial-scale=1">',
      "<title>Link not found - hop</title>",
      "</head>",
      "<body>",
      "<main>",
      "<h1>Link not found</h1>",
      "<p>This hop does not exist.</p>",
      "</main>",
      "</body>",
      "</html>",
    ].join(""),
  )
}

function renderExpired(event: Parameters<typeof setResponseStatus>[0]) {
  setResponseStatus(event, 410, "Link Expired")
  setHeader(event, "content-type", "text/html; charset=utf-8")

  return send(
    event,
    [
      "<!doctype html>",
      '<html lang="en">',
      "<head>",
      '<meta charset="utf-8">',
      '<meta name="viewport" content="width=device-width, initial-scale=1">',
      "<title>Link expired - hop</title>",
      "</head>",
      "<body>",
      "<main>",
      "<h1>Link expired</h1>",
      "<p>This hop has passed its Expiration and no longer redirects.</p>",
      "</main>",
      "</body>",
      "</html>",
    ].join(""),
  )
}

function renderSuspended(event: Parameters<typeof setResponseStatus>[0]) {
  setResponseStatus(event, 410, "Link Unavailable")
  setHeader(event, "content-type", "text/html; charset=utf-8")

  return send(
    event,
    [
      "<!doctype html>",
      '<html lang="en">',
      "<head>",
      '<meta charset="utf-8">',
      '<meta name="viewport" content="width=device-width, initial-scale=1">',
      "<title>Link unavailable - hop</title>",
      "</head>",
      "<body>",
      "<main>",
      "<h1>Link unavailable</h1>",
      "<p>This hop is currently unavailable.</p>",
      "</main>",
      "</body>",
      "</html>",
    ].join(""),
  )
}

function renderTombstoned(event: Parameters<typeof setResponseStatus>[0]) {
  setResponseStatus(event, 410, "Link No Longer Available")
  setHeader(event, "content-type", "text/html; charset=utf-8")

  return send(
    event,
    [
      "<!doctype html>",
      '<html lang="en">',
      "<head>",
      '<meta charset="utf-8">',
      '<meta name="viewport" content="width=device-width, initial-scale=1">',
      "<title>Link no longer available - hop</title>",
      "</head>",
      "<body>",
      "<main>",
      "<h1>Link no longer available</h1>",
      "<p>This hop was deleted and no longer redirects.</p>",
      "</main>",
      "</body>",
      "</html>",
    ].join(""),
  )
}

export default defineEventHandler(async (event) => {
  if (event.method !== "GET" && event.method !== "HEAD") {
    return
  }

  const segments = getRequestURL(event).pathname.split("/").filter(Boolean)

  // Only a single, dot-free, non-internal segment can be a Slug. Root (`/`),
  // `/api/*`, `/_nuxt/*`, `/__nuxt_*`, and assets like `/favicon.ico` all fall
  // through to the Nuxt app / Nitro internals.
  if (segments.length !== 1) {
    return
  }

  const slug = segments[0]

  if (!slug || slug.startsWith("_") || slug.includes(".")) {
    return
  }

  const config = useRuntimeConfig(event)
  const onShortDomain = isConfiguredHost(event, config.shortDomain)

  // App domain / other host in production: the app owns these routes.
  if (!onShortDomain && !import.meta.dev) {
    return
  }

  const result = await createProductionLinkLifecycle().resolve(slug, {
    referrer: getHeader(event, "referer") ?? getHeader(event, "referrer"),
    userAgent: getHeader(event, "user-agent"),
    ip:
      getHeader(event, "x-forwarded-for") ??
      getHeader(event, "x-real-ip") ??
      event.node.req.socket.remoteAddress,
  })

  if (result.status === "redirect") {
    return sendRedirect(event, result.destination, 302)
  }

  if (result.status === "expired") {
    return renderExpired(event)
  }

  if (result.status === "suspended") {
    return renderSuspended(event)
  }

  if (result.status === "tombstoned") {
    return renderTombstoned(event)
  }

  // Short domain has no app to fall back to — own the Not Found response.
  if (onShortDomain) {
    return renderNotFound(event)
  }

  // Dev single-host miss: not a Slug we know — let the Nuxt app render it.
})
