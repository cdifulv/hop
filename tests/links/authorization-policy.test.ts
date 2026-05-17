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
    expect(
      can({ type: "member", memberId: "member-2" }, "delete", anonymousLink),
    ).toBe(false)
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

  it("allows an Admin to view, delete, and suspend any Link, including the Anonymous pool", () => {
    const admin = { type: "member" as const, memberId: "admin-1", isAdmin: true }

    expect(can(admin, "view", ownedLink)).toBe(true)
    expect(can(admin, "delete", ownedLink)).toBe(true)
    expect(can(admin, "suspend", ownedLink)).toBe(true)
    expect(can(admin, "view", anonymousLink)).toBe(true)
    expect(can(admin, "delete", anonymousLink)).toBe(true)
    expect(can(admin, "suspend", anonymousLink)).toBe(true)
  })

  it("does not let Admin moderation rights change another Member's Expiration", () => {
    const admin = { type: "member" as const, memberId: "admin-1", isAdmin: true }

    expect(can(admin, "update_expiration", ownedLink)).toBe(false)
  })

  it("denies every Link action for a Suspended Member", () => {
    const suspendedMember = {
      type: "member" as const,
      memberId: "member-1",
      suspended: true,
    }
    const suspendedAdmin = {
      type: "member" as const,
      memberId: "admin-1",
      isAdmin: true,
      suspended: true,
    }

    expect(can(suspendedMember, "view", ownedLink)).toBe(false)
    expect(can(suspendedMember, "delete", ownedLink)).toBe(false)
    expect(can(suspendedMember, "update_expiration", ownedLink)).toBe(false)
    expect(can(suspendedMember, "suspend", ownedLink)).toBe(false)
    expect(can(suspendedAdmin, "view", ownedLink)).toBe(false)
    expect(can(suspendedAdmin, "delete", ownedLink)).toBe(false)
    expect(can(suspendedAdmin, "suspend", ownedLink)).toBe(false)
  })
})
