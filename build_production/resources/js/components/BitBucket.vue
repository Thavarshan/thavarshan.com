<template>
    <div class="row">
        <div class="col-lg-3 col-md-6 flex flex-col" v-for="repo in repos" :key="repo.id">
            <div class="bg-white hover:shadow-xl p-4 flex flex-col justify-between leading-normal flex flex-col flex-1 mb-4">
                <div>
                    <div class="text-gray-700 font-bold text-xl mb-2">
                        <a target="_blank" :href="repo.links.html.href">{{ repo.name }}</a>
                    </div>

                    <div class="text-gray-500 text-xs mb-4">
                        {{ repo.description }}
                    </div>
                </div>

                <div class="flex items-center justify-between">
                    <span class="inline-block bg-gray-200 rounded-full px-3 py-1 text-xs text-gray-700 mr-3 font-mono">{{ '#' + repo.language }}</span>

                    <span class="text-xs text-gray-500">
                        Updated: {{ updated(repo.updated_on) }}
                    </span>
                </div>
            </div>
        </div>
    </div>
</template>

<script>
    import moment from 'moment';

    export default {
        data() {
            return {
                repos: null,
            }
        },

        mounted() {
            this.getRepos();
        },

        methods: {
            getRepos() {
                axios.get(`https://api.bitbucket.org/2.0/repositories/Thavarshan`)
                    .then((response) => {
                        this.repos = response.data.values;
                    });
            },

            updated(time) {
                return moment(time).fromNow();
            },
        }
    }
</script>
