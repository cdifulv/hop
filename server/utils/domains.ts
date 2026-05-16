import { getRequestHost } from "h3"

export function configuredHost(input: unknown) {
  if (typeof input !== "string") {
    return undefined
  }

  return input.split(":")[0]?.toLowerCase() || undefined
}

export function requestHost(event: Parameters<typeof getRequestHost>[0]) {
  return getRequestHost(event, { xForwardedHost: true }).split(":")[0]?.toLowerCase()
}

export function isConfiguredHost(event: Parameters<typeof getRequestHost>[0], host: unknown) {
  return Boolean(host && requestHost(event) === configuredHost(host))
}
