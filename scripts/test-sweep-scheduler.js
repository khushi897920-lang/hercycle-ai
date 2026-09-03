/**
 * scripts/test-sweep-scheduler.js
 *
 * Comprehensive test suite for Scheduled Hyper-Parameter Sweeps.
 */

import assert from 'assert'
import {
  computeNextRunTimestamp,
  generateGridCombinations,
  generateRandomCombinations,
  registerSweep,
  executeSweepRun,
  getSweepsData,
} from '../lib/sweep-scheduler.js'

function testCronNextRunCalculation() {
  console.log('Test 1: Cron Expression Next Run Calculation')

  const baseDate = new Date('2026-08-31T14:30:00.000Z')

  // Nightly
  const nightlyNext = computeNextRunTimestamp('0 0 * * *', baseDate)
  assert.strictEqual(nightlyNext.toISOString(), '2026-09-01T00:00:00.000Z')

  // Hourly
  const hourlyNext = computeNextRunTimestamp('0 * * * *', baseDate)
  assert.strictEqual(hourlyNext.toISOString(), '2026-08-31T15:00:00.000Z')

  // Every 6 hours
  const every6hNext = computeNextRunTimestamp('0 */6 * * *', baseDate)
  assert.strictEqual(every6hNext.toISOString(), '2026-08-31T18:00:00.000Z')

  // Every 30 minutes
  const every30mNext = computeNextRunTimestamp('*/30 * * * *', baseDate)
  assert.strictEqual(every30mNext.toISOString(), '2026-08-31T15:00:00.000Z')

  console.log('  ✓ Cron next-run calculations passed.')
}

function testSearchSpaceExpansion() {
  console.log('\nTest 2: Search Space Expansion (Grid & Random)')

  const space = {
    learningRate: [0.0001, 0.0005, 0.001],
    batchSize: [32, 64],
    optimizer: ['Adam', 'AdamW'],
  }

  // Grid search: 3 x 2 x 2 = 12 combinations
  const gridCombos = generateGridCombinations(space)
  assert.strictEqual(gridCombos.length, 12, 'Grid Cartesian product must have 12 combinations')
  assert.strictEqual(gridCombos[0].learningRate, 0.0001)
  assert.strictEqual(gridCombos[0].batchSize, 32)
  assert.strictEqual(gridCombos[0].optimizer, 'Adam')

  // Random search max 5 trials
  const randomCombos = generateRandomCombinations(space, 5)
  assert.strictEqual(randomCombos.length, 5, 'Random search must return max 5 combinations')

  console.log('  ✓ Search space expansion tests passed.')
}

function testSweepRegistrationAndExecution() {
  console.log('\nTest 3: Sweep Registration & Execution Engine')

  const sweepConfig = {
    name: 'PCOD Test Grid Sweep',
    modelId: 'pcod_risk_classifier',
    modelName: 'PCOD Risk Classifier',
    sweepType: 'grid',
    cronExpression: '0 0 * * *',
    maxTrials: 6,
    hyperparameterSpace: {
      learningRate: [0.0001, 0.001],
      batchSize: [32, 64],
      optimizer: ['AdamW'],
    },
  }

  const registered = registerSweep(sweepConfig)
  assert.strictEqual(registered.name, 'PCOD Test Grid Sweep')
  assert.strictEqual(registered.status, 'scheduled')
  assert(registered.nextRunAt, 'Must have nextRunAt timestamp')

  // Execute sweep run
  const result = executeSweepRun(registered.id)
  assert.strictEqual(result.executedTrials.length, 4, 'Should execute 2 x 2 x 1 = 4 grid combinations')
  assert(result.bestTrial, 'Must identify best trial')
  assert.strictEqual(typeof result.bestTrial.accuracy, 'number')
  assert(result.bestTrial.accuracy >= 0.75, 'Accuracy must be valid')

  // Verify sweep metadata updated
  assert(result.sweep.lastRunAt, 'lastRunAt must be updated')
  assert(result.sweep.nextRunAt, 'nextRunAt must be updated for next schedule')

  const sweepsData = getSweepsData()
  assert(sweepsData.sweeps.length >= 3)
  assert(sweepsData.globalBest, 'Must provide global best hyperparameter configuration')

  console.log('  ✓ Sweep registration & execution tests passed.')
}

function runAllTests() {
  console.log('=== Running Scheduled Hyper-Parameter Sweep Test Suite ===\n')
  testCronNextRunCalculation()
  testSearchSpaceExpansion()
  testSweepRegistrationAndExecution()
  console.log('\n=== All Sweep Scheduler Tests Passed Successfully! ===')
}

runAllTests()
