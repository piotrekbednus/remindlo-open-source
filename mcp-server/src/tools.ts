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

export const tools: Tool[] = [
    {
        name: "list_campaigns",
        description:
            "List all SMS campaigns available in your Remindlo account. Use this to find campaign IDs for enrolling contacts.",
        inputSchema: {
            type: "object",
            properties: {},
            required: [],
        },
    },
    {
        name: "upsert_contact",
        description:
            "Create or update a contact in Remindlo. If a contact with the same phone or email exists, it will be updated. You can optionally enroll them in campaigns. IMPORTANT: When enrolling a contact in a campaign, you MUST set marketing_consent to true, otherwise SMS messages will not be sent. Always ask the user to confirm consent before setting it.",
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
                    description: "Whether contact agreed to receive SMS messages",
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
                        "Campaign IDs to auto-enroll the contact. Get IDs from list_campaigns.",
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
            },
            required: [],
        },
    },
    {
        name: "get_contact",
        description:
            "Get details of a specific contact by ID, phone number, or email. Returns full contact info including enrolled campaigns.",
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
            "Send a one-time SMS message to a contact. The contact must have a phone number. IMPORTANT: This feature requires a paid plan — free plan users will receive an error. The message body must not exceed 1600 characters.",
        inputSchema: {
            type: "object",
            properties: {
                contact_id: {
                    type: "string",
                    description:
                        "Contact UUID to send the message to. Use get_contact or list_contacts to find IDs.",
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
