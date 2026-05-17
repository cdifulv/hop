import { describe, expect, it, vi } from "vitest"

import { createLinkLifecycle } from "../../server/links/link-lifecycle"
import { createSlugAllocator } from "../../server/links/slug-allocator"
import { createAuthenticatedMemberRequestGuard } from "../../server/members/authenticated-request-guard"
import { createMemberIdentity } from "../../server/members/member-identity"
import { createMemberSuspension } from "../../server/members/member-suspension"
import { createMemberStatus } from "../../server/members/member-status"
import { createMemoryLinkRepository } from "../support/memory-link-repository"
import { createMemoryMemberRepository } from "../support/memory-member-repository"

function createFixture() {
  const memberRepository = createMemoryMemberRepository([
    {
      issuer: "https://identity.example.com",
      subject: "member-1",
      email: "member-1@example.com",
    },
  ])
  const linkRepository = createMemoryLinkRepository([
    {
      slug: "first-link",
      slugKey: "first-link",
      destination: "https://docs.example.com/first",
      ownerMemberId: "member-1",
    },
    {
      slug: "second-link",
      slugKey: "second-link",
      destination: "https://docs.example.com/second",
      ownerMemberId: "member-1",
    },
    {
      slug: "other-member-link",
      slugKey: "other-member-link",
      destination: "https://docs.example.com/other",
      ownerMemberId: "member-2",
    },
    {
      slug: "anonymous-link",
      slugKey: "anonymous-link",
      destination: "https://docs.example.com/anonymous",
      ownerMemberId: null,
    },
  ])
  const links = createLinkLifecycle({
    repository: linkRepository,
    validateDestination: (destination) => ({ status: "accepted", destination }),
    slugAllocator: createSlugAllocator({
      repository: linkRepository,
      randomBase62: () => "unused",
    }),
  })
  const invalidateSessions = vi.fn(async () => undefined)
  const suspension = createMemberSuspension({
    members: memberRepository,
    links,
    sessions: {
      invalidateSessions,
    },
    clock: {
      now: () => new Date("2026-05-17T12:00:00.000Z"),
    },
  })
  const status = createMemberStatus({
    repository: memberRepository,
  })

  return {
    invalidateSessions,
    links,
    memberRepository,
    status,
    suspension,
  }
}

describe("Member suspension", () => {
  it("suspends a Member, cascades to their Links, and emits active-session invalidation", async () => {
    const fixture = createFixture()

    await expect(
      fixture.suspension.suspendMember(
        { id: "admin-1", isAdmin: true },
        "member-1",
      ),
    ).resolves.toEqual({
      status: "suspended",
      member: expect.objectContaining({
        id: "member-1",
        suspended: true,
        suspendedAt: new Date("2026-05-17T12:00:00.000Z"),
      }),
      links: [
        expect.objectContaining({ slug: "first-link", lifecycleState: "suspended" }),
        expect.objectContaining({ slug: "second-link", lifecycleState: "suspended" }),
      ],
    })

    await expect(fixture.status.statusOf({ id: "member-1" })).resolves.toBe(
      "suspended",
    )
    await expect(fixture.links.resolve("first-link")).resolves.toEqual({
      status: "suspended",
    })
    await expect(fixture.links.resolve("second-link")).resolves.toEqual({
      status: "suspended",
    })
    await expect(fixture.links.resolve("other-member-link")).resolves.toEqual({
      status: "redirect",
      destination: "https://docs.example.com/other",
    })
    await expect(fixture.links.resolve("anonymous-link")).resolves.toEqual({
      status: "redirect",
      destination: "https://docs.example.com/anonymous",
    })
    expect(fixture.invalidateSessions).toHaveBeenCalledWith(
      expect.objectContaining({ id: "member-1" }),
    )
  })

  it("unsuspends a Member and restores their Links without retiring Slugs", async () => {
    const fixture = createFixture()

    await fixture.suspension.suspendMember(
      { id: "admin-1", isAdmin: true },
      "member-1",
    )

    await expect(
      fixture.suspension.unsuspendMember(
        { id: "admin-1", isAdmin: true },
        "member-1",
      ),
    ).resolves.toEqual({
      status: "unsuspended",
      member: expect.objectContaining({
        id: "member-1",
        suspended: false,
        suspendedAt: null,
      }),
      links: [
        expect.objectContaining({ slug: "first-link", lifecycleState: "active" }),
        expect.objectContaining({ slug: "second-link", lifecycleState: "active" }),
      ],
    })

    await expect(fixture.status.statusOf({ id: "member-1" })).resolves.toBe("active")
    await expect(fixture.links.resolve("first-link")).resolves.toEqual({
      status: "redirect",
      destination: "https://docs.example.com/first",
    })
    await expect(
      fixture.links.create({
        destination: "https://docs.example.com/reuse",
        slug: "FIRST-LINK",
      }),
    ).resolves.toEqual({
      status: "rejected",
      reason: "slug_taken",
    })
  })

  it("blocks SSO sign-in while the Member is suspended and allows it after restore", async () => {
    const fixture = createFixture()

    await fixture.suspension.suspendMember(
      { id: "admin-1", isAdmin: true },
      "member-1",
    )

    const memberIdentity = createMemberIdentity({
      repository: fixture.memberRepository,
    })

    await expect(
      memberIdentity.memberForSsoIdentity({
        issuer: "https://identity.example.com",
        subject: "member-1",
        email: "member-1@example.com",
      }),
    ).rejects.toThrow("Member is suspended")

    await fixture.suspension.unsuspendMember(
      { id: "admin-1", isAdmin: true },
      "member-1",
    )

    await expect(
      memberIdentity.memberForSsoIdentity({
        issuer: "https://identity.example.com",
        subject: "member-1",
        email: "member-1@example.com",
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        id: "member-1",
        suspended: false,
      }),
    )
  })

  it("denies the next authenticated request through the live status guard", async () => {
    const fixture = createFixture()
    const forceSignOut = vi.fn(async () => undefined)
    const handle = vi.fn(async () => ({ status: "handled" }))
    const guard = createAuthenticatedMemberRequestGuard({
      async sessionFor() {
        return {
          user: {
            id: "better-auth-user-1",
          },
        }
      },
      async memberForSession() {
        return {
          id: "member-1",
        }
      },
      statusOf: (member) => fixture.status.statusOf(member),
      forceSignOut,
    })

    await fixture.suspension.suspendMember(
      { id: "admin-1", isAdmin: true },
      "member-1",
    )

    await expect(
      guard({ headers: new Headers() }, handle),
    ).rejects.toMatchObject({
      statusCode: 401,
      statusMessage: "member_suspended",
    })
    expect(forceSignOut).toHaveBeenCalledOnce()
    expect(handle).not.toHaveBeenCalled()
  })
})
