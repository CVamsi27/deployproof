# A successful Node build can still omit a runtime file

This walkthrough uses Deployproof alpha.3 and synthetic Node deployment folders.

A deployment folder can contain a valid JavaScript entry while omitting a file that entry reads. Consider this built module:

```js
import { readFileSync } from 'node:fs';
readFileSync(new URL('./message.txt', import.meta.url));
```

Copy `server.js` into the deployment folder and leave `message.txt` behind. The JavaScript file exists and parses, but running that filesystem read needs the omitted asset. Building the module and checking the final folder answer different questions.

Deployproof checks the exact folder intended for deployment. Its structural check reads files as data, without importing the application. In the bundled `deployproof demo`, the first observation is:

```text
Broken artifact: failed (check exit 1)
missing_asset: message.txt (from server.js)
  Literal runtime asset is absent from the deployment folder.
  chain: server.js -> message.txt
```

The demo then adds the synthetic file and checks again. The repaired artifact exits 0. Both observations remain available with `demo --json`, and the command removes only its own temporary folder. Failed cleanup or unexpected controls make the demo incomplete and nonzero. The [README](../README.md) contains the pinned one-command install/run path.

The [pnpm workspace example](../examples/pnpm/README.md) reproduces the same failure with a real `pnpm deploy` command. Its synthetic library reads `templates/message.txt`. With `files: ["dist"]`, pnpm ships the library's JavaScript and omits the template. Deployproof exits 1 and identifies the missing file. With both paths included, the same check exits 0.

## How it checks the folder

1. Start from the entry inside the artifact and use Node File Trace to follow supported imports and requires.
2. Check the paths and symlinks against the artifact boundary. A dependency in the parent workspace does not count as shipped.
3. Check supported literal filesystem reads and report an omitted path with the chain that reaches it. Unsupported or unresolved patterns remain visible as incomplete coverage.

## Try the demo, then check your own build

With Node 22 or later and npm, run the pinned alpha from npm's cache.

```sh
release_url=https://github.com/CVamsi27/deployproof/releases/download/v0.1.0-alpha.3/developer-pain-lab-deployproof-0.1.0-alpha.3.tgz
npm exec --yes --ignore-scripts --package="$release_url" -- deployproof demo
```

Next, build your application as usual. If it ships `./out` and starts from `out/dist/server.js`, use the same package to check that exact folder. The entry path is relative to the artifact root.

```sh
npm exec --yes --ignore-scripts --package="$release_url" -- deployproof check ./out --entry dist/server.js
```

For the synthetic pnpm failure, fix the library's file list, regenerate the deployment folder, and rerun the check. For your own build, fix the packaging step that dropped the file. Once the check is useful, [add it after the build in CI](ci.md). Exit 0 means supported structural checks passed. Exit 1 reports a finding, 2 a setup or tool error, and 3 incomplete coverage without a stronger failure.

## Compare the result, not just the runtime

Deployproof uses [Node File Trace](https://github.com/vercel/nft) for its tracing core. A trace supplies files and warnings; interpreting it as a portability check needs additional rules. Deployproof adds containment checks and a limited literal-asset analysis. This is a specific candidate distinction, not a claim to replace tracing or smoke tests.

On 5 November 2026, `npm run measure` reproduced these six synthetic cases with Node 24.22.1, NFT 1.11.0 and a handwritten restricted container baseline through OrbStack on macOS arm64:

| Synthetic artifact | Deployproof structural result | Direct NFT warnings | Handwritten container result |
| --- | --- | --- | --- |
| Workspace link escapes the folder | Failed | 0 | Failed |
| Workspace package contained | Passed | 0 | Passed |
| Package built module omitted | Failed | 1 | Failed |
| Package built module included | Passed | 0 | Passed |
| Literal runtime asset omitted | Failed | 0 | Failed |
| Literal runtime asset included | Passed | 0 | Passed |

Zero NFT warnings are not a passing deployment verdict. In this run, the missing literal asset produced a Deployproof path finding despite no direct-trace warning. The workspace-link and missing-module findings retained partial trace coverage; a useful finding must not erase that uncertainty. The healthy equivalents passed complete supported-static checks. All six baseline containers completed ownership-verified cleanup.

The container baseline also caught all three broken cases by running their explicit synthetic commands. Deployproof's structural check obtained the declared findings without running the entry. That demonstrates a difference in observation and diagnosis on these fixtures; it does not establish faster setup, time saved or stronger runtime coverage. The measurement is one run, not a performance study. No participant has supplied an independent integration or retained-use result.

## Where this stops

Runtime-computed imports and unsupported filesystem expressions can remain partial. A structural pass cannot prove native ABI compatibility, external integrations or every route. An optional smoke command is a separate observation in a constrained disposable cell. It requires explicit local image preparation; the default structural check needs no engine.

If you already produce a Node deployment folder, [try one local check](../README.md#check-your-deployment-folder) after your normal build and compare it with your existing command. The most useful feedback is the setup effort, an actionable or unnecessary diagnostic, and whether you keep it on a later change. Share a sanitized summary or synthetic reproduction through the [opt-in trial form](https://github.com/CVamsi27/deployproof/issues/new?template=integration-trial.yml).
