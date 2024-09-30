<script setup lang="ts">
import { Star, Circle, GitFork } from 'lucide-vue-next';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import type { Repository } from '@/types/repository';
import moment from 'moment';

defineProps<{
  repository: Repository;
}>();
</script>

<template>
  <NuxtLink :to="repository.homepage || repository.html_url" class="flex flex-col flex-1" target="_blank">
    <Card class="hover:shadow-md flex flex-col justify-between flex-1">
      <CardHeader>
        <div>
          <CardTitle>{{ repository.name }}</CardTitle>
          <time :datetime="repository.updated_at" class="text-muted-foreground text-xs">
            Last updated {{ moment(repository.updated_at).fromNow() }}
          </time>
        </div>
        <CardDescription>
          {{ repository.description }}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div class="flex space-x-4 text-sm text-muted-foreground justify-between">
          <div class="flex items-center">
            <Circle class="mr-1 size-3 fill-sky-400 text-sky-400" />
            {{ repository.language }}
          </div>
          <div class="gap-x-3 flex items-center">
            <div class="flex items-center">
              <GitFork class="mr-1 size-3 fill-slate-400 text-slate-400" />
              {{ repository.forks_count }}
            </div>
            <div class="flex items-center">
              <Star class="mr-1 size-3 fill-amber-400 text-amber-400" />
              {{ repository.stargazers_count }}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  </NuxtLink>
</template>
