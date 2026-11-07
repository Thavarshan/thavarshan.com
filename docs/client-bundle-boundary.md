# Client-side profile boundary and bundle measurement

The professional profile remains schema-validated by Zod at the server/build boundary
(`profile.ts` and `site.ts`). The client navigation receives only its seven navigation
labels/URLs and three action links through the server `SiteNav` wrapper. The root
layout passes only the telemetry endpoint, active hostname and local-test override
to `TelemetryProvider`. Neither client entry imports the generated profile or Zod.

## Production build comparison for #141

Fresh `npm run build` runs using the same lockfile and Next.js 16.4.5, with the
same synthetic/default build environment. The baseline is commit `e52822d`
(after the other reliability fixes, immediately before this split). Counts include
**all JavaScript chunks referenced by `out/index.html`**, not just one selected
chunk. Gzip uses Node's `gzipSync` with level 9 and `mtime: 0`.

| Homepage JavaScript | Baseline | After refactor | Reduction |
| --- | ---: | ---: | ---: |
| Referenced chunks | 9 | 8 | 1 |
| Uncompressed bytes | 736,704 | 614,199 | 122,505 (16.6%) |
| Gzipped bytes | 226,205 | 190,396 | 35,809 (15.8%) |
| Referenced chunks containing `ZodError` | 1 | 0 | 1 |

The removed shared chunk contained both the parsed profile and runtime Zod error
text (127,822 bytes / 37,796 gzipped), but its entire size is **not** claimed as
the attributable saving; the full referenced-chunk totals above are the comparable
measurement. Actual transferred bytes can vary with compression, caching, CDN and
subsequent Next.js builds. This is an artifact-size measurement, not a measured
Core Web Vitals improvement.

To reproduce, build each revision and sum the byte length and gzip length of
`out/_next/static/chunks/*.js` files whose filenames appear in `out/index.html`.
The import-graph regression in `client-profile-boundary.test.ts` also verifies
the client bundle's inputs, while the profile parse regression fails on malformed
data. Keep the server projection and the telemetry environment overrides when
changing navigation or site configuration.
