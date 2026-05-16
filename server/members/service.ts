import { createDrizzleMemberRepository } from "./drizzle-member-repository"
import { createMemberIdentity } from "./member-identity"

export function createProductionMemberIdentity() {
  return createMemberIdentity({
    repository: createDrizzleMemberRepository(),
  })
}
