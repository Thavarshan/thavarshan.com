# Public repository maintenance and earning-opportunity audit

**Snapshot: 2026-11-06.** This is a **planning and verification document**, not a claim that every repository was rebuilt or updated.

## Scope and approach

GitHub connector inventory: **63 owned repositories** = **56 public** (45 active + 11 archived) and **7 private**. Public repository About metadata and top-level files were inspected; `.github` directories were inventoried. Seven private repositories were intentionally **not listed or described here**. Do not copy private repository names, dotfiles, work samples, or credentials into this public report.

**What the audit found:** among 45 active public repos, 15 have no recognized GitHub license; 10 lack a top-level `.github` folder; one has no root README. These are **review flags**, not automatic defects. Licenses are legal decisions: no license must be invented or added without explicit owner approval. Archived repositories should normally remain archived.

## Consistency standard (tailor, don't blindly paste)

1. **Accurate identity and maturity:** describe what code actually implements; separate stable, beta, prototype, research, learning and future roadmap. Avoid unverified "enterprise-ready," profitability, AI accuracy or security claims.
2. **Useful README:** state who it is for, working install/run/test commands, compatibility, a five-minute example, limitations, active support status and links.
3. **Safe contribution route:** a short CONTRIBUTING guide (or existing equivalent), issue and PR instructions for maintained collaborative projects. Avoid imposing an identical governance template on katas and archival snapshots.
4. **Security and licensing:** clear private-report channel for products handling secrets, accounts or finances; avoid public vulnerability proofs. Confirm existing licenses and ownership; do not change terms or visibility automatically.
5. **Reproducibility:** pin supported runtimes where appropriate; test matrix for advertised versions; CI lint/test/build; handle dependency PRs with changelogs, checks and rollback.
6. **Maintainer capacity:** triage issues and PRs, mark good first issues only when someone can support them, document release notes; archive genuinely unmaintained projects if the owner chooses.
7. **Discoverability:** consistent website link, repo About and topics where authorized, screenshots for user-facing tools, useful package-registry links and trustworthy changelog. Never buy stars, backfill artificial commits, or mass-post promotional content.

## Repository-by-repository next action

### Flagship maintainers

| Repository | Current signal | Next maintenance action |
| --- | --- | --- |
| [fetch-php](https://github.com/Thavarshan/fetch-php) | 451 stars · PHP | Preserve JS-inspired API; verify cancellation/Matrix 4 parity, streaming and docs; prioritise compatibility tests. |
| [filterable](https://github.com/Thavarshan/filterable) | 195 stars · PHP | Add newcomer contribution guide; verify Laravel 11–13/PHP 8.3–8.5 matrix and migration examples. |
| [phpvm](https://github.com/Thavarshan/phpvm) | 171 stars · Shell | Check .phpvmrc depth, shell/OS compatibility, PECL installation and release docs; test before release. |
| [honeymelon](https://github.com/Thavarshan/honeymelon) | 157 stars · TypeScript | Reconcile stable v2 vs beta v3, rename references, process dependency PRs; verify unsigned installer warnings. |
| [matrix](https://github.com/Thavarshan/matrix) | 60 stars · PHP | Add contribution guide; regression tests for timeout, cancellation, loop ownership and retry semantics. |

### Career and commercial products

| Repository | Current signal | Next maintenance action |
| --- | --- | --- |
| [thavarshan.com](https://github.com/Thavarshan/thavarshan.com) | 0 stars · TypeScript | Publish recruiter-friendly profile draft; reconcile canonical role/availability, site and CV; avoid stale metadata. |
| [wisp](https://github.com/Thavarshan/wisp) | 11 stars · PHP | Add security disclosure/contributor paths; run secret-leak, encryption, expiry and production configuration tests. |
| [viridian](https://github.com/Thavarshan/viridian) | 0 stars · TypeScript | Follow issue #8 and roadmap; label implemented vs planned release and incident intelligence; validate small slices. |
| [pinetree](https://github.com/Thavarshan/pinetree) | 0 stars · TypeScript | Validate Slack pilot with one team, export accuracy, timezone/security controls, then decide commercial offering. |
| [dokimos](https://github.com/Thavarshan/dokimos) | 5 stars · Python | Preserve uncertainty warnings; test false positives, provenance, reproducibility and corpus privacy. |
| [ignite](https://github.com/Thavarshan/ignite) | 0 stars · PHP | Check forum activity and dependencies; assess narrow community use before general feature expansion. |
| [nullwire](https://github.com/Thavarshan/nullwire) | 0 stars · JavaScript | Keep experimental warning; complete threat model, dependency/security checks, cross-platform client tests. |
| [orthrus](https://github.com/Thavarshan/orthrus) | 1 stars · PHP | Audit JWT tenant isolation, key rotation and auth policies; avoid unsupported production-ready claims. |
| [ledger](https://github.com/Thavarshan/ledger) | 0 stars · TypeScript | Demonstrate finance correctness and tenant isolation; avoid storing real personal data in demos. |
| [moxy-contacts](https://github.com/Thavarshan/moxy-contacts) | 0 stars · Python | Verify private archive threat model, backup/restore and D1 deployment; keep synthetic screenshots. |
| [webpify](https://github.com/Thavarshan/webpify) | 3 stars · TypeScript | Document maintained Node versions, fixtures and CLI compatibility; identify simple distribution story. |
| [secrets-loader](https://github.com/Thavarshan/secrets-loader) | 2 stars · Shell | Review shell quoting and secret redaction; document AWS SSM and offline examples. |
| [composer-upgrade-helper](https://github.com/Thavarshan/composer-upgrade-helper) | 0 stars · Python | Fix placeholder install URL and risky 'latest automatically' wording; add safe dry-run and tests as future work. |
| [github-org-cloner](https://github.com/Thavarshan/github-org-cloner) | 0 stars · Python | Validate authentication scopes, API pagination, rate limits, safe local paths and multi-OS CI. |

### Educational and demonstration work

| Repository | Current signal | Next maintenance action |
| --- | --- | --- |
| [phpunit-code-katas](https://github.com/Thavarshan/phpunit-code-katas) | 7 stars · PHP | Keep as clearly dated exercises; refresh version/support statement, don't promise active library support. |
| [python-code-katas](https://github.com/Thavarshan/python-code-katas) | 6 stars · Python | Keep as exercises; document minimum Python version and compare with pyper. |
| [birthdays](https://github.com/Thavarshan/birthdays) | 4 stars · Python | Mark as example/utility; verify SMTP/credential handling and dependency age. |
| [github-templates](https://github.com/Thavarshan/github-templates) | 2 stars · mixed | Add a real README with selection instructions; de-duplicate against modern repo-level templates. |
| [gym](https://github.com/Thavarshan/gym) | 5 stars · C++ | Label C++ learning app; verify build instructions without adding a hosting burden. |
| [otrium](https://github.com/Thavarshan/otrium) | 2 stars · PHP | Check PHP CLI applicability and data anonymization; label project origin accurately. |
| [bookshop](https://github.com/Thavarshan/bookshop) | 0 stars · Java | Explain Java desktop demo status; verify reproducible build and screenshots. |
| [etherwall](https://github.com/Thavarshan/etherwall) | 0 stars · PHP | Treat hate-speech classifier as experimental; test bias/false positives and no-production claim. |
| [babybuy](https://github.com/Thavarshan/babybuy) | 0 stars · Java | Mark Android exercise and supported SDK versions; no untested production promises. |
| [nesbot](https://github.com/Thavarshan/nesbot) | 1 stars · Python | Describe rule-based chatbot accurately, with examples and limitations. |
| [euclidius](https://github.com/Thavarshan/euclidius) | 3 stars · Python | Document dataset provenance, safety and model limitations; avoid accuracy claims without evaluation. |
| [bitdirectory](https://github.com/Thavarshan/bitdirectory) | 0 stars · TypeScript | Refresh deprecated Bitbucket API assumptions or mark explicitly as historical. |
| [chttp](https://github.com/Thavarshan/chttp) | 0 stars · C++ | Label crude educational HTTP server; do not claim security or production readiness. |
| [transmission](https://github.com/Thavarshan/transmission) | 3 stars · PHP | Validate vehicle data privacy; distinguish demo from production registry. |
| [comet.thavarshan.com](https://github.com/Thavarshan/comet.thavarshan.com) | 1 stars · Vue | Point visitors to Honeymelon canonical project and avoid implying active second product. |
| [aws-scripts](https://github.com/Thavarshan/aws-scripts) | 0 stars · Python | Check free-tier assumptions, IAM least privilege and dry-run options; avoid unintended AWS bills. |
| [chalice](https://github.com/Thavarshan/chalice) | 0 stars · TypeScript | Document Azure WebPubSub costs, required config and sample-only status. |
| [contacts](https://github.com/Thavarshan/contacts) | 0 stars · TypeScript | Mark enterprise-style learning repo, use synthetic data and clear AWS costs. |
| [workflow-release-registry](https://github.com/Thavarshan/workflow-release-registry) | 0 stars · Python | Identify as coding exercise/spec; add README framing rather than commercial branding. |
| [pyper](https://github.com/Thavarshan/pyper) | 0 stars · Python | Protect test-first Python lessons; add clear beginner contribution rules. |
| [reactor](https://github.com/Thavarshan/reactor) | 0 stars · TypeScript | Protect test-first React exercises; validate React 19 conventions and developer setup. |
| [virgosoft-exchange](https://github.com/Thavarshan/virgosoft-exchange) | 0 stars · PHP | Educational only: no live funds; review settlement tests and regulatory risks before any launch. |
| [heli-flight-test](https://github.com/Thavarshan/heli-flight-test) | 0 stars · Python | Mark simulated research, not verified flight controller; include repeatable experiment commands. |
| [LabTrack](https://github.com/Thavarshan/LabTrack) | 0 stars · Visual Basic 6.0 | Preserve authentic VB6 nostalgia; document Apple Silicon emulation and original 2009 context. |
| [wallstreet](https://github.com/Thavarshan/wallstreet) | 0 stars · Python | Keep learning-first and paper-only; don't implement lessons for Jerome or enable live money. |
| [framework](https://github.com/Thavarshan/framework) | 0 stars · mixed | Upstream framework checkout/fork; don't apply personal templates or claim ownership of upstream work. |

### Archived / no routine maintenance

| Repository | Current signal | Next maintenance action |
| --- | --- | --- |
| [base](https://github.com/Thavarshan/base) | Archived | Leave archived; no routine dependency or template churn. Revive only if clear users/requested value. |
| [wyreframe](https://github.com/Thavarshan/wyreframe) | Archived | Leave archived; no routine dependency or template churn. Revive only if clear users/requested value. |
| [xoomp](https://github.com/Thavarshan/xoomp) | Archived | Leave archived; no routine dependency or template churn. Revive only if clear users/requested value. |
| [code-katas-site](https://github.com/Thavarshan/code-katas-site) | Archived | Leave archived; no routine dependency or template churn. Revive only if clear users/requested value. |
| [qevoxo](https://github.com/Thavarshan/qevoxo) | Archived | Leave archived; no routine dependency or template churn. Revive only if clear users/requested value. |
| [storable](https://github.com/Thavarshan/storable) | Archived | Leave archived; no routine dependency or template churn. Revive only if clear users/requested value. |
| [pingpong](https://github.com/Thavarshan/pingpong) | Archived | Leave archived; no routine dependency or template churn. Revive only if clear users/requested value. |
| [amongfriends](https://github.com/Thavarshan/amongfriends) | Archived | Leave archived; no routine dependency or template churn. Revive only if clear users/requested value. |
| [convertible](https://github.com/Thavarshan/convertible) | Archived | Leave archived; no routine dependency or template churn. Revive only if clear users/requested value. |
| [manuscrite](https://github.com/Thavarshan/manuscrite) | Archived | Leave archived; no routine dependency or template churn. Revive only if clear users/requested value. |
| [formlink](https://github.com/Thavarshan/formlink) | Archived | Leave archived; no routine dependency or template churn. Revive only if clear users/requested value. |


## First implementation wave

1. **Profile (immediate):** prepare a full-stack/GenAI README in `marketing/github-profile/README.md`; document account-level publication steps. Do not replace `thavarshan.com` or assert a new employer.
2. **Contributor experience (this week):** add tailored CONTRIBUTING to `filterable` and `matrix`, and a vulnerability disclosure path to `wisp` after verifying existing test commands. Keep each change in a reviewable PR.
3. **Quick maintenance fix:** repair `composer-upgrade-helper` placeholder repository URL and warn clearly against automatic dependency bumps without testing.
4. **Maintainer hygiene (next 2 weeks):** process active dependency PRs on Honeymelon; verify Fetch PHP / Matrix cancellation matrix and phpvm docs-to-code parity. Each existing issue or PR owns its implementation, not duplicate tickets.
5. **Archive / low-signal:** leave 11 archived repositories untouched; don't force modern dependencies into old school/assessment projects. Evaluate each of the 15 unlicensed repos individually with explicit licensing choices before any change.

## Revenue hypotheses, not income claims

**Fastest likely route to cash:** offer paid Laravel/Node/AI integration and open-source developer-tool consulting using actual Fetch PHP, Filterable, phpvm, Brompton and KAYA examples. This uses existing proof without building a new SaaS. Reach prospects directly and measure conversations, not GitHub stars.

| Project or group | Possible paid offer | Cheap validation experiment | Main concern |
| --- | --- | --- | --- |
| **Fetch PHP + Filterable + phpvm + Matrix** | Paid integration, migration, support retainers, GitHub Sponsors | Publish one clear consulting CTA and ask 10 targeted PHP teams whether they need support | Sponsors are voluntary; library use does not imply willingness to pay |
| **Pinetree** | Slack time-reporting setup/service for small teams | Ask 5 agencies to test CSV/XLSX workflow; try a paid onboarding pilot | Slack distribution, time-data privacy, many competitors |
| **Wisp** | Hosted team workspaces, custom domain, sharing policies/audit | Interview 5 teams; prototype one organization feature after security testing | Sensitive data, security liability, strong existing alternatives |
| **Honeymelon** | Support, signed binaries, pro batch presets or automation features | Interview desktop users and test whether any will pay before changing free core | Free converters abound; code signing and support costs |
| **Viridian** | Paid release/incident evidence reports and small-team pilot | Build one evidence-backed release report using fixture data; approach 3 DevOps leads | Currently a scaffold; relatively long path to a sellable product |
| **Dokimos** | Human-reviewed plagiarism evidence workflow for institutions | Interview educators and test an evidence-only report with consented text | AI-detection false positives; ethical and reputational risk |
| **Moxy Contacts** | Privacy-first backup assistance for individuals/SMBs | Ask users about restore pain and offline import support | Personal data protection and low consumer willingness to pay |

**Deprioritize for monetization now:** `wallstreet` (learning/paper-only), `virgosoft-exchange` (financial/regulatory risk), `LabTrack` (nostalgia showcase), archived repositories, and anything relying on unsupported AI-detection certainty. Private projects require separate owner-only evaluation before any public promotion.

## A realistic 30-day operating plan

- **Days 1–3:** publish the GitHub profile README after the owner creates the special profile repository; update bio/pins; add paid-services/contact CTA; remove outdated branding in public-facing links.
- **Days 4–10:** merge safe contributor/docs PRs when checks pass; resolve one important Fetch/Matrix compatibility issue; prepare a credible release note and one concise engineering case study.
- **Days 11–20:** interview prospects for Pinetree/Wisp/Honeymelon rather than adding speculative features; reach out to companies that use Laravel, PHP packages and developer tooling.
- **Days 21–30:** build only the smallest requested paid pilot; review recruiter responses, genuine contributors, repo issue response time, and pilot willingness to pay. Stop low-signal work.

## Limits and decisions requiring owner input

- The GitHub connector cannot create the special `Thavarshan/Thavarshan` repo, alter account bio/pins, or edit repository topics/About metadata. These are **not completed** by creating a draft in the website repository.
- The reported public CV still has a Sino Lanka role shown as current; Jerome has also discussed unemployment. Reconcile the career timeline in the authoritative profile source with the owner before changing dates publicly.
- Choosing licenses for unlicensed repositories, opening private code, introducing paid hosting, and launching production finance/security services each need a separate explicit decision.
- CI execution and branch protection are not established by top-level file presence. Follow up per active repository and record actual test results before merging code changes.
