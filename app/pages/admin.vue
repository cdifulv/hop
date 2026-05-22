<script setup lang="ts">
import {
  adminShellRedirectPath,
  adminShellSections,
  canAccessAdminShell,
} from "~/utils/admin-shell"

useHead({ title: "Admin . hop" })

const { session, liveMemberSession, pending, refreshLiveMemberSession } =
  useLiveMemberSession()

const sessionPending = computed(() => session.value?.isPending ?? true)
const checkingAccess = computed(() => sessionPending.value || pending.value)
const hasAdminAccess = computed(() => canAccessAdminShell(liveMemberSession.value))

onMounted(() => {
  void refreshLiveMemberSession()
})

watchEffect(() => {
  if (checkingAccess.value) {
    return
  }

  const redirectPath = adminShellRedirectPath(liveMemberSession.value)

  if (redirectPath) {
    void navigateTo(redirectPath, { replace: true })
  }
})
</script>

<template>
  <main class="min-h-screen bg-[#F8FAFC] text-[#111827] dark:bg-[#0F172A] dark:text-[#F1F5F9]">
    <AppHeader />

    <section class="border-b border-[#E5E7EB] bg-white px-5 py-8 dark:border-[#273447] dark:bg-[#13223A] sm:px-8 lg:px-14">
      <div class="mx-auto flex max-w-6xl flex-col gap-2">
        <p class="text-xs font-semibold uppercase tracking-normal text-[#0B4DA2] dark:text-[#60A5FA]">
          Admin
        </p>
        <h1 class="m-0 font-serif text-4xl font-bold tracking-normal text-[#0B1320] dark:text-white">
          Deployment administration
        </h1>
      </div>
    </section>

    <section class="px-5 py-8 sm:px-8 lg:px-14">
      <div class="mx-auto max-w-6xl">
        <div
          v-if="checkingAccess || !hasAdminAccess"
          class="flex min-h-48 items-center justify-center text-sm font-medium text-[#6B6F76] dark:text-[#94A3B8]"
        >
          Checking access…
        </div>

        <div v-else class="grid gap-4 md:grid-cols-3">
          <NuxtLink
            v-for="section in adminShellSections"
            :id="section.to.split('#')[1]"
            :key="section.to"
            :to="section.to"
            class="group flex min-h-40 flex-col justify-between rounded-lg border border-[#E5E7EB] bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-[#0B4DA2] hover:shadow-md dark:border-[#273447] dark:bg-[#13223A] dark:hover:border-[#60A5FA]"
          >
            <div class="space-y-3">
              <UIcon
                :name="section.icon"
                class="h-5 w-5 text-[#0B4DA2] dark:text-[#60A5FA]"
              />
              <div class="space-y-1">
                <h2 class="m-0 text-base font-semibold text-[#0B1320] dark:text-white">
                  {{ section.label }}
                </h2>
                <p class="m-0 text-sm leading-6 text-[#6B6F76] dark:text-[#94A3B8]">
                  {{ section.description }}
                </p>
              </div>
            </div>
            <span class="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-[#0B4DA2] dark:text-[#60A5FA]">
              Open
              <UIcon
                name="i-lucide-arrow-right"
                class="h-4 w-4 transition group-hover:translate-x-0.5"
              />
            </span>
          </NuxtLink>
        </div>
      </div>
    </section>
  </main>
</template>
