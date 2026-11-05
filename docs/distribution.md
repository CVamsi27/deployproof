# Distribution and registry prerequisites

The owner chose to keep GitHub-package installation on 5 November 2026. GitHub packages are the supported public path; npm registry publication is deferred. No npm login is needed to use the tool.

The pinned GitHub alpha tarball is the current public installation path. The README's `npm exec --package=<release-url> -- deployproof demo` command uses npm's cache; it does not require a clone or an npm account. Release assets include `SHA256SUMS.txt` for independent verification. Avoid mutable `latest` URLs in CI.

The working package identity is `@developer-pain-lab/deployproof`. It is not published to npm, and ownership of that scope has not been verified. On 5 November 2026 the local `npm whoami --registry https://registry.npmjs.org/` preflight returned `ENEEDAUTH`. No registry publish was attempted.

Before a registry release, the owner must log in locally, confirm account and scope access, and explicitly authorize publication. Do not put passwords or tokens in issues, chat, source or logs. Use the registry's [scoped public package guidance](https://docs.npmjs.com/creating-and-publishing-scoped-public-packages/); a prerelease should use the `alpha` distribution tag rather than replacing `latest`. Review tarball contents and rerun source, package and relevant real integration gates before publishing.

No registry write token, automatic publish workflow, production deployment or outbound launch message is configured here. A future trusted-publishing workflow needs its own verified repository/package relationship and authorization; see [npm trusted publishers](https://docs.npmjs.com/trusted-publishers/).
