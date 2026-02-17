import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Resource definitions for MCP
 */
export const RESOURCES = [
  {
    uri: 'gaql://reference',
    name: 'GAQL Reference',
    description: 'Google Ads Query Language syntax reference with examples',
    mimeType: 'text/markdown'
  },
  {
    uri: 'metrics://definitions',
    name: 'Metrics Glossary',
    description: 'Google Ads metrics definitions and calculations',
    mimeType: 'text/markdown'
  }
];

/**
 * Read a resource by URI
 * @param {string} uri - Resource URI
 * @returns {Object} Resource content
 */
export function readResource(uri) {
  const resourceMap = {
    'gaql://reference': 'gaql-reference.md',
    'metrics://definitions': 'metrics-glossary.md'
  };

  const filename = resourceMap[uri];
  if (!filename) {
    throw new Error(`Unknown resource: ${uri}. Available: ${Object.keys(resourceMap).join(', ')}`);
  }

  const filePath = join(__dirname, filename);

  try {
    const content = readFileSync(filePath, 'utf-8');

    return {
      contents: [
        {
          uri: uri,
          mimeType: 'text/markdown',
          text: content
        }
      ]
    };
  } catch (error) {
    throw new Error(`Failed to read resource ${uri}: ${error.message}`);
  }
}

/**
 * Get list of available resources
 * @returns {Array} Resource definitions
 */
export function getResourcesList() {
  return RESOURCES;
}
