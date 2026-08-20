# Changelog

All notable changes to `@remindlo/mcp-server`.

This project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0]

### Added

- **MCP safety annotations on every tool.** Clients previously had to fall back
  to the SDK defaults — `readOnlyHint: false`, `destructiveHint: true`,
  `openWorldHint: true` — which made a contact lookup look exactly as risky as
  sending an SMS. Each tool now declares what it actually does, including a
  human-readable `title`.

  The consequential one is `idempotentHint`: `upsert_contact` converges on the
  same contact however many times it runs, so a retry is safe, while
  `send_message` sends another SMS and bills another segment every call, so a
  retry is not. A client can now tell those apart.

- A test suite (29 tests). The package previously shipped with none. Covers
  tool schemas, the annotations above, argument validation, and the HTTP
  wrapper's handling of transport failures, non-JSON responses and API errors.
  It stubs `fetch`, so it needs no API key and makes no network calls.

- The `LICENSE` file that `package.json` had declared since 1.0.0.

### Fixed

- The version reported to MCP clients was hardcoded as `1.0.8` and had drifted
  from `package.json`. It is now read from `package.json` at startup.

### Changed

- Moved to the [remindlo-open-source](https://github.com/piotrekbednus/remindlo-open-source)
  monorepo, which fixes the dead Repository link on npm and gives the package
  CI for the first time — build, typecheck and tests on Node 22 and 24.

## [1.0.9] and earlier

Released before this changelog was kept. See the
[commit history](https://github.com/piotrekbednus/remindlo-open-source/commits/main/mcp-server).
