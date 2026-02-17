import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { getResourcesList, readResource } from './server/resources/index.js';

describe('getResourcesList', () => {
  test('returns bing ads resources', () => {
    const resources = getResourcesList();

    assert.equal(Array.isArray(resources), true);
    assert.equal(resources.length, 2);

    const uris = resources.map((resource) => resource.uri);
    assert.ok(uris.includes('bingads://reference'));
    assert.ok(uris.includes('bingads://report-columns'));
  });
});

describe('readResource', () => {
  test('reads API reference', () => {
    const resource = readResource('bingads://reference');
    assert.ok(resource.contents[0].text.includes('Base URLs'));
  });

  test('reads report columns', () => {
    const resource = readResource('bingads://report-columns');
    assert.ok(resource.contents[0].text.includes('campaign'));
  });

  test('throws on unknown resource', () => {
    assert.throws(
      () => readResource('bingads://unknown'),
      /Unknown resource/
    );
  });
});

