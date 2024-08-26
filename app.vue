<script setup lang="ts">
const SITE_DECRIPTION = 'Jerome ';

useHead({
  title: 'Jerome Thayananthajothy',
  meta: [
    {
      name: 'description',
      content: SITE_DECRIPTION
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
  title: 'Jerome Thayananthajothy',
  ogTitle: 'Jerome Thayananthajothy',
  description: SITE_DECRIPTION,
  ogDescription: SITE_DECRIPTION,
  ogImage: 'https://github.com/stellar-comet/comet/blob/main/src/assets/images/Banner.jpg',
});
</script>

<template>
  <div scroll-region="">
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </div>
</template>
