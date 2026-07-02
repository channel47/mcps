import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Static list of resource documents exposed by the server.
 */
export const RESOURCES = [
  {
    uri: 'pinterestads://reference',
    name: 'Pinterest Ads API Reference',
    description: 'Core REST API v5 endpoints, query parameters, pagination, and error handling notes for Pinterest Ads workflows',
    mimeType: 'text/markdown'
  },
  {
    uri: 'pinterestads://analytics-columns',
    name: 'Pinterest Ads Analytics Columns Reference',
    description: 'Common analytics column names, attribution window semantics, and micro-currency conventions',
    mimeType: 'text/markdown'
  },
  {
    uri: 'pinterestads://rate-limits',
    name: 'Pinterest Ads Rate Limits and Quotas',
    description: 'Rate limiting behavior, backoff guidance, and operational recommendations',
    mimeType: 'text/markdown'
  }
];

const RESOURCE_FILE_MAP = {
  'pinterestads://reference': 'api-reference.md',
  'pinterestads://analytics-columns': 'analytics-columns-reference.md',
  'pinterestads://rate-limits': 'rate-limits-and-quotas.md'
};

export function getResourcesList() {
  return RESOURCES;
}

/**
 * Read a resource document by URI.
 * @param {string} uri
 * @returns {{ contents: Array<{ uri: string, mimeType: string, text: string }> }}
 */
export function readResource(uri) {
  const filename = RESOURCE_FILE_MAP[uri];
  if (!filename) {
    throw new Error(`Unknown resource: ${uri}. Available: ${Object.keys(RESOURCE_FILE_MAP).join(', ')}`);
  }

  const filePath = join(__dirname, filename);
  const content = readFileSync(filePath, 'utf8');

  return {
    contents: [
      {
        uri,
        mimeType: 'text/markdown',
        text: content
      }
    ]
  };
}
