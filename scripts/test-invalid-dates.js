import { predictNextPeriod } from '../lib/api-helpers.js';

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ Assertion Failed: ${message}`);
    process.exit(1);
  }
}

function runTests() {
  console.log('Running invalid date validation tests for predictNextPeriod...');

  // Test 1: Empty array input -> Should return default prediction
  {
    const res = predictNextPeriod([]);
    assert(res.averageCycleLength === 28, 'Expected averageCycleLength to be 28');
    assert(res.confidence === '0%', 'Expected confidence to be 0%');
    console.log('Test 1 Passed: Empty array input.');
  }

  // Test 2: Falsy entries / malformed objects -> Should ignore and return default prediction
  {
    const res = predictNextPeriod([null, undefined, {}, { start_date: null }]);
    assert(res.averageCycleLength === 28, 'Expected averageCycleLength to be 28');
    assert(res.confidence === '0%', 'Expected confidence to be 0%');
    console.log('Test 2 Passed: Falsy entries and missing fields handled.');
  }

  // Test 3: Completely invalid start_dates -> Should ignore and return default prediction
  {
    const res = predictNextPeriod([
      { start_date: 'invalid-date' },
      { start_date: 'hello-world' }
    ]);
    assert(res.averageCycleLength === 28, 'Expected averageCycleLength to be 28');
    assert(res.confidence === '0%', 'Expected confidence to be 0%');
    console.log('Test 3 Passed: Completely invalid start_dates ignored.');
  }

  // Test 4: Mix of valid and invalid dates -> Should process only valid dates
  {
    // One valid date, two invalid dates -> should fallback to single cycle entry behavior
    const res = predictNextPeriod([
      { start_date: 'invalid-date' },
      { start_date: '2026-07-01', cycle_length: 30 },
      { start_date: 'garbage-date-again' }
    ]);
    assert(res.averageCycleLength === 30, 'Expected averageCycleLength to be 30');
    assert(res.confidence === '75%', 'Expected confidence to be 75%');
    assert(res.nextPeriodDate.startsWith('Jul 31'), 'Expected next period: Jul 31');
    console.log('Test 4 Passed: Mix of valid and invalid dates processed.');
  }

  // Test 5: Multi-cycle with invalid dates intermixed
  {
    // Two valid dates, one invalid date
    const res = predictNextPeriod([
      { start_date: '2026-07-01', cycle_length: 30 },
      { start_date: 'invalid-date' },
      { start_date: '2026-07-31', cycle_length: 30 }
    ]);
    // Gap days: Jul 31 - Jul 1 = 30 days
    assert(res.averageCycleLength === 30, `Expected averageCycleLength to be 30, got ${res.averageCycleLength}`);
    console.log('Test 5 Passed: Multi-cycle with invalid dates intermixed.');
  }

  console.log('=== All Invalid Date Validation Tests Passed Successfully! ===');
}

runTests();
