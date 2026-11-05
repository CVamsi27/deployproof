# Deployproof

Catch missing files, broken workspace links and dependencies outside the exact Node folder being deployed.

[![CI](https://github.com/CVamsi27/deployproof/actions/workflows/ci.yml/badge.svg)](https://github.com/CVamsi27/deployproof/actions/workflows/ci.yml)

Public alpha for synthetic/local testing. Use Node 24.22.1 (`.node-version`). Installation from source and local tarballs is supported; the scoped package names are not published to npm. [GitHub releases](https://github.com/CVamsi27/deployproof/releases) provide verified alpha tarballs when a release is available.

## Clone and run

```sh
git clone https://github.com/CVamsi27/deployproof.git
cd deployproof
npm ci --ignore-scripts
npm run check
node examples/fixtures.js /tmp/deployproof-first-example
node src/cli.js check /tmp/deployproof-first-example/workspace-link-fixed --entry server.js --json
```

The example target must be new. Container-backed commands below require OrbStack and explicit local image preparation. They use the Docker-compatible CLI connected to OrbStack; Docker Desktop is not required. Missing engine, browser, image, collector or cleanup evidence remains a failure.

To use a tarball in another project, download this project's `.tgz` from its release and run `npm install --save-dev /absolute/path/to/the-downloaded.tgz`. The installed tarball exposes the `deployproof` binary and the same public API.

See [contributing](CONTRIBUTING.md), [security reporting](SECURITY.md), [changes](CHANGELOG.md) and [verification](docs/verification.md). Platform and adoption claims remain limited to recorded observations. These are ESM packages; the verified type-consumer profile is ESM/NodeNext. CommonJS compatibility is not promised; use dynamic import where needed.

Check whether a built Node application folder still depends on its original repository. Early prototype: synthetic failure detection is implemented; developer adoption and setup-time advantage remain unvalidated.

Deployproof reads the artifact as data. It does not import or run the inspected application during structural checks. It combines [Node File Trace](https://github.com/vercel/nft) with contained filesystem resolution, symlink checks, and a small supplemental literal-asset analysis.

## Try the synthetic broken and fixed examples

Requires Node 22+ and npm. From a checkout:

```sh
npm ci --ignore-scripts
node examples/fixtures.js /tmp/deployproof-fixtures
node src/cli.js check /tmp/deployproof-fixtures/workspace-link-broken --entry server.js
node src/cli.js check /tmp/deployproof-fixtures/workspace-link-fixed --entry server.js --json
npm run check
npm run pack:check
npm run measure
```

The generator refuses an existing target. Its six folders demonstrate three failure patterns, each with a healthy equivalent: a workspace symlink pointing back to omitted source, a package whose declared built module is absent, and a literal runtime asset omitted from the artifact. They are synthetic reproductions of failure classes; they are not copies of upstream incident applications.

For a locally packed install, run `npm pack`, install the resulting `.tgz` into another project, then use its `deployproof` binary. There is no hosted account requirement. `npm run pack:check` in this project verifies a clean installed consumer; no lab checkout is required.

## Check your deployment folder

Build or deploy your normal application first, then select the exact folder that you intend to copy:

```sh
deployproof check ./out --entry dist/server.js --json
```

For pnpm, `./out` can be the result of your existing `pnpm deploy` command. Deployproof neither builds the app nor installs its dependencies. The root and entry are explicit, so resolution cannot accidentally use a parent `node_modules`. Every external symlink is a finding even if its target currently exists on the developer's machine. The target is not read.

A missing dependency diagnostic names the importing module and specifier. Missing literal assets carry a path chain back to the entry. Source contents, application output, host environment values, and external target paths are excluded from reports. Keep the artifact stable during inspection: this is a diagnostic tool for trusted local build output, not an adversarial filesystem sandbox.

## Optional container smoke

The explicit smoke command is a separate observation. It runs only in a disposable container, with no network, source/socket mounts, host environment forwarding, or published ports. A never-started staging container receives the artifact; its snapshot becomes a separate read-only worker. The worker is non-root with dropped capabilities and CPU/memory/PID limits. Only a local base image is used, resolved to an immutable ID; images are never pulled automatically. Both containers and the snapshot image are removed after verifying their exact run labels.

```sh
# Prepare the selected image yourself before running the gate.
docker pull node:22-alpine
deployproof check ./out --entry dist/server.js --smoke-image node:22-alpine -- node dist/server.js --check
npm run test:integration
```

OrbStack is the verified local engine on macOS arm64. Set `CONTAINER_CLI=/absolute/path/to/docker` to a Docker-compatible client and `CONTAINER_HOST="unix://${HOME}/.orbstack/run/docker.sock"` before running Deployproof. The endpoint affects only the supervisor's client subprocess and overrides its `DOCKER_CONTEXT`; application containers receive neither setting. For manual preparation with those exports, use `env -u DOCKER_CONTEXT DOCKER_HOST="$CONTAINER_HOST" "$CONTAINER_CLI" pull node:22-alpine`. Without overrides, normal `docker` client/context selection remains available.

Supply a command that terminates: for a long-running server, implement an application-owned startup check. A zero exit with a consistent stopped/non-OOM state proves only that command exited zero in the copied artifact, not that every route or integration works. Container stdout/stderr is not collected. Timeout, unavailable engine/image, invalid observation, or failed ownership-verified cleanup cannot pass. No global cleanup is performed. Default command timeout is 15 seconds; API bounds allow 100–120000 ms. Reports retain both `imageId` (base) and `artifactImageId` (snapshot).

## API and result

```js
import { checkArtifact, smokeArtifact, exitCode } from '@developer-pain-lab/deployproof';
const report = await checkArtifact('./out', { entry: 'dist/server.js' });
// Optional, explicitly requested:
// report.smoke = await smokeArtifact('./out', { image: 'node:22-alpine', command: ['node', 'dist/server.js', '--check'] });
process.exitCode = exitCode(report);
```

Result fields remain independent: `execution`, `structural`, `coverage`, `smoke.status`, and (when smoke ran) `smoke.cleanup`. `passed` is not a deployment-readiness claim. Exit codes:

| Exit | Meaning |
| --- | --- |
| 0 | Supported structural checks passed; any requested smoke command also passed and cleaned up |
| 1 | Structural finding or nonzero smoke command |
| 2 | Invalid input, tool failure, blocked smoke prerequisite, or failed cleanup |
| 3 | Incomplete supported-static analysis without a stronger failure |

Defaults cap the scan at 10000 filesystem entries, individual reads at 2 MiB, total source reads at 32 MiB, and filesystem operations at 100000. Exceeding a ceiling is incomplete. Dynamic import/require and filesystem paths outside the supported literal forms are partial. The literal supplement understands imported `fs` read functions, `fs`/`fs.promises` namespace reads, direct CommonJS `fs` destructuring, relative string paths against artifact cwd, and `new URL('./file', import.meta.url)`. It does not prove all filesystem behavior, native ABI compatibility, network integrations, or every Node export condition. Conditional/optional imports may be conservatively flagged if their files are absent. Node File Trace warnings remain partial, including unresolved traces. Only built `.js`, `.mjs`, or `.cjs` entries are accepted.

## Comparison and promotion gate

`npm run measure` generates the six fixtures in a temporary folder and emits JSON with observed diagnostics and single-run wall times for Deployproof, direct NFT, and a separately handwritten restricted container baseline. NFT is a trace, not itself a portability verdict. The baseline can read only the explicitly generated synthetic fixtures. Unavailable engine/image is recorded as **blocked**, not a pass or a timing estimate; baseline disagreement with a fixture's expected result fails the gate. All six static, smoke and handwritten-baseline outcomes matched their expectations in the recorded OrbStack run. Single-run timings do not establish productivity or setup-time savings.

Related tools: [Node File Trace](https://github.com/vercel/nft) supplies the tracing core; [package-consumer-check](https://github.com/cagrikacmaz/package-consumer-check) tests npm packages installed into fresh consumers. Deployproof's candidate distinction is explaining the portability of an already-produced application directory. [pnpm #13754](https://github.com/pnpm/pnpm/issues/13754) and [Next.js #82626](https://github.com/vercel/next.js/issues/82626) document related failure classes, including fixed regressions; no current upstream defect is alleged.

Continue only if independent users obtain earlier detection or clearer diagnosis with less setup than their existing tracing/container checks. Until five outside developers trial it, three integrate it, and two retain it for a later change, adoption remains **unvalidated**. Do not infer demand from synthetic successes.

## Standalone project

This folder owns its source, tests, examples, npm lockfile and development scripts. Run every command here. [Verification](docs/verification.md) records independent-source and OrbStack gates; [validation plan](docs/validation-plan.md) records the remaining adoption targets. No runtime or test import depends on the lab or another project.
