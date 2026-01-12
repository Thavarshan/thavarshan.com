<template>
  <div
    v-if="!isDismissed"
    class="relative isolate flex items-center gap-x-6 overflow-hidden bg-gradient-to-r from-amber-500 to-orange-600 px-6 py-2.5 sm:px-3.5 sm:before:flex-1"
  >
    <div
      class="absolute top-1/2 left-[max(-7rem,calc(50%-52rem))] -z-10 -translate-y-1/2 transform-gpu blur-2xl"
      aria-hidden="true"
    >
      <div
        class="aspect-[577/310] w-[36.0625rem] bg-gradient-to-r from-yellow-300 to-amber-500 opacity-20"
        style="clip-path: polygon(74.8% 41.9%, 97.2% 73.2%, 100% 34.9%, 92.5% 0.4%, 87.5% 0%, 75% 28.6%, 58.5% 54.6%, 50.1% 56.8%, 46.9% 44%, 48.3% 17.4%, 24.7% 53.9%, 0% 27.9%, 11.9% 74.2%, 24.9% 54.1%, 68.6% 100%, 74.8% 41.9%)"
      />
    </div>
    <div
      class="absolute top-1/2 left-[max(45rem,calc(50%+8rem))] -z-10 -translate-y-1/2 transform-gpu blur-2xl"
      aria-hidden="true"
    >
      <div
        class="aspect-[577/310] w-[36.0625rem] bg-gradient-to-r from-yellow-300 to-amber-500 opacity-20"
        style="clip-path: polygon(74.8% 41.9%, 97.2% 73.2%, 100% 34.9%, 92.5% 0.4%, 87.5% 0%, 75% 28.6%, 58.5% 54.6%, 50.1% 56.8%, 46.9% 44%, 48.3% 17.4%, 24.7% 53.9%, 0% 27.9%, 11.9% 74.2%, 24.9% 54.1%, 68.6% 100%, 74.8% 41.9%)"
      />
    </div>

    <div class="flex flex-wrap items-center gap-x-4 gap-y-2">
      <p class="text-sm/6 text-white">
        <a
          href="https://honeymelon.app"
          target="_blank"
          rel="noopener noreferrer"
          class="font-semibold text-yellow-200 underline underline-offset-2 hover:text-yellow-100 transition"
        >
          Honeymelon
        </a>
        <span class="mx-2 opacity-80">&middot;</span>
        Convert, remux, and compress video in seconds — no subscriptions.
      </p>

      <a
        href="https://honeymelon.app"
        target="_blank"
        rel="noopener noreferrer"
        class="inline-flex items-center rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-white ring-1 ring-white/25 hover:bg-white/20 hover:ring-white/35 transition"
      >
        Visit website
        <ExternalLink class="ml-1.5 size-4" aria-hidden="true" />
      </a>
    </div>

    <div class="flex flex-1 justify-end">
      <button type="button" class="-m-3 p-3 focus-visible:-outline-offset-4" @click="dismissBanner">
        <span class="sr-only">Dismiss</span>
        <X class="size-5 text-white hover:text-yellow-200 transition-colors duration-200" aria-hidden="true" />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { X, ExternalLink } from 'lucide-vue-next';

const BANNER_KEY = 'honeymelon-banner-dismissed';

const isDismissed = ref(false);

onMounted(() => {
  isDismissed.value = localStorage.getItem(BANNER_KEY) === 'true';
});

const dismissBanner = () => {
  isDismissed.value = true;
  localStorage.setItem(BANNER_KEY, 'true');
};
</script>
