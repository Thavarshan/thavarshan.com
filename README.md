# Personal Website Rebuild: Space/Warp Travel Portfolio

## Overview

This project is a rebuild of my personal website with a space and warp-travel themed experience. The goal is to present my work and story as an interactive journey that showcases my projects, career, writing, and personal interests in a way that feels modern, memorable, and technically polished.

The site is designed to be content-first and performance-conscious: the 3D layer enhances the experience but never blocks access to the core content.

## Goals

- Create a distinctive portfolio experience inspired by space exploration and warp travel visuals.
- Showcase my featured projects, career timeline, blog, and interests in a cohesive narrative format.
- Keep the site fast, accessible, and SEO-friendly with progressive enhancement.
- Use modern web technologies (React + Three.js) while maintaining clean architecture and maintainability.

## Core Experience

The website should feel like a guided journey through different “stations” of my professional and personal profile.

### Journey Structure

- Landing: Intro and quick navigation, with a subtle starfield backdrop.
- Projects Station: Featured projects with live GitHub metadata and curated summaries.
- Career Station: Timeline of roles, milestones, and highlights.
- Skills and Stack: A structured view of technologies and areas of expertise, optionally represented visually as a constellation or cluster map.
- Interests Station: Personal interests and themes that influence my work (e.g., music, tooling, systems design, design, gaming, AI).
- Writing Station: Blog posts presented as “transmissions” or logs.
- Contact/Docking: Clear contact links, resume, and social profiles.

## Design Principles

### Content First

- All critical content is rendered as HTML to remain searchable, accessible, and readable.
- The 3D scene is a visual layer that enhances navigation and storytelling.

### Progressive Enhancement

- The site must work without WebGL.
- Users with reduced-motion preferences receive minimal animation.
- Mobile devices can use a “lite” 3D mode or a static fallback to preserve battery and performance.

### Simple Navigation

- A persistent navigation element (HUD-style) provides direct access to each section.
- Deep linking to sections should work (hash anchors, or route-based pages where appropriate).

### Accessibility

- Respect `prefers-reduced-motion`.
- Ensure keyboard navigation and focus visibility.
- Maintain readable typography and strong contrast.
- Provide fallbacks if WebGL is not supported.

## Technical Direction

### Framework and UI

- React with Next.js for routing, SEO, and static generation.
- TypeScript for maintainability.
- Tailwind CSS or equivalent for consistent styling and speed of iteration.

### 3D Layer

- Three.js via react-three-fiber (R3F) for scene rendering.
- Drei helpers for common primitives and utilities.
- Carefully limited postprocessing for subtle polish where appropriate.

### Motion and Interaction

- Scroll or section-driven transitions that feel like traveling through space.
- Camera movement between stations (e.g., spline path) triggered by navigation and/or scroll position.
- Warp effects used sparingly to transition between sections.

### Content and Data Sources

- Featured projects are curated and displayed with rich metadata.
- GitHub data is fetched at build time or revalidated periodically to avoid live, per-visitor API calls.
- Blog content is managed via MDX or a content pipeline (e.g., Contentlayer).

## Featured Projects Strategy

Instead of listing all repositories, the site should emphasize curated work:

- Maintain a `featured` list with:
  - Repository identifier
  - Short, human-written summary
  - Tags and highlights
  - Links (demo, docs, release, etc.) where relevant
- Merge in live GitHub metadata:
  - Stars, forks, last updated
  - Primary languages
  - Optional: pinned/readme highlights

This balances authenticity (live stats) with intentional presentation (curation).

## Performance Requirements

- Fast initial load and minimal layout shift.
- 3D code loaded client-side only, and only when appropriate.
- Efficient starfield rendering (instancing, reduced draw calls).
- Mobile-first performance constraints and optional “lite mode.”
- Maintain strong Lighthouse scores across performance, accessibility, best practices, and SEO.

## SEO Requirements

- Pre-render content with SSG/SSR where appropriate.
- Use proper metadata: titles, descriptions, Open Graph, Twitter cards.
- Generate sitemap and robots configuration.
- Ensure each major section can be linked to and indexed.

## Proposed Information Architecture

### Routes

- `/` Home journey (sections: projects, career, skills, interests, writing, contact)
- `/projects` Optional deep dive with filtering and full project list
- `/blog` Blog index
- `/blog/[slug]` Blog post page
- `/about` Optional expanded biography and values
- `/uses` Optional tools and setup page
- `/resume` Optional resume page or download link

## Success Criteria

- The site clearly communicates who I am, what I build, and what I’m interested in within the first 10 seconds.
- Visitors can discover my best work and understand impact without needing to dig.
- The 3D experience adds personality without harming usability.
- The site remains maintainable: content updates are simple and visuals are modular.

## Non-Goals

- Building a fully immersive 3D-only website that hides content.
- Complex WebGL scenes that sacrifice readability, accessibility, or performance.
- Real-time GitHub calls that risk rate limits or inconsistent performance.

## Roadmap

### Phase 1: Foundation

- Next.js site scaffold with layout and routing
- Content model: projects, career, interests, writing
- Featured projects pipeline with GitHub metadata caching
- Baseline starfield backdrop with safe fallbacks

### Phase 2: Journey and Visual Identity

- Section-based transitions and warp effects
- Camera movement between stations
- HUD navigation and deep linking
- Visual polish and typography system

### Phase 3: Refinement and Optimization

- Lite mode and reduced-motion support
- Performance profiling and GPU optimization
- SEO finalization and analytics
- Final design pass and cross-device QA

## License

TBD
