import { describe, expect, it } from "vitest"

import { createMemberIdentity } from "../../server/members/member-identity"
import { createMemoryMemberRepository } from "../support/memory-member-repository"

describe("SSO Member identity", () => {
  it("creates a Member on first successful SSO without a separate approval step", async () => {
    const members = createMemberIdentity({
      repository: createMemoryMemberRepository(),
    })

    const member = await members.memberForSsoIdentity({
      issuer: "https://identity.example.com",
      subject: "idp-subject-123",
      email: "casey@example.com",
      displayName: "Casey Nguyen",
    })

    expect(member).toEqual(
      expect.objectContaining({
        identityProviderIssuer: "https://identity.example.com",
        identityProviderSubject: "idp-subject-123",
        email: "casey@example.com",
        displayName: "Casey Nguyen",
        isAdmin: false,
        isBootstrapAdmin: false,
        suspended: false,
      }),
    )
  })

  it("keeps the same Member when the Identity provider changes email metadata", async () => {
    const members = createMemberIdentity({
      repository: createMemoryMemberRepository(),
    })

    const original = await members.memberForSsoIdentity({
      issuer: "https://identity.example.com",
      subject: "idp-subject-123",
      email: "casey@example.com",
      displayName: "Casey Nguyen",
    })

    const changed = await members.memberForSsoIdentity({
      issuer: "https://identity.example.com",
      subject: "idp-subject-123",
      email: "casey.renamed@example.com",
      displayName: "Casey Ho",
    })

    expect(changed).toEqual(
      expect.objectContaining({
        id: original.id,
        identityProviderIssuer: "https://identity.example.com",
        identityProviderSubject: "idp-subject-123",
        email: "casey.renamed@example.com",
        displayName: "Casey Ho",
      }),
    )
  })

  it("treats the same subject from a different issuer as a different Member", async () => {
    const members = createMemberIdentity({
      repository: createMemoryMemberRepository(),
    })

    const firstIssuer = await members.memberForSsoIdentity({
      issuer: "https://identity.example.com",
      subject: "shared-subject",
      email: "casey@example.com",
    })

    const secondIssuer = await members.memberForSsoIdentity({
      issuer: "https://other-idp.example.com",
      subject: "shared-subject",
      email: "casey@example.com",
    })

    expect(secondIssuer).toEqual(
      expect.objectContaining({
        identityProviderIssuer: "https://other-idp.example.com",
        identityProviderSubject: "shared-subject",
      }),
    )
    expect(secondIssuer.id).not.toBe(firstIssuer.id)
  })
})
