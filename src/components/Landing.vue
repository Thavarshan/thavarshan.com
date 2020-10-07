<template>
    <div id="app" class="bg-white text-gray-600 leading-normal antialiased min-h-screen">
        <header>
            <Nav :social="social" />
        </header>

        <main role="main">
            <Profile />

            <!-- <Recommendations /> -->

            <Projects />
        </main>

        <footer>
            <Credits :social="social" />
        </footer>
    </div>
</template>

<script>
    import Nav from './Nav';
    import Profile from './Profile';
    import Projects from './Projects';
    import Credits from './Credits';
    // import Recommendations from './Recommendations';

    export default {
        components: {
            Nav,
            Profile,
            Projects,
            Credits,
            // Recommendations
        },

        data() {
            return {
                social: [
                    {
                        name: 'mail',
                        icon: 'fas fa-envelope',
                        href: 'mailto:tjthavarshan@gmail.com'
                    },
                    {
                        name: 'github',
                        icon: 'fab fa-github',
                        href: 'https://github.com/Thavarshan'
                    },
                    {
                        name: 'linkedin',
                        icon: 'fab fa-linkedin',
                        href: 'https://www.linkedin.com/in/thavarshan'
                    }
                ]
            }
        }
    }
</script>
