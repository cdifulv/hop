import { describe, expect, it, vi } from "vitest"

import { createLinkLifecycle } from "../../server/links/link-lifecycle"
import { createSlugAllocator } from "../../server/links/slug-allocator"
import { createAuthenticatedMemberAccess } from "../../server/members/authenticated-member"
import { createAuthenticatedMemberRequestGuard } from "../../server/members/authenticated-request-guard"
import { createMemberIdentity } from "../../server/members/member-identity"
import { createMemberModeration } from "../../server/moderation/member-moderation"
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
  // The cascade runs through the one Moderation seam over the *real* Member
  // and Link seams — only the session invalidator is a spy.
  const moderation = createMemberModeration({
    members: memberRepository,
    links,
    sessions: {
      invalidateSessions,
    },
    clock: {
      now: () => new Date("2026-05-17T12:00:00.000Z"),
    },
  })
  const access = createAuthenticatedMemberAccess({
    async sessionFor() {
      return { user: { id: "member-1" } }
    },
    async memberForSession() {
      return { id: "member-1" }
    },
    statusOf: (member) => memberRepository.statusOf(member),
  })

  return {
    access,
    invalidateSessions,
    links,
    memberRepository,
    moderation,
  }
}

describe("Member moderation", () => {
  it("suspends a Member as one act: status flip, Link cascade, session invalidation", async () => {
    const fixture = createFixture()

    await expect(
      fixture.moderation.suspendMember(
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

    await expect(
      fixture.memberRepository.statusOf({ id: "member-1" }),
    ).resolves.toBe("suspended")
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

  it("requires Admin rights — a non-Admin actor cannot suspend", async () => {
    const fixture = createFixture()

    await expect(
      fixture.moderation.suspendMember({ id: "member-2" }, "member-1"),
    ).resolves.toEqual({ status: "not_found" })
    await expect(
      fixture.memberRepository.statusOf({ id: "member-1" }),
    ).resolves.toBe("active")
    expect(fixture.invalidateSessions).not.toHaveBeenCalled()
  })

  it("unsuspends a Member and restores their Links without retiring Slugs", async () => {
    const fixture = createFixture()

    await fixture.moderation.suspendMember(
      { id: "admin-1", isAdmin: true },
      "member-1",
    )

    await expect(
      fixture.moderation.unsuspendMember(
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

    await expect(
      fixture.memberRepository.statusOf({ id: "member-1" }),
    ).resolves.toBe("active")
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

  it("leaves a directly-Suspended Link halted after its Member is unsuspended", async () => {
    const fixture = createFixture()

    await fixture.links.suspendAdminLink(
      { id: "admin-link", isAdmin: true },
      "first-link",
    )
    await fixture.moderation.suspendMember(
      { id: "admin-member", isAdmin: true },
      "member-1",
    )

    await expect(
      fixture.moderation.unsuspendMember(
        { id: "admin-member", isAdmin: true },
        "member-1",
      ),
    ).resolves.toEqual({
      status: "unsuspended",
      member: expect.objectContaining({
        id: "member-1",
        suspended: false,
      }),
      links: [
        expect.objectContaining({
          slug: "first-link",
          lifecycleState: "suspended",
        }),
        expect.objectContaining({
          slug: "second-link",
          lifecycleState: "active",
        }),
      ],
    })

    await expect(fixture.links.resolve("first-link")).resolves.toEqual({
      status: "suspended",
    })
    await expect(fixture.links.resolve("second-link")).resolves.toEqual({
      status: "redirect",
      destination: "https://docs.example.com/second",
    })
  })

  it("blocks SSO sign-in while the Member is suspended and allows it after restore", async () => {
    const fixture = createFixture()

    await fixture.moderation.suspendMember(
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

    await fixture.moderation.unsuspendMember(
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
      access: fixture.access,
      forceSignOut,
    })

    await fixture.moderation.suspendMember(
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
