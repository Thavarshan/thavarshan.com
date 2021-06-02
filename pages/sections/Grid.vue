<template>
    <div class="lg:grid lg:grid-cols-12 gap-6">
        <card></card>
    </div>
</template>

<script>
export default {
    props: ['uri', 'auth'],

    data() {
        return {
            projects: []
        }
    }
}
</script>
