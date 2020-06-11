<template>
    <div id="app" class="bg-white text-gray-600 leading-normal antialiased min-h-screen">
        <header>
            <Nav />
        </header>

        <main role="main">
            <Profile />

            <Projects />
        </main>

        <footer>
            <Credits />
        </footer>
    </div>
</template>

<script>
    import Nav from './components/Nav';
    import Profile from './components/Profile';
    import Projects from './components/Projects';
    import Credits from './components/Credits';

    export default {
        name: 'App',

        components: {
            Nav,
            Profile,
            Projects,
            Credits,
        },
    }
</script>
