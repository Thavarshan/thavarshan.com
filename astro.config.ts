import { defineConfig } from "astro/config";
import markdown from "./integrations/markdown";
import tailwind from "@astrojs/tailwind";
import icon from "astro-icon";

// https://astro.build/config
export default defineConfig({
    integrations: [tailwind(), markdown(), icon()],
    site: "https://thavarshan.com"
});
