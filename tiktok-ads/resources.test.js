import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { getResourcesList, readResource } from './server/resources/index.js';

describe('getResourcesList', () => {
  test('returns tiktok ads resources', () => {
    const resources = getResourcesList();

    assert.equal(Array.isArray(resources), true);
    assert.equal(resources.length, 3);

    const uris = resources.map((resource) => resource.uri);
    assert.ok(uris.includes('tiktokads://reference'));
    assert.ok(uris.includes('tiktokads://reporting'));
    assert.ok(uris.includes('tiktokads://rate-limits'));
  });
});

describe('readResource', () => {
  test('reads api reference', () => {
    const resource = readResource('tiktokads://reference');
    assert.ok(resource.contents[0].text.includes('TikTok Business API'));
    assert.ok(resource.contents[0].text.includes('Access-Token'));
  });

  test('reads reporting reference', () => {
    const resource = readResource('tiktokads://reporting');
    assert.ok(resource.contents[0].text.includes('report/integrated/get'));
  });

  test('reads rate limits reference', () => {
    const resource = readResource('tiktokads://rate-limits');
    assert.ok(resource.contents[0].text.includes('Rate Limits'));
    assert.ok(resource.contents[0].text.includes('40100'));
  });

  test('throws on unknown resource', () => {
    assert.throws(
      () => readResource('tiktokads://unknown'),
      /Unknown resource/
    );
  });
});
