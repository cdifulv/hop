import { describe, expect, it, vi } from "vitest"

import { createAuthenticatedMemberRequestGuard } from "../../server/members/authenticated-request-guard"
import type { MemberStatus } from "../../server/members/member-status"

function createRequest(statusOf: (member: { id: string }) => Promise<MemberStatus>) {
  const forceSignOut = vi.fn(async () => undefined)
  const guard = createAuthenticatedMemberRequestGuard({
    async sessionFor() {
      return {
        user: {
          id: "member-1",
        },
      }
    },
    async memberForSession(_request, session) {
      return {
        id: session.user?.id ?? "",
      }
    },
    statusOf,
    forceSignOut,
  })

  return {
    forceSignOut,
    handle: () =>
      guard({ headers: new Headers() }, async ({ member }) => ({
        status: "handled",
        memberId: member.id,
      })),
  }
}

describe("authenticated Member request guard", () => {
  it("allows an authenticated request when the live Member status is Active", async () => {
    const request = createRequest(async () => "active")

    await expect(request.handle()).resolves.toEqual({
      status: "handled",
      memberId: "member-1",
    })
    expect(request.forceSignOut).not.toHaveBeenCalled()
  })

  it("rejects a Suspended Member and forces sign-out before the handler runs", async () => {
    const handle = vi.fn(async () => ({ status: "handled" }))
    const forceSignOut = vi.fn(async () => undefined)
    const guard = createAuthenticatedMemberRequestGuard({
      async sessionFor() {
        return {
          user: {
            id: "member-1",
          },
        }
      },
      async memberForSession(_request, session) {
        return {
          id: session.user?.id ?? "",
        }
      },
      async statusOf() {
        return "suspended"
      },
      forceSignOut,
    })

    await expect(
      guard({ headers: new Headers() }, handle),
    ).rejects.toMatchObject({
      statusCode: 401,
      statusMessage: "member_suspended",
    })
    expect(forceSignOut).toHaveBeenCalledOnce()
    expect(handle).not.toHaveBeenCalled()
  })

  it("checks live Member status on every authenticated request", async () => {
    const statuses: MemberStatus[] = ["active", "suspended"]
    const request = createRequest(async () => statuses.shift() ?? "suspended")

    await expect(request.handle()).resolves.toEqual({
      status: "handled",
      memberId: "member-1",
    })
    await expect(request.handle()).rejects.toMatchObject({
      statusCode: 401,
      statusMessage: "member_suspended",
    })
    expect(request.forceSignOut).toHaveBeenCalledOnce()
  })
})
