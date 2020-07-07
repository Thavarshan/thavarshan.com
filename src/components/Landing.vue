<template>
    <div id="app" class="bg-white text-gray-600 leading-normal antialiased min-h-screen">
        <header>
            <Nav />
        </header>

        <main role="main">
            <Profile />

            <Recommendations />

            <Projects />
        </main>

        <footer>
            <Credits />
        </footer>
    </div>
</template>

<script>
    import Nav from './Nav';
    import Profile from './Profile';
    import Projects from './Projects';
    import Credits from './Credits';
    import Recommendations from './Recommendations';

    export default {
        components: {
            Nav,
            Profile,
            Projects,
            Credits,
            Recommendations
        },
    }
</script>
