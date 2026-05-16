import {
  createDrizzleAuthenticatedMemberResolver,
  createDrizzleMemberRepository,
  createDrizzleMemberStatusRepository,
} from "./drizzle-member-repository"
import { createMemberIdentity } from "./member-identity"
import { createMemberStatus } from "./member-status"

export function createProductionMemberIdentity() {
  return createMemberIdentity({
    repository: createDrizzleMemberRepository(),
  })
}

export function createProductionMemberStatus() {
  return createMemberStatus({
    repository: createDrizzleMemberStatusRepository(),
  })
}

export function createProductionAuthenticatedMemberResolver() {
  return createDrizzleAuthenticatedMemberResolver()
}
