/**
 * Remindlo API Client
 * HTTP wrapper for the Remindlo REST API
 */

const API_BASE = "https://api.remindlo.co.uk/v1";

export interface Campaign {
    id: string;
    name: string;
    type: string;
    status: string;
}

export interface Contact {
    id: string;
    first_name?: string;
    last_name?: string;
    phone?: string;
    email?: string;
    marketing_consent?: boolean;
    next_due_at?: string;
    last_service_at?: string;
    note?: string;
    tags?: string[];
    custom_fields?: Record<string, unknown>;
    created_at?: string;
    updated_at?: string;
    campaigns?: Array<{
        campaign_id: string;
        campaign_name: string;
        enrolled_at: string;
        next_trigger_at?: string;
    }>;
}

export interface UpsertContactInput {
    phone?: string;
    email?: string;
    first_name?: string;
    last_name?: string;
    marketing_consent?: boolean;
    next_due_at?: string;
    last_service_at?: string;
    note?: string;
    tags?: string[];
    custom_fields?: Record<string, unknown>;
    campaign_ids?: string[];
}

export interface ListContactsParams {
    search?: string;
    limit?: number;
    offset?: number;
    has_phone?: boolean;
    marketing_consent?: boolean;
    next_due_before?: string;
    next_due_after?: string;
    sort_by?: "created_at" | "updated_at" | "next_due_at" | "first_name";
    sort_order?: "asc" | "desc";
}

export interface GetContactParams {
    contact_id?: string;
    phone?: string;
    email?: string;
}

export interface SendMessageInput {
    contact_id: string;
    body: string;
}

type ApiResponse<T> = {
    success: boolean;
    error?: {
        code: string;
        message: string;
        details?: Record<string, unknown>;
    };
} & Partial<T>;

export class RemindloClient {
    constructor(private apiKey: string) {}

    private async request<T>(
        endpoint: string,
        options: RequestInit = {}
    ): Promise<ApiResponse<T>> {
        let response: Response;

        try {
            response = await fetch(`${API_BASE}${endpoint}`, {
                ...options,
                headers: {
                    "x-api-key": this.apiKey,
                    "Content-Type": "application/json",
                    ...options.headers,
                },
            });
        } catch (error) {
            // Network error (connection refused, timeout, DNS failure)
            return {
                success: false,
                error: {
                    code: "NETWORK_ERROR",
                    message:
                        error instanceof Error
                            ? `Network error: ${error.message}`
                            : "Failed to connect to Remindlo API",
                },
            } as ApiResponse<T>;
        }

        try {
            const data = await response.json();
            return data as ApiResponse<T>;
        } catch {
            // Non-JSON response (HTML error page, etc.)
            return {
                success: false,
                error: {
                    code: "INVALID_RESPONSE",
                    message: `API returned non-JSON response (HTTP ${response.status})`,
                },
            } as ApiResponse<T>;
        }
    }

    async listCampaigns(): Promise<{ content: Array<{ type: string; text: string }> }> {
        const data = await this.request<{ campaigns: Campaign[] }>("/campaigns");

        if (!data.success) {
            return {
                content: [
                    {
                        type: "text",
                        text: `Error: ${data.error?.message || "Failed to list campaigns"}`,
                    },
                ],
            };
        }

        const campaigns = data.campaigns || [];
        if (campaigns.length === 0) {
            return {
                content: [
                    {
                        type: "text",
                        text: "No campaigns found. Create a campaign in the Remindlo dashboard first.",
                    },
                ],
            };
        }

        const formatted = campaigns
            .map((c) => `- ${c.name} (ID: ${c.id}, Status: ${c.status})`)
            .join("\n");

        return {
            content: [
                {
                    type: "text",
                    text: `Found ${campaigns.length} campaign(s):\n\n${formatted}`,
                },
            ],
        };
    }

    async upsertContact(
        input: UpsertContactInput
    ): Promise<{ content: Array<{ type: string; text: string }> }> {
        const data = await this.request<{
            contact_id: string;
            action: string;
            contact: Contact;
            enrollments?: Array<{ campaign_id: string; status: string; reason?: string }>;
        }>("/contacts", {
            method: "POST",
            body: JSON.stringify(input),
        });

        if (!data.success) {
            return {
                content: [
                    {
                        type: "text",
                        text: `Error: ${data.error?.message || "Failed to upsert contact"}${
                            data.error?.details
                                ? `\nDetails: ${JSON.stringify(data.error.details)}`
                                : ""
                        }`,
                    },
                ],
            };
        }

        const contact = data.contact;
        if (!contact) {
            return {
                content: [{ type: "text", text: "Error: No contact data in response" }],
            };
        }

        let text = `Contact ${data.action || "saved"}: ${contact.first_name || ""} ${
            contact.last_name || ""
        }`.trim();
        text += `\nID: ${data.contact_id}`;

        if (contact.phone) {
            text += `\nPhone: ${contact.phone}`;
        }
        if (contact.email) {
            text += `\nEmail: ${contact.email}`;
        }

        if (data.enrollments && data.enrollments.length > 0) {
            text += "\n\nCampaign enrollments:";
            for (const e of data.enrollments) {
                text += `\n- ${e.campaign_id}: ${e.status}`;
                if (e.reason) {
                    text += ` (${e.reason})`;
                }
            }
        }

        return {
            content: [{ type: "text", text }],
        };
    }

    async getContact(
        params: GetContactParams
    ): Promise<{ content: Array<{ type: string; text: string }> }> {
        let endpoint = "/contacts";

        if (params.contact_id) {
            endpoint = `/contacts/${params.contact_id}`;
        } else if (params.phone) {
            endpoint = `/contacts?phone=${encodeURIComponent(params.phone)}`;
        } else if (params.email) {
            endpoint = `/contacts?email=${encodeURIComponent(params.email)}`;
        } else {
            return {
                content: [
                    {
                        type: "text",
                        text: "Error: Please provide contact_id, phone, or email to lookup a contact.",
                    },
                ],
            };
        }

        const data = await this.request<{ contact: Contact }>(endpoint);

        if (!data.success) {
            return {
                content: [
                    {
                        type: "text",
                        text: `Error: ${data.error?.message || "Contact not found"}`,
                    },
                ],
            };
        }

        const contact = data.contact;
        if (!contact) {
            return {
                content: [{ type: "text", text: "Error: No contact data in response" }],
            };
        }
        return {
            content: [
                {
                    type: "text",
                    text: this.formatContact(contact),
                },
            ],
        };
    }

    async listContacts(
        params: ListContactsParams
    ): Promise<{ content: Array<{ type: string; text: string }> }> {
        const queryParams = new URLSearchParams();

        if (params.search) queryParams.set("search", params.search);
        if (params.limit) queryParams.set("limit", String(params.limit));
        if (params.offset) queryParams.set("offset", String(params.offset));
        if (params.has_phone !== undefined)
            queryParams.set("has_phone", String(params.has_phone));
        if (params.marketing_consent !== undefined)
            queryParams.set("marketing_consent", String(params.marketing_consent));
        if (params.next_due_before)
            queryParams.set("next_due_before", params.next_due_before);
        if (params.next_due_after)
            queryParams.set("next_due_after", params.next_due_after);
        if (params.sort_by) queryParams.set("sort_by", params.sort_by);
        if (params.sort_order) queryParams.set("sort_order", params.sort_order);

        const query = queryParams.toString();
        const endpoint = query ? `/contacts?${query}` : "/contacts";

        const data = await this.request<{
            contacts: Contact[];
            pagination: { total: number; limit: number; offset: number; has_more: boolean };
        }>(endpoint);

        if (!data.success) {
            return {
                content: [
                    {
                        type: "text",
                        text: `Error: ${data.error?.message || "Failed to list contacts"}`,
                    },
                ],
            };
        }

        const contacts = data.contacts || [];
        const pagination = data.pagination || { total: contacts.length, limit: 50, offset: 0, has_more: false };

        if (contacts.length === 0) {
            return {
                content: [
                    {
                        type: "text",
                        text: "No contacts found matching your criteria.",
                    },
                ],
            };
        }

        const contactList = contacts
            .map((c) => {
                let line = `- ${c.first_name || ""} ${c.last_name || ""}`.trim() || "Unknown";
                if (c.phone) line += ` | ${c.phone}`;
                if (c.email) line += ` | ${c.email}`;
                return line;
            })
            .join("\n");

        let text = `Found ${pagination.total} contact(s)`;
        if (pagination.has_more) {
            text += ` (showing ${contacts.length})`;
        }
        text += `:\n\n${contactList}`;

        if (pagination.has_more) {
            text += `\n\nUse offset=${
                pagination.offset + pagination.limit
            } to see more.`;
        }

        return {
            content: [{ type: "text", text }],
        };
    }

    async sendMessage(
        input: SendMessageInput
    ): Promise<{ content: Array<{ type: string; text: string }> }> {
        const data = await this.request<{
            message_id: string;
            status: string;
            contact_id: string;
            parts: number;
            channel: string;
        }>("/messages", {
            method: "POST",
            body: JSON.stringify(input),
        });

        if (!data.success) {
            return {
                content: [
                    {
                        type: "text",
                        text: `Error: ${data.error?.message || "Failed to send message"}`,
                    },
                ],
            };
        }

        return {
            content: [
                {
                    type: "text",
                    text: `SMS sent successfully!\nMessage ID: ${data.message_id}\nStatus: ${data.status || "queued"}\nSMS parts: ${data.parts ?? "unknown"}`,
                },
            ],
        };
    }

    /**
     * Reduce a raw ISO timestamp to something easier to skim in the
     * Claude Desktop chat. The npm package runs locally without DB
     * access, so unlike the cloud MCP server it can't fetch the
     * tenant's time zone / country prefix and render in their locale.
     * Best we can do is:
     *   - midnight UTC → date only ("2026-03-15") [the legacy all-day shape]
     *   - otherwise    → date + time + UTC marker ("2026-03-15 14:30 UTC")
     * Falls back to the raw string on parse failure — never blank.
     *
     * Note: post-PR-1 sync stores all-day events at midnight-tenant-TZ
     * rather than midnight-UTC, so for non-UTC tenants those will
     * render as e.g. "2026-03-14 15:00 UTC" (Tokyo) instead of date-only.
     * Mildly ugly but unambiguous; fixing properly needs the API to
     * expose tenant locale.
     */
    private formatTimestamp(iso: string): string {
        const m = iso.match(
            /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):\d{2}(?:\.\d+)?(Z|[+-]\d{2}:\d{2})?$/,
        );
        if (!m) return iso;
        const [, date, hh, mm] = m;
        if (hh === "00" && mm === "00") return date;
        return `${date} ${hh}:${mm} UTC`;
    }

    private formatContact(contact: Contact): string {
        let text = `Contact: ${contact.first_name || ""} ${contact.last_name || ""}`.trim();
        text += `\nID: ${contact.id}`;

        if (contact.phone) text += `\nPhone: ${contact.phone}`;
        if (contact.email) text += `\nEmail: ${contact.email}`;
        if (contact.marketing_consent !== undefined) {
            text += `\nMarketing consent: ${contact.marketing_consent ? "Yes" : "No"}`;
        }
        if (contact.next_due_at) text += `\nNext due: ${this.formatTimestamp(contact.next_due_at)}`;
        if (contact.last_service_at) text += `\nLast service: ${this.formatTimestamp(contact.last_service_at)}`;
        if (contact.note) text += `\nNote: ${contact.note}`;
        if (contact.tags && contact.tags.length > 0) {
            text += `\nTags: ${contact.tags.join(", ")}`;
        }

        if (contact.campaigns && contact.campaigns.length > 0) {
            text += "\n\nEnrolled campaigns:";
            for (const c of contact.campaigns) {
                text += `\n- ${c.campaign_name} (enrolled: ${this.formatTimestamp(c.enrolled_at)})`;
                if (c.next_trigger_at) {
                    text += ` | next trigger: ${this.formatTimestamp(c.next_trigger_at)}`;
                }
            }
        }

        return text;
    }
}
