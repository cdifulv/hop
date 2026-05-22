import type { AdminShellMemberSession } from "~/utils/admin-shell"
import { authClient } from "~/utils/auth-client"

export function useLiveMemberSession() {
  const session = authClient.useSession()
  const liveMemberSession = useState<AdminShellMemberSession>(
    "live-member-session",
    () => ({ member: null }),
  )
  const pending = ref(false)

  const authPending = computed(() => session.value?.isPending ?? true)
  const authUserId = computed(() => session.value?.data?.user?.id ?? null)

  async function refreshLiveMemberSession() {
    if (authPending.value) {
      return
    }

    if (!authUserId.value) {
      liveMemberSession.value = { member: null }
      return
    }

    pending.value = true

    try {
      liveMemberSession.value = await $fetch<AdminShellMemberSession>(
        "/api/member/session",
      )
    } catch {
      liveMemberSession.value = { member: null }
    } finally {
      pending.value = false
    }
  }

  watch([authUserId, authPending], () => void refreshLiveMemberSession(), {
    immediate: true,
  })

  return {
    session,
    liveMemberSession,
    pending,
    refreshLiveMemberSession,
  }
}
