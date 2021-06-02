<script>
export default {
    props: ['uri'],

    created() {
        this.getData();
    },

    data() {
        return {
            data: []
        }
    },

    render() {
        return this.$scopedSlots.default({
            data: this.data
        })
    },

    methods: {
        async getData() {
            await this.$axios.$get(this.uri)
                .then(response => this.data = response);
        }
    }
}
</script>
