<template>
    <div class="lg:grid lg:grid-cols-12 gap-6">
        <div v-for="(project, id) in projects" :key="id" class="col-span-full sm:col-span-6 md:col-span-4 lg:col-span-3 flex flex-col">
            <card :project="project"></card>
        </div>
    </div>
</template>

<script>
export default {
    props: ['projects']
}
</script>
