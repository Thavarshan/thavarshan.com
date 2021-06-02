<template>
    <div class="rounded-xl shadow overflow-hidden flex flex-col flex-1 justify-between">
        <div class="px-4 py-5 sm:px-6 bg-white flex flex-col flex-1 justify-between">
            <div>
                <div>
                    <h6 class="font-semibold text-base text-gray-800">
                        {{ project.name }}
                    </h6>

                    <span class="block text-xs text-gray-500">
                        Last updated {{ diffForHumans(project.updated_at) }}
                    </span>
                </div>

                <p class="mt-4 text-sm text-gray-600">
                    {{ project.description }}
                </p>
            </div>

            <div class="mt-10 flex items-center justify-between">
                <a target="_blank" class="inline-flex items-center text-xs font-medium text-blue-500 hover:text-blue-600 focus:text-blue-600 active:text-blue-700" :href="project.website ? project.website : (project.html_url || project.links.html.href)">
                    <span>View project</span>

                    <span class="ml-1">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                            <path fill-rule="evenodd" d="M12.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-2.293-2.293a1 1 0 010-1.414z" clip-rule="evenodd" />
                        </svg>
                    </span>
                </a>

                <span class="text-xs font-medium rounded-full py-1 px-2 bg-blue-100 text-blue-800">
                    {{ (project.language || 'Markdown').toLowerCase() }}
                </span>
            </div>
        </div>
    </div>
</template>

<script>
export default {
    props: ['project'],

    methods: {
        diffForHumans(timestamp) {
            return this.$moment(timestamp).fromNow();
        }
    }
}
</script>
