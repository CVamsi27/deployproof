# Changelog

## Unreleased

Document a one-off check from the public alpha and a lockfile-based CI recipe. Verify the CI command against a missing asset, its repair and incomplete analysis from a fresh packed consumer.

## 0.1.0-alpha.3 — 2026-11-06

Preserve observed findings when the diagnostic report reaches its 1,000-detail limit. The JSON report exposes `diagnosticsTruncated` and the human report notes truncation.

## 0.1.0-alpha.2 — 2026-11-05

Add a real pnpm 11.23.0 workspace example: inspect a contained deploy, an ordinary copy with external workspace links, and deploys with omitted module/asset files. Use offline, script-free preparation with private config/store/temp files. Preserve actual structural reports and optional separate constrained smoke evidence. Missing prerequisites, wrong controls or failed cleanup cannot pass.

Test the generated artifacts, cleanup failure, missing/wrong pnpm, invalid arguments and missing smoke images. Add the real structural and packed-example gates to CI. GitHub release packages remain the selected distribution path; npm publishing is deferred. Scanner behavior and public API are unchanged; adoption remains unvalidated.

## 0.1.0-alpha.1 — 2026-11-05

Add `deployproof demo [--json]`: inspect a private synthetic missing asset, add the file, verify the repair and remove the fixture. The application is never executed. Mismatched controls, failed setup or failed cleanup cannot pass.

Verify the installed demo in a fresh packed consumer. Put pinned GitHub installation and actual output first in the README; add a CI recipe and opt-in pilot kit. Scanner and ordinary check exit semantics are unchanged. Independent adoption remains unvalidated; npm registry publication is not included.

## 0.1.0-alpha.0 — 2026-11-05

First public alpha source release.

Node artifact containment and dependency tracing, literal assets, separate constrained smoke execution and six broken/fixed controls with independent baselines.

Verification and platform limits are documented. No production-safety, uniqueness, time-saving or retained-adoption claim is made. GitHub distribution is separate from npm registry publication.
