<template>
  <div v-if="!isDismissed" class="relative isolate flex items-center gap-x-6 overflow-hidden bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-2.5 sm:px-3.5 sm:before:flex-1">
    <div class="absolute top-1/2 left-[max(-7rem,calc(50%-52rem))] -z-10 -translate-y-1/2 transform-gpu blur-2xl" aria-hidden="true">
      <div class="aspect-[577/310] w-[36.0625rem] bg-gradient-to-r from-cyan-400 to-blue-500 opacity-20" style="clip-path: polygon(74.8% 41.9%, 97.2% 73.2%, 100% 34.9%, 92.5% 0.4%, 87.5% 0%, 75% 28.6%, 58.5% 54.6%, 50.1% 56.8%, 46.9% 44%, 48.3% 17.4%, 24.7% 53.9%, 0% 27.9%, 11.9% 74.2%, 24.9% 54.1%, 68.6% 100%, 74.8% 41.9%)" />
    </div>
    <div class="absolute top-1/2 left-[max(45rem,calc(50%+8rem))] -z-10 -translate-y-1/2 transform-gpu blur-2xl" aria-hidden="true">
      <div class="aspect-[577/310] w-[36.0625rem] bg-gradient-to-r from-cyan-400 to-blue-500 opacity-20" style="clip-path: polygon(74.8% 41.9%, 97.2% 73.2%, 100% 34.9%, 92.5% 0.4%, 87.5% 0%, 75% 28.6%, 58.5% 54.6%, 50.1% 56.8%, 46.9% 44%, 48.3% 17.4%, 24.7% 53.9%, 0% 27.9%, 11.9% 74.2%, 24.9% 54.1%, 68.6% 100%, 74.8% 41.9%)" />
    </div>
    <div class="flex flex-wrap items-center gap-x-4 gap-y-2">
      <p class="text-sm/6 text-white">
        <strong class="font-semibold text-yellow-300">Altus 4</strong> &middot; AI-Enhanced intelligent search-as-a-service platform with semantic understanding.
      </p>
    </div>
    <div class="flex flex-1 justify-end">
      <button type="button" class="-m-3 p-3 focus-visible:-outline-offset-4" @click="dismissBanner">
        <span class="sr-only">Dismiss</span>
        <X class="size-5 text-white hover:text-yellow-300 transition-colors duration-200" aria-hidden="true" />
      </button>
    </div>
  </div>
</template>

<script setup>
import { X } from 'lucide-vue-next';

const BANNER_KEY = 'altus4-banner-dismissed';

const isDismissed = ref(false);

onMounted(() => {
  isDismissed.value = localStorage.getItem(BANNER_KEY) === 'true';
});

const dismissBanner = () => {
  isDismissed.value = true;
  localStorage.setItem(BANNER_KEY, 'true');
};
</script>
