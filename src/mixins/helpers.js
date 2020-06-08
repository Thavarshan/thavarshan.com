import moment from 'moment';
import axios from 'axios';

export default {
    data() {
        return {
            repos: []
        }
    },

    created() {
        axios.defaults.headers.common['X-Requested-With'] = 'XMLHttpRequest';
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
