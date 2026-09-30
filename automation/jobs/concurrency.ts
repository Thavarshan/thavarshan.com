/** Raised by job enrichment to say a page should be skipped (not failed). Jobs-specific, so it lives with the jobs pipeline. */
export class SkipEnrichmentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SkipEnrichmentError";
  }
}
