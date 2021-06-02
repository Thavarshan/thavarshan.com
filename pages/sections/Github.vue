<template>
    <div class="py-16 bg-gray-50">
        <div class="container mx-auto px-4 sm:px-6">
            <div class="mb-10 lg:grid lg:grid-cols-12 gap-6">
                <div class="col-span-full md:col-span-6">
                    <div>
                        <h5 class="font-bold text-xl text-gray-800">
                            Personal Projects
                        </h5>

                        <p class="mt-3 max-w-md text-sm text-gray-500 leading-relaxed">
                            A list of personal projects now hosted as open source projects or as templates on GitHub pulled in live using <span class="font-bold">GitHub API</span>.
                        </p>
                    </div>
                </div>
            </div>

            <grid></grid>
        </div>
    </div>
</template>

<script>
import Grid from './Grid';

export default {
    components: {
        Grid,
    }
}
</script>
