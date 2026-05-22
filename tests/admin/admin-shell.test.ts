import { describe, expect, it } from "vitest"

import {
  adminShellSections,
  canAccessAdminShell,
  adminShellRedirectPath,
} from "../../app/utils/admin-shell"

describe("Admin shell access", () => {
  it("allows an Admin to reach the Admin shell and exposes the Admin areas", () => {
    expect(canAccessAdminShell({ member: { id: "admin-1", isAdmin: true } })).toBe(
      true,
    )
    expect(adminShellRedirectPath({ member: { id: "admin-1", isAdmin: true } })).toBe(
      null,
    )
    expect(adminShellSections.map((section) => section.label)).toEqual([
      "Link moderation",
      "Member management",
      "Deployment configuration",
    ])
  })

  it("redirects a non-admin Member or Anonymous visitor to the Member dashboard", () => {
    expect(canAccessAdminShell({ member: { id: "member-1", isAdmin: false } })).toBe(
      false,
    )
    expect(adminShellRedirectPath({ member: { id: "member-1", isAdmin: false } })).toBe(
      "/",
    )
    expect(canAccessAdminShell({ member: null })).toBe(false)
    expect(adminShellRedirectPath({ member: null })).toBe("/")
  })

  it("uses the latest Member session when an Admin is demoted", () => {
    let session = { member: { id: "member-1", isAdmin: true } }

    expect(adminShellRedirectPath(session)).toBe(null)

    session = { member: { id: "member-1", isAdmin: false } }

    expect(adminShellRedirectPath(session)).toBe("/")
  })
})
