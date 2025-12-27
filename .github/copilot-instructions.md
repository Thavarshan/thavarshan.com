
# Copilot Instructions for thavarshan.com

## Project Overview

- **Framework:** Next.js (App Router) with TypeScript for all logic and UI. Uses Tailwind CSS for styling and shadcn/ui for component patterns.
- **UI Components:** All reusable UI elements are in `components/ui/`, following shadcn conventions. Compose new UI from these, using PascalCase for exports and kebab-case for files. Example: `import { Button } from "@/components/ui/button"`.
- **Global Styles:** Located in `app/globals.css`. Tailwind config is in `tailwind.config.js`.
- **Utilities:** Shared helpers (e.g., `cn` for class merging) are in `lib/utils.ts`.
- **No backend/API:** All data is static or fetched at build time. No server routes or runtime API endpoints.

## Architecture & Data Flow

- **Pages:** Main entry is `app/page.tsx` (Next.js) or `pages/*.vue` (Nuxt variant). Layout is handled by `app/layout.tsx` or `layouts/default.vue`.
- **Content:** Blog and project data are managed via static files or content pipeline (e.g., MDX, Contentlayer, or Nuxt Content).
- **Featured Projects:** Curated in code, with GitHub metadata merged at build time (see `README.md` for strategy).
- **Navigation:** Persistent HUD-style navigation, deep linking supported. See `layouts/default.vue` for Nuxt or `app/layout.tsx` for Next.js.
- **Accessibility:** Follows best practices—keyboard navigation, reduced motion, strong contrast. See `README.md` for principles.

## Developer Workflows

- **Install dependencies:** `npm install`
- **Run dev server:** `npm run dev`
- **Build for production:** `npm run build`
- **Lint:** `npm run lint`
- **Format:** `npm run format` (if configured)
- **Tailwind:** Use utility classes; extend in `tailwind.config.js` as needed.

## Project-Specific Conventions

- **Component Structure:** Place new UI in `components/ui/`, export via `index.ts` if needed. Use shadcn/ui patterns for consistency.
- **TypeScript:** All code must be strongly typed. Define interfaces/types for all props and data models (see `types/` for examples).
- **Styling:** Prefer Tailwind classes. Use `cn` from `lib/utils.ts` for conditional class merging.
- **No global state:** Use props/context only. No Redux, Zustand, or similar.
- **SEO:** Metadata and sitemap handled via config (`nuxt.config.ts` or Next.js equivalents). See `seo.ts` for site constants.

## Integration & External Dependencies

- **shadcn/ui:** For UI primitives and patterns.
- **radix-ui:** For accessible UI components.
- **GitHub API:** Used at build time for project metadata (see `pages/projects.vue` or equivalent).
- **Three.js/react-three-fiber:** For 3D scenes (if present, see `README.md`).

## Examples

- **UI Component:** `components/ui/button.tsx` (Next.js) or `components/ui/button.vue` (Nuxt)
- **Utility:** `lib/utils.ts` for `cn` function
- **Page:** `app/page.tsx` or `pages/index.vue`
- **Featured Projects:** See `README.md` “Featured Projects Strategy”

## When in Doubt

- Follow the structure and naming of existing files.
- Reference this file and `README.md` for architecture, design, and workflow guidance.
- If a pattern is unclear, prefer explicit, strongly-typed, and accessible code.
