import { calculatePCODRisk } from '../lib/api-helpers.js';

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ Assertion Failed: ${message}`);
    process.exit(1);
  }
}

function runTests() {
  console.log('Running PCOD Risk Engine Recurrence Mapping Tests...\n');

  const mockCycles = [
    { start_date: '2026-04-01', cycle_length: 28 },
    { start_date: '2026-04-29', cycle_length: 28 },
    { start_date: '2026-05-27', cycle_length: 28 }
  ];

  // Test 1: Flat string array backward compatibility
  {
    const symptoms = ['acne', 'fatigue', 'bloating'];
    const res = calculatePCODRisk(mockCycles, symptoms);
    assert(res.score === 25, `Expected score 25, got ${res.score}`);
    assert(res.tier === 'LOW RISK', `Expected LOW RISK, got ${res.tier}`);
    assert(res.factors.includes('Multiple PCOD-related symptoms reported'), 'Expected multiple symptoms factor');
    console.log('✅ Test 1 Passed: Legacy flat string symptom array backward compatibility');
  }

  // Test 2: High recurrence across 90-day window (multi-month)
  {
    const dailyLogs = [
      { date: '2026-07-20', symptoms: ['acne', 'fatigue', 'bloating'] },
      { date: '2026-06-15', symptoms: ['acne', 'fatigue'] },
      { date: '2026-05-10', symptoms: ['acne', 'bloating'] }
    ];
    const res = calculatePCODRisk(mockCycles, dailyLogs);
    assert(res.score === 35, `Expected score 35, got ${res.score}`);
    assert(res.tier === 'MEDIUM RISK', `Expected MEDIUM RISK, got ${res.tier}`);
    assert(res.factors.some(f => f.includes('High symptom recurrence') || f.includes('Persistent recurrence')), 'Expected high symptom recurrence factor');
    console.log('✅ Test 2 Passed: High recurrence across 90-day multi-month window');
  }

  // Test 3: 90-day window cutoff filtering (logs older than 90 days ignored)
  {
    const dailyLogs = [
      { date: '2026-07-20', symptoms: ['acne'] },
      { date: '2026-02-01', symptoms: ['acne', 'fatigue', 'bloating', 'headache', 'hirsutism'] } // >90 days old
    ];
    const res = calculatePCODRisk(mockCycles, dailyLogs);
    // Only 1 symptom within 90 days -> 10 points score
    assert(res.score === 10, `Expected score 10 for recent log only, got ${res.score}`);
    assert(res.tier === 'LOW RISK', `Expected LOW RISK, got ${res.tier}`);
    console.log('✅ Test 3 Passed: Logs older than 90 days correctly filtered out');
  }

  // Test 4: Single highly recurring symptom (e.g. acne logged 4 times)
  {
    const dailyLogs = [
      { date: '2026-07-25', symptoms: ['acne'] },
      { date: '2026-07-20', symptoms: ['acne'] },
      { date: '2026-07-15', symptoms: ['acne'] },
      { date: '2026-07-10', symptoms: ['acne'] }
    ];
    const res = calculatePCODRisk(mockCycles, dailyLogs);
    assert(res.score === 20, `Expected score 20, got ${res.score}`);
    assert(res.factors.some(f => f.includes('Recurring PCOD symptom pattern')), 'Expected recurring pattern factor');
    console.log('✅ Test 4 Passed: Single highly recurring symptom pattern detected');
  }

  // Test 5: Combined irregular cycles + high symptom recurrence -> HIGH RISK tier
  {
    const irregularCycles = [
      { start_date: '2026-01-01', cycle_length: 22 },
      { start_date: '2026-01-23', cycle_length: 60 },
      { start_date: '2026-03-24', cycle_length: 30 },
      { start_date: '2026-04-23', cycle_length: 30 }
    ];
    const dailyLogs = [
      { date: '2026-07-20', symptoms: ['acne', 'fatigue', 'bloating'] },
      { date: '2026-06-15', symptoms: ['acne', 'fatigue', 'hirsutism'] },
      { date: '2026-05-10', symptoms: ['acne', 'weight gain'] }
    ];
    const res = calculatePCODRisk(irregularCycles, dailyLogs);
    // Cycle stdDev/range: +35 (20 irregularity + 15 range)
    // Symptoms: +35
    // Total score = 70 (capped at 85)
    assert(res.score >= 60, `Expected score >= 60, got ${res.score}`);
    assert(res.tier === 'HIGH RISK', `Expected HIGH RISK, got ${res.tier}`);
    console.log('✅ Test 5 Passed: Irregular cycles + high symptom recurrence triggers HIGH RISK tier');
  }

  console.log('\n=== All PCOD Recurrence Engine Tests Passed Successfully! ===');
}

runTests();
