import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { getPromptsList, renderPrompt } from './server/prompts/templates.js';

describe('getPromptsList', () => {
  test('returns expected prompts', () => {
    const prompts = getPromptsList();
    assert.equal(Array.isArray(prompts), true);
    assert.equal(prompts.length, 3);

    const names = prompts.map((prompt) => prompt.name);
    assert.deepEqual(names.sort(), ['account_performance_audit', 'creative_fatigue_check', 'spend_pacing_check']);
  });
});

describe('renderPrompt', () => {
  test('renders spend pacing check with advertiser id', () => {
    const result = renderPrompt('spend_pacing_check', { advertiser_id: '7000000000000000001' });
    const text = result.messages[0].content.text;

    assert.ok(text.includes('7000000000000000001'));
    assert.ok(text.includes('spend pacing check'));
  });

  test('applies default values for optional arguments', () => {
    const result = renderPrompt('creative_fatigue_check', { advertiser_id: '123' });
    const text = result.messages[0].content.text;

    assert.ok(text.includes('last 14 days'));
  });

  test('overrides defaults when arguments are provided', () => {
    const result = renderPrompt('account_performance_audit', {
      advertiser_id: '123',
      lookback_days: '90'
    });
    const text = result.messages[0].content.text;

    assert.ok(text.includes('last 90 days'));
  });

  test('throws on missing required arguments', () => {
    assert.throws(
      () => renderPrompt('spend_pacing_check', {}),
      /Missing required arguments/
    );
  });

  test('throws on unknown prompt', () => {
    assert.throws(
      () => renderPrompt('unknown', {}),
      /Unknown prompt/
    );
  });
});
