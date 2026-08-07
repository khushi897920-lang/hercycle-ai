import { predictNextPeriod } from '../lib/api-helpers.js';

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ Assertion Failed: ${message}`);
    process.exit(1);
  }
}

async function runTests() {
  console.log('Running predictNextPeriod single entry validation tests...');

  const startDate = '2026-07-01';
  // Pin the clock. These assertions check cycle_length normalisation, not
  // staleness, and previously only held while the real date was on or before
  // 29 Jul 2026 — after which predictNextPeriod correctly rolls a past
  // projection forward and the hardcoded dates stopped matching.
  const today = new Date(2026, 6, 1);

  // Test 1: Normal cycle_length (e.g. 30) -> Should keep 30
  {
    const history = [{ start_date: startDate, cycle_length: 30 }];
    const res = await predictNextPeriod(history, today);
    assert(res.averageCycleLength === 30, `Expected 30, got ${res.averageCycleLength}`);
    // Expected next period date: Jul 31 (Jul 1 + 30 days)
    assert(res.nextPeriodDate.startsWith('Jul 31'), `Expected Jul 31, got ${res.nextPeriodDate}`);
    console.log('Test 1 Passed: Normal length accepted.');
  }

  // Test 2: Cycle length too high (e.g. 100) -> Should fallback to 28
  {
    const history = [{ start_date: startDate, cycle_length: 100 }];
    const res = await predictNextPeriod(history, today);
    assert(res.averageCycleLength === 28, `Expected fallback 28, got ${res.averageCycleLength}`);
    // Expected next period date: Jul 29 (Jul 1 + 28 days)
    assert(res.nextPeriodDate.startsWith('Jul 29'), `Expected Jul 29, got ${res.nextPeriodDate}`);
    console.log('Test 2 Passed: Excessively high length normalized.');
  }

  // Test 3: Cycle length too low (e.g. 10) -> Should fallback to 28
  {
    const history = [{ start_date: startDate, cycle_length: 10 }];
    const res = await predictNextPeriod(history, today);
    assert(res.averageCycleLength === 28, `Expected fallback 28, got ${res.averageCycleLength}`);
    console.log('Test 3 Passed: Excessively low length normalized.');
  }

  // Test 4: Negative cycle length (e.g. -5) -> Should fallback to 28
  {
    const history = [{ start_date: startDate, cycle_length: -5 }];
    const res = await predictNextPeriod(history, today);
    assert(res.averageCycleLength === 28, `Expected fallback 28, got ${res.averageCycleLength}`);
    console.log('Test 4 Passed: Negative length normalized.');
  }

  // Test 5: Numeric string (e.g. "32") -> Should parse and use 32
  {
    const history = [{ start_date: startDate, cycle_length: '32' }];
    const res = await predictNextPeriod(history, today);
    assert(res.averageCycleLength === 32, `Expected 32, got ${res.averageCycleLength}`);
    console.log('Test 5 Passed: Numeric string parsed successfully.');
  }

  // Test 6: Non-numeric/garbage string -> Should fallback to 28
  {
    const history = [{ start_date: startDate, cycle_length: 'garbage' }];
    const res = await predictNextPeriod(history, today);
    assert(res.averageCycleLength === 28, `Expected fallback 28, got ${res.averageCycleLength}`);
    console.log('Test 6 Passed: Garbage string normalized.');
  }

  console.log('=== All predictNextPeriod Validation Tests Passed! ===');
}

runTests().catch(err => {
  console.error(err);
  process.exit(1);
});
