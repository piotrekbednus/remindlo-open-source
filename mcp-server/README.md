# Remindlo MCP Server

MCP (Model Context Protocol) server for [Remindlo](https://www.remindlo.co.uk) SMS Reminder API.
Enables Claude Desktop and other AI assistants to manage contacts and SMS campaigns directly.

## Installation

### Claude Desktop

Add to your `claude_desktop_config.json`:

**macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "remindlo": {
      "command": "npx",
      "args": ["@remindlo/mcp-server"],
      "env": {
        "REMINDLO_API_KEY": "sk_live_your_key_here"
      }
    }
  }
}
```

Get your API key from [Remindlo Dashboard → Integrations](https://remindlo.co.uk/dashboard/integrations).

### Manual Installation

```bash
npm install -g @remindlo/mcp-server
```

Then configure Claude Desktop to use the global install:

```json
{
  "mcpServers": {
    "remindlo": {
      "command": "remindlo-mcp",
      "env": {
        "REMINDLO_API_KEY": "sk_live_your_key_here"
      }
    }
  }
}
```

## Available Tools

### list_campaigns

List all SMS campaigns available in your Remindlo account.

```
Example: "What campaigns do I have in Remindlo?"
```

### upsert_contact

Create or update a contact. If a contact with the same phone or email exists, it will be updated.

**Required** (at least one):
- `phone` - Phone in E.164 format (e.g., +447912345678)
- `email` - Email address

**Optional**:
- `first_name` - First name
- `last_name` - Last name
- `marketing_consent` - Whether contact agreed to receive SMS
- `next_due_at` - Next appointment in ISO 8601. Use `YYYY-MM-DD` for an all-day entry, or full datetime `YYYY-MM-DDTHH:mm:ssZ` (e.g. `2026-03-15T14:30:00Z`) to set a specific time.
- `campaign_ids` - Array of campaign IDs to enroll contact
- `tags` - Array of tags
- `note` - Notes about the contact

```
Example: "Add John Smith, phone +447912345678, to the Birthday campaign"
```

### get_contact

Get details of a specific contact by ID, phone, or email.

**Required** (at least one):
- `contact_id` - Contact UUID
- `phone` - Phone number in E.164 format
- `email` - Email address

```
Example: "Look up the contact with phone +447912345678"
```

### send_message

Send a one-time SMS message to a contact. Requires a paid plan.

**Required**:
- `contact_id` - Contact UUID (use get_contact or list_contacts to find IDs)
- `body` - SMS message text (max 1600 characters)

```
Example: "Send an SMS to John Smith saying his appointment is confirmed for tomorrow at 2pm"
```

> **Note:** This feature is only available on paid plans. Free plan users will receive an error.

### list_contacts

Search and list contacts with filtering and pagination.

**All parameters are optional**:
- `search` - Search in name, phone, email
- `limit` - Max results (default 50, max 100)
- `offset` - Skip N results for pagination
- `has_phone` - Only contacts with phone numbers
- `marketing_consent` - Filter by consent status
- `next_due_before` / `next_due_after` - Filter by appointment date
- `sort_by` - Field to sort by (created_at, updated_at, next_due_at, first_name)
- `sort_order` - asc or desc

```
Example: "Show me all contacts due this week"
```

## Example Conversations

### Adding a contact with campaign enrollment

**You:** Add Maria Garcia, phone +34612345678, email maria@example.com to the Appointment Reminder campaign

**Claude:**
1. Lists campaigns to find "Appointment Reminder" ID
2. Creates/updates contact with campaign enrollment
3. Confirms: "Contact created: Maria Garcia (ID: xxx) enrolled in Appointment Reminder campaign"

### Finding contacts

**You:** Find all contacts due for appointments next week

**Claude:** Uses list_contacts with next_due_after and next_due_before to show matching contacts.

### Looking up a specific contact

**You:** What info do we have for +447912345678?

**Claude:** Uses get_contact to retrieve and display full contact details including enrolled campaigns.

## Phone Number Format

Phone numbers must be in E.164 international format:
- UK: +447912345678
- Poland: +48607123456
- US: +12025551234
- Spain: +34612345678

## API Documentation

Full documentation: https://www.remindlo.co.uk/help/mcp-server-claude-integration

## Troubleshooting

### "REMINDLO_API_KEY environment variable is required"

Make sure you've added your API key to the Claude Desktop config:

```json
{
  "mcpServers": {
    "remindlo": {
      "command": "npx",
      "args": ["@remindlo/mcp-server"],
      "env": {
        "REMINDLO_API_KEY": "sk_live_your_key_here"
      }
    }
  }
}
```

### "Invalid API key"

- Check that your API key starts with `sk_live_` or `sk_test_`
- Verify the key in your Remindlo dashboard
- Make sure the key hasn't expired

### Tools not appearing in Claude

1. Restart Claude Desktop after config changes
2. Check the config file path is correct for your OS
3. Verify JSON syntax in claude_desktop_config.json

## Development

This package lives in the [remindlo-open-source](https://github.com/piotrekbednus/remindlo-open-source) monorepo.

```bash
git clone https://github.com/piotrekbednus/remindlo-open-source.git
cd remindlo-open-source/mcp-server
npm ci
npm test          # builds, then runs the suite against dist/
npm run typecheck
```

Tests run against the compiled output in `dist/` — the code npm actually ships — and stub `globalThis.fetch`, so the suite never touches the live API and needs no API key.

## Support

- Email: support@remindlo.co.uk
- Documentation: https://www.remindlo.co.uk/help/mcp-server-claude-integration

## License

MIT
