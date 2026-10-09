# Free Growth Engine report email delivery

## Decision

Jerome requested free inbox delivery and selected GitHub email notifications over direct Gmail SMTP. Reuse GitHub's existing bot/token and one standing report issue. No email password, paid provider, new dependency or private email address belongs in the public repository. Personal email-notification settings remain account-controlled and cannot be inspected through the connector.

## Implementation

- Publish the same trusted public Markdown report artifact from a separate main-only notification job with minimal issue-writing permissions.
- Mention the verified owner in a fixed, marker-validated standing issue. Link the exact Actions run/revision and explain that publication is not proof of inbox receipt.
- Deliver weekly and opted-in manual reports. Post an initial activation report, suppress later code-push notifications, and deduplicate by original run ID on retries.
- Validate execution context, destination, summary shape/size and API responses; bound history scanning, timeouts and response size; never print raw API errors/credentials.
- Keep report/baseline production independent from notification failures. Closing the feed disables delivery; reverting this focused PR removes the notification job.

## Validation

Regression tests cover the fixed recipient/thread, retry deduplication including pagination, forged markers, bootstrap/push suppression, closed feeds, invalid/untrusted inputs, oversized/redirect/error responses, ambiguous POST failure and bounded history. Run local type/lint/tests/static build, required PR CI, then verify the first actual bot-authored report comment and notification job. Inbox arrival still requires the owner's participating-email preferences; no mailbox is read as part of this feature.

## Cost

At most twelve GitHub API requests per publication, usually three. Existing public Actions and GitHub issue/email notifications only, with no paid service or new credential.
