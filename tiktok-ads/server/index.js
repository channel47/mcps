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
import { report } from './tools/report.js';
import { mutate } from './tools/mutate.js';
import { getPromptsList, renderPrompt } from './prompts/templates.js';
import { getResourcesList, readResource } from './resources/index.js';

const SERVER_NAME = 'tiktok-ads-mcp';
const SERVER_VERSION = '0.1.0';
const READ_ONLY = process.env.TIKTOK_ADS_READ_ONLY === 'true';

const ALL_TOOLS = [
  {
    name: 'list_accounts',
    description: 'List accessible TikTok ad accounts (advertisers) with name, status, currency, and timezone. Discovers advertiser ids via /oauth2/advertiser/get/ when TIKTOK_ADS_APP_ID and TIKTOK_ADS_APP_SECRET are set; otherwise pass advertiser_ids or set TIKTOK_ADS_ADVERTISER_ID.',
    inputSchema: {
      type: 'object',
      properties: {
        advertiser_ids: {
          type: 'array',
          items: { type: 'string' },
          description: 'Explicit advertiser ids to look up (skips oauth2 discovery)'
        }
      }
    }
  },
  {
    name: 'query',
    description: 'Query campaigns, adgroups, or ads from the TikTok Business API with optional filtering, field selection, and pagination.',
    inputSchema: {
      type: 'object',
      properties: {
        advertiser_id: {
          type: 'string',
          description: 'TikTok advertiser ID (defaults to TIKTOK_ADS_ADVERTISER_ID)'
        },
        entity: {
          type: 'string',
          enum: ['campaigns', 'adgroups', 'ads'],
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
        filtering: {
          type: 'object',
          description: 'Optional TikTok filtering object (e.g. { "campaign_ids": ["123"], "primary_status": "STATUS_DELIVERY_OK" })'
        },
        limit: {
          type: 'integer',
          minimum: 1,
          maximum: 1000,
          description: 'Maximum rows to return (default: 100, max: 1000)'
        }
      },
      required: ['entity']
    }
  },
  {
    name: 'report',
    description: 'Run a synchronous TikTok integrated report (GET /report/integrated/get/) with dimensions, metrics, and a date range or lifetime scope. Rows are returned with dimensions and metrics flattened together.',
    inputSchema: {
      type: 'object',
      properties: {
        advertiser_id: {
          type: 'string',
          description: 'TikTok advertiser ID (defaults to TIKTOK_ADS_ADVERTISER_ID)'
        },
        report_type: {
          type: 'string',
          enum: ['BASIC', 'AUDIENCE'],
          description: 'Report type (default: BASIC)'
        },
        data_level: {
          type: 'string',
          enum: ['AUCTION_ADVERTISER', 'AUCTION_CAMPAIGN', 'AUCTION_ADGROUP', 'AUCTION_AD'],
          description: 'Aggregation level (default: AUCTION_CAMPAIGN)'
        },
        dimensions: {
          type: 'array',
          items: { type: 'string' },
          description: 'Report dimensions. Defaults to the data_level id dimension plus stat_time_day (id dimension only when lifetime=true).'
        },
        metrics: {
          type: 'array',
          items: { type: 'string' },
          description: 'Report metrics (default: spend, impressions, clicks, ctr, cpc, cpm, conversion, cost_per_conversion, conversion_rate)'
        },
        start_date: {
          type: 'string',
          description: 'Start date YYYY-MM-DD (defaults to 7 days ago when lifetime is false)'
        },
        end_date: {
          type: 'string',
          description: 'End date YYYY-MM-DD (defaults to today UTC when lifetime is false)'
        },
        lifetime: {
          type: 'boolean',
          description: 'Query lifetime metrics instead of a date range (default: false; excludes stat_time dimensions)'
        },
        filtering: {
          type: 'array',
          items: { type: 'object' },
          description: 'Optional filter clauses: [{ "field_name", "filter_type", "filter_value" }]'
        },
        order_field: {
          type: 'string',
          description: 'Optional metric/dimension to sort by (e.g. spend)'
        },
        order_type: {
          type: 'string',
          enum: ['ASC', 'DESC'],
          description: 'Sort direction when order_field is set (default: DESC)'
        },
        limit: {
          type: 'integer',
          minimum: 1,
          maximum: 1000,
          description: 'Maximum rows to return (default: 100, max: 1000)'
        }
      }
    }
  },
  {
    name: 'mutate',
    description: 'Execute create/update/pause/enable/delete operations for campaign, adgroup, and ad entities. dry_run defaults to true and performs local validation plus a preview of the exact requests (TikTok has no server-side validate-only mode). Campaign and adgroup creates default operation_status to DISABLE (paused) for safety. DELETE is permanent and unrecoverable — prefer pause. Ad updates take the full /ad/update/ body in params (ads are identified via creatives[].ad_id).',
    inputSchema: {
      type: 'object',
      properties: {
        advertiser_id: {
          type: 'string',
          description: 'TikTok advertiser ID (defaults to TIKTOK_ADS_ADVERTISER_ID)'
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

  if (name === 'report') {
    return report(params);
  }

  if (name === 'mutate') {
    if (READ_ONLY) {
      throw new Error('mutate is disabled in read-only mode (TIKTOK_ADS_READ_ONLY=true)');
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
