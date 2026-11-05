# Contributing

Read the scope and compatibility notes in [README](README.md). Fork the repository, clone your fork and use a branch such as `fix/short-description`. Use Node 24.22.1 and the checked-in lockfile.

```sh
npm ci --ignore-scripts
npm run check
npm run pack:check
npm run test:integration
```

The structural demo needs no container engine: run `node src/cli.js demo` or `node src/cli.js demo --json`. For all six broken/fixed fixtures, run `node examples/fixtures.js /tmp/deployproof-fixtures` with a new target, then `node src/cli.js check /tmp/deployproof-fixtures/workspace-link-broken --entry server.js`. Exit 1 is the expected finding; the matching `workspace-link-fixed` folder exits 0. `npm run measure` compares the fixtures against tracing and a handwritten container baseline.

Prepare OrbStack images explicitly as documented in the [reference](docs/reference.md). Record exactly which checks passed, failed or were blocked. Missing prerequisites and incomplete evidence must remain nonzero. `pack:check` installs the tarball independently and runs the installed demo; it borrows no sibling projects or source imports.

For a bug, provide a minimal synthetic fixture, exact command, versions, expected behavior and observed result. Add a regression that fails before a behavior fix and passes after it. Keep application execution within the documented boundary. Do not include production data, credentials, raw environment dumps or application boot files.

A pull request should explain the resulting behavior, why it is needed, validation and compatibility limits. Preserve cleanup ownership and evidence distinctions. No automatic external probing, production connectors or global cleanup.

The [real pnpm example](examples/pnpm/README.md) has separate gates with an explicitly provisioned pnpm 11.23.0 executable:

```sh
npm exec --yes --package=pnpm@11.23.0 -- npm run test:pnpm
npm exec --yes --package=pnpm@11.23.0 -- npm run pack:check:pnpm
# Requires the selected OrbStack endpoint and local node:24-bookworm-slim image:
npm exec --yes --package=pnpm@11.23.0 -- npm run test:pnpm:smoke
```

`test:pnpm` covers generated artifacts and a cleanup-failure control. `test:pnpm:smoke` covers all four real cells and a missing-image control. Standard `npm run check` needs no pnpm executable; its negative prerequisite/argument tests do not run an application.

Use [issues](https://github.com/CVamsi27/deployproof/issues) for non-sensitive reports and [private security reporting](SECURITY.md) for sensitive findings. Actual integration and retained-use evidence is useful; stars and synthetic examples do not establish adoption.
