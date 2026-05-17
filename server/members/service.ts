import {
  createDrizzleAuthenticatedMemberResolver,
  createDrizzleMemberRepository,
  createDrizzleMemberSessionInvalidator,
  createDrizzleMemberSuspensionRepository,
  createDrizzleMemberStatusRepository,
} from "./drizzle-member-repository"
import { createProductionLinkLifecycle } from "../links/service"
import { createMemberIdentity } from "./member-identity"
import { createMemberSuspension } from "./member-suspension"
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

export function createProductionMemberSuspension() {
  return createMemberSuspension({
    members: createDrizzleMemberSuspensionRepository(),
    links: createProductionLinkLifecycle(),
    sessions: createDrizzleMemberSessionInvalidator(),
  })
}

export function createProductionAuthenticatedMemberResolver() {
  return createDrizzleAuthenticatedMemberResolver()
}
