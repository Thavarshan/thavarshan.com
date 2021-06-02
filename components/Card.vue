<template>
    <div class="col-span-full sm:col-span-6 md:col-span-4 lg:col-span-3 flex flex-col">
        <div class="rounded-xl shadow overflow-hidden flex flex-col flex-1 justify-between">
            <div class="px-4 py-5 sm:px-6 bg-white flex flex-col flex-1 justify-between">
                <div>
                    <div>
                        <h6 class="font-semibold text-base text-gray-800">Project Name</h6>

                        <span class="block text-xs text-gray-500">
                            Last updated 6 years ago
                        </span>
                    </div>

                    <p class="mt-4 text-sm text-gray-600">
                        Donec sed odio dui. Vestibulum id ligula porta felis euismod semper. Nulla vitae elit libero, a pharetra augue.
                    </p>
                </div>

                <div class="mt-10 flex items-center justify-between">
                    <a class="text-xs font-medium text-blue-500 hover:text-blue-600 focus:text-blue-600 active:text-blue-700" href="#">
                        <span>View project</span> <span class="ml-1">&rarr;</span>
                    </a>

                    <span class="text-xs font-medium rounded-full py-1 px-2 bg-blue-100 text-blue-800">
                        PHP
                    </span>
                </div>
            </div>
        </div>
    </div>
</template>

<script>
export default {
    props: ['project'],
}
</script>
