# agent-skills-index

Build a `.well-known/agent-skills/index.json` discovery manifest from a directory of `SKILL.md` files, so AI agents can find the Skills your domain publishes — and verify they loaded the right bytes.

Zero runtime dependencies. Node 18.17+.

```bash
npx agent-skills-index dist/.well-known/agent-skills
```

```
✓ wrote dist/.well-known/agent-skills/index.json (1 skill)
  • remindlo-sms-reminders → sha256:ea050b38f70…
```

## Why this exists

A **Skill** is a Markdown file that teaches an AI agent how to do something — which tool to reach for, in what order, with what caveats. Anthropic popularised the `SKILL.md` format; the Agent Skills Discovery convention makes those files findable at a well-known URL, the same way `robots.txt` made crawl rules findable.

The convention needs one machine-readable index listing every Skill you publish, each with a SHA-256 digest. Writing that by hand means remembering to update a digest every time you edit a sentence. You will forget. Then agents either skip your Skill or load it unverified.

This generates the index from the files themselves, so the two can't drift.

## Layout it expects

One directory per Skill, each containing a `SKILL.md`:

```
dist/.well-known/agent-skills/
├── index.json            ← generated
├── my-first-skill/
│   └── SKILL.md
└── my-second-skill/
    └── SKILL.md
```

Directory names must match `^[a-z0-9-]{1,64}$`, and must match the `name` in the file's frontmatter. Agents resolve a Skill by its URL, so a mismatch there is a broken link with extra steps — it's an error, not a warning.

## What a SKILL.md looks like

```markdown
---
name: my-first-skill
description: Use when a user wants to do X with Y. Covers A, B and C. Skip for Z.
license: MIT
homepage: https://example.com
---

# My first skill

Everything the agent should know…
```

Only `name` and `description` affect the manifest. Everything else is yours.

The `description` is the part that matters most and the part people rush. An agent reads *only* the descriptions in your index when deciding whether to load a Skill at all — the body is never fetched if the description doesn't earn it. Say when to use it **and when not to**; the cap is 1024 bytes, measured in bytes rather than characters, so non-ASCII copy runs out sooner than it looks.

Long descriptions can use YAML block scalars — both `|` (literal) and `>` (folded) work:

```yaml
description: >-
  Use when a user wants to do X with Y.
  Covers A, B and C. Skip for Z.
```

## What it generates

```json
{
  "$schema": "https://schemas.agentskills.io/discovery/0.2.0/schema.json",
  "skills": [
    {
      "name": "remindlo-sms-reminders",
      "type": "skill-md",
      "description": "Use when a service business owner needs to send SMS or email reminders…",
      "url": "/.well-known/agent-skills/remindlo-sms-reminders/SKILL.md",
      "digest": "sha256:ea050b38f70c6564a5e2771111c5ffccdf3400bd26c0dcca99328288852bb15c"
    }
  ]
}
```

Skills are sorted by name and the JSON is formatted deterministically, so regenerating produces no diff unless a Skill actually changed. That's what makes `--check` (below) usable as a CI gate.

The digest covers the raw file bytes, not the parsed content — an agent can verify it byte-for-byte against what it fetched.

## Wiring it into a build

Generate the manifest *after* your Skills land in the output directory:

```json
{
  "scripts": {
    "build": "vite build && agent-skills-index dist/.well-known/agent-skills"
  }
}
```

Serve `.md` as `text/markdown; charset=utf-8` rather than letting it download as a blob. For Apache:

```apache
AddType text/markdown .md
AddCharset utf-8 .md
```

## Keeping it honest in CI

`--check` regenerates in memory and compares against what's on disk. It writes nothing and exits 1 if they differ:

```yaml
- run: npx agent-skills-index dist/.well-known/agent-skills --check
```

Use this if you commit `index.json` rather than generating it at build time. It fails the build when someone edits a `SKILL.md` and forgets the digest — which is the entire failure mode this tool exists to prevent.

## CLI reference

```
agent-skills-index [root] [options]

  root                  Directory containing <skill-name>/SKILL.md subdirectories.
                        Default: dist/.well-known/agent-skills

  -o, --out <path>      Where to write the manifest. Default: <root>/index.json
  -b, --base-url <url>  Emit absolute skill URLs against this origin instead of
                        root-relative paths.
  -p, --url-prefix <p>  Path prefix the skills are served under.
                        Default: /.well-known/agent-skills
      --check           Don't write. Exit 1 if the manifest is missing or stale.
      --allow-empty     Succeed with an empty manifest when no skills are found.
  -q, --quiet           Only print errors.
  -h, --help            Show help.
  -v, --version         Print the version.
```

Exit codes: `0` written or up to date · `1` validation failed or stale · `2` bad usage.

Use `--url-prefix` when your build directory doesn't mirror your URL structure — the generated `url` is what agents fetch, so it has to reflect where the files are actually served, not where they sit on disk.

## Library API

```js
import { buildIndex, serialiseIndex } from 'agent-skills-index';

const manifest = buildIndex('dist/.well-known/agent-skills', {
  baseUrl: 'https://example.com',   // optional: absolute URLs
  urlPrefix: '/.well-known/agent-skills',
});

console.log(serialiseIndex(manifest));
```

Also exported: `buildSkillEntry`, `listSkillDirs`, `parseFrontmatter`, `SkillValidationError`, and the `NAME_PATTERN` / `MAX_DESCRIPTION_BYTES` / `SCHEMA_URL` constants.

Validation failures throw `SkillValidationError` with a `.skill` property naming the offending directory. Anything else that throws is a genuine I/O problem.

## How discovery fits together

The index is one link in a chain. A complete setup usually looks like:

1. **`/llms.txt`** — a short human-and-agent-readable overview of what your site offers, linking to the manifest.
2. **`/.well-known/agent-skills/index.json`** — this file. Names each Skill, describes when to use it, and pins its digest.
3. **`/.well-known/agent-skills/<name>/SKILL.md`** — the Skill itself: workflows, decision trees, gotchas.
4. **An API or MCP server** — what the Skill actually teaches the agent to call.

A Skill without step 4 is documentation. An API without steps 1–3 is undiscoverable. The manifest is the cheap piece that makes the expensive pieces findable.

## A Skill in production

`examples/remindlo-sms-reminders/SKILL.md` is the real, deployed Skill from [Remindlo](https://www.remindlo.co.uk) — an SMS and email reminder platform for service businesses. It's served at [`remindlo.co.uk/.well-known/agent-skills/`](https://www.remindlo.co.uk/.well-known/agent-skills/index.json) by exactly this tool.

It's worth reading as a worked example rather than a toy: it shows a decision tree mapping user phrasings onto specific tool calls, E.164 phone normalisation per country, consent regimes (GDPR/PECR, TCPA, CASL) flagged without pretending the agent can adjudicate them, and — importantly — an explicit list of cases where the agent should *not* use the Skill.

```bash
npm run example    # regenerates examples/index.json
```

## Spec notes

The emitted shape matches Cloudflare's Agent Skills Discovery RFC v0.2.0 (`schemas.agentskills.io/discovery/0.2.0`), and is what `remindlo.co.uk` serves in production today.

The convention is young and pre-1.0. If you hit a divergence between what this emits and what an agent expects, please open an issue with the details — tracking the spec is the point of the package.

## License

MIT
