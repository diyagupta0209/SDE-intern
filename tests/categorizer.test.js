import './env.js';
import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { resetEnvCache } from '../src/config/env.js';
import { categorizeTransaction } from '../src/services/llmCategorizer.js';
import { toCents } from '../src/utils/money.js';

const categories = [
  {
    _id: 'food',
    name: 'Food & Dining',
    slug: 'food-dining',
    kind: 'expense',
    keywords: ['starbucks', 'uber eats', 'coffee'],
  },
  {
    _id: 'transport',
    name: 'Transport',
    slug: 'transport',
    kind: 'expense',
    keywords: ['uber', 'metro'],
  },
  {
    _id: 'income',
    name: 'Income',
    slug: 'income',
    kind: 'income',
    keywords: ['salary', 'payroll'],
  },
  {
    _id: 'other',
    name: 'Other',
    slug: 'other',
    kind: 'both',
    keywords: [],
  },
];

describe('transaction categorizer', { concurrency: 1 }, () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    process.env.LLM_API_KEY = '';
    resetEnvCache();
  });

  it('keeps money amounts as integer cents', () => {
    assert.equal(toCents('10'), 1000);
    assert.equal(toCents('10.5'), 1050);
    assert.equal(toCents(10.5), 1050);
    assert.throws(() => toCents('10.555'), /2 decimal/);
    assert.throws(() => toCents('0'), /greater than zero/);
  });

  it('picks the longest keyword that fits the transaction type', async () => {
    const food = await categorizeTransaction({
      description: 'Uber Eats lunch',
      amount: '12.00',
      type: 'expense',
    }, categories);
    assert.equal(food.category, 'Food & Dining');
    assert.equal(food.source, 'rules');

    const ride = await categorizeTransaction({
      description: 'Uber ride to the airport',
      amount: '18.00',
      type: 'expense',
    }, categories);
    assert.equal(ride.category, 'Transport');

    const salary = await categorizeTransaction({
      description: 'Monthly salary',
      amount: '5000.00',
      type: 'income',
    }, categories);
    assert.equal(salary.category, 'Income');
  });

  it('uses an OpenAI-compatible response when an API key is configured', async () => {
    process.env.LLM_API_KEY = 'sk-test';
    resetEnvCache();
    globalThis.fetch = async (url, options) => {
      assert.equal(url, 'https://llm.example.test/v1/chat/completions');
      assert.equal(options.headers.Authorization, 'Bearer sk-test');
      const body = JSON.parse(options.body);
      assert.equal(body.model, 'test-model');
      assert.equal(body.messages[1].content.includes('vague merchant'), true);
      return {
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: JSON.stringify({
                category: 'Transport',
                confidence: 0.93,
                reason: 'Ride hail',
              }),
            },
          }],
        }),
      };
    };

    const result = await categorizeTransaction({
      description: 'vague merchant charge',
      amount: '15.00',
      type: 'expense',
    }, categories);
    assert.equal(result.source, 'llm');
    assert.equal(result.category, 'Transport');
    assert.equal(result.categoryId, 'transport');
    assert.equal(result.confidence, 0.93);
  });

  it('falls back to keyword rules when the model returns an unknown category or errors', async () => {
    process.env.LLM_API_KEY = 'sk-test';
    resetEnvCache();

    globalThis.fetch = async () => ({
      ok: true,
      json: async () => ({
        choices: [{
          message: { content: JSON.stringify({ category: 'Spaceships', confidence: 0.4, reason: 'nope' }) },
        }],
      }),
    });
    const unknown = await categorizeTransaction({
      description: 'Coffee at Starbucks',
      amount: '5.00',
      type: 'expense',
    }, categories);
    assert.equal(unknown.source, 'rules');
    assert.equal(unknown.category, 'Food & Dining');

    globalThis.fetch = async () => ({ ok: false, status: 503, text: async () => 'unavailable' });
    const failed = await categorizeTransaction({
      description: 'Metro card',
      amount: '2.00',
      type: 'expense',
    }, categories);
    assert.equal(failed.category, 'Transport');
    assert.equal(failed.source, 'rules');
  });
});
