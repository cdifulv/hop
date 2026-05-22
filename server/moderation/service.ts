import { createProductionLinkLifecycle } from "../links/service"
import {
  createDrizzleMemberSessionInvalidator,
  createDrizzleMemberSuspensionRepository,
} from "../members/drizzle-member-repository"
import { createMemberModeration } from "./member-moderation"

export function createProductionMemberModeration() {
  return createMemberModeration({
    members: createDrizzleMemberSuspensionRepository(),
    links: createProductionLinkLifecycle(),
    sessions: createDrizzleMemberSessionInvalidator(),
  })
}
