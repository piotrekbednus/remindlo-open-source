# Changelog

All notable changes to `@remindlo/mcp-server`.

This project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.1]

### Changed

- **Read-only tools set `destructiveHint: false` explicitly.** The MCP spec
  calls `destructiveHint` meaningful only when `readOnlyHint` is false, so
  `list_campaigns`, `get_contact` and `list_contacts` used to omit it. OpenAI's
  plugin scanner does not apply that rule: it fills in the default (`true`)
  and labels the tool both read-only and destructive. Tool behaviour is
  unchanged. The remote server at `mcp.remindlo.co.uk` made the same change.

## [1.2.0]

### Added

- **Recurring services.** `upsert_contact` takes `is_recurrent`,
  `recurrent_interval_value` and `recurrent_interval_unit`, and `list_contacts`
  can filter by `is_recurrent`. The REST API and the remote server at
  `mcp.remindlo.co.uk` have supported these since February 2026; this package
  was the only client that could not set them. A recurring contact's next due
  date moves forward by the interval once it passes, so "every 6 months" is set
  once rather than after every visit.

- **Server identity.** The server now reports `title`, `websiteUrl` and an
  icon, the same values as the remote server, for clients that show them.

### Changed

- **Tool descriptions state facts instead of giving the model orders**, to
  match the Claude connector directory's rule against instructions about model
  behaviour or other tools in descriptions. The remote server was changed the
  same way.

  The consent safeguard is kept, and moved to where it is read at the right
  moment: the `marketing_consent` field itself now says it is required for
  campaign messages and must never be assumed. The old tool-level wording
  ("you MUST set marketing_consent to true, otherwise SMS messages will not be
  sent") pushed a model towards setting it to make an enrolment work.

- `send_message` says outright that it is not idempotent and that each call
  bills a separate SMS, and links to the documentation.

### Fixed

- `list_contacts` now shows each contact's ID. It printed names, phones and
  emails only, so a contact picked from the list could not be passed to
  `send_message` or `get_contact` without a second lookup. A contact with no
  name was also meant to show as "Unknown" and never did.

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
