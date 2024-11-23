<script setup lang="ts">
definePageMeta({
  title: 'Blog'
});
</script>

<template>
  <div class="mt-4 md:mt-10">
    <div class="max-w-xl space-y-4">
      <h3 class="text-slate-800 font-bold text-2xl">Blog 📝</h3>
      <p class="text-slate-600 text-lg">
        Over the years I’ve published a few dozen articles — some more noteworthy than others.
      </p>
      <Separator class="my-10" />
      <div class="space-y-4">
        <ContentList path="/blog" v-slot="{ list }">
          <NuxtLink v-for="post in list" :key="post._path" :to="post._path" class="block">
            <article class="flex max-w-xl flex-col items-start justify-between leading-normal">
              <div class="group relative">
                <h3 class="text-lg/6 font-semibold text-gray-900 group-hover:text-gray-600">
                  <a href="#">
                    <span class="absolute inset-0"></span>
                    {{ post.title }}
                  </a>
                </h3>
                <p class="mt-2 line-clamp-2 text-sm/6 text-gray-600 whitespace-normal truncate ...">{{ post.description }}</p>
              </div>
            </article>
          </NuxtLink>
        </ContentList>
      </div>
    </div>
  </div>
</template>
