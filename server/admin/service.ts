import { createDeploymentAdmin } from "./deployment-admin"
import { createDrizzleDeploymentAdminRepository } from "./drizzle-deployment-admin-repository"

export function createProductionDeploymentAdmin() {
  return createDeploymentAdmin({
    repository: createDrizzleDeploymentAdminRepository(),
    bootstrapCredential: {
      email: process.env.NUXT_BOOTSTRAP_ADMIN_EMAIL,
    },
  })
}
