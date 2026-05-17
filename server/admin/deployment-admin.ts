import type { MemberRecord } from "../members/member-identity"

export type DeploymentMember = MemberRecord

export interface DeploymentConfig {
  appDomain: string | null
  shortDomain: string | null
  identityProviderActive: boolean
  identityProviderIssuer: string | null
  identityProviderClientId: string | null
  identityProviderClientSecretRef: string | null
  anonymousCreationEnabled: boolean
}

export interface ConfigureDeploymentInput {
  appDomain: string
  shortDomain: string
  identityProvider: {
    active: boolean
    issuer: string
    clientId: string
    clientSecretRef: string
  }
}

export interface DeploymentAdminRepository {
  currentConfig(): Promise<DeploymentConfig>
  saveConfig(input: Partial<DeploymentConfig>): Promise<DeploymentConfig>
  findMember(id: string): Promise<DeploymentMember | null>
  countNonBootstrapAdmins(): Promise<number>
  setAdmin(memberId: string, isAdmin: boolean): Promise<DeploymentMember | null>
}

interface DeploymentAdminOptions {
  repository: DeploymentAdminRepository
  bootstrapCredential: {
    email?: string | null
  }
}

export function createDeploymentAdmin(options: DeploymentAdminOptions) {
  async function get() {
    return options.repository.currentConfig()
  }

  async function isBootstrapEnabled() {
    const config = await get()
    const nonBootstrapAdminCount = await options.repository.countNonBootstrapAdmins()

    return !(config.identityProviderActive && nonBootstrapAdminCount > 0)
  }

  async function update(actor: DeploymentMember, input: ConfigureDeploymentInput) {
    assertAdmin(actor)

    return options.repository.saveConfig({
      appDomain: required(input.appDomain, "App domain is required"),
      shortDomain: required(input.shortDomain, "Short domain is required"),
      identityProviderActive: input.identityProvider.active,
      identityProviderIssuer: required(
        input.identityProvider.issuer,
        "Identity provider issuer is required",
      ),
      identityProviderClientId: required(
        input.identityProvider.clientId,
        "Identity provider client ID is required",
      ),
      identityProviderClientSecretRef: required(
        input.identityProvider.clientSecretRef,
        "Identity provider client secret reference is required",
      ),
    })
  }

  async function promote(actor: DeploymentMember, memberId: string) {
    assertAdmin(actor)
    return setAdminRole(options.repository, memberId, true)
  }

  async function demote(actor: DeploymentMember, memberId: string) {
    assertAdmin(actor)

    if (actor.id === memberId) {
      throw new Error("Admins cannot demote themselves")
    }

    return setAdminRole(options.repository, memberId, false)
  }

  return {
    get,
    update,
    promote,
    demote,

    async isBootstrapCredentialEnabled() {
      return isBootstrapEnabled()
    },

    async isBootstrapEnabled() {
      return isBootstrapEnabled()
    },

    async canAttemptBootstrapCredentialSignIn(email: string) {
      if (!sameEmail(email, options.bootstrapCredential.email)) {
        return false
      }

      return isBootstrapEnabled()
    },

    async configureDeployment(
      actor: DeploymentMember,
      input: ConfigureDeploymentInput,
    ): Promise<DeploymentConfig> {
      return update(actor, input)
    },

    async promoteMemberToAdmin(actor: DeploymentMember, memberId: string) {
      return promote(actor, memberId)
    },

    async demoteMemberFromAdmin(actor: DeploymentMember, memberId: string) {
      return demote(actor, memberId)
    },

    async isAnonCreationEnabled() {
      const config = await get()
      return config.anonymousCreationEnabled
    },
  }
}

async function setAdminRole(
  repository: DeploymentAdminRepository,
  memberId: string,
  isAdmin: boolean,
) {
  const member = await repository.findMember(memberId)

  if (!member) {
    throw new Error("Member not found")
  }

  if (member.isBootstrapAdmin) {
    throw new Error("Bootstrap admin role cannot be changed")
  }

  const updated = await repository.setAdmin(memberId, isAdmin)

  if (!updated) {
    throw new Error("Member not found")
  }

  return updated
}

function assertAdmin(actor: DeploymentMember) {
  if (!actor.isAdmin) {
    throw new Error("Admin privileges are required")
  }
}

function required(value: string, message: string) {
  const normalized = value.trim()

  if (!normalized) {
    throw new Error(message)
  }

  return normalized
}

function sameEmail(left: string, right?: string | null) {
  return Boolean(right) && left.trim().toLowerCase() === right.trim().toLowerCase()
}
