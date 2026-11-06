# Deployproof

**The build passed. Does the deployment folder contain what the app needs?**

Deployproof checks an already-built Node folder for missing files, broken workspace links and dependencies that escape back into the source repository. It names the missing path and its import chain without running the application.

[![CI](https://github.com/CVamsi27/deployproof/actions/workflows/ci.yml/badge.svg)](https://github.com/CVamsi27/deployproof/actions/workflows/ci.yml)

## Try it without cloning

Requires Node 22+ and npm. This command installs the pinned GitHub alpha into npm's cache and runs a synthetic example. No account or container engine is needed.

```sh
npm exec --yes --ignore-scripts --package=https://github.com/CVamsi27/deployproof/releases/download/v0.1.0-alpha.3/developer-pain-lab-deployproof-0.1.0-alpha.3.tgz -- deployproof demo
```

Actual output from the bundled example:

```text
Synthetic demo: an entry reads message.txt, but the deployment folder omits it.
Broken artifact: failed (check exit 1)
missing_asset: message.txt (from server.js)
  Literal runtime asset is absent from the deployment folder.
  chain: server.js -> message.txt
Fixed artifact: passed (check exit 0)
Cleanup: completed
Demo: passed
Structural checks only; the synthetic application was not executed.
```

The command creates a private temporary folder, checks the broken artifact, adds the missing file, checks again and removes its own folder. `demo --json` exposes both real reports. Demo exit 0 means those controls and cleanup succeeded; an incomplete demo exits 2. It is an example, not a scan of your project.

## Check your deployment folder

Build the application with your usual tools. From the application directory, run one check using npm's cache. This leaves your manifest and lockfile alone.

```sh
npm exec --yes --ignore-scripts --package=https://github.com/CVamsi27/deployproof/releases/download/v0.1.0-alpha.3/developer-pain-lab-deployproof-0.1.0-alpha.3.tgz -- deployproof check ./out --entry dist/server.js
```

Select the **exact folder you intend to ship**. For pnpm this can be your existing `pnpm deploy` output. Deployproof does not build or install the application. Resolution is confined to that folder: parent `node_modules` cannot rescue an omitted dependency, and links outside the folder are findings even if they work locally. Use `--json` for a structured report. Keep build output stable while checking it.

If the result helps, [keep the check in CI](docs/ci.md). Add the pinned dev dependency to the project that runs the build, commit its lockfile, and check the same output after each build. A missing file, incomplete analysis or tool failure remains nonzero.

Using pnpm workspaces? The [real pnpm deployment example](examples/pnpm/README.md) runs pnpm 11.23.0 against four synthetic controls. It demonstrates an ordinary copy with escaping workspace links and deploy outputs with missing module/asset files, alongside a contained healthy deploy. Optional smoke uses OrbStack.

## What the alpha covers

- Built `.js`, `.mjs` and `.cjs` entries, traced with [Node File Trace](https://github.com/vercel/nft).
- Missing dependencies, external/broken symlinks and supported literal filesystem reads.
- An optional, separate smoke command in a constrained disposable container. [OrbStack instructions and full reference](docs/reference.md).

Dynamic imports and unsupported filesystem expressions produce partial coverage. A structural pass covers supported static patterns; it does not prove every runtime path, native ABI or external integration. This is a diagnostic tool for trusted local build output, not an adversarial filesystem sandbox.

| Check exit | Meaning |
| --- | --- |
| 0 | Supported structural checks passed; any requested smoke also passed and cleaned up |
| 1 | Structural finding or failing smoke command |
| 2 | Invalid input, tool/prerequisite failure or failed cleanup |
| 3 | Incomplete analysis without a stronger failure |

The scoped package is **not published to npm**. GitHub [alpha releases](https://github.com/CVamsi27/deployproof/releases) contain tarballs and checksums. The JavaScript API is ESM; TypeScript declarations and CommonJS support are not supplied. Recorded checks use Node 24.22.1 on Ubuntu 24.04 and macOS arm64; the real smoke profile uses OrbStack. See [verification](docs/verification.md) for the precise limits.

## Help decide whether this is useful

This is a public alpha. Independent integrations and retained use are still unvalidated. The synthetic examples demonstrate detection, not time saved.

Try it on one local deployment folder and [share a trial report](https://github.com/CVamsi27/deployproof/issues/new?template=integration-trial.yml). A confusing diagnostic, unnecessary finding or reason for removal is useful feedback. The [pilot guide](docs/pilot.md) explains what to measure. If it is useful, a GitHub star helps people find it; a report from an actual integration helps us improve it.

For the API, constraints, fixture comparisons and optional smoke execution, read the [reference](docs/reference.md). For source setup and checks, read [contributing](CONTRIBUTING.md). [Security reporting](SECURITY.md) · [Changelog](CHANGELOG.md) · [Validation targets](docs/validation-plan.md).
