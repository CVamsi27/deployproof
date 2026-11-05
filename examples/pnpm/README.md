# Real pnpm deployment example

This example uses pnpm 11.23.0 itself to prepare a synthetic workspace. It never imports an existing application or runs the entry on the host. The verified profile is Node 24.22.1; different pnpm versions are blocked rather than counted as this profile.

From a Deployproof checkout after `npm ci --ignore-scripts`:

```sh
npm exec --yes --package=pnpm@11.23.0 -- node examples/pnpm/verify.js
```

From a project with the GitHub Deployproof package installed:

```sh
npm exec --yes --package=pnpm@11.23.0 -- node node_modules/@developer-pain-lab/deployproof/examples/pnpm/verify.js
```

These commands explicitly obtain the pinned pnpm tool through npm. If already installed, use `node examples/pnpm/verify.js` with pnpm on PATH, or set `PNPM_CLI=/absolute/path/to/pnpm`. The example itself never downloads a package manager. Its workspace has only a local dependency; install/deploy commands use `--offline` and `--ignore-scripts`, with a private store, config and temporary directory.

## Observed controls

The workspace contains a prebuilt `server.js` and one library whose exported module reads `templates/message.txt`. The library's package `files` list determines whether its module and asset are deployed. pnpm creates the dependency links and deploy output; this is not a hand-written mock node_modules layout.

| Case | Actual preparation | Expected structural check |
| --- | --- | --- |
| `deploy-contained` | pnpm deploy includes module and template | Exit 0, complete supported-static coverage |
| `ordinary-copy` | Copy the installed app directory with its workspace links intact | Exit 1, `external_symlink` |
| `deploy-missing-asset` | pnpm deploy with library `files: ["dist"]` | Exit 1, `missing_asset` with entry-to-asset chain |
| `deploy-missing-module` | pnpm deploy with library `files: ["templates"]` | Exit 1, `missing_dependency` naming the library |

The contained deploy is the healthy control for the three mistakes. JSON retains each actual scanner report and expected/observed check exits. The **example command exits 0 only when all controls match and its private workspace cleanup completes**. It does not scan your application. Missing/wrong pnpm, failed preparation or cleanup exits 2; incomplete analysis without a stronger problem exits 3. An unexpected control result exits 1.

## Optional smoke through OrbStack

Prepare the image explicitly and select the supervisor client:

```sh
orbctl start docker
export CONTAINER_CLI=/absolute/path/to/docker
export CONTAINER_HOST="unix://${HOME}/.orbstack/run/docker.sock"
env -u DOCKER_CONTEXT DOCKER_HOST="$CONTAINER_HOST" "$CONTAINER_CLI" pull node:24-bookworm-slim
npm exec --yes --package=pnpm@11.23.0 -- node examples/pnpm/verify.js --smoke-image node:24-bookworm-slim
```

Each smoke uses the existing constrained disposable cell: no network, source/socket mounts or host environment forwarding. The entry runs only there. The healthy command must exit zero and each broken command must fail. An unavailable image or failed smoke cleanup prevents passing. Top-level `cleanup` describes the private workspace; each `report.smoke.cleanup` describes its separate container resources.

## Your application

Keep your normal build/deploy command, then check the exact output:

```sh
pnpm --filter your-app deploy --prod ./out
pnpm exec deployproof check ./out --entry dist/server.js --json
```

Adapt the filter and entry to your build. This example does not validate every pnpm release, peer-dependency topology, native module, framework or runtime path. Dynamic expressions remain partial. Current [pnpm deploy guidance](https://pnpm.io/cli/deploy) explains output and file selection; follow guidance for your version. See [the full reference](../../docs/reference.md) and [CI recipe](../../docs/ci.md).
