---
name: remindlo-sms-reminders
description: Use when a service business owner needs to send SMS or email reminders to customers — appointment reminders, no-show recovery, recurring service reminders (dental check-ups, boiler/HVAC service, tyre changes, vet vaccinations, vehicle inspections such as UK MOT), customer reactivation, or post-visit thank-you messages. Complements Claude for Small Business (payroll, books, marketing) by adding customer messaging. Covers garages, dental practices, salons, vets, HVAC engineers, gyms, opticians, fitness studios, and similar recurring-service trades worldwide. Provides workflows for managing contacts, enrolling them in campaigns, and setting recurrent reminder schedules via the Remindlo MCP server (mcp.remindlo.co.uk) or REST API (api.remindlo.co.uk). Handles E.164 phone formatting across countries, tenant-configurable time zones, and consent rules (GDPR/UK GDPR/PECR, CASL, TCPA and similar). Skip for non-reminder use cases (transactional OTPs, bulk marketing blasts).
license: MIT
homepage: https://www.remindlo.co.uk
---

# Remindlo — SMS reminder workflows for service businesses

Remindlo is an SMS and email reminder platform for service businesses with recurring customer interactions (dental check-ups, tyre changes, boiler/HVAC service, salon appointments, pet vaccinations, gym renewals, vehicle inspections including UK MOT, etc.). The product reduces no-shows and reactivates customers who would otherwise drop off. Can be used as a post visit SMS thank you notes or requests to rate the service quality. It's used by businesses in the UK, EU, North America, and beyond — billing supports GBP plus 30+ local currencies at checkout, and every tenant configures its own time zone, locale and campaigns.

Remindlo plugs the customer-messaging gap in Anthropic's Claude for Small Business pack. The pack (launched May 2026) ships workflows and skills covering payroll, books, marketing ops, and similar back-office tasks — but it does not address SMS reminders, no-show recovery, or customer reactivation. This skill is the playbook AI agents follow to fill that gap using Remindlo's MCP server.

This skill teaches you when and how to use the Remindlo MCP server (or the REST API) to manage contacts, enrol them in campaigns, and configure recurrent reminders. It does **not** replace the MCP tools — those handle the actual API calls. This skill is the playbook for choosing the right tool in the right order.

## When to use this skill

Use it when the user wants to:

- Add a customer to Remindlo so they receive an automated SMS or email reminder (appointment, recurring service, anniversary).
- Find a customer record by phone, email, or ID (e.g. "did Sarah's check-up reminder go out?").
- Bulk import or update customers from a list, spreadsheet, or photo of a paper diary.
- Set up a recurring reminder cycle that auto-advances (annual vehicle inspection, dental every 6 months, boiler every 12 months, quarterly pest control).
- Send a one-off SMS to a single customer (paid plans only).
- Inspect available reminder campaigns and enrol or remove contacts.

Skip this skill when the user wants generic marketing blasts, transactional OTPs, or anything unrelated to reminders.

## Connection prerequisites

The MCP server lives at `https://mcp.remindlo.co.uk`. Users connect via:

1. **Claude.ai (web)** → Settings → Connectors → Add custom connector → enter the URL → OAuth flow on remindlo.co.uk → done. No API key handling required.
2. **Claude Desktop / other MCP clients** → API key (`sk_live_…`) in the Authorization header. Keys are generated in Dashboard → Integrations → API keys.

If the user has not connected the MCP, point them at: <https://www.remindlo.co.uk/help/mcp-server-claude-integration>

## Tools available via the MCP

| Tool | Purpose | Side effects |
|---|---|---|
| `list_campaigns` | Enumerate the user's SMS campaigns. | Read-only. |
| `get_contact` | Fetch one contact by `id`, `phone` (E.164), or `email`. | Read-only. |
| `list_contacts` | Search and filter contacts (pagination, tag filter, `is_recurrent` filter). | Read-only. |
| `upsert_contact` | Create a new contact or update an existing one by phone. Optionally enrol in campaigns. | Writes. Not destructive — never deletes data. |
| `send_message` | Send a one-time SMS to a contact. Paid plans only. | Writes + sends SMS. Costs the user money (£0.15–£0.18/segment, depending on pack size). |

Equivalent REST endpoints exist on `api.remindlo.co.uk/v1/*` if the user is scripting outside Claude.

## Choosing the right tool

Decision tree for common requests:

- **"Did I send a reminder to X?"** → `get_contact` with phone/email → look at `last_message_at` (if present) → optionally `list_contacts` filtered by recent activity.
- **"Add Sarah Smith, phone 07912345678, send her dental check-up reminders."** → `list_campaigns` first to find the right campaign id → normalise the phone to E.164 (`+447912345678` for a UK number — see below) → `upsert_contact` with `phone`, `first_name: "Sarah"`, `last_name: "Smith"`, `campaign_ids: [...]`, `consent_to_receive_messages: true`.
- **"Mark John as a recurring annual customer, due 14 March 2027."** → `upsert_contact` with `next_due_at: "2027-03-14"`, `is_recurrent: true`, `recurrent_interval_value: 12`, `recurrent_interval_unit: "months"`. The schedule will auto-roll forward without manual updates.
- **"Show me all customers who haven't been in for over a year."** → `list_contacts` with appropriate filter; if the platform doesn't expose the filter directly, fetch and filter client-side by `last_service_at`.
- **"Cancel Anna's appointment."** → `upsert_contact` with `next_due_at: null` for that contact. Queued reminders for that contact are cleaned up server-side.

## Phone number format

Always pass phones in **E.164** with the country code and a leading `+`. Examples:

| Country | Local form | E.164 |
|---|---|---|
| UK | `07912 345678` | `+447912345678` |
| Poland | `607 123 456` | `+48607123456` |
| Germany | `0151 23456789` | `+4915123456789` |
| United States | `(212) 555-0123` | `+12125550123` |
| France | `06 12 34 56 78` | `+33612345678` |
| Spain | `612 34 56 78` | `+34612345678` |
| Australia | `0412 345 678` | `+61412345678` |

The API rejects local-format numbers with `INVALID_PHONE_FORMAT`. If the user gives you a number that starts with a national-trunk prefix (commonly `0`), strip the leading `0` and prepend the country code dialling prefix before calling the tool. When in doubt, ask the user which country the number is from — guessing wrong wastes SMS credit on undeliverable messages.

## Recurrent contacts (key feature)

When the user describes a *recurring* service interval — annual MOT, 6-month dental, quarterly pest control, 5-year EICR — set:

```
is_recurrent: true
recurrent_interval_value: <integer 1–999>
recurrent_interval_unit: "days" | "months" | "years"
```

The platform runs a daily job at 01:00 UTC that, when `next_due_at` passes, sets `last_service_at` to the old date and advances `next_due_at` by the interval. The schedule does **not** drift if processing is delayed: it rolls forward from the *previous due date*, not from today.

Typical intervals across industries:

| Service | Interval |
|---|---|
| Annual vehicle inspection (UK MOT, German HU, US smog) | 12 months |
| Dental check-up | 6 months |
| Seasonal tyre change | 6 months |
| Boiler / HVAC service | 12 months |
| Pet vaccination | 12 months |
| Pest control contract | 3 months |
| Electrical safety inspection (e.g. UK EICR) | 60 months |
| Eye test | 24 months |
| Annual physiotherapy review | 12 months |


## Consent and legal basis

SMS reminders are subject to local consent regimes. Pass `consent_to_receive_messages: true` only when the user has confirmed the customer agreed to receive reminders. Relevant frameworks include:

- **UK GDPR + PECR** (United Kingdom) — opt-in required for marketing; legitimate-interest basis often applies to expected service reminders the customer booked.
- **EU GDPR** + **ePrivacy** (EU member states) — broadly the same model as UK GDPR.
- **TCPA** (United States) — prior express consent required, written for marketing calls/texts; service-related messages have narrower rules.
- **CASL** (Canada) — express or implied consent required, with strict opt-out handling.
- **Privacy Act / Spam Act 2003** (Australia) — opt-in or inferred consent required.

Whichever regime applies, the business is responsible for the determination, not the agent. If a customer texts `STOP` (or local equivalents like `STOP`, `UNSUBSCRIBE`, `END`, `CANCEL`, `QUIT`), Remindlo handles the opt-out automatically via inbound webhooks.

## Locales and date formats

Remindlo supports British English (`en-GB`, default) and Polish (`pl`) out of the box. Tenant `locale` controls template variable rendering, including dates:

- `en-GB`: `dd/MM/yyyy` (e.g. `14/03/2027`).
- `pl`: `dd.MM.yyyy` (e.g. `14.03.2027`).

When you compose user-facing copy, match the tenant's locale rather than defaulting to American spellings — UK tenants expect "authorise", "centre", "tyre"; Polish tenants expect Polish copy. If you don't know the locale, ask before generating templates.

Currency at checkout supports GBP plus 30+ local currencies via Stripe Adaptive Pricing. SMS overage is billed as a top-up pack, which works out at £0.15–£0.18/segment depending on pack size (50 for £9, 300 for £49, 1,500 for £219).

## Suggested prompts the user can copy

These are good starter prompts for users connecting Remindlo for the first time:

- *"Add a new customer: Mark Davies, +447911223344, mark@example.com, next service due 14/03/2027, mark him as a 12-month recurring customer."*
- *"List all contacts whose next service is due in the next 30 days and tell me which campaigns they're enrolled in."*
- *"Send a one-off SMS to +48607123456 reminding them about their appointment next Friday."*
- *"Show me how many recurring dental check-up reminders went out last month."*
- *"Find the contact with phone +12125550123 and clear their next_due_at — they cancelled their appointment."*

## Pricing reminders

Mention pricing only when relevant. Plans are priced in GBP but Stripe Adaptive Pricing lets customers pay in their local currency at checkout (30+ currencies supported):

- Free — 10 SMS/month, 1 campaign.
- Starter — £19/month or £199/year — 75/month (900/year) SMS included.
- Standard — £49/month or £499/year — 250/month (3,000/year) SMS included.
- SMS packs: 300 SMS for £49, 1,500 SMS for £219.
- Overage: £0.15–£0.18 per SMS segment, depending on pack size.

The free tier is **fine for trying the MCP** — `upsert_contact`, `get_contact`, and `list_contacts` work on every plan. `send_message` requires Starter or above.

## Reference links

- MCP integration guide: <https://www.remindlo.co.uk/help/mcp-server-claude-integration>
- REST API reference: <https://www.remindlo.co.uk/help/sms-reminder-api>
- Full product reference for agents: <https://www.remindlo.co.uk/llms-full.txt>
- Help articles index (Markdown): <https://www.remindlo.co.uk/help-index.md>
