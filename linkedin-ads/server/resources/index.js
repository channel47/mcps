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
    uri: 'linkedinads://reference',
    name: 'LinkedIn Marketing API Reference',
    description: 'Core versioned REST endpoints, required headers, Rest.li 2.0 encoding, and finder syntax for LinkedIn Ads workflows',
    mimeType: 'text/markdown'
  },
  {
    uri: 'linkedinads://analytics-fields',
    name: 'LinkedIn Ads Analytics Field Reference',
    description: 'adAnalytics pivots, time granularities, and commonly used metric fields with defaults',
    mimeType: 'text/markdown'
  },
  {
    uri: 'linkedinads://rate-limits',
    name: 'LinkedIn Ads Rate Limits and Quotas',
    description: 'Rate limiting behavior, backoff guidance, and operational recommendations',
    mimeType: 'text/markdown'
  }
];

const RESOURCE_FILE_MAP = {
  'linkedinads://reference': 'marketing-api-reference.md',
  'linkedinads://analytics-fields': 'analytics-fields-reference.md',
  'linkedinads://rate-limits': 'rate-limits-and-quotas.md'
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
