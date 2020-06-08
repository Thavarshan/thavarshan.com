<template>
    <section class="py-16 bg-gray-200">
        <div class="container mx-auto px-6">
            <div class="mb-8">
                <h4 class="text-xl font-medium text-gray-800 leading-6">Professional Projects</h4>

                <p class="mt-2 max-w-md text-sm leading-relaxed text-gray-600">
                    A list of projects done for clients through out my years as a freelancer and an employee at <span class="font-semibold">Pearl Cluster (Pvt) Ltd</span>.
                </p>
            </div>

            <Professional />
        </div>

        <div class="container mx-auto mt-16 px-6">
            <div class="mb-8">
                <h4 class="text-xl font-medium text-gray-800 leading-6">Personal Projects on GitHub</h4>

                <p class="mt-2 max-w-md text-sm leading-relaxed text-gray-600">
                    A list of personal projects (GitHub repos) now hosted as open source projects or as templates on <span class="font-bold">GitHub</span>.
                </p>
            </div>

            <GitHub />
        </div>

        <div class="container mx-auto mt-16 px-6">
            <div class="mb-8">
                <h4 class="text-xl font-medium text-gray-800 leading-6">Practice Apps on BitBucket</h4>

                <p class="mt-2 max-w-md text-sm leading-relaxed text-gray-600">
                    A list of code katas and coding challenges I did and am doing.
                </p>
            </div>

            <BitBucket />
        </div>
    </section>
</template>

<script>
    import GitHub from './GitHub';
    import BitBucket from './BitBucket';
    import Professional from './Professional';

    export default {
        components: {
            GitHub,
            BitBucket,
            Professional,
        },
    }
</script>
