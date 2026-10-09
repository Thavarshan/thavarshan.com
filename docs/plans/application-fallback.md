# Issue #49 implementation plan

The existing application generator already owns private storage, PDF compilation, state and human review. Its paid-AI gate currently disables the entire pipeline. Extend that pipeline rather than introduce another publisher or submission path.

1. Add a pure deterministic preparation function: exact profile skills and verbatim role/project evidence, explicit gaps, eligibility cautions, CV selection, cover-letter draft and interview prompts. Treat job descriptions as data, never instructions.
2. Default scheduled and manual runs to template mode. Manual dispatch may select one normalized snapshot ID. Keep AI an explicit opt-in requiring both the spending flag and API key. Preserve eligibility and terminal applied-state guards.
3. Save preparation evidence only beside PDFs in the existing private repository. Clean local generated files, avoid logging content or raw provider/compiler errors, and fail closed on invalid state.
4. Test strong/partial matches, ambiguous and ineligible jobs, malformed input, optional AI gating and failure recovery; run the repository CI before review.

No architecture discrepancy: the existing feature and automation boundaries can support this increment directly. No employer communication, public package artifacts, new paid service or scoring-model rewrite is needed.
