import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const RESOURCES = [
  {
    uri: 'metaads://reference',
    name: 'Meta Ads Graph API Reference',
    description: 'Core Graph API endpoints, query parameters, and error handling notes for Meta Ads workflows',
    mimeType: 'text/markdown'
  }
];

const RESOURCE_FILE_MAP = {
  'metaads://reference': 'graph-api-reference.md'
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
