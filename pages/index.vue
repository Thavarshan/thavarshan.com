<template>
    <div>
        <profile></profile>

        <projects></projects>
    </div>
</template>

<script>
import Profile from './sections/Profile';
import Projects from './sections/Projects';

export default {
    components: {
        Profile,
        Projects,
    }
}
</script>
