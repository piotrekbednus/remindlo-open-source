# Remindlo Open Source

Components extracted from [Remindlo](https://www.remindlo.co.uk) and released standalone.

Remindlo is an SMS and email reminder platform for service businesses — garages, dental practices, salons, vets, HVAC engineers — the kind of business that loses real money every month to no-shows and customers who quietly stop coming back. Building it turned up a few pieces that aren't specific to reminders at all. Those live here.

Each package is independent: its own `package.json`, tests, and licence. Nothing here depends on Remindlo's codebase or requires a Remindlo account.

## Packages

| Package | What it does |
|---|---|
| [`agent-skills-index`](agent-skills-index) | Builds a `.well-known/agent-skills/index.json` discovery manifest from a directory of `SKILL.md` files, so AI agents can find the Skills your domain publishes — and verify they loaded the right bytes. Zero dependencies. |

## Why publish these

Agent-facing infrastructure only works if enough sites implement it the same way. A discovery manifest that only one domain serves is a curiosity; the same manifest served by a hundred domains is a convention agents can rely on. Keeping the generator private would have been the worse trade.

The `agent-skills-index` package ships with Remindlo's own deployed Skill as its worked example, which also serves as its CI fixture — if the example ever drifts from its digest, the build fails. Publishing it means the tool stays honest.

## Licence

MIT, per package. See each package's `LICENSE`.

## Contributing

Issues and pull requests are welcome. Package-specific detail lives in each package's README.
