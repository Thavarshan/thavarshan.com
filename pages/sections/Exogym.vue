<template>
    <div>
        <div class="container mx-auto px-4 sm:px-6">
            <div class="mb-10 lg:grid lg:grid-cols-12 gap-6">
                <div class="col-span-full md:col-span-6">
                    <div>
                        <h5 class="font-bold text-xl text-gray-800">
                            Contributions: Exogym
                        </h5>

                        <p class="mt-3 max-w-md text-sm text-gray-500 leading-relaxed">
                            Exogym is an organization specializing in making the best gym management system called <span class="font-bold">Benchpress</span>.
                        </p>
                    </div>
                </div>
            </div>

            <provider uri="https://api.github.com/orgs/exogym/repos">
                <div slot-scope="{ data }">
                    <grid :projects="data"></grid>
                </div>
            </provider>
        </div>
    </div>
</template>

<script>
export default {}
</script>
