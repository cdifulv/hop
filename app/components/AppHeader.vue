<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui';

import { authClient } from '~/utils/auth-client';

const colorMode = useColorMode();
const session = authClient.useSession();

const colorModeTitle = computed(() =>
  colorMode.value === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'
);

const member = computed(() => session.value?.data?.user ?? null);
const sessionPending = computed(() => session.value?.isPending ?? false);

const memberName = computed(
  () => member.value?.name?.trim() || member.value?.email?.trim() || 'Member'
);

const memberInitials = computed(() => {
  const name = member.value?.name?.trim();

  if (name) {
    return name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join('')
      .toUpperCase();
  }

  const email = member.value?.email?.trim();
  return email ? email.slice(0, 2).toUpperCase() : '?';
});

const isSigningOut = ref(false);

const menuItems = computed<DropdownMenuItem[][]>(() => [
  [{ label: memberName.value, type: 'label' }],
  [
    {
      label: isSigningOut.value ? 'Signing out…' : 'Sign out',
      icon: 'i-lucide-log-out',
      onSelect: () => {
        void signOut();
      }
    }
  ]
]);

async function signOut() {
  if (isSigningOut.value) {
    return;
  }

  isSigningOut.value = true;

  try {
    await authClient.signOut();
  } finally {
    // Full reload so the dashboard re-fetches Links as an Anonymous visitor.
    await navigateTo('/', { external: true });
  }
}
</script>

<template>
  <header
    class="border-b border-[#E5E7EB] bg-white/95 px-5 py-4 dark:border-[#273447] dark:bg-[#0F172A]/95 sm:px-8 lg:px-14"
  >
    <div class="mx-auto flex max-w-6xl items-center justify-between gap-4">
      <NuxtLink to="/" class="flex items-center gap-3">
        <span
          class="h-2.5 w-2.5 rounded-full bg-[#0B4DA2] shadow-[0_0_0_5px_rgba(11,77,162,0.1)]"
        />
        <span
          class="font-serif text-[26px] font-bold italic leading-none text-[#0B1320] dark:text-white"
        >
          hop
        </span>
      </NuxtLink>
      <div class="flex items-center gap-2">
        <UColorModeButton
          variant="ghost"
          size="sm"
          square
          :title="colorModeTitle"
          class="text-[#6B6F76] hover:bg-[#F8FAFC] hover:text-[#111827] dark:text-[#94A3B8] dark:hover:bg-[#273447] dark:hover:text-white"
        />

        <div
          v-if="sessionPending"
          class="h-8 w-8 animate-pulse rounded-full bg-[#E5E7EB] dark:bg-[#273447]"
          aria-hidden="true"
        />

        <UDropdownMenu
          v-else-if="member"
          :items="menuItems"
          :content="{ align: 'end' }"
        >
          <button
            type="button"
            :aria-label="`Member menu for ${memberName}`"
            :title="memberName"
            class="grid h-8 w-8 place-items-center rounded-full bg-[#0B4DA2] text-xs font-semibold text-white outline-none ring-offset-2 ring-offset-white focus-visible:ring-2 focus-visible:ring-[#0B4DA2] dark:ring-offset-[#0F172A]"
          >
            {{ memberInitials }}
          </button>
        </UDropdownMenu>

        <UButton
          v-else
          to="/sign-in"
          icon="i-lucide-log-in"
          class="h-8 rounded-full bg-[#0B4DA2] px-3.5 text-sm font-semibold text-white hover:bg-[#093f84]"
        >
          Sign in
        </UButton>
      </div>
    </div>
  </header>
</template>
