import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { getResourcesList, readResource } from './server/resources/index.js';

describe('getResourcesList', () => {
  test('returns pinterest ads resources', () => {
    const resources = getResourcesList();

    assert.equal(Array.isArray(resources), true);
    assert.equal(resources.length, 3);

    const uris = resources.map((resource) => resource.uri);
    assert.ok(uris.includes('pinterestads://reference'));
    assert.ok(uris.includes('pinterestads://analytics-columns'));
    assert.ok(uris.includes('pinterestads://rate-limits'));
  });
});

describe('readResource', () => {
  test('reads api reference', () => {
    const resource = readResource('pinterestads://reference');
    assert.ok(resource.contents[0].text.includes('https://api.pinterest.com/v5'));
    assert.ok(resource.contents[0].text.includes('bookmark'));
  });

  test('reads analytics columns reference', () => {
    const resource = readResource('pinterestads://analytics-columns');
    assert.ok(resource.contents[0].text.includes('Analytics Columns Reference'));
    assert.ok(resource.contents[0].text.includes('SPEND_IN_DOLLAR'));
  });

  test('reads rate limits reference', () => {
    const resource = readResource('pinterestads://rate-limits');
    assert.ok(resource.contents[0].text.includes('Rate Limits'));
  });

  test('throws on unknown resource', () => {
    assert.throws(
      () => readResource('pinterestads://unknown'),
      /Unknown resource/
    );
  });
});
