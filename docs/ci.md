# CI and real-container gates

## Add the check to your application

Install the pinned GitHub alpha with the README command, then commit your application's `package.json` and lockfile. Use the locally installed binary after the build that produces your deployment folder. This example assumes `npm run build` creates `out/dist/server.js`; adapt those two paths to your existing build.

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
      - run: npx --no-install deployproof check ./out --entry dist/server.js --json
```

Do not add `continue-on-error` or `|| true` to the check: findings, partial coverage and tool failures have distinct nonzero exits. Do not substitute `demo` for the application check. The demo intentionally repairs its own synthetic example and can pass without inspecting your build. Structural checks need no container engine or credentials. For a pnpm application, keep its existing install/build commands and invoke the installed binary with `pnpm exec deployproof`.

The dependency remains a pinned GitHub tarball until npm registry publication is available. Review new alpha versions before changing the pin. Source installation and contributor checks are not required in your application job.

## This repository's gates

Hosted CI runs source/package checks on Ubuntu 24.04 with Node 24.22.1. A green unit/package job does not establish container-profile compatibility. Local container evidence uses OrbStack on macOS arm64.

The manual OrbStack workflow requires a dedicated runner labelled `self-hosted`, `macOS`, `ARM64`, `orbstack`, a working compatible client/endpoint, and the explicit base/fixture images in the README. It accepts only owner-triggered workflow dispatch and never runs automatically for public pull requests. No runner is provisioned or registered by this repository. Without one, the remote manual gate is unexecuted; local real-container tests are separate evidence.

Configure only the supervisor's `CONTAINER_CLI`/`CONTAINER_HOST` variables (or `RETRYGLASS_CONTAINER_CLI`/`RETRYGLASS_CONTAINER_HOST` for Retryglass) in that dedicated runner. Do not give application containers a host socket, source mount or inherited environment. Keep logs synthetic and inspect exact run labels after an interrupted supervisor. No global cleanup.

Actions are pinned to inspected full commit SHAs and use a read-only repository token with persisted checkout credentials disabled. The workflow definitions follow [GitHub syntax](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax) and [secure-use guidance](https://docs.github.com/en/actions/reference/security/secure-use). Registry publication and deployment are not part of CI.
