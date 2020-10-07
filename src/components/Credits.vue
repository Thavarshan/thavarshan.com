<template>
    <div class="container mx-auto px-6">
        <div class="text-center text-xs py-16">
            <div class="text-gray-500 mb-3">&copy; {{ year }} <span class="font-semibold">Thavarshan</span></div>

            <div class="flex justify-center items-center">
                <a v-for="link in social" v-bind:key="link.name" class="text-gray-500 hover:text-gray-600 inline-block mx-2" :href="link.href">
                    <span :class="link.icon"></span>
                </a>
            </div>
        </div>
    </div>
</template>

<script>
    export default {
        props: ['social'],

        data() {
            return {
                year: new Date().getFullYear()
            }
        }
    }
</script>
