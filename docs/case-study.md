# A successful Node build can still omit a runtime file

Draft technical post. This example is synthetic; it does not describe a customer incident or prove developer adoption.

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

If you already produce a Node deployment folder, try one local check after your normal build and compare it with your existing command. The most useful feedback is the setup effort, an actionable or unnecessary diagnostic, and whether you keep it on a later change. Share only a sanitized summary or synthetic reproduction through the [opt-in trial form](https://github.com/CVamsi27/deployproof/issues/new?template=integration-trial.yml). No source upload or credentials are needed.
