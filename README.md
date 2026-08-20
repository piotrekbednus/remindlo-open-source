# Remindlo Open Source

Components extracted from [Remindlo](https://www.remindlo.co.uk) and released standalone.

Remindlo is an SMS and email reminder platform for service businesses — garages, dental practices, salons, vets, HVAC engineers — the kind of business that loses real money every month to no-shows and customers who quietly stop coming back. Building it turned up a few pieces that aren't specific to reminders at all. Those live here.

Each package is independent: its own `package.json`, tests, and licence. Nothing here depends on Remindlo's codebase or requires a Remindlo account.

## Packages

| Package | npm | What it does |
|---|---|---|
| [`agent-skills-index`](agent-skills-index) | `agent-skills-index` | Builds a `.well-known/agent-skills/index.json` discovery manifest from a directory of `SKILL.md` files, so AI agents can find the Skills your domain publishes — and verify they loaded the right bytes. Zero dependencies. |
| [`mcp-server`](mcp-server) | `@remindlo/mcp-server` | The Remindlo MCP server for Claude Desktop and other stdio MCP clients. Exposes contacts, campaigns and one-off SMS as tools over the Model Context Protocol. Requires a Remindlo API key. |

## Why publish these

The two packages are here for different reasons.

`agent-skills-index` is general-purpose: nothing about it is specific to reminders. Agent-facing infrastructure only works if enough sites implement it the same way — a discovery manifest that one domain serves is a curiosity, the same manifest served by a hundred domains is a convention agents can rely on. It ships with Remindlo's own deployed Skill as its worked example, which doubles as its CI fixture, so the tool stays honest.

`@remindlo/mcp-server` is Remindlo-specific by nature — it talks to the Remindlo API and needs an API key. It's open because you should be able to read what runs on your machine before you paste an API key into a config file. It's a small, dependency-light client; the whole thing is three source files.

## Licence

MIT, per package. See each package's `LICENSE`.

## Contributing

Issues and pull requests are welcome. Package-specific detail lives in each package's README.
