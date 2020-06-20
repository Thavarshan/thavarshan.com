<template>
    <pdf src="../assets/docs/thavarshan-resumé.pdf"></pdf>
</template>

<script>
    import pdf from 'vue-pdf';

    export default {
        components: {
            pdf,
        },

        mounted() {
            console.log("Component mounted");
        }
    }
</script>
