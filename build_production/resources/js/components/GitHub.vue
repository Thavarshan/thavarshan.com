<template>
    <div class="row">
        <div class="col-lg-3 col-md-6 flex flex-col" v-for="repo in repos" :key="repo.id">
            <div class="bg-white hover:shadow-xl p-4 flex flex-col justify-between leading-normal flex flex-col flex-1 mb-4">
                <div>
                    <div class="text-gray-900 font-bold text-xl mb-2">
                        <a target="_blank" :href="repo.html_url">{{ repo.name }}</a>
                    </div>

                    <div class="text-gray-500 text-xs mb-4">
                        {{ repo.description }}
                    </div>
                </div>

                <div class="flex items-center justify-between">
                    <span class="inline-block bg-gray-200 rounded-full px-3 py-1 text-xs text-gray-700 mr-3 font-mono">{{ '#' + repo.language }}</span>

                    <span class="text-xs text-gray-500">
                        Updated: {{ updated(repo.updated_at) }}
                    </span>
                </div>
            </div>
        </div>
    </div>
</template>

<script>
    import helpers from "../mixins/helpers";

    export default {
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
        },
    }
</script>
