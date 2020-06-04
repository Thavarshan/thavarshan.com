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
    import moment from 'moment';

    export default {
        data() {
            return {
                repos: null,
                id: '2aac754eb6ac3fe478cd',
                secret: 'b67c45c66014f874d22b422ad140affd5a5d329d'
            }
        },

        mounted() {
            this.getRepos();
        },

        methods: {
            getRepos() {
                axios.get(`https://api.github.com/users/emberfuse/repos?client_id=${this.id}&client_secret=${this.secret}`)
                    .then((response) => {
                        this.repos = response.data;
                    });
            },

            updated(time) {
                return moment(time).fromNow();
            },
        }
    }
</script>
