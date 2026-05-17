import { and, count, eq } from "drizzle-orm"

import { db } from "../db"
import { deploymentConfig, members } from "../db/schema/hop"
import { toMemberRecord } from "../members/drizzle-member-repository"
import type {
  DeploymentAdminRepository,
  DeploymentConfig,
} from "./deployment-admin"

const defaultConfigKey = "default"

export function createDrizzleDeploymentAdminRepository(): DeploymentAdminRepository {
  return {
    async currentConfig() {
      const [config] = await db
        .select()
        .from(deploymentConfig)
        .where(eq(deploymentConfig.key, defaultConfigKey))
        .limit(1)

      return config ? toDeploymentConfig(config) : defaultDeploymentConfig()
    },

    async saveConfig(input) {
      const [config] = await db
        .insert(deploymentConfig)
        .values({
          key: defaultConfigKey,
          ...input,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: deploymentConfig.key,
          set: {
            ...input,
            updatedAt: new Date(),
          },
        })
        .returning()

      if (!config) {
        throw new Error("Deployment config upsert did not return a row")
      }

      return toDeploymentConfig(config)
    },

    async findMember(id) {
      const [member] = await db
        .select()
        .from(members)
        .where(eq(members.id, id))
        .limit(1)

      return member ? toMemberRecord(member) : null
    },

    async countNonBootstrapAdmins() {
      const [result] = await db
        .select({
          value: count(),
        })
        .from(members)
        .where(and(eq(members.isAdmin, true), eq(members.isBootstrapAdmin, false)))

      return result?.value ?? 0
    },

    async setAdmin(memberId, isAdmin) {
      const [member] = await db
        .update(members)
        .set({
          isAdmin,
          updatedAt: new Date(),
        })
        .where(eq(members.id, memberId))
        .returning()

      return member ? toMemberRecord(member) : null
    },
  }
}

function defaultDeploymentConfig(): DeploymentConfig {
  return {
    appDomain: null,
    shortDomain: null,
    identityProviderActive: false,
    identityProviderIssuer: null,
    identityProviderClientId: null,
    identityProviderClientSecretRef: null,
    anonymousCreationEnabled: true,
  }
}

function toDeploymentConfig(config: typeof deploymentConfig.$inferSelect): DeploymentConfig {
  return {
    appDomain: config.appDomain,
    shortDomain: config.shortDomain,
    identityProviderActive: config.identityProviderActive,
    identityProviderIssuer: config.identityProviderIssuer,
    identityProviderClientId: config.identityProviderClientId,
    identityProviderClientSecretRef: config.identityProviderClientSecretRef,
    anonymousCreationEnabled: config.anonymousCreationEnabled,
  }
}
