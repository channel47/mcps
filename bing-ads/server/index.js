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
import { listProducts } from './tools/list-products.js';
import { mutate } from './tools/mutate.js';
import { query } from './tools/query-campaigns.js';
import { report } from './tools/report.js';
import { getPromptsList, renderPrompt } from './prompts/templates.js';
import { getResourcesList, readResource } from './resources/index.js';

const SERVER_NAME = 'bing-ads-mcp';
const SERVER_VERSION = '1.1.4';

const TOOLS = [
  {
    name: 'list_accounts',
    description: 'List all accessible Microsoft Advertising (Bing Ads) accounts. Use this first to find account IDs before running other tools.',
    inputSchema: {
      type: 'object',
      properties: {
        customer_id: {
          type: 'string',
          description: 'Customer (manager) ID. Uses default from BING_ADS_CUSTOMER_ID when omitted.'
        }
      }
    }
  },
  {
    name: 'list_products',
    description: 'List Microsoft Merchant Center products from the Content API. Returns feed fields including link (landing URL), title, price, availability, and offer ID.',
    inputSchema: {
      type: 'object',
      properties: {
        store_id: {
          type: 'string',
          description: 'Merchant Center store ID (BMC StoreId)'
        },
        max_results: {
          type: 'integer',
          description: 'Maximum products to return per request (1-250, default: 250)',
          default: 250
        },
        start_token: {
          type: 'string',
          description: 'Pagination token from a prior list_products response'
        }
      },
      required: ['store_id']
    }
  },
  {
    name: 'query',
    description: 'Query Microsoft Advertising account structure — campaigns, ad groups, keywords, and ads. Returns configuration and settings (names, statuses, budgets, bids, match types), not performance metrics. Use the report tool for impressions, clicks, spend, and conversions.',
    inputSchema: {
      type: 'object',
      properties: {
        account_id: {
          type: 'string',
          description: 'Account ID (uses BING_ADS_ACCOUNT_ID when omitted)'
        },
        customer_id: {
          type: 'string',
          description: 'Customer ID (uses BING_ADS_CUSTOMER_ID when omitted)'
        },
        entity: {
          type: 'string',
          enum: ['campaigns', 'ad_groups', 'keywords', 'ads'],
          description: 'Entity type to query'
        },
        campaign_id: {
          type: 'string',
          description: 'Campaign ID (required for ad_groups)'
        },
        ad_group_id: {
          type: 'string',
          description: 'Ad group ID (required for keywords and ads)'
        },
        campaign_type: {
          type: 'string',
          description: 'Campaign type filter (e.g. "Search", "Shopping", "PerformanceMax"). Omit to return all types.'
        }
      },
      required: ['entity']
    }
  },
  {
    name: 'report',
    description: 'Pull Microsoft Advertising performance data — impressions, clicks, spend, conversions, and more. Use this for any metrics or time-series data. Returns parsed CSV rows. For account structure (campaign names, budgets, keywords), use the query tool instead.',
    inputSchema: {
      type: 'object',
      properties: {
        account_id: {
          type: 'string',
          description: 'Account ID (uses BING_ADS_ACCOUNT_ID when omitted)'
        },
        customer_id: {
          type: 'string',
          description: 'Customer ID (uses BING_ADS_CUSTOMER_ID when omitted)'
        },
        report_type: {
          type: 'string',
          enum: ['campaign', 'ad_group', 'keyword', 'ad', 'search_query', 'account', 'asset_group'],
          description: 'Type of performance report'
        },
        columns: {
          type: 'array',
          items: {
            type: 'string'
          },
          description: 'Optional report columns. Uses report defaults when omitted.'
        },
        date_range: {
          type: 'string',
          enum: ['Today', 'Yesterday', 'LastSevenDays', 'ThisWeek', 'LastWeek', 'Last14Days', 'Last30Days', 'LastFourWeeks', 'ThisMonth', 'LastMonth', 'LastThreeMonths', 'LastSixMonths', 'ThisYear', 'LastYear'],
          description: 'Predefined date range',
          default: 'LastSevenDays'
        },
        aggregation: {
          type: 'string',
          enum: ['Summary', 'Daily', 'Weekly', 'Monthly', 'Hourly'],
          description: 'Report aggregation level',
          default: 'Daily'
        },
        limit: {
          type: 'integer',
          description: 'Maximum number of parsed rows returned',
          default: 100
        }
      },
      required: ['report_type']
    }
  },
  {
    name: 'mutate',
    description: 'Execute write operations on Microsoft Advertising entities. Supports campaigns, ad_groups, keywords, ads, and negative_keywords. Default dry_run=true validates without making changes.\n\nOperation format examples:\n- Campaign update: { entity: "campaigns", update: { Id: "123", DailyBudget: 50 } }\n- Keyword create: { entity: "keywords", create: { ad_group_id: "456", Text: "shoes", MatchType: "Exact", Bid: { Amount: 1.5 } } }\n- Negative keyword create: { entity: "negative_keywords", create: { entity_id: "789", entity_type: "Campaign", Text: "free", MatchType: "Phrase" } }\n- Remove: { entity: "keywords", remove: { Id: "321", ad_group_id: "456" } }',
    inputSchema: {
      type: 'object',
      properties: {
        account_id: {
          type: 'string',
          description: 'Account ID (uses BING_ADS_ACCOUNT_ID when omitted)'
        },
        customer_id: {
          type: 'string',
          description: 'Customer ID (uses BING_ADS_CUSTOMER_ID when omitted)'
        },
        operations: {
          type: 'array',
          description: 'Array of operations. Each needs "entity" (campaigns|ad_groups|keywords|ads|negative_keywords) and one of "create", "update", or "remove". Keywords and ads require ad_group_id inside the action object. Ad groups require campaign_id. Negative keywords require entity_id and entity_type (Campaign or AdGroup).',
          items: { type: 'object' }
        },
        partial_failure: {
          type: 'boolean',
          description: 'Continue after individual failures (default: true)',
          default: true
        },
        dry_run: {
          type: 'boolean',
          description: 'Validate only, no API calls (default: true)',
          default: true
        }
      },
      required: ['operations']
    }
  }
];

const envStatus = validateEnvironment();
if (!envStatus.valid) {
  console.error(`Missing required environment variables: ${envStatus.missing.join(', ')}`);
  process.exit(1);
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

  if (name === 'list_products') {
    return listProducts(params);
  }

  if (name === 'report') {
    return report(params);
  }

  if (name === 'mutate') {
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
