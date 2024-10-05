<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { Octokit } from '@octokit/core';
import GitHubCard from '@/components/blocks/GitHubCard.vue';
import type { Repository } from '@/types/repository';
import { SITE_TITLE, SITE_DESCRIPTION } from '../seo';

definePageMeta({
  title: SITE_TITLE
});

const config = useRuntimeConfig();

useHead({
  title: SITE_TITLE,
  meta: [
    {
      name: 'description',
      content: SITE_DESCRIPTION
    }
  ],
});

const loading = ref(true);
const repositories = ref<Repository[]>([]);
const octokit = new Octokit({ auth: config.githubApiKey });
const pinnedRepos = [
  'filterable',
  'fetch-php',
  'matrix',
  'phpvm',
  'comet'
];

async function fetchRepositories() {
  try {
    const response = await octokit.request('GET /users/{username}/repos', {
      username: config.githubUser as string || 'Thavarshan'
    });

    repositories.value = response.data
      .filter((repo: any) => pinnedRepos.includes(repo.name))
      .map((repo: any) => ({
        ...repo,
        master_branch: repo.default_branch,
      }))
      .sort((a: any, b: any) => b.stargazers_count - a.stargazers_count);

    loading.value = false;
  } catch (error) {
    console.error('Error fetching repositories:', error);
    loading.value = false;
  }
}

onMounted(async () => {
  await fetchRepositories();
});
</script>

<template>
  <div class="mt-10">
    <div class="max-w-xl space-y-4">
      <h3 class="text-slate-800 font-bold text-2xl">Project 📁</h3>
      <p class="text-slate-600 text-lg">
        I'm coding so fast to finish this page, even my keyboard needs a coffee break!
      </p>
    </div>
    <div v-if="loading" class="h-56 flex items-center justify-center">
      <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
    </div>
    <div v-else class="mt-4 grid grid-cols-12 gap-4 w-full">
      <div class="col-span-6 flex flex-col flex-1" v-for="repository in repositories" :key="repository.id">
        <GitHubCard :repository="repository" />
      </div>
    </div>
  </div>
</template>
