# Launch drafts — not sent

These drafts describe implemented synthetic behavior. They make no claim of real incidents, independent adoption or time saved. Pick channels where the concrete question is welcome; check their current rules before submitting. No outreach or submission is authorized by this document.

## Opt-in pilot invitation

I am testing Deployproof, a small open-source CLI for Node deployment folders. It checks for missing runtime files, broken workspace links and dependencies that resolve outside the folder being shipped, without running the application.

If you already produce a standalone or pnpm deployment folder and want to try a local alpha, the README includes a one-command synthetic demo: https://github.com/CVamsi27/deployproof

I am looking for feedback on one real integration: setup effort, whether the diagnostic changes anything, and how it compares with your current check. A blocked result or reason not to use it is useful. No source upload or credentials are needed. Participation and feedback are optional.

## Technical case study

[A successful Node build can still omit a runtime file](case-study.md) contains the copy-ready draft, actual synthetic output and the six-case comparison. It remains a draft; no article or message has been submitted.

## Short launch post

I built a local alpha for a narrow question: does my built Node deployment folder still need something from the source repo? Deployproof reports missing assets and escaping dependencies without importing the app. The README has a one-command broken/fixed demo. Dynamic paths can remain incomplete, and real adoption is unvalidated. Feedback from one deployment-folder integration would help: https://github.com/CVamsi27/deployproof

## Show HN draft

Title: Show HN: Deployproof checks Node deployment folders for missing runtime files

I built Deployproof to inspect the exact directory being shipped, using Node File Trace plus containment and literal-asset checks. It reports a missing path and chain without running the application. The README offers a pinned, runnable synthetic demo and an optional separate constrained smoke command.

This is an alpha with six synthetic broken/fixed controls. Dynamic filesystem expressions and imports can remain partial; it is not a deployment-readiness verdict. I would like feedback on whether the diagnosis is clearer or easier to integrate than your existing trace/container checks. What would prevent you keeping this in CI?

Before posting, verify the linked release still runs, review the [Show HN guidelines](https://news.ycombinator.com/showhn.html) and be available to discuss the implementation. Do not coordinate votes or ask friends to upvote.
