export type MemberStatus = "active" | "suspended"

export interface MemberStatusRepository {
  statusOf(member: { id: string }): Promise<MemberStatus | null>
}

export interface MemberStatusLookup {
  statusOf(member: { id: string }): Promise<MemberStatus>
}

interface MemberStatusOptions {
  repository: MemberStatusRepository
}

export function createMemberStatus(options: MemberStatusOptions): MemberStatusLookup {
  return {
    async statusOf(member) {
      const status = await options.repository.statusOf(member)

      return status ?? "active"
    },
  }
}
