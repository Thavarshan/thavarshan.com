<template>
    <div class="container mx-auto px-6">
        <div class="text-center text-xs py-16">
            <div class="text-gray-500 mb-3">&copy; {{ year }} <span class="font-semibold">Thavarshan</span></div>

            <div class="flex justify-center items-center">
                <a class="text-gray-500 hover:text-gray-600 inline-block mx-2" href="mailto:tjthavarshan@gmail.com">
                    <span class="fas fa-envelope"></span>
                </a>

                <a target="_blank" class="text-gray-500 hover:text-gray-600 inline-block mx-2" href="https://twitter.com/thavarshan">
                    <span class="fab fa-twitter"></span>
                </a>

                <a target="_blank" class="text-gray-500 hover:text-gray-600 inline-block mx-2" href="https://github.com/Thavarshan">
                    <span class="fab fa-github"></span>
                </a>

                <a target="_blank" class="text-gray-500 hover:text-gray-600 inline-block mx-2" href="https://www.linkedin.com/in/thavarshan-thayananthajothy-9a7bb2106/">
                    <span class="fab fa-linkedin"></span>
                </a>

                <a target="_blank" class="text-gray-500 hover:text-gray-600 inline-block mx-2" href="https://dribbble.com/thavarshan">
                    <span class="fab fa-dribbble"></span>
                </a>
            </div>
        </div>
    </div>
</template>

<script>
    export default {
        data() {
            return {
                year: new Date().getFullYear()
            }
        }
    }
</script>
