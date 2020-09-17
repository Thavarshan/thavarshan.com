<template>
    <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
        <div class="flex flex-col h-48" v-for="repo in repos" :key="repo.id" v-show="! repo.fork">
            <a target="_blank" :href="repo.homepage ? repo.homepage : repo.html_url" class="bg-white rounded-lg shadow-sm hover:shadow-md p-4 flex flex-col justify-between leading-normal flex flex-col flex-1">
                <Card :repo="repo" />

                <div class="flex items-baseline justify-between">
                    <span class="inline-block bg-gray-200 rounded-full px-3 py-1 text-xs text-gray-700 mr-3 font-mono">{{ '#' + repo.language }}</span>

                    <span class="text-xs text-gray-500 whitespace-no-wrap">
                        Updated {{ updated(repo.updated_at) }}
                    </span>
                </div>
            </a>
        </div>
    </div>
</template>

<script>
    import helpers from "../mixins/helpers";
    import Card from './Card';

    export default {
        components: {
            Card,
        },

        mixins: [helpers],

        mounted() {
            this.getRepos(
                `https://api.github.com/users/thavarshan/repos`,
                {},
                {
                    auth: {
                        token: 'b421dc8182eb0e0ca0b8acd9fe403ee8c03efbdd',
                    }
                }
            );

            console.log(this.repos);
        },
    }
</script>
