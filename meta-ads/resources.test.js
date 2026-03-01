import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { getResourcesList, readResource } from './server/resources/index.js';

describe('getResourcesList', () => {
  test('returns meta ads resources', () => {
    const resources = getResourcesList();

    assert.equal(Array.isArray(resources), true);
    assert.equal(resources.length, 3);

    const uris = resources.map((resource) => resource.uri);
    assert.ok(uris.includes('metaads://reference'));
    assert.ok(uris.includes('metaads://entity-fields'));
    assert.ok(uris.includes('metaads://rate-limits'));
  });
});

describe('readResource', () => {
  test('reads api reference', () => {
    const resource = readResource('metaads://reference');
    assert.ok(resource.contents[0].text.includes('Graph API'));
  });

  test('reads entity fields reference', () => {
    const resource = readResource('metaads://entity-fields');
    assert.ok(resource.contents[0].text.includes('Entity Field Reference'));
  });

  test('reads rate limits reference', () => {
    const resource = readResource('metaads://rate-limits');
    assert.ok(resource.contents[0].text.includes('Rate Limits'));
  });

  test('throws on unknown resource', () => {
    assert.throws(
      () => readResource('metaads://unknown'),
      /Unknown resource/
    );
  });
});
