<script setup lang="ts">
import {
  NAME,
  SITE_TITLE,
  SITE_DESCRIPTION
} from './seo';

useHead({
  title: SITE_TITLE,
  meta: [
    {
      name: 'description',
      content: SITE_DESCRIPTION
    },
    {
      name: 'robots',
      content: 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1'
    }
  ],
  bodyAttrs: {
    class: 'font-sans antialiased text-slate-600 min-h-full flex flex-col [overflow-anchor:none]'
  }
});

useSeoMeta({
  title: NAME,
  ogTitle: NAME,
  description: SITE_DESCRIPTION,
  ogDescription: SITE_DESCRIPTION,
  ogImage: 'https://thavarshan.com/images/Banner.jpg',
});
</script>

<template>
  <div scroll-region="">
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </div>
</template>
