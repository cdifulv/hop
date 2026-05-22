<script setup lang="ts">
import { authClient } from "~/utils/auth-client"

interface SignInError {
  status?: number
  message?: string
}

const config = useRuntimeConfig()
const colorMode = useColorMode()
const session = authClient.useSession()

useHead({ title: "Sign in . hop" })

const ssoProviderId = computed(() => config.public.ssoProviderId)
const ssoConfigured = computed(() => Boolean(ssoProviderId.value))

const credentialFormOpen = ref(!ssoConfigured.value)
const email = ref("")
const password = ref("")
const isSsoRedirecting = ref(false)
const isSubmitting = ref(false)
const ssoErrorMessage = ref("")
const credentialErrorMessage = ref("")

const colorModeTitle = computed(() =>
  colorMode.value === "dark" ? "Switch to light mode" : "Switch to dark mode",
)

const canSubmitCredential = computed(
  () => email.value.trim() !== "" && password.value !== "" && !isSubmitting.value,
)

// A signed-in Member has no reason to be on the sign-in page.
watchEffect(() => {
  if (session.value?.data?.user) {
    void navigateTo("/", { external: true })
  }
})

async function signInWithSso() {
  if (!ssoConfigured.value || isSsoRedirecting.value) {
    return
  }

  ssoErrorMessage.value = ""
  isSsoRedirecting.value = true

  const { error } = await authClient.signIn.sso({
    providerId: ssoProviderId.value,
    callbackURL: "/",
    errorCallbackURL: "/sign-in",
  })

  // A successful call hands off to the Identity provider via a browser
  // redirect; reaching here with an error means the redirect never happened.
  if (error) {
    isSsoRedirecting.value = false
    ssoErrorMessage.value = "Single sign-on is unavailable right now. Try again later."
  }
}

async function signInWithCredential() {
  if (!canSubmitCredential.value) {
    return
  }

  credentialErrorMessage.value = ""
  isSubmitting.value = true

  const { error } = await authClient.signIn.email({
    email: email.value.trim(),
    password: password.value,
  })

  isSubmitting.value = false

  if (error) {
    credentialErrorMessage.value = credentialErrorMessageFor(error)
    return
  }

  // Full reload so the dashboard loads with the Member's session.
  await navigateTo("/", { external: true })
}

function credentialErrorMessageFor(error: SignInError) {
  if (error.status === 403) {
    return "Bootstrap admin sign-in is not available for this deployment."
  }

  if (error.status === 401) {
    return "Incorrect email or password."
  }

  return "Unable to sign in. Try again."
}
</script>

<template>
  <main class="relative min-h-screen bg-[#FFFFFF] text-[#111827] dark:bg-[#0F172A] dark:text-[#F1F5F9]">
    <div class="pointer-events-none fixed inset-0 bg-[radial-gradient(900px_420px_at_82%_-12%,rgba(11,77,162,0.09),transparent_60%),radial-gradient(760px_420px_at_-12%_110%,rgba(11,77,162,0.08),transparent_58%)] dark:opacity-50" />

    <div class="absolute right-5 top-5">
      <UColorModeButton
        variant="ghost"
        size="sm"
        square
        :title="colorModeTitle"
        class="text-[#6B6F76] hover:bg-[#F8FAFC] hover:text-[#111827] dark:text-[#94A3B8] dark:hover:bg-[#273447] dark:hover:text-white"
      />
    </div>

    <div class="relative mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center gap-8 px-5 py-16">
      <NuxtLink to="/" class="flex items-center gap-3">
        <span class="h-2.5 w-2.5 rounded-full bg-[#0B4DA2] shadow-[0_0_0_5px_rgba(11,77,162,0.1)]" />
        <span class="font-serif text-[28px] font-bold italic leading-none text-[#0B1320] dark:text-white">
          hop
        </span>
      </NuxtLink>

      <UCard
        class="w-full gap-0 rounded-[20px] border-[#E5E7EB] bg-white p-0 shadow-[0_24px_60px_-16px_rgba(11,19,32,0.18),0_6px_16px_rgba(11,19,32,0.06)] ring-0 dark:border-[#273447] dark:bg-[#13223A] dark:shadow-black/40"
        :ui="{ body: 'p-6 sm:p-8' }"
      >
        <div class="space-y-6">
          <header class="space-y-1.5">
            <h1 class="m-0 font-serif text-3xl font-bold tracking-normal text-[#0B1320] dark:text-white">
              Sign in
            </h1>
            <p class="text-sm leading-6 text-[#6B6F76] dark:text-[#94A3B8]">
              Sign in to see and manage the Links you create. Anyone can shorten a
              URL without signing in.
            </p>
          </header>

          <div class="space-y-2">
            <UButton
              block
              type="button"
              icon="i-lucide-shield-check"
              :loading="isSsoRedirecting"
              :disabled="!ssoConfigured || isSsoRedirecting"
              class="h-11 rounded-[10px] bg-[#0B4DA2] px-5 font-semibold text-white shadow-[0_6px_14px_rgba(11,77,162,0.22)] hover:bg-[#093f84] disabled:opacity-60"
              @click="signInWithSso"
            >
              Continue with single sign-on
            </UButton>
            <p
              v-if="!ssoConfigured"
              class="text-xs leading-5 text-[#6B6F76] dark:text-[#94A3B8]"
            >
              Single sign-on has not been configured for this deployment yet.
            </p>
            <p
              v-if="ssoErrorMessage"
              class="text-sm font-medium text-[#DC2626] dark:text-[#F87171]"
              role="alert"
            >
              {{ ssoErrorMessage }}
            </p>
          </div>

          <div v-if="ssoConfigured" class="flex items-center gap-3">
            <span class="h-px flex-1 bg-[#E5E7EB] dark:bg-[#334155]" />
            <span class="text-[11px] font-semibold uppercase tracking-normal text-[#9CA3AF]">
              or
            </span>
            <span class="h-px flex-1 bg-[#E5E7EB] dark:bg-[#334155]" />
          </div>

          <button
            v-if="ssoConfigured && !credentialFormOpen"
            type="button"
            class="text-sm font-semibold text-[#0B4DA2] hover:text-[#093f84] dark:text-[#60A5FA]"
            @click="credentialFormOpen = true"
          >
            Sign in with the bootstrap admin credential
          </button>

          <form
            v-else
            class="space-y-4"
            @submit.prevent="signInWithCredential"
          >
            <div class="space-y-1.5">
              <span class="text-xs font-semibold uppercase tracking-normal text-[#6B6F76] dark:text-[#94A3B8]">
                Bootstrap admin
              </span>
              <p class="text-xs leading-5 text-[#9CA3AF]">
                The deploy-time credential for the first Admin, used to configure
                the Identity provider.
              </p>
            </div>

            <label class="block space-y-2">
              <span class="text-xs font-semibold uppercase tracking-normal text-[#6B6F76] dark:text-[#94A3B8]">
                Email
              </span>
              <div class="flex items-center gap-3 rounded-[10px] border border-[#E5E7EB] bg-[#F8FAFC] px-4 py-3 focus-within:border-[#0B4DA2] focus-within:shadow-[0_0_0_3px_rgba(11,77,162,0.08)] dark:border-[#334155] dark:bg-[#0F172A]">
                <UIcon name="i-lucide-mail" class="h-5 w-5 shrink-0 text-[#6B6F76] dark:text-[#94A3B8]" />
                <input
                  v-model="email"
                  type="email"
                  autocomplete="email"
                  class="min-w-0 flex-1 bg-transparent text-base text-[#111827] outline-none placeholder:text-[#9CA3AF] dark:text-[#F1F5F9]"
                  placeholder="admin@example.com"
                >
              </div>
            </label>

            <label class="block space-y-2">
              <span class="text-xs font-semibold uppercase tracking-normal text-[#6B6F76] dark:text-[#94A3B8]">
                Password
              </span>
              <div class="flex items-center gap-3 rounded-[10px] border border-[#E5E7EB] bg-[#F8FAFC] px-4 py-3 focus-within:border-[#0B4DA2] focus-within:shadow-[0_0_0_3px_rgba(11,77,162,0.08)] dark:border-[#334155] dark:bg-[#0F172A]">
                <UIcon name="i-lucide-lock" class="h-5 w-5 shrink-0 text-[#6B6F76] dark:text-[#94A3B8]" />
                <input
                  v-model="password"
                  type="password"
                  autocomplete="current-password"
                  class="min-w-0 flex-1 bg-transparent text-base text-[#111827] outline-none placeholder:text-[#9CA3AF] dark:text-[#F1F5F9]"
                  placeholder="••••••••"
                >
              </div>
            </label>

            <p
              v-if="credentialErrorMessage"
              class="text-sm font-medium text-[#DC2626] dark:text-[#F87171]"
              role="alert"
            >
              {{ credentialErrorMessage }}
            </p>

            <UButton
              block
              type="submit"
              :loading="isSubmitting"
              :disabled="!canSubmitCredential"
              :variant="ssoConfigured ? 'outline' : 'solid'"
              class="h-11 rounded-[10px] px-5 font-semibold"
              :class="ssoConfigured
                ? 'border-[#E5E7EB] text-[#111827] hover:bg-[#F8FAFC] dark:border-[#334155] dark:text-[#F1F5F9] dark:hover:bg-[#1E293B]'
                : 'bg-[#0B4DA2] text-white shadow-[0_6px_14px_rgba(11,77,162,0.22)] hover:bg-[#093f84]'"
            >
              Sign in
            </UButton>
          </form>
        </div>
      </UCard>

      <NuxtLink
        to="/"
        class="text-sm font-medium text-[#6B6F76] hover:text-[#0B4DA2] dark:text-[#94A3B8]"
      >
        Back to hop
      </NuxtLink>
    </div>
  </main>
</template>
