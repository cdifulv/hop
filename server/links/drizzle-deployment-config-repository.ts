import { eq } from "drizzle-orm"

import { db } from "../db"
import { deploymentConfig } from "../db/schema/hop"

export interface DeploymentConfigRepository {
  anonymousCreationEnabled(): Promise<boolean>
}

export function createDrizzleDeploymentConfigRepository(): DeploymentConfigRepository {
  return {
    async anonymousCreationEnabled() {
      const [config] = await db
        .select({
          anonymousCreationEnabled: deploymentConfig.anonymousCreationEnabled,
        })
        .from(deploymentConfig)
        .where(eq(deploymentConfig.key, "default"))
        .limit(1)

      return config?.anonymousCreationEnabled ?? true
    },
  }
}
