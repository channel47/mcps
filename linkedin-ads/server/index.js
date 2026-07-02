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
import { analytics } from './tools/analytics.js';
import { mutate } from './tools/mutate.js';
import { getPromptsList, renderPrompt } from './prompts/templates.js';
import { getResourcesList, readResource } from './resources/index.js';

const SERVER_NAME = 'linkedin-ads-mcp';
const SERVER_VERSION = '0.1.0';
const READ_ONLY = process.env.LINKEDIN_ADS_READ_ONLY === 'true';

const ALL_TOOLS = [
  {
    name: 'list_accounts',
    description: 'List all accessible LinkedIn ad accounts for the authenticated token, with optional status/type filters.',
    inputSchema: {
      type: 'object',
      properties: {
        status: {
          anyOf: [
            { type: 'string' },
            {
              type: 'array',
              items: { type: 'string' }
            }
          ],
          description: 'Optional account status filter (ACTIVE, CANCELED, DRAFT, PENDING_DELETION, REMOVED). String or array.'
        },
        type: {
          anyOf: [
            { type: 'string' },
            {
              type: 'array',
              items: { type: 'string' }
            }
          ],
          description: 'Optional account type filter (BUSINESS, ENTERPRISE). String or array.'
        },
        limit: {
          type: 'integer',
          minimum: 1,
          description: 'Maximum accounts to return (default: 1000)'
        }
      }
    }
  },
  {
    name: 'query',
    description: 'Query campaigns, campaign groups, or creatives for a LinkedIn ad account. Supports either the numeric account ID or the urn:li:sponsoredAccount URN.',
    inputSchema: {
      type: 'object',
      properties: {
        account_id: {
          type: 'string',
          description: 'LinkedIn ad account ID. Supports either 123... or urn:li:sponsoredAccount:123...'
        },
        entity: {
          type: 'string',
          enum: ['campaigns', 'campaign_groups', 'creatives'],
          description: 'Entity type to query'
        },
        status: {
          anyOf: [
            { type: 'string' },
            {
              type: 'array',
              items: { type: 'string' }
            }
          ],
          description: 'Optional status filter (e.g. ACTIVE, PAUSED, DRAFT, ARCHIVED). For creatives this filters intendedStatus.'
        },
        campaign_ids: {
          type: 'array',
          items: { type: 'string' },
          description: 'Creatives only: restrict to these campaign IDs (plain IDs or URNs)'
        },
        limit: {
          type: 'integer',
          minimum: 1,
          description: 'Maximum rows to return (default: 100)'
        }
      },
      required: ['entity']
    }
  },
  {
    name: 'analytics',
    description: 'Fetch adAnalytics metrics pivoted by ACCOUNT, CAMPAIGN_GROUP, CAMPAIGN, or CREATIVE over a date range. Defaults to impressions, clicks, costInLocalCurrency, externalWebsiteConversions plus dateRange/pivotValues; at most 20 metric fields per call. No pagination (LinkedIn caps responses at 15,000 elements).',
    inputSchema: {
      type: 'object',
      properties: {
        account_id: {
          type: 'string',
          description: 'LinkedIn ad account ID used when entity_ids is omitted. Supports either 123... or urn:li:sponsoredAccount:123...'
        },
        pivot: {
          type: 'string',
          enum: ['ACCOUNT', 'CAMPAIGN_GROUP', 'CAMPAIGN', 'CREATIVE'],
          description: 'Dimension to group results by'
        },
        start: {
          type: 'string',
          description: 'Start date (YYYY-MM-DD)'
        },
        end: {
          type: 'string',
          description: 'End date (YYYY-MM-DD). Omit for "through today".'
        },
        time_granularity: {
          type: 'string',
          enum: ['ALL', 'DAILY', 'MONTHLY'],
          description: 'Time breakdown (default: ALL)'
        },
        entity_type: {
          type: 'string',
          enum: ['account', 'campaign_group', 'campaign', 'creative'],
          description: 'Entity type of entity_ids (default: account)'
        },
        entity_ids: {
          type: 'array',
          items: { type: 'string' },
          description: 'Plain IDs (or URNs) to scope the report to. Defaults to the account when omitted.'
        },
        fields: {
          anyOf: [
            { type: 'string' },
            {
              type: 'array',
              items: { type: 'string' }
            }
          ],
          description: 'Metric fields to request (max 20 metrics). Defaults to impressions,clicks,costInLocalCurrency,externalWebsiteConversions,dateRange,pivotValues.'
        }
      },
      required: ['pivot', 'start']
    }
  },
  {
    name: 'mutate',
    description: 'Execute create/update/pause/enable/archive operations for campaign, campaign_group, and creative entities. dry_run defaults to true and returns a local-validation preview of the exact requests without calling the API (LinkedIn has no server-side validate-only mode). Creates default to DRAFT status (LinkedIn\'s safe non-serving state; pass explicit status — intendedStatus for creatives — to override). archive sets status ARCHIVED and is hard to reverse — prefer pause. Updates use Rest.li PARTIAL_UPDATE with { patch: { $set: {...} } }.',
    inputSchema: {
      type: 'object',
      properties: {
        account_id: {
          type: 'string',
          description: 'LinkedIn ad account ID. Supports either 123... or urn:li:sponsoredAccount:123...'
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
          description: 'Validate locally and preview requests only (default: true)',
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

  if (name === 'analytics') {
    return analytics(params);
  }

  if (name === 'mutate') {
    if (READ_ONLY) {
      throw new Error('mutate is disabled in read-only mode (LINKEDIN_ADS_READ_ONLY=true)');
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
