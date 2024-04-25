const defaultTheme = require("tailwindcss/defaultTheme");

/** @type {import('tailwindcss').Config} */
module.exports = {
	content: ["./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}"],
	theme: {
		screens: {
			xs: "475px",
			...defaultTheme.screens
		},
		extend: {
			colors: {
				main: "#78350f",
                animated: "#fffb76",
                amber: {
                    DEFAULT: '#FEAD38',
                    50: '#FFF8EF',
                    100: '#FFF0DA',
                    200: '#FFDFB2',
                    300: '#FECE89',
                    400: '#FEBE61',
                    500: '#FEAD38',
                    600: '#FD9601',
                    700: '#C57501',
                    800: '#8D5401',
                    900: '#553300',
                    950: '#392200'
                },
			},
			fontSize: {
				"code-sm": "0.825rem",
				"code-base": "0.925rem",
				"code-lg": "1.12rem",
				"code-xl": "1.2rem",
				"code-2xl": "1.45rem",
				"code-3xl": "1.825rem",
				"code-4xl": "2.15rem",
				"code-5xl": "2.9rem"
			}
		}
	},
	plugins: []
};
