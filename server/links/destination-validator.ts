import { lookup } from "node:dns/promises"
import { isIP } from "node:net"

const MAX_DESTINATION_LENGTH = 2048

export type DestinationValidationResult =
  | {
      status: "valid"
      destination: string
    }
  | {
      status: "rejected"
      reason:
        | "invalid_url"
        | "unsupported_scheme"
        | "destination_too_long"
        | "dns_lookup_failed"
        | "blocked_address"
    }

export interface DestinationResolver {
  resolve(hostname: string): Promise<string[]>
}

export interface DestinationValidator {
  validate(input: string): Promise<DestinationValidationResult>
}

const defaultResolver: DestinationResolver = {
  async resolve(hostname: string): Promise<string[]> {
    const records = await lookup(hostname, {
      all: true,
      verbatim: true,
    })

    return records.map((record) => record.address)
  },
}

export function createDestinationValidator(
  resolver: DestinationResolver = defaultResolver,
): DestinationValidator {
  return {
    async validate(input: string): Promise<DestinationValidationResult> {
      if (input.length > MAX_DESTINATION_LENGTH) {
        return {
          status: "rejected",
          reason: "destination_too_long",
        }
      }

      let destination: URL

      try {
        destination = new URL(input)
      } catch {
        return {
          status: "rejected",
          reason: "invalid_url",
        }
      }

      if (destination.protocol !== "http:" && destination.protocol !== "https:") {
        return {
          status: "rejected",
          reason: "unsupported_scheme",
        }
      }

      let addresses: string[]

      try {
        addresses = await resolveDestinationAddresses(destination.hostname, resolver)
      } catch {
        return {
          status: "rejected",
          reason: "dns_lookup_failed",
        }
      }

      if (addresses.length === 0 || addresses.some(isBlockedAddress)) {
        return {
          status: "rejected",
          reason: addresses.length === 0 ? "dns_lookup_failed" : "blocked_address",
        }
      }

      return {
        status: "valid",
        destination: destination.toString(),
      }
    },
  }
}

export function validateDestination(input: string): Promise<DestinationValidationResult> {
  return createDestinationValidator().validate(input)
}

async function resolveDestinationAddresses(
  hostname: string,
  resolver: DestinationResolver,
): Promise<string[]> {
  const address = hostname.replace(/^\[(.*)\]$/, "$1")

  if (isIP(address)) {
    return [address]
  }

  return resolver.resolve(hostname)
}

function isBlockedAddress(address: string): boolean {
  const ipVersion = isIP(address)

  if (ipVersion === 4) {
    return isBlockedIpv4Address(address)
  }

  if (ipVersion === 6) {
    const mappedIpv4Address = parseIpv4MappedIpv6Address(address)

    if (mappedIpv4Address) {
      return isBlockedIpv4Address(mappedIpv4Address)
    }

    return isBlockedIpv6Address(address)
  }

  return true
}

function isBlockedIpv4Address(address: string): boolean {
  const octets = address.split(".").map((part) => Number(part))
  const [first, second, third, fourth] = octets

  if (octets.length !== 4 || octets.some((octet) => !Number.isInteger(octet))) {
    return true
  }

  return (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    (first === 100 && second >= 64 && second <= 127) ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168) ||
    (first === 100 && second === 100 && third === 100 && fourth === 200)
  )
}

function isBlockedIpv6Address(address: string): boolean {
  const normalized = address.toLowerCase()
  const firstHextet = Number.parseInt(normalized.split(":")[0] || "0", 16)

  return (
    normalized === "::" ||
    normalized === "::1" ||
    normalized === "fd00:ec2::254" ||
    (firstHextet & 0xfe00) === 0xfc00 ||
    (firstHextet & 0xffc0) === 0xfe80
  )
}

function parseIpv4MappedIpv6Address(address: string): string | null {
  const normalized = address.toLowerCase()

  if (!normalized.startsWith("::ffff:")) {
    return null
  }

  const mappedAddress = normalized.slice("::ffff:".length)

  if (isIP(mappedAddress) === 4) {
    return mappedAddress
  }

  const hextets = mappedAddress.split(":")

  if (hextets.length !== 2) {
    return null
  }

  const first = Number.parseInt(hextets[0], 16)
  const second = Number.parseInt(hextets[1], 16)

  if ([first, second].some((part) => !Number.isInteger(part) || part < 0 || part > 0xffff)) {
    return null
  }

  return [
    (first >> 8) & 0xff,
    first & 0xff,
    (second >> 8) & 0xff,
    second & 0xff,
  ].join(".")
}
