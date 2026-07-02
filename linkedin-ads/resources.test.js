import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { getResourcesList, readResource } from './server/resources/index.js';

describe('getResourcesList', () => {
  test('returns linkedin ads resources', () => {
    const resources = getResourcesList();

    assert.equal(Array.isArray(resources), true);
    assert.equal(resources.length, 3);

    const uris = resources.map((resource) => resource.uri);
    assert.ok(uris.includes('linkedinads://reference'));
    assert.ok(uris.includes('linkedinads://analytics-fields'));
    assert.ok(uris.includes('linkedinads://rate-limits'));
  });
});

describe('readResource', () => {
  test('reads api reference', () => {
    const resource = readResource('linkedinads://reference');
    assert.ok(resource.contents[0].text.includes('LinkedIn Marketing API'));
    assert.ok(resource.contents[0].text.includes('X-Restli-Protocol-Version'));
  });

  test('reads analytics fields reference', () => {
    const resource = readResource('linkedinads://analytics-fields');
    assert.ok(resource.contents[0].text.includes('Analytics Field Reference'));
    assert.ok(resource.contents[0].text.includes('costInLocalCurrency'));
  });

  test('reads rate limits reference', () => {
    const resource = readResource('linkedinads://rate-limits');
    assert.ok(resource.contents[0].text.includes('Rate Limits'));
  });

  test('throws on unknown resource', () => {
    assert.throws(
      () => readResource('linkedinads://unknown'),
      /Unknown resource/
    );
  });
});
