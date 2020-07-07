<template>
    <section class="py-16 bg-gray-200">
        <div class="container mx-auto px-6">
            <div class="mb-8">
                <h4 class="text-xl font-bold text-gray-800 leading-6">Professional Projects</h4>

                <p class="mt-2 max-w-lg text-sm leading-relaxed text-gray-600">
                    A few projects I did for clients through out my years as a freelancer and an employee at <span class="font-semibold">Pearl Cluster (Pvt) Ltd</span>.
                </p>
            </div>

            <Professional />
        </div>

        <div class="container mx-auto mt-16 px-6">
            <div class="mb-8">
                <h4 class="text-xl font-bold text-gray-800 leading-6">Personal Projects on GitHub</h4>

                <p class="mt-2 max-w-lg text-sm leading-relaxed text-gray-600">
                    A list of personal projects (GitHub repos) now hosted as open source projects or as templates on <span class="font-bold">GitHub</span> pulled in live using GitHub API.
                </p>
            </div>

            <GitHub />
        </div>

        <div class="container mx-auto mt-16 px-6">
            <div class="mb-8">
                <h4 class="text-xl font-bold text-gray-800 leading-6">Practice Apps on BitBucket</h4>

                <p class="mt-2 max-w-lg text-sm leading-relaxed text-gray-600">
                    A list of coding challenges and practice apps I built and am working on, pulled in live using BitBucket API.
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
