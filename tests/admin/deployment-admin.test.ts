import { describe, expect, it } from "vitest"

import {
  createDeploymentAdmin,
  type DeploymentAdminRepository,
  type DeploymentConfig,
  type DeploymentMember,
} from "../../server/admin/deployment-admin"

function createMemoryDeploymentAdminRepository(options?: {
  config?: Partial<DeploymentConfig>
  members?: DeploymentMember[]
}): DeploymentAdminRepository & {
  member(id: string): DeploymentMember | undefined
} {
  const now = new Date("2026-05-17T00:00:00.000Z")
  let config: DeploymentConfig = {
    appDomain: null,
    shortDomain: null,
    identityProviderActive: false,
    identityProviderIssuer: null,
    identityProviderClientId: null,
    identityProviderClientSecretRef: null,
    anonymousCreationEnabled: true,
    ...options?.config,
  }
  const members = new Map<string, DeploymentMember>(
    (options?.members ?? []).map((member) => [member.id, member]),
  )

  return {
    member(id) {
      return members.get(id)
    },
    async currentConfig() {
      return config
    },
    async saveConfig(input) {
      config = {
        ...config,
        ...input,
      }
      return config
    },
    async findMember(id) {
      return members.get(id) ?? null
    },
    async countNonBootstrapAdmins() {
      return [...members.values()].filter(
        (member) => member.isAdmin && !member.isBootstrapAdmin,
      ).length
    },
    async setAdmin(memberId, isAdmin) {
      const member = members.get(memberId)

      if (!member) {
        return null
      }

      const updated = {
        ...member,
        isAdmin,
        updatedAt: now,
      }
      members.set(memberId, updated)
      return updated
    },
  }
}

function member(input: Partial<DeploymentMember> & { id: string }): DeploymentMember {
  const now = new Date("2026-05-17T00:00:00.000Z")

  return {
    id: input.id,
    identityProviderIssuer: "https://identity.example.com",
    identityProviderSubject: input.id,
    email: `${input.id}@example.com`,
    displayName: input.id,
    isAdmin: false,
    isBootstrapAdmin: false,
    suspended: false,
    suspendedAt: null,
    createdAt: now,
    updatedAt: now,
    ...input,
  }
}

describe("Deployment admin lifecycle", () => {
  it("keeps the Bootstrap admin credential enabled before the Identity provider is active", async () => {
    const deployment = createDeploymentAdmin({
      repository: createMemoryDeploymentAdminRepository(),
      bootstrapCredential: {
        email: "bootstrap@example.com",
      },
    })

    await expect(deployment.isBootstrapCredentialEnabled()).resolves.toBe(true)
    await expect(
      deployment.canAttemptBootstrapCredentialSignIn("bootstrap@example.com"),
    ).resolves.toBe(true)
  })

  it("does not disable the Bootstrap credential when the Identity provider is active but no non-bootstrap Admin exists", async () => {
    const deployment = createDeploymentAdmin({
      repository: createMemoryDeploymentAdminRepository({
        config: {
          identityProviderActive: true,
        },
        members: [
          member({
            id: "bootstrap",
            isAdmin: true,
            isBootstrapAdmin: true,
          }),
        ],
      }),
      bootstrapCredential: {
        email: "bootstrap@example.com",
      },
    })

    await expect(deployment.isBootstrapCredentialEnabled()).resolves.toBe(true)
  })

  it("disables the Bootstrap credential exactly when the Identity provider is active and a non-bootstrap Admin exists", async () => {
    const deployment = createDeploymentAdmin({
      repository: createMemoryDeploymentAdminRepository({
        config: {
          identityProviderActive: true,
        },
        members: [
          member({
            id: "admin-1",
            isAdmin: true,
          }),
        ],
      }),
      bootstrapCredential: {
        email: "bootstrap@example.com",
      },
    })

    await expect(deployment.isBootstrapCredentialEnabled()).resolves.toBe(false)
    await expect(
      deployment.canAttemptBootstrapCredentialSignIn("bootstrap@example.com"),
    ).resolves.toBe(false)
  })

  it("lets an Admin configure the Identity provider and Deployment domains", async () => {
    const repository = createMemoryDeploymentAdminRepository()
    const deployment = createDeploymentAdmin({
      repository,
      bootstrapCredential: {
        email: "bootstrap@example.com",
      },
    })

    await expect(
      deployment.configureDeployment(
        member({
          id: "bootstrap",
          isAdmin: true,
          isBootstrapAdmin: true,
        }),
        {
          appDomain: "app.example.com",
          shortDomain: "go.example.com",
          identityProvider: {
            active: true,
            issuer: "https://identity.example.com",
            clientId: "hop",
            clientSecretRef: "secret/hop/oidc",
          },
        },
      ),
    ).resolves.toEqual(
      expect.objectContaining({
        appDomain: "app.example.com",
        shortDomain: "go.example.com",
        identityProviderActive: true,
        identityProviderIssuer: "https://identity.example.com",
        identityProviderClientId: "hop",
        identityProviderClientSecretRef: "secret/hop/oidc",
      }),
    )
  })

  it("lets the Bootstrap admin promote an SSO-authenticated Member to Admin, then disables the Bootstrap credential", async () => {
    const repository = createMemoryDeploymentAdminRepository({
      config: {
        identityProviderActive: true,
      },
      members: [
        member({
          id: "member-1",
        }),
      ],
    })
    const deployment = createDeploymentAdmin({
      repository,
      bootstrapCredential: {
        email: "bootstrap@example.com",
      },
    })

    await expect(
      deployment.promoteMemberToAdmin(
        member({
          id: "bootstrap",
          isAdmin: true,
          isBootstrapAdmin: true,
        }),
        "member-1",
      ),
    ).resolves.toEqual(
      expect.objectContaining({
        id: "member-1",
        isAdmin: true,
        isBootstrapAdmin: false,
      }),
    )
    await expect(deployment.isBootstrapCredentialEnabled()).resolves.toBe(false)
  })

  it("lets Admins promote and demote other Members", async () => {
    const repository = createMemoryDeploymentAdminRepository({
      members: [
        member({
          id: "admin-1",
          isAdmin: true,
        }),
        member({
          id: "member-1",
        }),
      ],
    })
    const deployment = createDeploymentAdmin({
      repository,
      bootstrapCredential: {
        email: "bootstrap@example.com",
      },
    })

    await deployment.promoteMemberToAdmin(repository.member("admin-1")!, "member-1")
    await expect(
      deployment.demoteMemberFromAdmin(repository.member("admin-1")!, "member-1"),
    ).resolves.toEqual(
      expect.objectContaining({
        id: "member-1",
        isAdmin: false,
      }),
    )
  })

  it("keeps anonymous creation as a kill switch and not a membership-eligibility list", async () => {
    const deployment = createDeploymentAdmin({
      repository: createMemoryDeploymentAdminRepository({
        config: {
          anonymousCreationEnabled: false,
        },
      }),
      bootstrapCredential: {
        email: "bootstrap@example.com",
      },
    })

    await expect(deployment.isAnonCreationEnabled()).resolves.toBe(false)
  })
})
