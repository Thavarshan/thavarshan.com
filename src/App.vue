<template>
    <div id="app" class="bg-white text-gray-600 leading-normal antialiased min-h-screen">
        <header>
            <Nav />
        </header>

        <main role="main">
            <Hero />

            <Projects />
        </main>

        <footer>
            <Credits />
        </footer>
    </div>
</template>

<script>
    import Nav from './components/Nav';
    import Hero from './components/Hero';
    import Projects from './components/Projects';
    import Credits from './components/Credits';

    export default {
        name: 'App',

        components: {
            Nav,
            Hero,
            Projects,
            Credits,
        },

        created () {
            document.title = "Thavarshan | Personal Portfolio";
        }
    }
</script>
