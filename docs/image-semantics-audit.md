# Image accessibility, performance and social-card audit

## Content image policy

- Informative images need concise alt text describing their purpose; decorative illustrations/icons should use empty `alt=""` (or hide equivalent SVG icons from assistive technology) and must not duplicate nearby text.
- Always provide intrinsic width and height or a stable aspect ratio to avoid layout shifts. Use WebP/AVIF for large photographic assets when the actual savings justify another asset; retain a compact JPEG when it already transfers efficiently and is supported by all browsers.
- `src/features/home/hero.tsx` is the only content `<Image>` today. It uses the descriptive person name for alt text, a square intrinsic `176×176` aspect ratio, a cropped responsive square presentation and eager loading because it is above the fold. Its local `public/images/avatar.jpg` is a `460×460` JPEG of roughly 16 KB. Next.js static export cannot use the default dynamic image optimizer, so this image is intentionally `unoptimized` and served directly.
- Generated social cards are not decorative page content: the browser reads them from Open Graph/Twitter image metadata, and the nearby metadata supplies descriptive titles. They are not duplicated as `<img>` in the pages.

## Generated social images

All social-card routes use `ImageResponse` to generate `1200×630` PNG images. `npm run structure:routes` now validates **every** exported `opengraph-image` file for PNG signature, dimensions and a 2 MB transfer-size ceiling. Its unit regression checks reject wrong format, oversized output and mismatched dimensions; the existing route inventory and deployed-smoke checks cover missing assets and metadata.

Manual visual review on the production build completed 2026-11-08 (local build output, **not** a live social-platform scrape):

| Page class | Representative generated image | Review |
| --- | --- | --- |
| Homepage | `/opengraph-image` | Full name and positioning fit, with margins and footer visible |
| Insight | `/insights/event-driven-asynchronous-php-matrix-lessons/opengraph-image` | Three-line title, description and author remain readable with no overlap |
| Project | `/projects/honeymelon/opengraph-image` | Long project name wraps onto two lines; description and footer fit |
| Developer tool | `/tools/laravel-env-checker/opengraph-image` | Title and privacy promise visible without truncation |

The automated checks cannot reliably judge arbitrary text overflow or preview crops on LinkedIn, X or Facebook, so repeat the representative rendered-image review after significant title/typography changes. No runtime service or account login is required. An image-specific sitemap is not useful here: these cards describe existing HTML pages and there is currently no independent indexed image gallery.
