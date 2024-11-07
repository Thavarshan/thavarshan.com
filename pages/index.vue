<script setup lang="ts">
import { SITE_TITLE } from '../seo';

definePageMeta({
  title: SITE_TITLE
});
</script>

<template>
  <div class="mt-4 md:mt-10">
    <div class="space-y-4 max-w-xl text-center md:text-left mx-auto md:mx-0">
      <h3 class="text-gray-800 font-bold text-2xl">Hiya 👋</h3>
      <p class="text-gray-600 text-lg">
        I'm Jerome—a full-stack engineer, open-source contributor, and tech enthusiast based in Birmingham, United Kingdom.
      </p>
      <p class="text-gray-600 text-lg">
        I’m the creator of <a target="_blank" href="https://comet.thavarshan.com" class="text-gray-800 underline">Comet Video Converter</a>, the author of <a target="_blank" href="https://github.com/Thavarshan/fetch-php" class="text-gray-800 underline">FetchPHP</a>, and <a target="_blank" href="https://github.com/Thavarshan/filterable" class="text-gray-800 underline">Laravel Filterable</a>, along with many other open-source contributions.
      </p>
      <p class="text-gray-600 text-lg">
        I’m passionate about design patterns, Test-Driven Development (TDD), and building solutions that make people's lives easier. From enhancing Laravel queries to enhancing async capabilities in PHP with <a target="_blank" href="https://github.com/Thavarshan/matrix" class="text-gray-800 underline">Matrix</a>, my work is all about empowering developers with flexible and efficient tools.
      </p>
      <p class="text-gray-600 text-lg">
        Right now, I'm focused on making Comet and my other projects the best they can be, including the recently launched <a target="_blank" href="https://github.com/Thavarshan/phpvm" class="text-gray-800 underline">PHP Version Manager (phpvm)</a>. Exciting updates are on the way!
      </p>
    </div>
  </div>
</template>

