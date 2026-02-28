#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  GetPromptRequestSchema,
  ListPromptsRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema
} from '@modelcontextprotocol/sdk/types.js';

import { validateEnvironment } from './auth.js';
import { listAccounts } from './tools/list-accounts.js';
import { query } from './tools/query.js';
import { mutate } from './tools/mutate.js';
import { getPromptsList, renderPrompt } from './prompts/templates.js';
import { getResourcesList, readResource } from './resources/index.js';

const SERVER_NAME = 'meta-ads-mcp';
const SERVER_VERSION = '1.0.0';
const READ_ONLY = process.env.META_ADS_READ_ONLY === 'true';

const ALL_TOOLS = [
  {
    name: 'list_accounts',
    description: 'List all accessible Meta ad accounts for the authenticated token.',
    inputSchema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          description: 'Optional account status filter (e.g. ACTIVE, DISABLED)'
        }
      }
    }
  },
  {
    name: 'query',
    description: 'Query campaigns, adsets, ads, insights, audiences, or creatives from Meta Graph API.',
    inputSchema: {
      type: 'object',
      properties: {
        account_id: {
          type: 'string',
          description: 'Meta account ID. Supports either 123... or act_123...'
        },
        entity: {
          type: 'string',
          enum: ['campaigns', 'adsets', 'ads', 'insights', 'audiences', 'creatives'],
          description: 'Entity type to query'
        },
        fields: {
          anyOf: [
            { type: 'string' },
            {
              type: 'array',
              items: { type: 'string' }
            }
          ],
          description: 'Optional fields selection. Defaults to entity-specific presets.'
        },
        filters: {
          type: 'array',
          items: { type: 'object' },
          description: 'Optional structured Graph filtering clauses'
        },
        date_range: {
          anyOf: [{ type: 'string' }, { type: 'object' }],
          description: 'Insights-only date range preset or { since, until } object'
        },
        level: {
          type: 'string',
          description: 'Insights-only breakdown level (campaign, adset, ad)'
        },
        time_increment: {
          anyOf: [{ type: 'string' }, { type: 'integer' }],
          description: 'Insights-only increment (1, 7, monthly, etc.)'
        },
        limit: {
          type: 'integer',
          minimum: 1,
          maximum: 1000,
          description: 'Maximum rows to return (default: 100, max: 1000)'
        },
        sort: {
          type: 'string',
          description: 'Optional sort expression'
        }
      },
      required: ['entity']
    }
  },
  {
    name: 'mutate',
    description: 'Execute create/update/pause/enable/delete operations for campaign, adset, ad, and audience entities. dry_run defaults to true.',
    inputSchema: {
      type: 'object',
      properties: {
        account_id: {
          type: 'string',
          description: 'Meta account ID. Supports either 123... or act_123...'
        },
        operations: {
          type: 'array',
          description: 'Array of operation objects: { entity, action, id?, params? }',
          items: {
            type: 'object'
          }
        },
        dry_run: {
          type: 'boolean',
          description: 'Validate and preview only (default: true)',
          default: true
        },
        partial_failure: {
          type: 'boolean',
          description: 'Continue executing later operations when one fails (default: true)',
          default: true
        }
      },
      required: ['operations']
    }
  }
];

const TOOLS = READ_ONLY ? ALL_TOOLS.filter((tool) => tool.name !== 'mutate') : ALL_TOOLS;

const envStatus = validateEnvironment();
if (!envStatus.valid) {
  console.error(`Missing required environment variables: ${envStatus.missing.join(', ')}`);
  process.exit(1);
}

if (READ_ONLY) {
  console.error('Read-only mode enabled — mutate tool disabled');
}

const server = new Server(
  {
    name: SERVER_NAME,
    version: SERVER_VERSION
  },
  {
    capabilities: {
      tools: {},
      prompts: {},
      resources: {}
    }
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: params } = request.params;

  if (name === 'list_accounts') {
    return listAccounts(params);
  }

  if (name === 'query') {
    return query(params);
  }

  if (name === 'mutate') {
    if (READ_ONLY) {
      throw new Error('mutate is disabled in read-only mode (META_ADS_READ_ONLY=true)');
    }
    return mutate(params);
  }

  throw new Error(`Unknown tool: ${name}`);
});

server.setRequestHandler(ListPromptsRequestSchema, async () => ({ prompts: getPromptsList() }));
server.setRequestHandler(GetPromptRequestSchema, async (request) => (
  renderPrompt(request.params.name, request.params.arguments || {})
));

server.setRequestHandler(ListResourcesRequestSchema, async () => ({ resources: getResourcesList() }));
server.setRequestHandler(ReadResourceRequestSchema, async (request) => readResource(request.params.uri));

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`${SERVER_NAME} v${SERVER_VERSION} started`);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
