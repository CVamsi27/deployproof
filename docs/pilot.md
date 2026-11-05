# First integration pilot

Goal: learn whether Deployproof gives a developer an earlier or clearer answer than their existing checks with less setup. Five independent trials, three completed integrations and two uses on a later relevant change are continuation targets. Current recorded participation is zero. Stars, downloads and the bundled demo are not integration or retention evidence.

## Run one trial

1. Give the participant the README and a pinned release. Let them start without a live walkthrough. Record assistance separately.
2. Ask them to check one local, non-production deployment folder they understand. Record OS, Node/package version, entry, setup minutes and run minutes. Do not ask them to upload the artifact.
3. Record whether the result is actionable, incomplete, incorrect or blocked. Ask what they changed, if anything. Compare the outcome and effort with their existing check; do not infer time saved from scanner duration.
4. Record whether they added the check to their normal workflow and why. A successful demo alone is not a completed integration.
5. At their next relevant deployment change, ask whether they reran, retained or removed it. No relevant change means unobserved. Record the reason without pressure to give positive feedback.

Use the opt-in [public trial form](https://github.com/CVamsi27/deployproof/issues/new?template=integration-trial.yml) or keep local notes using [the blank CSV](trial-template.csv). Copy private notes into ignored `pilot-results/`; do not commit participant identities, repository paths, credentials, customer data or proprietary source. Public issues should contain only sanitized summaries and synthetic reproductions. Do not collect telemetry automatically.

## Decision

Fix repeated setup obstacles before adding framework adapters. Investigate partial analysis and unnecessary findings as failures of the user experience. If an existing command answers the question with equal or less work, prefer a contribution or stop this experiment. Promote other projects independently; this pilot does not validate Retryglass, Rolloutproof or Revokeproof.

[Launch messages](launch-drafts.md) are drafts only. No participant has been contacted or counted. Publishing a repository does not authorize sending messages to others.
