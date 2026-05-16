<script setup lang="ts">
interface CreatedLink {
  slug: string
  destination: string
  expiresAt: string | null
  shortUrl: string
}

type ExpirationPreset = "none" | "1d" | "7d" | "30d" | "date"

const config = useRuntimeConfig()
const shortDomain = computed(() => config.public.shortDomain)
const colorMode = useColorMode()
const destination = ref("")
const customSlug = ref("")
const expirationPreset = ref<ExpirationPreset>("none")
const customExpirationDate = ref("")
const createdLink = ref<CreatedLink | null>(null)
const createErrorMessage = ref("")
const isCreating = ref(false)
const copyState = ref<"idle" | "copied">("idle")

const colorModeTitle = computed(() =>
  colorMode.value === "dark" ? "Switch to light mode" : "Switch to dark mode"
)

const previewSlug = computed(() => createdLink.value?.slug ?? (customSlug.value.trim() || "auto"))

const expirationPresets: Array<{
  label: string
  value: ExpirationPreset
  icon: string
}> = [
  { label: "None", value: "none", icon: "i-lucide-infinity" },
  { label: "1 day", value: "1d", icon: "i-lucide-sun" },
  { label: "7 days", value: "7d", icon: "i-lucide-calendar-days" },
  { label: "30 days", value: "30d", icon: "i-lucide-calendar-range" },
  { label: "Date", value: "date", icon: "i-lucide-calendar" },
]

const expirationPreview = computed(() => {
  if (expirationPreset.value === "none") {
    return "No Expiration"
  }

  const expiresAt = getSelectedExpiration()

  if (!expiresAt) {
    return "Choose a date"
  }

  return `Expires ${expiresAt.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  })}`
})

const canCreateLink = computed(
  () =>
    destination.value.trim() !== "" &&
    !isCreating.value &&
    (expirationPreset.value !== "date" || customExpirationDate.value !== ""),
)

const recentLinks = [
  {
    slug: "q3-deck",
    host: "docs.google.com",
    title: "Q3 LP Update - Final.pptx",
    clicks: "124",
    created: "7h ago",
    expiry: null,
    tone: "muted",
  },
  {
    slug: "all-hands",
    host: "somerset.zoom.us",
    title: "All-Hands - Recurring Zoom",
    clicks: "213",
    created: "1d ago",
    expiry: null,
    tone: "muted",
  },
  {
    slug: "aurora-memo",
    host: "drive.google.com",
    title: "Project Aurora - IC Memo (Draft 4)",
    clicks: "89",
    created: "2d ago",
    expiry: "expires in 6d",
    tone: "warning",
  },
  {
    slug: "policy-2026",
    host: "somcap.box.com",
    title: "Compliance Handbook 2026",
    clicks: "8",
    created: "11h ago",
    expiry: "expires in 28d",
    tone: "muted",
  },
]

const stats = [
  { label: "Workspace links", value: "6" },
  { label: "Total clicks", value: "1,093" },
  { label: "Active expiring", value: "2" },
]

function iconButtonClass(danger = false) {
  return danger
    ? "text-[#6B6F76] hover:bg-red-50 hover:text-[#DC2626] dark:text-[#94A3B8] dark:hover:bg-red-500/10 dark:hover:text-[#F87171]"
    : "text-[#6B6F76] hover:bg-[#F8FAFC] hover:text-[#111827] dark:text-[#94A3B8] dark:hover:bg-[#273447] dark:hover:text-white"
}

function addDays(days: number) {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return date
}

function getSelectedExpiration() {
  switch (expirationPreset.value) {
    case "1d":
      return addDays(1)
    case "7d":
      return addDays(7)
    case "30d":
      return addDays(30)
    case "date": {
      if (!customExpirationDate.value) {
        return null
      }

      const [year, month, day] = customExpirationDate.value.split("-").map(Number)

      if (!year || !month || !day) {
        return null
      }

      return new Date(year, month - 1, day, 23, 59, 59, 999)
    }
    default:
      return null
  }
}

async function createLink() {
  createErrorMessage.value = ""
  copyState.value = "idle"
  createdLink.value = null
  isCreating.value = true

  try {
    const expiresAt = getSelectedExpiration()
    const response = await $fetch<{ link: CreatedLink }>("/api/links", {
      method: "POST",
      body: {
        destination: destination.value,
        slug: customSlug.value,
        expiresAt: expiresAt ? expiresAt.toISOString() : null,
      },
    })

    createdLink.value = response.link
  } catch (error) {
    createErrorMessage.value = createLinkErrorMessage(error)
  } finally {
    isCreating.value = false
  }
}

function createLinkErrorMessage(error: unknown) {
  const reason = getCreateLinkErrorReason(error)

  switch (reason) {
    case "invalid_url":
      return "Enter a valid URL."
    case "unsupported_scheme":
      return "Enter an http or https URL."
    case "slug_too_short":
      return "Use at least 3 characters for the Slug."
    case "slug_too_long":
      return "Use 64 characters or fewer for the Slug."
    case "slug_invalid_characters":
      return "Use only letters, numbers, and hyphens for the Slug."
    case "slug_taken":
      return "That Slug is already taken."
    case "expiration_invalid":
      return "Choose a valid Expiration."
    default:
      return "Unable to create this Link."
  }
}

function getCreateLinkErrorReason(error: unknown) {
  if (typeof error !== "object" || error === null) {
    return ""
  }

  if ("statusMessage" in error && typeof error.statusMessage === "string") {
    return error.statusMessage
  }

  if (
    "data" in error &&
    typeof error.data === "object" &&
    error.data !== null &&
    "statusMessage" in error.data &&
    typeof error.data.statusMessage === "string"
  ) {
    return error.data.statusMessage
  }

  return ""
}

async function copyCreatedLink() {
  if (!createdLink.value) {
    return
  }

  await navigator.clipboard.writeText(createdLink.value.shortUrl)
  copyState.value = "copied"
}
</script>

<template>
  <UApp>
    <main class="min-h-screen bg-[#FFFFFF] text-[#111827] dark:bg-[#0F172A] dark:text-[#F1F5F9]">
    <header class="border-b border-[#E5E7EB] bg-white/95 px-5 py-4 dark:border-[#273447] dark:bg-[#0F172A]/95 sm:px-8 lg:px-14">
      <div class="mx-auto flex max-w-6xl items-center justify-between gap-4">
        <div class="flex items-center gap-3">
          <span class="h-2.5 w-2.5 rounded-full bg-[#0B4DA2] shadow-[0_0_0_5px_rgba(11,77,162,0.1)]" />
          <span class="font-serif text-[26px] font-bold italic leading-none text-[#0B1320] dark:text-white">
            hop
          </span>
        </div>
        <div class="flex items-center gap-2">
          <UBadge
            variant="outline"
            class="hidden h-8 rounded-full border-[#E5E7EB] bg-[#F8FAFC] px-3 text-[#6B6F76] dark:border-[#334155] dark:bg-[#13223A] dark:text-[#CBD5E1] sm:inline-flex"
          >
            <span class="h-1.5 w-1.5 rounded-full bg-[#16A34A] dark:bg-[#22C55E]" />
            Internal . Somerset
          </UBadge>
          <UColorModeButton
            variant="ghost"
            size="sm"
            square
            :title="colorModeTitle"
            :class="iconButtonClass()"
          />
          <div class="grid h-8 w-8 place-items-center rounded-full bg-[#0B4DA2] text-xs font-semibold text-white">
            ML
          </div>
        </div>
      </div>
    </header>

    <div class="pointer-events-none fixed inset-0 bg-[radial-gradient(900px_420px_at_82%_-12%,rgba(11,77,162,0.09),transparent_60%),radial-gradient(760px_420px_at_-12%_110%,rgba(11,77,162,0.08),transparent_58%)] dark:opacity-50" />

    <div class="relative mx-auto flex w-full max-w-6xl flex-col gap-12 px-5 py-10 sm:px-8 lg:px-10 lg:py-14">
      <section class="grid gap-8">
        <div class="max-w-3xl">
          <UBadge class="mb-5 h-7 rounded-md bg-[rgba(11,77,162,0.08)] px-3 text-[11px] font-semibold uppercase tracking-normal text-[#0B4DA2] hover:bg-[rgba(11,77,162,0.08)]">
            URL shortener . v0.4
          </UBadge>
          <h1 class="m-0 max-w-3xl text-balance font-serif text-4xl font-bold leading-[1.02] tracking-normal text-[#0B1320] dark:text-white sm:text-6xl">
            Let's hop <em class="text-[#0B4DA2]">somewhere</em> new.
          </h1>
          <p class="mt-4 max-w-xl text-base leading-7 text-[#6B6F76] dark:text-[#CBD5E1] sm:text-[17px]">
            Paste a long URL and create a tidy
            <code class="rounded border border-[#E5E7EB] bg-[#F8FAFC] px-1.5 py-0.5 font-mono text-sm text-[#111827] dark:border-[#334155] dark:bg-[#13223A] dark:text-[#F1F5F9]">
              {{ shortDomain }}/...
            </code>
            link for internal decks, memos, portals, and meeting rooms.
          </p>
        </div>

        <UCard
          class="gap-0 rounded-[20px] border-[#E5E7EB] bg-white p-0 shadow-[0_24px_60px_-16px_rgba(11,19,32,0.18),0_6px_16px_rgba(11,19,32,0.06)] ring-0 dark:border-[#273447] dark:bg-[#13223A] dark:shadow-black/40"
          :ui="{ body: 'p-6 sm:p-8' }"
        >
          <form class="space-y-5" @submit.prevent="createLink">
            <label class="block space-y-2">
              <span class="text-xs font-semibold uppercase tracking-normal text-[#6B6F76] dark:text-[#94A3B8]">
                Long URL
              </span>
              <div class="flex items-center gap-3 rounded-[10px] border border-[#E5E7EB] bg-[#F8FAFC] px-4 py-4 shadow-[0_0_0_0_rgba(11,77,162,0)] focus-within:border-[#0B4DA2] focus-within:shadow-[0_0_0_3px_rgba(11,77,162,0.08)] dark:border-[#334155] dark:bg-[#0F172A]">
                <UIcon name="i-lucide-link-2" class="h-5 w-5 shrink-0 text-[#6B6F76] dark:text-[#94A3B8]" />
                <input
                  v-model="destination"
                  class="min-w-0 flex-1 bg-transparent font-mono text-base text-[#111827] outline-none placeholder:text-[#9CA3AF] dark:text-[#F1F5F9]"
                  placeholder="https://docs.google.com/document/d/..."
                >
              </div>
            </label>

            <label class="block space-y-2">
              <span class="text-xs font-semibold uppercase tracking-normal text-[#6B6F76] dark:text-[#94A3B8]">
                Custom slug
              </span>
              <div class="flex items-center gap-3 rounded-[10px] border border-[#E5E7EB] bg-[#F8FAFC] px-4 py-4 shadow-[0_0_0_0_rgba(11,77,162,0)] focus-within:border-[#0B4DA2] focus-within:shadow-[0_0_0_3px_rgba(11,77,162,0.08)] dark:border-[#334155] dark:bg-[#0F172A]">
                <UIcon name="i-lucide-tag" class="h-5 w-5 shrink-0 text-[#6B6F76] dark:text-[#94A3B8]" />
                <span class="max-w-[45%] truncate font-mono text-sm text-[#6B6F76] dark:text-[#94A3B8]">
                  {{ shortDomain }}/
                </span>
                <input
                  v-model="customSlug"
                  class="min-w-0 flex-1 bg-transparent font-mono text-base text-[#111827] outline-none placeholder:text-[#9CA3AF] dark:text-[#F1F5F9]"
                  placeholder="roadmap-2026"
                  maxlength="64"
                >
              </div>
            </label>

            <div class="space-y-3">
              <div class="flex items-center justify-between gap-3">
                <span class="text-xs font-semibold uppercase tracking-normal text-[#6B6F76] dark:text-[#94A3B8]">
                  Expiration
                </span>
                <span class="text-xs font-medium text-[#6B6F76] dark:text-[#94A3B8]">
                  {{ expirationPreview }}
                </span>
              </div>
              <div class="flex flex-wrap gap-2">
                <UButton
                  v-for="preset in expirationPresets"
                  :key="preset.value"
                  type="button"
                  size="sm"
                  variant="outline"
                  :icon="preset.icon"
                  :class="[
                    'h-9 rounded-[10px] px-3 text-sm font-semibold',
                    expirationPreset === preset.value
                      ? 'border-[#0B4DA2] bg-[rgba(11,77,162,0.08)] text-[#0B4DA2] hover:bg-[rgba(11,77,162,0.12)] dark:border-[#60A5FA] dark:bg-blue-400/10 dark:text-[#93C5FD]'
                      : 'border-[#E5E7EB] bg-white text-[#6B6F76] hover:bg-[#F8FAFC] dark:border-[#334155] dark:bg-[#13223A] dark:text-[#94A3B8] dark:hover:bg-[#1E293B]',
                  ]"
                  @click="expirationPreset = preset.value"
                >
                  {{ preset.label }}
                </UButton>
              </div>
              <label
                v-if="expirationPreset === 'date'"
                class="flex items-center gap-3 rounded-[10px] border border-[#E5E7EB] bg-[#F8FAFC] px-4 py-3 focus-within:border-[#0B4DA2] focus-within:shadow-[0_0_0_3px_rgba(11,77,162,0.08)] dark:border-[#334155] dark:bg-[#0F172A]"
              >
                <UIcon name="i-lucide-calendar" class="h-5 w-5 shrink-0 text-[#6B6F76] dark:text-[#94A3B8]" />
                <input
                  v-model="customExpirationDate"
                  type="date"
                  class="min-w-0 flex-1 bg-transparent text-base text-[#111827] outline-none dark:text-[#F1F5F9]"
                >
              </label>
            </div>

            <p
              v-if="createErrorMessage"
              class="text-sm font-medium text-[#DC2626] dark:text-[#F87171]"
              role="alert"
            >
              {{ createErrorMessage }}
            </p>

            <div class="flex flex-col gap-4 border-t border-dashed border-[#E5E7EB] pt-5 dark:border-[#334155] sm:flex-row sm:items-center sm:justify-between">
              <div class="min-w-0">
                <div class="text-[11px] font-semibold uppercase tracking-normal text-[#9CA3AF]">
                  Short link
                </div>
                <code class="mt-1 block truncate font-mono text-base text-[#6B6F76] dark:text-[#94A3B8]">
                  {{ shortDomain }}/<b class="font-semibold text-[#0B4DA2]">{{ previewSlug }}</b>
                </code>
              </div>
              <div class="flex flex-col gap-2 sm:flex-row">
                <UButton
                  v-if="createdLink"
                  type="button"
                  icon="i-lucide-copy"
                  variant="outline"
                  class="h-11 rounded-[10px] px-4 font-semibold"
                  @click="copyCreatedLink"
                >
                  {{ copyState === "copied" ? "Copied" : "Copy" }}
                </UButton>
                <UButton
                  type="submit"
                  trailing-icon="i-lucide-arrow-right"
                  :loading="isCreating"
                  :disabled="!canCreateLink"
                  class="h-11 rounded-[10px] bg-[#0B4DA2] px-5 font-semibold text-white shadow-[0_6px_14px_rgba(11,77,162,0.22)] hover:bg-[#093f84]"
                >
                  Hop it
                </UButton>
              </div>
            </div>
          </form>
        </UCard>
      </section>

      <section class="grid gap-5">
        <div class="grid gap-3 sm:grid-cols-3">
          <UCard
            v-for="stat in stats"
            :key="stat.label"
            class="rounded-[10px] border-[#E5E7EB] bg-white py-4 shadow-sm ring-0 dark:border-[#273447] dark:bg-[#13223A]"
            :ui="{ body: 'px-5' }"
          >
              <div class="font-serif text-3xl font-bold leading-none text-[#0B1320] dark:text-white">
                {{ stat.value }}
              </div>
              <div class="mt-2 text-xs font-semibold uppercase tracking-normal text-[#6B6F76] dark:text-[#94A3B8]">
                {{ stat.label }}
              </div>
          </UCard>
        </div>

        <div class="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 class="m-0 font-serif text-3xl font-bold tracking-normal text-[#0B1320] dark:text-white">
              Recent hops
            </h2>
            <p class="mt-1 text-sm text-[#6B6F76] dark:text-[#94A3B8]">
              6 links in this workspace
            </p>
          </div>
          <div class="flex flex-col gap-3 sm:flex-row sm:items-center">
            <label class="flex min-w-0 items-center gap-2 rounded-[10px] border border-[#E5E7EB] bg-white px-3 py-2 text-[#6B6F76] focus-within:border-[#0B4DA2] focus-within:shadow-[0_0_0_3px_rgba(11,77,162,0.08)] dark:border-[#334155] dark:bg-[#13223A] dark:text-[#94A3B8] sm:min-w-[260px]">
              <UIcon name="i-lucide-search" class="h-4 w-4" />
              <input
                class="min-w-0 flex-1 bg-transparent text-sm text-[#111827] outline-none placeholder:text-[#9CA3AF] dark:text-[#F1F5F9]"
                placeholder="Search slugs, domains, titles"
              >
            </label>
            <div class="inline-flex rounded-[10px] border border-[#E5E7EB] bg-[#F8FAFC] p-1 dark:border-[#334155] dark:bg-[#13223A]">
              <UButton
                variant="ghost"
                size="sm"
                class="h-8 rounded-md bg-white px-3 text-[#0B1320] shadow-sm hover:bg-white dark:bg-[#1E293B] dark:text-white"
              >
                Recent
              </UButton>
              <UButton
                variant="ghost"
                size="sm"
                class="h-8 rounded-md px-3 text-[#6B6F76] hover:bg-white hover:text-[#111827] dark:text-[#94A3B8] dark:hover:bg-[#1E293B] dark:hover:text-white"
              >
                Most clicked
              </UButton>
            </div>
          </div>
        </div>

        <UCard
          class="gap-0 overflow-hidden rounded-[14px] border-[#E5E7EB] bg-white p-0 shadow-[0_4px_12px_rgba(11,19,32,0.08),0_2px_4px_rgba(11,19,32,0.04)] ring-0 dark:border-[#273447] dark:bg-[#13223A]"
          :ui="{ header: 'sr-only', body: 'p-0' }"
        >
          <template #header>
            <h2>Recent hops</h2>
          </template>
            <article
              v-for="(link, index) in recentLinks"
              :key="link.slug"
              class="grid gap-4 border-b border-[#E5E7EB] px-5 py-5 last:border-b-0 dark:border-[#273447] lg:grid-cols-[1fr_auto_auto] lg:items-center lg:gap-6"
              :class="index === 0 ? 'border-l-4 border-l-[#0B4DA2] bg-[rgba(11,77,162,0.06)]' : ''"
            >
              <div class="min-w-0 space-y-2">
                <div class="flex flex-wrap items-center gap-2.5">
                  <a
                    href="#"
                    class="inline-flex items-baseline font-mono text-[15px] text-[#0B1320] hover:text-[#0B4DA2] dark:text-[#F1F5F9]"
                  >
                    <span class="font-normal text-[#6B6F76] dark:text-[#94A3B8]">
                      {{ shortDomain }}/
                    </span>
                    <span class="font-semibold">{{ link.slug }}</span>
                  </a>
                  <UBadge
                    v-if="link.expiry"
                    variant="outline"
                    leading-icon="i-lucide-calendar-clock"
                    :class="link.tone === 'warning'
                      ? 'h-6 rounded-md border-0 bg-[#FEF3C7] text-[#B7791F] dark:bg-yellow-400/10 dark:text-[#FBBF24]'
                      : 'h-6 rounded-md border-[#E5E7EB] bg-[#F8FAFC] text-[#6B6F76] dark:border-[#334155] dark:bg-[#1E293B] dark:text-[#94A3B8]'"
                  >
                    {{ link.expiry }}
                  </UBadge>
                </div>
                <div class="flex min-w-0 gap-2 text-sm text-[#6B6F76] dark:text-[#94A3B8]">
                  <span class="shrink-0 font-medium text-[#111827] dark:text-[#CBD5E1]">
                    {{ link.host }}
                  </span>
                  <span class="text-[#9CA3AF]">.</span>
                  <span class="truncate">{{ link.title }}</span>
                </div>
              </div>

              <div class="flex gap-7 lg:justify-end">
                <div class="min-w-14 lg:text-right">
                  <div class="font-serif text-[22px] font-bold leading-none text-[#0B1320] dark:text-white">
                    {{ link.clicks }}
                  </div>
                  <div class="mt-1 text-[11px] font-medium uppercase tracking-normal text-[#9CA3AF]">
                    clicks
                  </div>
                </div>
                <div class="min-w-16 lg:text-right">
                  <div class="text-sm font-medium text-[#6B6F76] dark:text-[#94A3B8]">
                    {{ link.created }}
                  </div>
                  <div class="mt-1 text-[11px] font-medium uppercase tracking-normal text-[#9CA3AF]">
                    created
                  </div>
                </div>
              </div>

              <div class="flex gap-1 lg:justify-end">
                <UButton aria-label="Copy link" title="Copy link" variant="ghost" size="sm" square icon="i-lucide-copy" :class="iconButtonClass()" />
                <UButton aria-label="Open destination" title="Open destination" variant="ghost" size="sm" square icon="i-lucide-external-link" :class="iconButtonClass()" />
                <UButton aria-label="Delete link" title="Delete link" variant="ghost" size="sm" square icon="i-lucide-trash-2" :class="iconButtonClass(true)" />
              </div>
            </article>
        </UCard>
      </section>

      <footer class="flex flex-wrap gap-2 border-t border-[#E5E7EB] pt-6 text-xs text-[#6B6F76] dark:border-[#273447] dark:text-[#94A3B8]">
        <span>hop . internal tool</span>
        <span>.</span>
        <span>Somerset Capital</span>
        <span>.</span>
        <a href="#" class="hover:text-[#0B4DA2]">
          Docs
        </a>
        <a href="#" class="hover:text-[#0B4DA2]">
          Slack #hop
        </a>
      </footer>

      <div
        v-if="createdLink"
        class="fixed bottom-6 left-1/2 hidden -translate-x-1/2 items-center gap-2 rounded-full bg-[#0B1320] px-4 py-2 text-sm font-medium text-white shadow-2xl dark:bg-white dark:text-[#0B1320] md:flex"
      >
        <UIcon name="i-lucide-check" class="h-4 w-4 text-[#16A34A] dark:text-[#22C55E]" />
        Link created . {{ createdLink.shortUrl }}
      </div>
      </div>
    </main>
  </UApp>
</template>
