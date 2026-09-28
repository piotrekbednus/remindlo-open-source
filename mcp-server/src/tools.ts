/**
 * MCP Tool Definitions for Remindlo
 */

import { Tool } from "@modelcontextprotocol/sdk/types.js";
import {
    RemindloClient,
    UpsertContactInput,
    GetContactParams,
    ListContactsParams,
    SendMessageInput,
} from "./api-client.js";

/**
 * Tool definitions.
 *
 * Every tool carries MCP safety annotations. They are hints, not enforcement —
 * a client may ignore them — but without them a client has to assume the worst
 * of every tool: the SDK defaults are `readOnlyHint: false`,
 * `destructiveHint: true` and `openWorldHint: true`. That makes read-only
 * lookups look as risky as sending an SMS, so clients either prompt for
 * everything or, worse, for nothing.
 *
 * The distinction that matters most here is `idempotentHint`. `upsert_contact`
 * converges on the same state however many times it runs, so a retry is safe.
 * `send_message` sends another SMS every time and bills another segment, so a
 * retry is not.
 */
export const tools: Tool[] = [
    {
        name: "list_campaigns",
        description:
            "List all SMS campaigns available in your Remindlo account, with the campaign IDs used to enrol contacts.",
        annotations: {
            title: "List campaigns",
            readOnlyHint: true,
            openWorldHint: false,
        },
        inputSchema: {
            type: "object",
            properties: {},
            required: [],
        },
    },
    {
        name: "upsert_contact",
        description:
            "Create or update a contact in Remindlo. If a contact with the same phone or email exists, it will be updated. Optionally enrols the contact in campaigns. Campaign messages are only sent to contacts whose marketing_consent is true; the field records that the customer agreed to receive messages.",
        annotations: {
            title: "Create or update a contact",
            readOnlyHint: false,
            destructiveHint: false,
            idempotentHint: true,
            openWorldHint: false,
        },
        inputSchema: {
            type: "object",
            properties: {
                phone: {
                    type: "string",
                    description:
                        "Phone number in E.164 format (e.g., +447912345678 for UK, +48607123456 for Poland)",
                },
                email: {
                    type: "string",
                    description: "Email address",
                },
                first_name: {
                    type: "string",
                    description: "Contact's first name",
                },
                last_name: {
                    type: "string",
                    description: "Contact's last name",
                },
                marketing_consent: {
                    type: "boolean",
                    description:
                        "Whether the customer has agreed to receive SMS messages. Required for campaign messages to be sent. Set to true only when the customer's agreement has been confirmed with the user; never assume it.",
                },
                next_due_at: {
                    type: "string",
                    description:
                        "Next appointment in ISO 8601 format. Use 'YYYY-MM-DD' for an all-day entry (no specific time), or full datetime 'YYYY-MM-DDTHH:mm:ssZ' (e.g. '2026-03-15T14:30:00Z') to set a specific appointment time. The tenant's time zone is applied automatically when formatting reminders.",
                },
                last_service_at: {
                    type: "string",
                    description:
                        "Last service date. ISO 8601 — date 'YYYY-MM-DD' or datetime with time and zone, e.g. '2026-03-15T14:30:00Z'.",
                },
                campaign_ids: {
                    type: "array",
                    items: { type: "string" },
                    description:
                        "Campaign IDs to auto-enrol the contact, as returned when listing campaigns.",
                },
                tags: {
                    type: "array",
                    items: { type: "string" },
                    description: "Tags for categorization (e.g., ['vip', 'premium'])",
                },
                note: {
                    type: "string",
                    description: "Notes about the contact",
                },
                custom_fields: {
                    type: "object",
                    description: "Custom data as key-value pairs",
                },
                is_recurrent: {
                    type: "boolean",
                    description:
                        "Whether this contact has a recurring service (e.g. annual boiler check, 6-month dental visit). When the next due date passes, Remindlo moves it forward by the interval.",
                },
                recurrent_interval_value: {
                    type: "number",
                    description:
                        "How often the service recurs (e.g. 6 for every 6 months). Required when is_recurrent is true.",
                },
                recurrent_interval_unit: {
                    type: "string",
                    enum: ["days", "months", "years"],
                    description: "Unit for the recurrence interval. Required when is_recurrent is true.",
                },
            },
            required: [],
        },
    },
    {
        name: "get_contact",
        description:
            "Get details of a specific contact by ID, phone number, or email. Returns full contact info including enrolled campaigns.",
        annotations: {
            title: "Look up a contact",
            readOnlyHint: true,
            openWorldHint: false,
        },
        inputSchema: {
            type: "object",
            properties: {
                contact_id: {
                    type: "string",
                    description: "Contact UUID",
                },
                phone: {
                    type: "string",
                    description: "Phone number in E.164 format to lookup",
                },
                email: {
                    type: "string",
                    description: "Email address to lookup",
                },
            },
            required: [],
        },
    },
    {
        name: "send_message",
        description:
            "Send a one-time SMS message to a contact. The contact must have a phone number. Not idempotent: each call sends and bills a separate SMS. Requires a paid plan; on the free plan the call returns an error. The message body must not exceed 1600 characters. Docs: https://www.remindlo.co.uk/help/mcp-server-claude-integration",
        annotations: {
            title: "Send a one-off SMS",
            readOnlyHint: false,
            destructiveHint: false,
            // Every call sends another SMS and bills another segment,
            // so a client must never treat a retry as free.
            idempotentHint: false,
            openWorldHint: true,
        },
        inputSchema: {
            type: "object",
            properties: {
                contact_id: {
                    type: "string",
                    description:
                        "UUID of the contact to send the message to, as returned when looking up or listing contacts.",
                },
                body: {
                    type: "string",
                    description: "SMS message text (max 1600 characters)",
                },
            },
            required: ["contact_id", "body"],
        },
    },
    {
        name: "list_contacts",
        description:
            "List and search contacts with optional filtering. Returns paginated results.",
        annotations: {
            title: "List and search contacts",
            readOnlyHint: true,
            openWorldHint: false,
        },
        inputSchema: {
            type: "object",
            properties: {
                search: {
                    type: "string",
                    description: "Search term to find in name, phone, or email",
                },
                limit: {
                    type: "number",
                    description: "Maximum number of results (default 50, max 100)",
                },
                offset: {
                    type: "number",
                    description: "Number of results to skip for pagination",
                },
                has_phone: {
                    type: "boolean",
                    description: "Only show contacts with phone numbers",
                },
                marketing_consent: {
                    type: "boolean",
                    description: "Filter by marketing consent status",
                },
                next_due_before: {
                    type: "string",
                    description: "Contacts due before this moment. ISO 8601 — date 'YYYY-MM-DD' or datetime with time and zone, e.g. '2026-03-15T14:30:00Z'.",
                },
                next_due_after: {
                    type: "string",
                    description: "Contacts due after this moment. ISO 8601 — date 'YYYY-MM-DD' or datetime with time and zone, e.g. '2026-03-15T14:30:00Z'.",
                },
                sort_by: {
                    type: "string",
                    enum: ["created_at", "updated_at", "next_due_at", "first_name"],
                    description: "Field to sort by",
                },
                sort_order: {
                    type: "string",
                    enum: ["asc", "desc"],
                    description: "Sort order (ascending or descending)",
                },
                is_recurrent: {
                    type: "boolean",
                    description: "Filter by recurrent service status",
                },
            },
            required: [],
        },
    },
];

export async function handleToolCall(
    name: string,
    args: Record<string, unknown>,
    apiKey: string
): Promise<{ content: Array<{ type: string; text: string }> }> {
    const client = new RemindloClient(apiKey);

    switch (name) {
        case "list_campaigns":
            return await client.listCampaigns();

        case "upsert_contact": {
            const input: UpsertContactInput = {
                phone: args.phone as string | undefined,
                email: args.email as string | undefined,
                first_name: args.first_name as string | undefined,
                last_name: args.last_name as string | undefined,
                marketing_consent: args.marketing_consent as boolean | undefined,
                next_due_at: args.next_due_at as string | undefined,
                last_service_at: args.last_service_at as string | undefined,
                note: args.note as string | undefined,
                tags: args.tags as string[] | undefined,
                custom_fields: args.custom_fields as Record<string, unknown> | undefined,
                campaign_ids: args.campaign_ids as string[] | undefined,
                is_recurrent: args.is_recurrent as boolean | undefined,
                recurrent_interval_value: args.recurrent_interval_value as number | undefined,
                recurrent_interval_unit: args.recurrent_interval_unit as
                    | "days"
                    | "months"
                    | "years"
                    | undefined,
            };

            // Remove undefined values
            Object.keys(input).forEach((key) => {
                if (input[key as keyof UpsertContactInput] === undefined) {
                    delete input[key as keyof UpsertContactInput];
                }
            });

            if (!input.phone && !input.email) {
                return {
                    content: [
                        {
                            type: "text",
                            text: "Error: At least one of phone or email is required.",
                        },
                    ],
                };
            }

            return await client.upsertContact(input);
        }

        case "get_contact": {
            const params: GetContactParams = {
                contact_id: args.contact_id as string | undefined,
                phone: args.phone as string | undefined,
                email: args.email as string | undefined,
            };

            if (!params.contact_id && !params.phone && !params.email) {
                return {
                    content: [
                        {
                            type: "text",
                            text: "Error: At least one of contact_id, phone, or email is required.",
                        },
                    ],
                };
            }

            return await client.getContact(params);
        }

        case "send_message": {
            const contact_id = args.contact_id as string | undefined;
            const body = args.body as string | undefined;

            if (!contact_id) {
                return {
                    content: [
                        {
                            type: "text",
                            text: "Error: contact_id is required.",
                        },
                    ],
                };
            }

            if (!body) {
                return {
                    content: [
                        {
                            type: "text",
                            text: "Error: body is required.",
                        },
                    ],
                };
            }

            const input: SendMessageInput = { contact_id, body };
            return await client.sendMessage(input);
        }

        case "list_contacts": {
            const params: ListContactsParams = {
                search: args.search as string | undefined,
                limit: args.limit as number | undefined,
                offset: args.offset as number | undefined,
                has_phone: args.has_phone as boolean | undefined,
                marketing_consent: args.marketing_consent as boolean | undefined,
                is_recurrent: args.is_recurrent as boolean | undefined,
                next_due_before: args.next_due_before as string | undefined,
                next_due_after: args.next_due_after as string | undefined,
                sort_by: args.sort_by as ListContactsParams["sort_by"],
                sort_order: args.sort_order as ListContactsParams["sort_order"],
            };
            return await client.listContacts(params);
        }

        default:
            return {
                content: [
                    {
                        type: "text",
                        text: `Unknown tool: ${name}`,
                    },
                ],
            };
    }
}
