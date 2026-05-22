<script setup lang="ts">
interface CreatedLink {
  slug: string
  destination: string
  expiresAt: string | null
  expirationStatus: "none" | "active" | "expired"
  createdAt: string
  clickCount: number
  shortUrl: string
}

interface SessionLink extends CreatedLink {
  host: string
  title: string
  expiry: string | null
  created: string
}

type ExpirationPreset = "none" | "1d" | "7d" | "30d" | "date"
type MemberLinkSort = "recent" | "clicks"

const config = useRuntimeConfig()
const shortDomain = computed(() => config.public.shortDomain)
const destination = ref("")
const customSlug = ref("")
const expirationPreset = ref<ExpirationPreset>("none")
const customExpirationDate = ref("")
const createdLink = ref<CreatedLink | null>(null)
const sessionLinks = ref<SessionLink[]>([])
const createErrorMessage = ref("")
const sessionErrorMessage = ref("")
const listScope = ref<"member" | "browser">("browser")
const linkSearch = ref("")
const linkSort = ref<MemberLinkSort>("recent")
const isCreating = ref(false)
const deletingSlug = ref("")
const copyState = ref<"idle" | "copied">("idle")
const copiedSessionSlug = ref("")

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

const displayedSessionLinks = computed(() => {
  const search = linkSearch.value.trim().toLowerCase()

  return [...sessionLinks.value]
    .filter((link) => {
      if (!search) {
        return true
      }

      return [link.slug, link.host, link.title].some((value) =>
        value.toLowerCase().includes(search),
      )
    })
    .sort((left, right) => {
      if (linkSort.value === "clicks") {
        const clickOrder = right.clickCount - left.clickCount

        if (clickOrder !== 0) {
          return clickOrder
        }
      }

      return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
    })
})

const stats = computed(() => [
  {
    label: listScope.value === "member" ? "Member links" : "Session links",
    value: String(displayedSessionLinks.value.length),
  },
  {
    label: "Total clicks",
    value: String(
      displayedSessionLinks.value.reduce((total, link) => total + link.clickCount, 0),
    ),
  },
  {
    label: "Active expiring",
    value: String(
      displayedSessionLinks.value.filter((link) => link.expirationStatus === "active").length,
    ),
  },
])

const emptyListMessage = computed(() => {
  if (linkSearch.value.trim()) {
    return "No matching Links."
  }

  return listScope.value === "member"
    ? "Member Links will appear here."
    : "Links created in this Browser session will appear here."
})

onMounted(loadSessionLinks)

watch([linkSearch, linkSort], () => {
  if (listScope.value === "member") {
    void loadSessionLinks()
  }
})

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
    upsertSessionLink(response.link)
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
    case "anonymous_creation_disabled":
      return "Anonymous Link creation is disabled."
    case "rate_limited":
      return "Too many Links were created from this source. Try again later."
    default:
      return "Unable to create this Link."
  }
}

function getCreateLinkErrorReason(error: unknown) {
  if (typeof error !== "object" || error === null) {
    return ""
  }

  if (
    "data" in error &&
    typeof error.data === "object" &&
    error.data !== null &&
    "reason" in error.data &&
    typeof error.data.reason === "string"
  ) {
    return error.data.reason
  }

  if (
    "data" in error &&
    typeof error.data === "object" &&
    error.data !== null &&
    "data" in error.data &&
    typeof error.data.data === "object" &&
    error.data.data !== null &&
    "reason" in error.data.data &&
    typeof error.data.data.reason === "string"
  ) {
    return error.data.data.reason
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

  await copyLink(createdLink.value)
  copyState.value = "copied"
}

async function loadSessionLinks() {
  sessionErrorMessage.value = ""

  try {
    const response = await fetchLinks()
    sessionLinks.value = response.links.map(toSessionLink)
  } catch {
    sessionErrorMessage.value = "Unable to load Links."
  }
}

async function fetchLinks() {
  try {
    const response = await $fetch<{ links: CreatedLink[] }>("/api/member/links", {
      query: {
        search: linkSearch.value || undefined,
        sort: linkSort.value,
      },
    })
    listScope.value = "member"
    return response
  } catch (error) {
    if (!isAuthenticationRequired(error)) {
      throw error
    }
  }

  const response = await $fetch<{ links: CreatedLink[] }>("/api/links")
  listScope.value = "browser"
  return response
}

function isAuthenticationRequired(error: unknown) {
  const reason = getCreateLinkErrorReason(error)
  return reason === "authentication_required"
}

function upsertSessionLink(link: CreatedLink) {
  sessionLinks.value = [
    toSessionLink(link),
    ...sessionLinks.value.filter((sessionLink) => sessionLink.slug !== link.slug),
  ]
}

function toSessionLink(link: CreatedLink): SessionLink {
  return {
    ...link,
    host: destinationHost(link.destination),
    title: link.destination,
    expiry: expirationLabel(link.expiresAt),
    created: createdLabel(link.createdAt),
  }
}

function destinationHost(value: string) {
  try {
    return new URL(value).host
  } catch {
    return value
  }
}

function expirationLabel(value: string | null) {
  if (!value) {
    return "No Expiration"
  }

  const expiresAt = new Date(value)

  if (Number.isNaN(expiresAt.getTime())) {
    return "No Expiration"
  }

  return `expires ${expiresAt.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  })}`
}

function expirationStatusLabel(link: SessionLink) {
  if (link.expirationStatus === "expired") {
    return "Expired"
  }

  return link.expiry ?? "No Expiration"
}

function createdLabel(value: string) {
  const createdAt = new Date(value)

  if (Number.isNaN(createdAt.getTime())) {
    return ""
  }

  return createdAt.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

async function copyLink(link: CreatedLink) {
  await navigator.clipboard.writeText(link.shortUrl)
  copiedSessionSlug.value = link.slug
}

async function deleteSessionLink(link: SessionLink) {
  sessionErrorMessage.value = ""
  deletingSlug.value = link.slug

  try {
    const endpoint = listScope.value === "member" ? "/api/member/links" : "/api/links"

    await $fetch(`${endpoint}/${encodeURIComponent(link.slug)}`, {
      method: "DELETE",
    })
    sessionLinks.value = sessionLinks.value.filter(
      (sessionLink) => sessionLink.slug !== link.slug,
    )
  } catch {
    sessionErrorMessage.value = "Unable to delete this Link."
  } finally {
    deletingSlug.value = ""
  }
}
</script>

<template>
  <main class="min-h-screen bg-[#FFFFFF] text-[#111827] dark:bg-[#0F172A] dark:text-[#F1F5F9]">
    <AppHeader />

    <div class="pointer-events-none fixed inset-0 bg-[radial-gradient(900px_420px_at_82%_-12%,rgba(11,77,162,0.09),transparent_60%),radial-gradient(760px_420px_at_-12%_110%,rgba(11,77,162,0.08),transparent_58%)] dark:opacity-50" />

    <div class="relative mx-auto flex w-full max-w-6xl flex-col gap-12 px-5 py-10 sm:px-8 lg:px-10 lg:py-14">
      <section class="grid gap-8">
        <div class="max-w-3xl">
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
              {{ sessionLinks.length }} links in this {{ listScope === "member" ? "Member dashboard" : "Browser session" }}
            </p>
          </div>
          <div class="flex flex-col gap-3 sm:flex-row sm:items-center">
            <label class="flex min-w-0 items-center gap-2 rounded-[10px] border border-[#E5E7EB] bg-white px-3 py-2 text-[#6B6F76] focus-within:border-[#0B4DA2] focus-within:shadow-[0_0_0_3px_rgba(11,77,162,0.08)] dark:border-[#334155] dark:bg-[#13223A] dark:text-[#94A3B8] sm:min-w-[260px]">
              <UIcon name="i-lucide-search" class="h-4 w-4" />
              <input
                v-model="linkSearch"
                class="min-w-0 flex-1 bg-transparent text-sm text-[#111827] outline-none placeholder:text-[#9CA3AF] dark:text-[#F1F5F9]"
                placeholder="Search Slugs, hosts, titles"
              >
            </label>
            <div class="inline-flex rounded-[10px] border border-[#E5E7EB] bg-[#F8FAFC] p-1 dark:border-[#334155] dark:bg-[#13223A]">
              <UButton
                variant="ghost"
                size="sm"
                class="h-8 rounded-md px-3"
                :class="linkSort === 'recent' ? 'bg-white text-[#0B1320] shadow-sm hover:bg-white dark:bg-[#1E293B] dark:text-white' : 'text-[#6B6F76] hover:bg-white hover:text-[#111827] dark:text-[#94A3B8] dark:hover:bg-[#1E293B] dark:hover:text-white'"
                @click="linkSort = 'recent'"
              >
                Recent
              </UButton>
              <UButton
                variant="ghost"
                size="sm"
                class="h-8 rounded-md px-3"
                :class="linkSort === 'clicks' ? 'bg-white text-[#0B1320] shadow-sm hover:bg-white dark:bg-[#1E293B] dark:text-white' : 'text-[#6B6F76] hover:bg-white hover:text-[#111827] dark:text-[#94A3B8] dark:hover:bg-[#1E293B] dark:hover:text-white'"
                @click="linkSort = 'clicks'"
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
            <div
              v-if="sessionErrorMessage"
              class="border-b border-[#E5E7EB] px-5 py-4 text-sm font-medium text-[#DC2626] dark:border-[#273447] dark:text-[#F87171]"
              role="alert"
            >
              {{ sessionErrorMessage }}
            </div>
            <div
              v-if="displayedSessionLinks.length === 0"
              class="px-5 py-8 text-sm text-[#6B6F76] dark:text-[#94A3B8]"
            >
              {{ emptyListMessage }}
            </div>
            <article
              v-for="(link, index) in displayedSessionLinks"
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
                    variant="outline"
                    leading-icon="i-lucide-calendar-clock"
                    class="h-6 rounded-md border-[#E5E7EB] bg-[#F8FAFC] text-[#6B6F76] dark:border-[#334155] dark:bg-[#1E293B] dark:text-[#94A3B8]"
                  >
                    {{ expirationStatusLabel(link) }}
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
                    {{ link.clickCount }}
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
                <UButton
                  :aria-label="copiedSessionSlug === link.slug ? 'Copied link' : 'Copy link'"
                  :title="copiedSessionSlug === link.slug ? 'Copied link' : 'Copy link'"
                  variant="ghost"
                  size="sm"
                  square
                  :icon="copiedSessionSlug === link.slug ? 'i-lucide-check' : 'i-lucide-copy'"
                  :class="iconButtonClass()"
                  @click="copyLink(link)"
                />
                <UButton
                  aria-label="Open destination"
                  title="Open destination"
                  variant="ghost"
                  size="sm"
                  square
                  icon="i-lucide-external-link"
                  :to="link.destination"
                  target="_blank"
                  :class="iconButtonClass()"
                />
                <UButton
                  aria-label="Delete link"
                  title="Delete link"
                  variant="ghost"
                  size="sm"
                  square
                  icon="i-lucide-trash-2"
                  :loading="deletingSlug === link.slug"
                  :class="iconButtonClass(true)"
                  @click="deleteSessionLink(link)"
                />
              </div>
            </article>
        </UCard>
      </section>

      <footer class="border-t border-[#E5E7EB] pt-6 text-xs text-[#6B6F76] dark:border-[#273447] dark:text-[#94A3B8]">
        <span>&copy; {{ new Date().getFullYear() }} hop</span>
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
</template>
