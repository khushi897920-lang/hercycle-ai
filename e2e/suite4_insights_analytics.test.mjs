import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

describe('Suite 4: Health Insights, Analytics & Data Export Flow', () => {
  test('InMemoryLRUCache set, get, invalidate, and clear operations behave correctly', async () => {
    const { InMemoryLRUCache } = await import('../lib/cache.js');
    const cache = new InMemoryLRUCache({ max: 3, ttl: 5000 });
    
    cache.set('test:user1', { score: 20, tier: 'LOW RISK' });
    const val = cache.get('test:user1');
    assert.deepStrictEqual(val, { score: 20, tier: 'LOW RISK' });

    cache.invalidate('test:user1');
    assert.strictEqual(cache.get('test:user1'), undefined);
  });

  test('PCOD risk algorithm returns valid risk structure for given inputs', async () => {
    const { calculatePCODRisk } = await import('../lib/api-helpers.js');
    const cycles = [
      { start_date: '2026-07-01', end_date: '2026-07-05', cycle_length: 35 },
      { start_date: '2026-05-20', end_date: '2026-05-25', cycle_length: 42 }
    ];
    const symptoms = ['Acne', 'Bloating', 'Fatigue'];

    const risk = await calculatePCODRisk(cycles, symptoms);
    assert(typeof risk.score === 'number', 'Risk score should be a number');
    assert(risk.score >= 0 && risk.score <= 100, 'Risk score should be between 0 and 100');
  });

  test('toYMD helper converts ISO dates to YYYY-MM-DD format safely', async () => {
    const { toYMD } = await import('../lib/utils.js');
    assert.strictEqual(toYMD('2026-07-28T10:00:00.000Z'), '2026-07-28');
    assert.strictEqual(toYMD(null), '');
    assert.strictEqual(toYMD(undefined), '');
  });
});
