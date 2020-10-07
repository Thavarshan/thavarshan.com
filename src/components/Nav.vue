<template>
    <nav class="py-2 bg-gray-800">
        <div class="container mx-auto px-6">
            <div class="flex items-center justify-between">
                <a href="https://www.dropbox.com/s/cuylkapkyyjxqt5/Thavarshan%20Resum%C3%A9.pdf?dl=0" class="text-gray-400 hover:text-white inline-block text-sm font-medium hover:no-underline">Resumé <span class="ml-1">&rarr;</span></a>

                <div class="flex items-center">
                    <a v-for="link in social" v-bind:key="link.name" class="text-gray-400 hover:text-white inline-block ml-4" :href="link.href">
                        <span :class="link.icon"></span>
                    </a>
                </div>
            </div>
        </div>
    </nav>
</template>

<script>
    export default {
        props: ['social']
    }
</script>

