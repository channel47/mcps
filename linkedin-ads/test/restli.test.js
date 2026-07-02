import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import {
  buildQueryString,
  encodeRestliValue,
  isRawParam,
  rawParam,
  restliDate,
  restliDateRange,
  restliList,
  restliSearchFilter
} from '../server/utils/restli.js';

describe('encodeRestliValue', () => {
  test('percent-encodes URN colons', () => {
    assert.equal(
      encodeRestliValue('urn:li:sponsoredCampaign:123'),
      'urn%3Ali%3AsponsoredCampaign%3A123'
    );
  });

  test('encodes characters encodeURIComponent leaves bare', () => {
    assert.equal(encodeRestliValue("a(b)'c!*"), 'a%28b%29%27c%21%2A');
  });

  test('leaves plain enum values untouched', () => {
    assert.equal(encodeRestliValue('ACTIVE'), 'ACTIVE');
  });
});

describe('restliList', () => {
  test('joins encoded items with literal commas', () => {
    assert.equal(
      restliList(['urn:li:sponsoredCampaign:1', 'urn:li:sponsoredCampaign:2']),
      'List(urn%3Ali%3AsponsoredCampaign%3A1,urn%3Ali%3AsponsoredCampaign%3A2)'
    );
  });

  test('wraps a single non-array value', () => {
    assert.equal(restliList('ACTIVE'), 'List(ACTIVE)');
  });
});

describe('restliDate / restliDateRange', () => {
  test('builds date expression without leading zeros', () => {
    assert.equal(restliDate('2026-06-01'), '(year:2026,month:6,day:1)');
  });

  test('builds full date range', () => {
    assert.equal(
      restliDateRange('2026-06-01', '2026-06-30'),
      '(start:(year:2026,month:6,day:1),end:(year:2026,month:6,day:30))'
    );
  });

  test('omits end when not provided', () => {
    assert.equal(restliDateRange('2026-06-01'), '(start:(year:2026,month:6,day:1))');
  });

  test('rejects malformed dates', () => {
    assert.throws(() => restliDateRange('06/01/2026'), /Expected YYYY-MM-DD/);
    assert.throws(() => restliDateRange('2026-13-01'), /Invalid start date value/);
  });
});

describe('restliSearchFilter', () => {
  test('builds single-field filter', () => {
    assert.equal(
      restliSearchFilter({ status: ['ACTIVE', 'PAUSED'] }),
      '(status:(values:List(ACTIVE,PAUSED)))'
    );
  });

  test('builds multi-field filter and skips empty fields', () => {
    assert.equal(
      restliSearchFilter({ status: ['ACTIVE'], type: ['BUSINESS'], reference: [] }),
      '(status:(values:List(ACTIVE)),type:(values:List(BUSINESS)))'
    );
  });

  test('returns null when no clause remains', () => {
    assert.equal(restliSearchFilter({ status: [] }), null);
    assert.equal(restliSearchFilter({}), null);
  });
});

describe('buildQueryString', () => {
  test('encodes plain values and inserts raw params verbatim', () => {
    const queryString = buildQueryString({
      q: 'analytics',
      dateRange: rawParam('(start:(year:2026,month:6,day:1))'),
      pageToken: 'a b/c'
    });

    assert.equal(
      queryString,
      'q=analytics&dateRange=(start:(year:2026,month:6,day:1))&pageToken=a%20b%2Fc'
    );
  });

  test('renders arrays as List with encoded URN items', () => {
    const queryString = buildQueryString({
      campaigns: ['urn:li:sponsoredCampaign:123']
    });

    assert.equal(queryString, 'campaigns=List(urn%3Ali%3AsponsoredCampaign%3A123)');
  });

  test('does not double-encode raw Rest.li expressions', () => {
    const queryString = buildQueryString({
      search: rawParam('(status:(values:List(ACTIVE)))')
    });

    assert.doesNotMatch(queryString, /%28|%3A|%2C/);
    assert.equal(queryString, 'search=(status:(values:List(ACTIVE)))');
  });

  test('skips null, undefined, and empty values', () => {
    const queryString = buildQueryString({
      q: 'search',
      search: null,
      pageToken: undefined,
      pageSize: '',
      count: 0
    });

    assert.equal(queryString, 'q=search&count=0');
  });

  test('returns empty string for empty params', () => {
    assert.equal(buildQueryString({}), '');
    assert.equal(buildQueryString(), '');
  });
});

describe('rawParam', () => {
  test('marks values as raw', () => {
    assert.equal(isRawParam(rawParam('x')), true);
    assert.equal(isRawParam('x'), false);
  });
});
