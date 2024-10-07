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
      I’m the creator of <a target="_blank" href="https://comet.thavarshan.com" class="text-slate-800 underline">Comet Video Converter</a>, the author of <a target="_blank" href="https://github.com/Thavarshan/fetch-php" class="text-slate-800 underline">FetchPHP</a>, and <a target="_blank" href="https://github.com/Thavarshan/filterable" class="text-slate-800 underline">Laravel Filterable</a>, along with many other open-source contributions.
    </p>
    <p class="text-slate-600 text-lg">
      I’m passionate about design patterns, Test-Driven Development (TDD), and building solutions that make people's lives easier. From enhancing Laravel queries to enhancing async capabilities in PHP with <a target="_blank" href="https://github.com/Thavarshan/matrix" class="text-slate-800 underline">Matrix</a>, my work is all about empowering developers with flexible and efficient tools.
    </p>
    <p class="text-slate-600 text-lg">
      Right now, I'm focused on making Comet and my other projects the best they can be, including the recently launched <a target="_blank" href="https://github.com/Thavarshan/phpvm" class="text-slate-800 underline">PHP Version Manager (phpvm)</a>. Exciting updates are on the way!
    </p>
  </div>
</template>

