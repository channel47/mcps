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
    uri: 'metaads://reference',
    name: 'Meta Ads Graph API Reference',
    description: 'Core Graph API endpoints, query parameters, and error handling notes for Meta Ads workflows',
    mimeType: 'text/markdown'
  },
  {
    uri: 'metaads://entity-fields',
    name: 'Meta Ads Entity Field Reference',
    description: 'Default fields and common optional field expansions for queryable entities',
    mimeType: 'text/markdown'
  },
  {
    uri: 'metaads://rate-limits',
    name: 'Meta Ads Rate Limits and Quotas',
    description: 'Rate limiting behavior, backoff guidance, and operational recommendations',
    mimeType: 'text/markdown'
  }
];

const RESOURCE_FILE_MAP = {
  'metaads://reference': 'graph-api-reference.md',
  'metaads://entity-fields': 'entity-fields-reference.md',
  'metaads://rate-limits': 'rate-limits-and-quotas.md'
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
