<template>
    <section class="py-16 bg-gray-800">
        <div class="container mx-auto px-6">
            <div class="flex flex-col justify-center items-center">
                <div class="text-center">
                    <h4 class="font-bold text-white text-2xl">
                        What Other People Say about Me
                    </h4>

                    <h6 class="text-gray-600">LinkedIn recommedations received from superiors and colleagues.</h6>
                </div>

                <div class="border-t border-gray-700 my-6 h-px bg-white w-1/2"></div>

                <hooper :settings="settings" class="text-center flex items-center justify-center md:max-w-xl xl:max-w-2xl">
                    <slide v-for="recommendation in recommendations" :key="recommendation.id" :index="recommendation.id" class="text-center flex justify-center">
                        <div class="md:max-w-xl xl:max-w-2xl">
                            <p class="text-lg leading-relaxed text-gray-100 italic">
                                {{ recommendation.message }}
                            </p>

                            <div class="mt-6 flex flex-col items-center">
                                <h5 class="text-lg text-white font-semibold">{{ recommendation.name }}</h5>
                                <h6 class="text-gray-600 text-sm max-w-sm">{{ recommendation.title }}</h6>
                            </div>
                        </div>
                    </slide>
                </hooper>
            </div>
        </div>
    </section>
</template>

<script>
    import data from '../assets/data/recommendations.json';
    import { Hooper, Slide } from 'hooper';
    import 'hooper/dist/hooper.css';

    export default {
        components: {
            Hooper,
            Slide
        },

        data() {
            return {
                recommendations: data.recommendations,
                settings: {
                    centerMode: true,
                    pagination: 'no',
                    autoPlay: true,
                    playSpeed: 7000,
                }
            }
        },
    }
</script>

<style scoped>
    .hooper {
        height: auto;
    }
</style>
