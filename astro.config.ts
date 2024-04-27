import { defineConfig } from 'astro/config';
import markdown from './integrations/markdown';
import tailwind from '@astrojs/tailwind';
import icon from 'astro-icon';

import vercel from "@astrojs/vercel/serverless";

// https://astro.build/config
export default defineConfig({
    integrations: [tailwind(), markdown(), icon()],
    site: 'https://thavarshan.com',
    output: "server",
    adapter: vercel({
        webAnalytics: {
            enabled: true,
        },
    })
});
