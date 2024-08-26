<script setup lang="ts">
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from '@/components/ui/tooltip';
import {
  Button
} from '@/components/ui/button';
import {
  Github,
  Linkedin,
  Heart
} from 'lucide-vue-next';

const NAME = 'Jerome Thayananthajothy';
</script>

<template>
  <div class="container py-20 pxx-24">
    <div class="flex items-start justify-center gap-x-12">
      <div class="flex flex-col items-center flex-shrink-0">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>
              <Avatar class="size-24 hover:shadow border">
                <AvatarImage src="/images/avatar.jpg" :alt="NAME" />
                <AvatarFallback>CN</AvatarFallback>
              </Avatar>
            </TooltipTrigger>
            <TooltipContent side="top">
              {{ NAME }}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <div class="mt-6 flex flex-col gap-y-3">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <Button variant="outline" as-child>
                  <a href="https://github.com/Thavarshan" target="_blank">
                    <Github class="size-6" />
                  </a>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">
                github.com/Thavarshan
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <Button variant="outline" as-child>
                  <a href="https://www.linkedin.com/in/thavarshan" target="_blank">
                    <Linkedin class="size-6" />
                  </a>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">
                linkedin.com/Thavarshan
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <Button variant="outline" as-child>
                  <a href="https://github.com/sponsors/Thavarshan" target="_blank">
                    <Heart class="size-6 text-pink-500" />
                  </a>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">
                Sponsor me on GitHub
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
      <div>
        <div>
          <h1 class="text-3xl font-bold text-slate-800">{{ NAME }}</h1>
          <!-- Navbar -->
          <div class="flex items-center gap-x-10 mt-4">
            <NuxtLink to="/" class="text-slate-500 hover:text-slate-800 uppercase text-xs font-medium tracking-widest" active-class="text-slate-800 underline">About</NuxtLink>
            <NuxtLink to="/projects" class="text-slate-500 hover:text-slate-800 uppercase text-xs font-medium tracking-widest" active-class="text-slate-800 underline">Projects</NuxtLink>
            <NuxtLink to="/blog" class="text-slate-500 hover:text-slate-800 uppercase text-xs font-medium tracking-widest" active-class="text-slate-800 underline">Blog</NuxtLink>
            <a href="mailto:tjthavarshan@gmail.com" class="text-slate-500 hover:text-slate-800 uppercase text-xs font-medium tracking-widest">Contact</a>
          </div>
        </div>
        <div>
          <slot />
        </div>
      </div>
    </div>
  </div>
</template>
