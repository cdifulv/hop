import { describe, expect, it } from "vitest"

import { can } from "../../server/links/authorization-policy"

const ownedLink = {
  ownerMemberId: "member-1",
}

const anonymousLink = {
  ownerMemberId: null,
}

describe("Link authorization policy", () => {
  it("allows a Member to view, delete, and manage Expiration for their own Links", () => {
    const actor = { type: "member" as const, memberId: "member-1" }

    expect(can(actor, "view", ownedLink)).toBe(true)
    expect(can(actor, "delete", ownedLink)).toBe(true)
    expect(can(actor, "update_expiration", ownedLink)).toBe(true)
  })

  it("denies Anonymous visitors and non-owner Members", () => {
    expect(can({ type: "anonymous" }, "view", anonymousLink)).toBe(false)
    expect(can({ type: "anonymous" }, "delete", anonymousLink)).toBe(false)
    expect(can({ type: "anonymous" }, "update_expiration", anonymousLink)).toBe(
      false,
    )
    expect(can({ type: "member", memberId: "member-2" }, "view", ownedLink)).toBe(
      false,
    )
    expect(can({ type: "member", memberId: "member-2" }, "delete", ownedLink)).toBe(
      false,
    )
    expect(
      can({ type: "member", memberId: "member-2" }, "update_expiration", ownedLink),
    ).toBe(false)
  })
})
