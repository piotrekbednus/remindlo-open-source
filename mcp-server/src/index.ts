#!/usr/bin/env node
/**
 * Remindlo MCP Server
 * Enables AI assistants to manage contacts and SMS campaigns via the Remindlo API.
 *
 * Usage:
 *   REMINDLO_API_KEY=sk_live_xxx npx @remindlo/mcp-server
 *
 * Or configure in Claude Desktop:
 *   {
 *     "mcpServers": {
 *       "remindlo": {
 *         "command": "npx",
 *         "args": ["@remindlo/mcp-server"],
 *         "env": { "REMINDLO_API_KEY": "sk_live_xxx" }
 *       }
 *     }
 *   }
 */

import { createRequire } from "node:module";

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { tools, handleToolCall } from "./tools.js";

// Read the version from package.json rather than repeating it here — a
// hardcoded literal drifts from the published version the moment npm version
// bumps package.json, and this is the version clients see over MCP.
const require = createRequire(import.meta.url);
const { version } = require("../package.json") as { version: string };

const API_KEY = process.env.REMINDLO_API_KEY;

if (!API_KEY) {
    console.error("Error: REMINDLO_API_KEY environment variable is required");
    console.error("");
    console.error("Get your API key from: https://remindlo.co.uk/dashboard/integrations");
    console.error("");
    console.error("Usage:");
    console.error("  REMINDLO_API_KEY=sk_live_xxx npx @remindlo/mcp-server");
    process.exit(1);
}

const server = new Server(
    {
        name: "remindlo",
        version,
    },
    {
        capabilities: {
            tools: {},
        },
    }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools,
}));

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    return handleToolCall(name, args || {}, API_KEY);
});

// Start server
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
}

main().catch((error) => {
    console.error("Server error:", error);
    process.exit(1);
});
