import moment from 'moment';

export default {
    data() {
        return {
            repos: []
        }
    },

    methods: {
        getRepos(endpoint, data = {},  headers = {}) {
            axios.get(endpoint, data, headers)
                .then((response) => {
                    this.repos = response.data;
                });
        },

        updated(time) {
            return moment(time).fromNow();
        },
    }
}
