<script setup lang="ts">
import type { NuxtError } from '#app';
import DefaultLayout from './layouts/default.vue';

const props = defineProps<{
  error: NuxtError;
}>();

definePageMeta({
  title: `${props.error.statusCode} - ${props.error.statusMessage}`
});
</script>

<template>
  <DefaultLayout>
    <div class="mt-4 md:mt-10">
      <div class="space-y-4 max-w-xl text-center md:text-left mx-auto md:mx-0">
        <h3 class="text-gray-800 font-bold text-2xl">{{ error.statusCode }} <span v-if="error.statusCode === 404">🤷‍♂️</span><span v-else>😞</span></h3>
        <p class="text-gray-600 text-lg">
          {{ error.statusMessage || "An unexpected error occurred." }}
        </p>
      </div>
    </div>
  </DefaultLayout>
</template>
