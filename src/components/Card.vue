<template>
    <div>
        <div class="text-gray-800 font-semibold text-base mb-2">
            {{ repo.name }}
        </div>

        <div class="text-gray-500 text-xs mb-6">
            {{ repo.description }}
        </div>
    </div>
</template>

<script>
    export default {
        props: ['repo'],
    }
</script>

