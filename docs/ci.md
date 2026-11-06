# CI and real-container gates

## Add the check to your application

First [try one check on your built folder](../README.md#check-your-deployment-folder). When you're ready to keep it, install the pinned GitHub alpha and commit your application's `package.json` and lockfile.

```sh
npm install --save-dev --ignore-scripts https://github.com/CVamsi27/deployproof/releases/download/v0.1.0-alpha.3/developer-pain-lab-deployproof-0.1.0-alpha.3.tgz
```

Place the check immediately after the step that creates the folder you ship. This workflow assumes `npm run build` produces `out/dist/server.js`. Set `./out` to the artifact directory and `dist/server.js` to the path of the entry inside that directory.

```yaml
name: Deployment artifact
on: [push, pull_request]
permissions:
  contents: read
jobs:
  artifact:
    runs-on: ubuntu-24.04
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
        with:
          persist-credentials: false
      - uses: actions/setup-node@949feb2413d6458794dcd2491c4babbbce0c15c1 # v7.1.0
        with:
          node-version: '24.22.1'
          package-manager-cache: false
      - run: npm ci
      - run: npm run build
      - run: npm exec --no -- deployproof check ./out --entry dist/server.js --json
```

Let the check's exit status fail the step. Exit 1 reports a finding, exit 2 a tool or setup failure, and exit 3 incomplete coverage. Run `check` against the build output in this step. `demo` inspects and repairs its own synthetic folder. Structural checks need no container engine or credentials.

For a pnpm project, use its existing install and build steps. Run these from the package that owns the check. To install the dev dependency at a workspace root, add `-w` to the first command.

```sh
pnpm add -D --ignore-scripts https://github.com/CVamsi27/deployproof/releases/download/v0.1.0-alpha.3/developer-pain-lab-deployproof-0.1.0-alpha.3.tgz
pnpm exec deployproof check ./out --entry dist/server.js --json
```

The dependency remains a pinned GitHub tarball until npm registry publication is available. Review new alpha versions before changing the pin. Source installation and contributor checks are not required in your application job.

## This repository's gates

Hosted CI explicitly provisions pnpm 11.23.0 for `test:pnpm` and `pack:check:pnpm`. Both prepare only the example's private offline workspace with ignored lifecycle scripts. The first checks actual generated deploy artifacts and the cleanup-failure control; the second runs the shipped example from an independent installed consumer. No application entry or container smoke runs in these hosted steps. The manual OrbStack workflow additionally requests `test:pnpm:smoke` with the local `node:24-bookworm-slim` image prepared beforehand.

Hosted CI runs source/package checks on Ubuntu 24.04 with Node 24.22.1. The packed consumer reinstalls from its own lockfile and runs the same `npm exec --no` check against a missing asset, its repair, and a dynamic import. Local container evidence uses OrbStack on macOS arm64.

The manual OrbStack workflow requires a dedicated runner labelled `self-hosted`, `macOS`, `ARM64`, `orbstack`, a working compatible client/endpoint, and the explicit base/fixture images in the README. It accepts only owner-triggered workflow dispatch and never runs automatically for public pull requests. No runner is provisioned or registered by this repository. Without one, the remote manual gate is unexecuted; local real-container tests are separate evidence.

Configure only the supervisor's `CONTAINER_CLI`/`CONTAINER_HOST` variables (or `RETRYGLASS_CONTAINER_CLI`/`RETRYGLASS_CONTAINER_HOST` for Retryglass) in that dedicated runner. Do not give application containers a host socket, source mount or inherited environment. Keep logs synthetic and inspect exact run labels after an interrupted supervisor. No global cleanup.

Actions are pinned to inspected full commit SHAs and use a read-only repository token with persisted checkout credentials disabled. The workflow definitions follow [GitHub syntax](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax) and [secure-use guidance](https://docs.github.com/en/actions/reference/security/secure-use). Registry publication and deployment are not part of CI.
