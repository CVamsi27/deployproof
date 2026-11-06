# First integration pilot

The pilot tests whether Deployproof catches something a developer's existing check missed or makes an equivalent check easier to set up. The [trial record](https://github.com/CVamsi27/developer-pain-lab/blob/HEAD/docs/adoption-trials.md) has the current enrollment window and counts.

## Run one trial

Choose a repository with a forthcoming deployment change. Use the [one-off README command](../README.md#check-your-deployment-folder) to run the pinned alpha against its output before adding a dev dependency. Compare with the existing check on the same artifact. Record cold downloads, hands-on setup and machine runtime separately. Record later use at 14, 30 and 90 days, with unobserved changes tracked separately.

1. Give the participant the README and a pinned release. Let them start without a live walkthrough. Record assistance separately.
2. Ask them to check one local, non-production deployment folder they understand. Record OS, Node/package version, entry, setup minutes and run minutes. Do not ask them to upload the artifact.
3. Record whether the result is actionable, incomplete, incorrect or blocked. Ask what they changed, if anything. Compare the outcome and effort with their existing check; do not infer time saved from scanner duration.
4. If they want to keep it, give them the [CI recipe](ci.md). Record whether they added the check to their normal workflow and why. Count a completed integration when the check runs against their own build output in that workflow.
5. At their next relevant deployment change, ask whether they reran, retained or removed it. No relevant change means unobserved. Record the reason without pressure to give positive feedback.

Use the opt-in [public trial form](https://github.com/CVamsi27/deployproof/issues/new?template=integration-trial.yml) or keep local notes using [the blank CSV](trial-template.csv). Copy private notes into ignored `pilot-results/`; do not commit participant identities, repository paths, credentials, customer data or proprietary source. Public issues should contain only sanitized summaries and synthetic reproductions. Do not collect telemetry automatically.

## Decision

Fix repeated setup obstacles before adding framework adapters. Investigate partial analysis and unnecessary findings as failures of the user experience. If an existing command answers the question with equal or less work, prefer a contribution or stop this experiment. Promote other projects independently; this pilot does not validate Retryglass, Rolloutproof or Revokeproof.

[Launch messages](launch-drafts.md) are drafts only. No participant has been contacted or counted. Publishing a repository does not authorize sending messages to others.
