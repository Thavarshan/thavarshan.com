Automated weekly content refresh.

This updates generated public snapshots and CV source from current public data:

- GitHub repository metadata
- Package registry metrics
- Generated LaTeX CV source

Validation run:

- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run insights:bundle`
- `GITHUB_STATS_DISABLED=1 npm run build`
