#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

// Import auth for validation
import { validateEnvironment } from './auth.js';

// Import tools
import { listAccounts } from './tools/list-accounts.js';
import { runGaqlQuery } from './tools/gaql-query.js';
import { mutate } from './tools/mutate.js';

// Import resources
import { getResourcesList, readResource } from './resources/index.js';

// Import prompts
import { getPromptsList, renderPrompt } from './prompts/templates.js';

// Server metadata
const SERVER_NAME = 'google-ads-mcp';
const SERVER_VERSION = '1.0.0';

// Validate environment on startup
const { valid, missing } = validateEnvironment();
if (!valid) {
  console.error(`Missing required environment variables: ${missing.join(', ')}`);
  process.exit(1);
}

// Create MCP server
const server = new Server(
  {
    name: SERVER_NAME,
    version: SERVER_VERSION,
  },
  {
    capabilities: {
      tools: {},
      prompts: {},
      resources: {},
    },
  }
);

// Tool definitions
const TOOLS = [
  {
    name: 'list_accounts',
    description: 'List all accessible Google Ads accounts under the authenticated user or MCC. Use this first to find account IDs before running other tools.',
    inputSchema: {
      type: 'object',
      properties: {
        include_manager_accounts: {
          type: 'boolean',
          description: 'Include manager (MCC) accounts in results',
          default: false
        }
      }
    }
  },
  {
    name: 'query',
    description: 'Execute any GAQL SELECT query. Returns clean JSON results. Mutations are blocked - use mutate tool for write operations.',
    inputSchema: {
      type: 'object',
      properties: {
        customer_id: {
          type: 'string',
          description: 'Google Ads account ID (optional, uses default if not specified)'
        },
        query: {
          type: 'string',
          description: 'Full GAQL query string (SELECT only)'
        },
        limit: {
          type: 'integer',
          description: 'Maximum rows to return (default: 100, max: 10000)',
          default: 100
        }
      },
      required: ['query']
    }
  },
  {
    name: 'mutate',
    description: `Execute write operations using GoogleAdsService.Mutate. Default dry_run=true for safety.

Supports two operation formats:

1. Standard Google Ads format (auto-transformed):
   { "update": { "resource_name": "customers/123/campaigns/456", "status": "PAUSED" } }
   { "create": { "ad_group": "customers/123/adGroups/456", "keyword": {...} } }
   { "remove": "customers/123/labels/789" }

2. Opteo library format:
   { "entity": "campaign", "operation": "update", "resource": { "resource_name": "...", "status": "PAUSED" } }

Entity types are auto-inferred from resource_name patterns for updates/removes.

Asset Uploads:
For IMAGE/VIDEO assets, use 'image_file_path' or 'video_file_path' with absolute file paths:
   { "entity": "asset", "operation": "create", "resource": { "name": "My Image", "type": "IMAGE", "image_file_path": "/path/to/image.jpg" } }

- Tool automatically reads, validates, and base64-encodes the file
- Supported formats: JPEG (.jpg, .jpeg), PNG (.png with valid headers)
- Maximum file size: 5MB
- Paths must be absolute (e.g., /Users/name/image.jpg or C:\\Users\\name\\image.jpg)`,
    inputSchema: {
      type: 'object',
      properties: {
        customer_id: {
          type: 'string',
          description: 'Google Ads customer ID (optional, uses default if not specified)'
        },
        operations: {
          type: 'array',
          description: 'Array of mutation operations. Supports standard format ({ create/update/remove: ... }) or Opteo format ({ entity, operation, resource }).',
          items: {
            type: 'object'
          }
        },
        partial_failure: {
          type: 'boolean',
          description: 'Enable partial failure mode (default: true)',
          default: true
        },
        dry_run: {
          type: 'boolean',
          description: 'Validate only, do not execute (default: true)',
          default: true
        }
      },
      required: ['operations']
    }
  }
];

// Register list_tools handler
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: TOOLS };
});

// Register call_tool handler
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: params } = request.params;

  try {
    switch (name) {
      case 'list_accounts':
        return await listAccounts(params);

      case 'query':
        return await runGaqlQuery(params);

      case 'mutate':
        return await mutate(params);

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    console.error(`Tool error (${name}):`, error);
    throw error;
  }
});

// Register list_prompts handler
server.setRequestHandler(ListPromptsRequestSchema, async () => {
  return { prompts: getPromptsList() };
});

// Register get_prompt handler
server.setRequestHandler(GetPromptRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    return renderPrompt(name, args || {});
  } catch (error) {
    console.error(`Prompt error (${name}):`, error);
    throw error;
  }
});

// Register list_resources handler
server.setRequestHandler(ListResourcesRequestSchema, async () => {
  return { resources: getResourcesList() };
});

// Register read_resource handler
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const { uri } = request.params;

  try {
    return readResource(uri);
  } catch (error) {
    console.error(`Resource error (${uri}):`, error);
    throw error;
  }
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error(`${SERVER_NAME} v${SERVER_VERSION} started`);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
