export interface AdminShellMemberSession {
  member: {
    id: string
    isAdmin?: boolean
  } | null
}

export const memberDashboardPath = "/"

export const adminShellSections = [
  {
    label: "Link moderation",
    description: "Review and moderate Links across the Deployment.",
    to: "/admin#link-moderation",
    icon: "i-lucide-shield-alert",
  },
  {
    label: "Member management",
    description: "Review Members and Admin roles.",
    to: "/admin#member-management",
    icon: "i-lucide-users",
  },
  {
    label: "Deployment configuration",
    description: "Manage Deployment settings and Identity provider setup.",
    to: "/admin#deployment-configuration",
    icon: "i-lucide-sliders-horizontal",
  },
] as const

export function canAccessAdminShell(session: AdminShellMemberSession) {
  return Boolean(session.member?.isAdmin)
}

export function adminShellRedirectPath(session: AdminShellMemberSession) {
  return canAccessAdminShell(session) ? null : memberDashboardPath
}
