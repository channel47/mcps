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
    uri: 'tiktokads://reference',
    name: 'TikTok Business API Reference',
    description: 'Core Business API endpoints, request conventions, and error handling notes for TikTok Ads workflows',
    mimeType: 'text/markdown'
  },
  {
    uri: 'tiktokads://reporting',
    name: 'TikTok Ads Reporting Reference',
    description: 'Integrated report dimensions, metrics, data levels, and date handling',
    mimeType: 'text/markdown'
  },
  {
    uri: 'tiktokads://rate-limits',
    name: 'TikTok Ads Rate Limits and Quotas',
    description: 'Rate limiting behavior, backoff guidance, and operational recommendations',
    mimeType: 'text/markdown'
  }
];

const RESOURCE_FILE_MAP = {
  'tiktokads://reference': 'business-api-reference.md',
  'tiktokads://reporting': 'reporting-reference.md',
  'tiktokads://rate-limits': 'rate-limits-and-quotas.md'
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
