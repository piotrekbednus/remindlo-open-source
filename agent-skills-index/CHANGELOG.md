# Changelog

All notable changes to `agent-skills-index`.

This project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0]

First public release.

Generalised from the build script that generates the discovery manifest served
at `remindlo.co.uk/.well-known/agent-skills/index.json`, which it still
produces byte-for-byte.

### Added

- CLI that builds a `.well-known/agent-skills/index.json` from a directory of
  `<skill-name>/SKILL.md` files, pinning a SHA-256 digest of each file's raw
  bytes.
- `--check`, which regenerates in memory and exits non-zero when the committed
  manifest has drifted from its source files. Intended as a CI gate: it catches
  the case this tool exists to prevent, editing a Skill and forgetting its
  digest.
- `--base-url` and `--url-prefix`, so the emitted `url` reflects where the
  files are served rather than where they sit in the build directory.
- Validation with actionable messages: `description` is required, its
  1024-byte cap is measured in bytes rather than characters, and a
  directory name must match the `name` in its frontmatter.
- Frontmatter parsing for YAML block scalars (`|` and `>`), CRLF line endings
  and a leading BOM.
- A library API — `buildIndex`, `buildSkillEntry`, `parseFrontmatter`,
  `listSkillDirs`, `serialiseIndex` — alongside the CLI.
- Remindlo's deployed Skill as a worked example, which doubles as the CI
  fixture: if it ever drifts from its digest, the build fails.

### Notes

The manifest shape follows Cloudflare's Agent Skills Discovery RFC v0.2.0. The
convention is pre-1.0, so this package is too. If you hit a divergence between
what it emits and what an agent expects, please open an issue.
