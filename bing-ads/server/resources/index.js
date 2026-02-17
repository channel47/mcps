import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const RESOURCES = [
  {
    uri: 'bingads://reference',
    name: 'Bing Ads API Reference',
    description: 'Microsoft Advertising REST endpoint and auth reference',
    mimeType: 'text/markdown'
  },
  {
    uri: 'bingads://report-columns',
    name: 'Bing Ads Report Columns',
    description: 'Suggested columns by report type for the report tool',
    mimeType: 'text/markdown'
  }
];

const RESOURCE_FILE_MAP = {
  'bingads://reference': 'api-reference.md',
  'bingads://report-columns': 'report-columns.md'
};

export function getResourcesList() {
  return RESOURCES;
}

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

