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

const SERVER_NAME = 'pinterest-ads-mcp';
const SERVER_VERSION = '0.1.0';
const READ_ONLY = process.env.PINTEREST_ADS_READ_ONLY === 'true';

const IDS_FILTER_SCHEMA = {
  anyOf: [
    { type: 'string' },
    {
      type: 'array',
      items: { type: 'string' }
    }
  ]
};

const ALL_TOOLS = [
  {
    name: 'list_accounts',
    description: 'List all accessible Pinterest ad accounts for the authenticated token, including id, name, currency, country, and owner.',
    inputSchema: {
      type: 'object',
      properties: {
        include_shared_accounts: {
          type: 'boolean',
          description: 'Include ad accounts shared with the authenticated user (API default: true)'
        }
      }
    }
  },
  {
    name: 'query',
    description: 'Query Pinterest Ads campaigns, ad_groups, or ads with optional entity status and id filters. Note: the API returns only ACTIVE and PAUSED entities by default — pass entity_statuses to include ARCHIVED or DRAFT.',
    inputSchema: {
      type: 'object',
      properties: {
        ad_account_id: {
          type: 'string',
          description: 'Pinterest ad account ID (falls back to PINTEREST_ADS_AD_ACCOUNT_ID)'
        },
        entity: {
          type: 'string',
          enum: ['campaigns', 'ad_groups', 'ads'],
          description: 'Entity type to query'
        },
        entity_statuses: {
          ...IDS_FILTER_SCHEMA,
          description: 'Status filter: ACTIVE, PAUSED, ARCHIVED, DRAFT, DELETED_DRAFT (API default: ACTIVE, PAUSED)'
        },
        campaign_ids: {
          ...IDS_FILTER_SCHEMA,
          description: 'Filter by campaign IDs (comma-separated string or array)'
        },
        ad_group_ids: {
          ...IDS_FILTER_SCHEMA,
          description: 'Filter by ad group IDs (ad_groups and ads entities only)'
        },
        ad_ids: {
          ...IDS_FILTER_SCHEMA,
          description: 'Filter by ad IDs (ads entity only)'
        },
        order: {
          type: 'string',
          enum: ['ASCENDING', 'DESCENDING'],
          description: 'Sort order by ID (higher IDs are more recently created)'
        },
        limit: {
          type: 'integer',
          minimum: 1,
          maximum: 1000,
          description: 'Maximum rows to return across pages (default: 100, max: 1000)'
        }
      },
      required: ['entity']
    }
  },
  {
    name: 'analytics',
    description: 'Pull Pinterest Ads analytics at account, campaign, ad_group, or ad level. Entity levels require the matching ids param (campaign_ids, ad_group_ids, ad_ids). Dates are YYYY-MM-DD, at most 90 days back and a 90-day range.',
    inputSchema: {
      type: 'object',
      properties: {
        ad_account_id: {
          type: 'string',
          description: 'Pinterest ad account ID (falls back to PINTEREST_ADS_AD_ACCOUNT_ID)'
        },
        level: {
          type: 'string',
          enum: ['account', 'campaign', 'ad_group', 'ad'],
          description: 'Reporting level (default: account)'
        },
        start_date: {
          type: 'string',
          description: 'Report start date (YYYY-MM-DD, UTC). Cannot be more than 90 days back from today.'
        },
        end_date: {
          type: 'string',
          description: 'Report end date (YYYY-MM-DD, UTC). Cannot be more than 90 days past start_date.'
        },
        columns: {
          ...IDS_FILTER_SCHEMA,
          description: 'Metric columns (default: SPEND_IN_DOLLAR, IMPRESSION_2, CLICKTHROUGH_2, CTR_2, TOTAL_CONVERSIONS). See the pinterestads://analytics-columns resource.'
        },
        granularity: {
          type: 'string',
          enum: ['TOTAL', 'DAY', 'WEEK', 'MONTH', 'HOUR'],
          description: 'Time breakdown (default: TOTAL). HOUR no longer returns conversion metrics.'
        },
        campaign_ids: {
          ...IDS_FILTER_SCHEMA,
          description: 'Campaign IDs (required for level=campaign)'
        },
        ad_group_ids: {
          ...IDS_FILTER_SCHEMA,
          description: 'Ad group IDs (required for level=ad_group)'
        },
        ad_ids: {
          ...IDS_FILTER_SCHEMA,
          description: 'Ad IDs (required for level=ad)'
        },
        click_window_days: {
          type: 'integer',
          enum: [0, 1, 7, 14, 30, 60],
          description: 'Click attribution window in days (API default: 30)'
        },
        engagement_window_days: {
          type: 'integer',
          enum: [0, 1, 7, 14, 30, 60],
          description: 'Engagement attribution window in days (API default: 30)'
        },
        view_window_days: {
          type: 'integer',
          enum: [0, 1, 7, 14, 30, 60],
          description: 'View attribution window in days (API default: 1)'
        },
        conversion_report_time: {
          type: 'string',
          enum: ['TIME_OF_AD_ACTION', 'TIME_OF_CONVERSION'],
          description: 'Report conversions by ad action time or conversion time (API default: TIME_OF_AD_ACTION)'
        },
        reporting_timezone: {
          type: 'string',
          enum: ['PINTEREST_TIME_ZONE', 'AD_ACCOUNT_TIME_ZONE'],
          description: 'Timezone used to bucket metrics'
        }
      },
      required: ['start_date', 'end_date']
    }
  },
  {
    name: 'mutate',
    description: 'Execute create/update/pause/enable/archive operations for campaign, ad_group, and ad entities via Pinterest bulk-array endpoints. dry_run defaults to true and performs local validation plus a preview of the exact requests (Pinterest has no server-side validate-only mode). Creates default to PAUSED status. Pinterest has NO delete — archive (status ARCHIVED) is the terminal state and archived entities cannot be reactivated. Campaign creates require name and objective_type; ad_group creates require name, campaign_id, and billable_event; ad creates require ad_group_id, pin_id, and creative_type.',
    inputSchema: {
      type: 'object',
      properties: {
        ad_account_id: {
          type: 'string',
          description: 'Pinterest ad account ID (falls back to PINTEREST_ADS_AD_ACCOUNT_ID)'
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
  console.error('Set PINTEREST_ADS_ACCESS_TOKEN, or all of PINTEREST_ADS_CLIENT_ID + PINTEREST_ADS_CLIENT_SECRET + PINTEREST_ADS_REFRESH_TOKEN for the refresh-token flow.');
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
      throw new Error('mutate is disabled in read-only mode (PINTEREST_ADS_READ_ONLY=true)');
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
