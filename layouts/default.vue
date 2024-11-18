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
import { NAME } from '../seo';
import resume from '../assets/docs/Jerome-Resume.pdf';
</script>

<template>
  <div class="py-6 md:py-20 px-0 md:px-24">
    <div class="flex flex-col md:flex-row items-start justify-center gap-x-0 md:gap-x-12 w-full md:max-w-5xl mx-auto">
      <div class="flex flex-col mx-auto md:mx-0 items-center flex-shrink-0">
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
        <div class="mt-6 flex flex-row md:flex-col gap-x-3 md:gap-x-0 md:gap-y-3">
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
      <div class="w-full flex flex-col mt-4 md:mt-0">
        <div>
          <h1 class="text-lg text-center md:text-left md:text-3xl font-bold text-gray-800">{{ NAME }}</h1>
          <!-- Navbar -->
          <div class="flex items-center justify-center md:justify-start gap-x-0 md:gap-x-10 mt-4 divide-x divide-gray-100 border-y border-gray-100 md:border-0">
            <NuxtLink to="/" class="p-2 md:p-0 bg-white  hover:bg-gray-100 md:hover:bg-white text-gray-500 hover:text-gray-800 uppercase text-xs font-medium tracking-widest" active-class="text-gray-800 underline">About</NuxtLink>
            <NuxtLink to="/projects" class="p-2 md:p-0 bg-white  hover:bg-gray-100 md:hover:bg-white text-gray-500 hover:text-gray-800 uppercase text-xs font-medium tracking-widest" active-class="text-gray-800 underline">Projects</NuxtLink>
            <NuxtLink to="/blog" class="p-2 md:p-0 bg-white  hover:bg-gray-100 md:hover:bg-white text-gray-500 hover:text-gray-800 uppercase text-xs font-medium tracking-widest" active-class="text-gray-800 underline">Blog</NuxtLink>
            <a href="mailto:tjthavarshan@gmail.com" class="p-2 md:p-0 bg-white  hover:bg-gray-100 md:hover:bg-white text-gray-500 hover:text-gray-800 uppercase text-xs font-medium tracking-widest">Contact</a>
            <a :href="resume" class="p-2 md:p-0 bg-white  hover:bg-gray-100 md:hover:bg-white text-gray-500 hover:text-gray-800 uppercase text-xs font-medium tracking-widest" download>Résumé</a>
          </div>
        </div>
        <div class="w-full px-4 md:px-0">
          <slot />
        </div>
      </div>
    </div>
  </div>
</template>
