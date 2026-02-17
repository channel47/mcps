import { test, describe } from 'node:test';
import assert from 'node:assert';
import { getResourcesList, readResource } from './server/resources/index.js';

describe('getResourcesList', () => {
  test('returns array of resources', () => {
    const resources = getResourcesList();
    assert.ok(Array.isArray(resources));
    assert.strictEqual(resources.length, 2);
  });

  test('includes gaql reference', () => {
    const resources = getResourcesList();
    const gaql = resources.find(r => r.uri === 'gaql://reference');
    assert.ok(gaql);
    assert.strictEqual(gaql.name, 'GAQL Reference');
    assert.strictEqual(gaql.mimeType, 'text/markdown');
  });

  test('includes metrics glossary', () => {
    const resources = getResourcesList();
    const metrics = resources.find(r => r.uri === 'metrics://definitions');
    assert.ok(metrics);
    assert.strictEqual(metrics.name, 'Metrics Glossary');
    assert.strictEqual(metrics.mimeType, 'text/markdown');
  });
});

describe('readResource', () => {
  test('reads gaql reference', () => {
    const result = readResource('gaql://reference');
    assert.ok(result.contents);
    assert.strictEqual(result.contents.length, 1);
    assert.strictEqual(result.contents[0].uri, 'gaql://reference');
    assert.strictEqual(result.contents[0].mimeType, 'text/markdown');
    assert.ok(result.contents[0].text.includes('GAQL'));
  });

  test('reads metrics glossary', () => {
    const result = readResource('metrics://definitions');
    assert.ok(result.contents);
    assert.strictEqual(result.contents[0].uri, 'metrics://definitions');
    assert.ok(result.contents[0].text.includes('Metrics'));
  });

  test('throws on unknown resource', () => {
    assert.throws(
      () => readResource('unknown://resource'),
      /Unknown resource/
    );
  });
});
