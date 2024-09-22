<script setup lang="ts">
import { SITE_TITLE } from '../seo';

definePageMeta({
  title: SITE_TITLE
});
</script>

<template>
  <div class="mt-10 space-y-4 max-w-xl">
    <h3 class="text-slate-800 font-bold text-2xl">Hiya 👋</h3>
    <p class="text-slate-600 text-lg">
      I'm Jerome—a full-stack developer, open-source contributor, and tech enthusiast based in Birmingham, United Kingdom.
    </p>
    <p class="text-slate-600 text-lg">
      I’m the creator of <a target="_blank" href="https://comet.thavarshan.com" class="text-slate-800 underline">Comet Video Converter</a>, the author of <a target="_blank" href="https://github.com/Thavarshan/filterable" class="text-slate-800 underline">Laravel Filterable</a>, and a part-time amateur pencil sketch artist.
    </p>
    <p class="text-slate-600 text-lg">
      I’m passionate about design patterns, Test-Driven Development (TDD), and building solutions that make people's lives easier.
    </p>
    <p class="text-slate-600 text-lg">
      Right now, I'm focused on making Comet the best it can be, along with a few other exciting projects that I can't wait to share with you soon.
    </p>
  </div>
</template>
