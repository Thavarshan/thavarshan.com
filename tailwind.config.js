const defaultTheme = require('tailwindcss/defaultTheme');

module.exports = {
    mode: 'jit',

    purge: {
        content: [
            `components/**/*.{vue,js}`,
            `layouts/**/*.vue`,
            `pages/**/*.vue`,
            `plugins/**/*.{js,ts}`,
            `nuxt.config.{js,ts}`
        ]
    },

    darkMode: false, // or 'media' or 'class'

    theme: {
        container: {
            center: true,
        },

        extend: {
            fontFamily: {
                sans: ['Inter', ...defaultTheme.fontFamily.sans],
            },
        },
    },

    variants: {
        extend: {},
    },

    plugins: [],
}
