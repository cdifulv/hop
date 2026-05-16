export type DestinationValidationResult =
  | {
      status: "valid"
      destination: string
    }
  | {
      status: "rejected"
      reason: "invalid_url" | "unsupported_scheme"
    }

export function validateDestination(input: string): DestinationValidationResult {
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

  return {
    status: "valid",
    destination: destination.toString(),
  }
}
