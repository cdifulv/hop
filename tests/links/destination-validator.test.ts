import { describe, expect, it } from "vitest"

import { createDestinationValidator } from "../../server/links/destination-validator"

const resolverFor = (records: Record<string, string[]>) => ({
  resolve: async (hostname: string) => records[hostname] ?? [],
})

describe("Destination validation", () => {
  it("accepts http and https Destinations", async () => {
    const validator = createDestinationValidator(
      resolverFor({
        "docs.example.com": ["93.184.216.34"],
      }),
    )

    await expect(validator.validate("http://docs.example.com/deck")).resolves.toEqual({
      status: "valid",
      destination: "http://docs.example.com/deck",
    })
    await expect(validator.validate("https://docs.example.com/deck")).resolves.toEqual({
      status: "valid",
      destination: "https://docs.example.com/deck",
    })
  })

  it("rejects unsupported schemes", async () => {
    const validator = createDestinationValidator(resolverFor({}))

    await expect(validator.validate("mailto:ops@example.com")).resolves.toEqual({
      status: "rejected",
      reason: "unsupported_scheme",
    })
  })

  it("rejects Destinations resolving to internal addresses", async () => {
    const validator = createDestinationValidator(
      resolverFor({
        "private.example.com": ["10.0.0.4"],
        "loopback.example.com": ["127.0.0.1"],
        "link-local.example.com": ["169.254.1.1"],
        "metadata.example.com": ["fd00:ec2::254"],
      }),
    )

    await expect(validator.validate("https://private.example.com")).resolves.toEqual({
      status: "rejected",
      reason: "blocked_address",
    })
    await expect(validator.validate("https://loopback.example.com")).resolves.toEqual({
      status: "rejected",
      reason: "blocked_address",
    })
    await expect(validator.validate("https://link-local.example.com")).resolves.toEqual({
      status: "rejected",
      reason: "blocked_address",
    })
    await expect(validator.validate("https://metadata.example.com")).resolves.toEqual({
      status: "rejected",
      reason: "blocked_address",
    })
  })

  it("rejects over-length Destinations", async () => {
    const validator = createDestinationValidator(resolverFor({}))

    await expect(validator.validate(`https://example.com/${"a".repeat(2049)}`)).resolves.toEqual({
      status: "rejected",
      reason: "destination_too_long",
    })
  })
})
