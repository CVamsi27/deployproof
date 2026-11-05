# Deployproof verification

## pnpm workspace alpha.2 — 5 November 2026

The new shipped example runs actual pnpm 11.23.0 install/deploy commands on a synthetic local workspace. A contained deploy exits 0; an ordinary directory copy and deploys with omitted library asset/module files each exit 1 with their expected findings. Healthy coverage is complete for supported static patterns. No application entry executes on the host. Framework commands are offline with lifecycle scripts disabled and private config, store and temporary paths.

| Gate | Observed result |
| --- | --- |
| `npm run check` | 30 behavior tests, zero failures/skips; 24 JavaScript files syntax checked |
| `test:pnpm` | Two tests passed: four real generated artifact controls and a cleanup-failure control |
| `test:pnpm:smoke` | Four actual OrbStack cells matched healthy/broken outcomes; a missing-image control remained blocked/nonzero |
| Original real smoke integration | All six broken/fixed cases passed on OrbStack |
| `pack:check:pnpm` | Fresh independent consumer passed API/CLI/demo plus the shipped real pnpm example |
| Fresh unrelated source copy | Frozen install, all 30 tests and an independent packed pnpm consumer passed without sibling code/dependencies |
| Negative prerequisite/argument controls | Missing/wrong pnpm, invalid/empty smoke flags and symlink invocation remained nonzero as required |

The first cleanup test exposed pnpm's Node compile cache outside the private root. Child temporary paths now stay inside the owned cell. A packed-consumer check also exposed a macOS symlink path that skipped direct execution; a real symlink regression and canonical entry comparison fixed it. Neither issue was accepted as a passing integration.

Hosted CI now runs the real structural and installed pnpm example with an explicitly provisioned pinned tool. Exact-head hosted CI and anonymous release asset verification are linked from the [alpha.2 release notes](https://github.com/CVamsi27/deployproof/releases/tag/v0.1.0-alpha.2). The local real profile is macOS arm64/Node 24.22.1/OrbStack; hosted structural checks use Ubuntu 24.04/Node 24.22.1. The remote manual OrbStack workflow remains unexecuted. Other pnpm versions and application/framework integrations remain unverified. GitHub packages are the owner's selected distribution path; npm publishing is deferred. Independent trials remain unvalidated.

## First-use alpha.1 — 5 November 2026

The new `demo` command runs the actual structural checker on a private synthetic artifact before and after adding its missing asset. Its tests verify the path chain, both exits, complete supported-static coverage, no smoke execution and removal of the private directory. The real CLI also succeeds with child-process APIs disabled. An injected cleanup failure retains the observations and returns incomplete/nonzero. Strict invalid arguments and help create no fixture.

| Gate | Observed result |
| --- | --- |
| `npm run check` | 26 behavior tests, zero failures or skips; 19 JavaScript files syntax checked |
| `npm run pack:check` | Fresh independent install, API import, installed help and broken/fixed demo passed |
| `npm run test:integration` | All six real broken/fixed smoke cases passed on macOS arm64 OrbStack |
| Fresh unrelated source copy | Frozen clean install, all 26 tests and packed consumer passed without sibling source/dependencies |
| `npm exec --package=<local-tarball> -- deployproof demo` | Passed from an unrelated empty folder with isolated npm cache/config |
| README transcript | Exact match against actual installed demo output |
| Copyable application CI recipe | Actionlint passed; no application integration or deployment claimed |
| `npm run measure` | All six structural and handwritten OrbStack baseline outcomes matched; all baseline cleanup completed; raw NFT warnings recorded separately |
| Public issue form | YAML parsed; no participant or submission invented |

The pinned public release URL is verified again after publication; that asset's download/checksum/install evidence belongs to the [alpha.1 release notes](https://github.com/CVamsi27/deployproof/releases/tag/v0.1.0-alpha.1). Hosted CI for the release commit is a separate gate linked there. The remote manual OrbStack workflow remains unexecuted. npm registry publication remains blocked by missing local authentication and unverified scope access; see [distribution](distribution.md). No outreach was sent. Independent participation remains zero.

## Independent folder split — 5 November 2026

The implementation moved from the lab's workspace into its own sibling project folder. It has its own package manifest, frozen npm lockfile, source, tests, examples, license, operating rules and development scripts. Package identity and public APIs are unchanged. No project imports another project or the lab at runtime.

Verification passed from an unrelated temporary source copy with no lab or sibling source/dependency access. The copy installed only this project's frozen lockfile and ran its own commands:

| Gate | Observed result |
| --- | --- |
| Frozen clean source install | Passed, no workspace links |
| `npm run check` | 22 behavior tests passed, zero failures or skips; JavaScript syntax passed |
| `npm run pack:check` | Passed tarball allowlist, fresh independent npm consumer and public imports plus installed CLI |
| `npm run test:integration` | Passed on macOS arm64 using OrbStack |
| Optional lab aggregate check and comparison | Passed from the new sibling roots |

Six real container smoke cases matched their broken/fixed expectations and cleaned up. Local per-step logs and `summary.json` are retained in this project's ignored `artifacts/separation/`; temporary source copies and packed-consumer projects were removed. No runtime implementation or public API was changed during separation. No failed prerequisite was converted to a skip or pass.

```sh
npm ci --ignore-scripts
npm run check
npm run pack:check
npm run test:integration
npm run measure
```

Node 24.22.1 is selected in `.node-version`; the manifest retains its existing Node >=22 range. A version range is not evidence that every runtime/platform was tested. Use OrbStack and the README's explicit compatible-client configuration for container gates. Revokeproof uses only its synthetic loopback server and an explicitly installed Playwright browser.

Historical combined evidence remains in the optional research folder at [developer-pain-lab](https://github.com/CVamsi27/developer-pain-lab/blob/HEAD/docs/verification.md). This project does not need that folder to install or run. Adoption remains unvalidated; no publication or outreach occurred.

## Public alpha release checks

Public GitHub distribution is explicitly authorized after source, package and real-runtime gates pass. Pinned hosted CI is a separate observation from the local macOS/OrbStack run. A manual self-hosted OrbStack workflow requires a dedicated runner and remains unexecuted remotely until a maintainer configures one. No runner or production service is provisioned by this source release.

Frozen source installs, project checks and tarball consumers are rerun for release. Final results and hosted CI links are recorded with the public release. Independent adoption and retained use remain unvalidated; GitHub availability alone establishes neither.

Release source/package checks passed with 22 behavior tests and zero skipped tests. Fresh packed consumers and relevant real integration passed. Publint 0.3.25 passed; workflow syntax passed Actionlint 1.7.12. Hosted CI is a separate gate visible from the repository workflow page.
