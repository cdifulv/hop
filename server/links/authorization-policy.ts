export type LinkActor =
  | {
      type: "anonymous"
    }
  | {
      type: "member"
      memberId: string
      isAdmin?: boolean
    }

export type LinkAction = "view" | "delete" | "update_expiration"

interface AuthorizableLink {
  ownerMemberId: string | null
}

export function can(actor: LinkActor, action: LinkAction, link: AuthorizableLink) {
  if (actor.type === "anonymous") {
    return false
  }

  if (actor.isAdmin && (action === "view" || action === "delete")) {
    return true
  }

  return link.ownerMemberId === actor.memberId
}
