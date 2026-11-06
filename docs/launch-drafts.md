# Deployproof pilot and launch drafts

Start with maintainers who already ship a Node application folder from a pnpm workspace. The best fit has an upcoming change to package exports, included files, workspace dependencies, or its deployment build. Ask each participant to check one build folder with the [one-off command](../README.md#check-your-deployment-folder) and compare the result with their existing check on the same folder.

1. Share the invitation with developers who have opted into feedback or in a community that welcomes project showcases. [pnpm Show and Tell](https://github.com/pnpm/pnpm/discussions/categories/show-and-tell) is a candidate for the reproducible pnpm example. Review its current rules before posting.
2. Give participants the quickstart first. Offer help after their first attempt, and record what blocked them. If the check helps, send the [CI recipe](ci.md) so they can keep it for their next change.
3. Record trial starts, completed integrations, concrete benefits, and later use in the [lab trial record](https://github.com/CVamsi27/developer-pain-lab/blob/HEAD/docs/adoption-trials.md). Compare stars and downloads separately. After repeat use, prepare a consented case study and one broader launch.

## Opt-in pilot invitation

Do you ship a Node app from a pnpm workspace? I built Deployproof to check the folder you actually deploy. In a synthetic workspace, `pnpm deploy` produced an app folder whose library module was present but whose runtime template was missing. Deployproof named the missing file and showed the import chain.

I'm looking for five maintainers willing to run one local check after their usual build. You can try the pinned alpha without adding a dependency or uploading your project. If you try it, I'd like to know what your existing check found and whether you'd keep this step in CI. Confusing or unnecessary findings are welcome feedback. [Run one check](https://github.com/CVamsi27/deployproof#check-your-deployment-folder) · [Share a sanitized result](https://github.com/CVamsi27/deployproof/issues/new?template=integration-trial.yml)

## Technical case study

[A successful Node build can still omit a runtime file](case-study.md) contains the observed synthetic output, the comparison with direct tracing and container smoke, and the real pnpm reproduction.

## Short launch post

My build passed, but what actually went into the deploy folder? In a reproducible pnpm example, removing the library's templates directory from its package file list left its JavaScript in place. Deployproof showed the missing file and which entry needed it. Run the broken/fixed demo, or try the pinned alpha on your own build folder. [Quickstart](https://github.com/CVamsi27/deployproof#try-it-without-cloning)

## Show HN draft

Title: Show HN: Deployproof checks Node deployment folders for missing runtime files

I built Deployproof to inspect the exact directory being shipped, using Node File Trace plus containment and literal-asset checks. It reports a missing path and chain without running the application. The README offers a pinned, runnable synthetic demo and an optional separate constrained smoke command.

This is an alpha with six synthetic broken/fixed controls. Dynamic filesystem expressions and imports can remain partial; it is not a deployment-readiness verdict. I would like feedback on whether the diagnosis is clearer or easier to integrate than your existing trace/container checks. What would prevent you keeping this in CI?

After the pilot records repeat use, verify the release link and demo again. Submit the runnable repository and be available to answer questions. [Show HN guidelines](https://news.ycombinator.com/showhn.html)
