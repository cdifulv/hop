export type LinkActor =
  | {
      type: "anonymous"
    }
  | {
      type: "member"
      memberId: string
    }

export type LinkAction = "view" | "delete" | "update_expiration"

interface AuthorizableLink {
  ownerMemberId: string | null
}

export function can(actor: LinkActor, action: LinkAction, link: AuthorizableLink) {
  void action

  return actor.type === "member" && link.ownerMemberId === actor.memberId
}
