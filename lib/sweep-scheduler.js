/**
 * lib/sweep-scheduler.js
 *
 * Engine for scheduling, executing, and monitoring hyper-parameter sweeps
 * (Grid Search and Random Search) for HerCycle AI ML models.
 */

import crypto from 'crypto'

/**
 * Parses cron expression or preset and computes the next execution timestamp.
 *
 * @param {string} cronExpr Standard 5-field cron string or alias (e.g., '0 0 * * *', '@nightly', '0 /6 * * *')
 * @param {Date} [fromDate] Base date (defaults to now)
 * @returns {Date} Deterministic next run timestamp
 */
export function computeNextRunTimestamp(cronExpr, fromDate = new Date()) {
  const base = new Date(fromDate.getTime())
  const expr = (cronExpr || '').trim().toLowerCase()

  if (expr === '@nightly' || expr === '0 0 * * *') {
    // Next midnight UTC
    const next = new Date(base)
    next.setUTCHours(24, 0, 0, 0)
    return next
  }

  if (expr === '@hourly' || expr === '0 * * * *') {
    const next = new Date(base)
    next.setUTCHours(next.getUTCHours() + 1, 0, 0, 0)
    return next
  }

  if (expr.includes('*/6') || expr === 'every_6h') {
    const next = new Date(base)
    const currentHours = next.getUTCHours()
    const nextInterval = (Math.floor(currentHours / 6) + 1) * 6
    next.setUTCHours(nextInterval, 0, 0, 0)
    return next
  }

  if (expr.includes('*/12') || expr === 'every_12h') {
    const next = new Date(base)
    const currentHours = next.getUTCHours()
    const nextInterval = (Math.floor(currentHours / 12) + 1) * 12
    next.setUTCHours(nextInterval, 0, 0, 0)
    return next
  }

  if (expr.includes('*/30') || expr === 'every_30m') {
    const next = new Date(base)
    const currentMins = next.getUTCMinutes()
    const nextInterval = (Math.floor(currentMins / 30) + 1) * 30
    if (nextInterval >= 60) {
      next.setUTCHours(next.getUTCHours() + 1, 0, 0, 0)
    } else {
      next.setUTCMinutes(nextInterval, 0, 0)
    }
    return next
  }

  // Default fallback: 24 hours from base
  return new Date(base.getTime() + 24 * 60 * 60 * 1000)
}

/**
 * Expands hyperparameter search space into Cartesian product for Grid Search.
 *
 * @param {Record<string, Array<any>>} space
 * @returns {Array<Record<string, any>>}
 */
export function generateGridCombinations(space = {}) {
  const keys = Object.keys(space)
  if (keys.length === 0) return [{}]

  let combinations = [{}]
  for (const key of keys) {
    const values = Array.isArray(space[key]) ? space[key] : [space[key]]
    const nextCombos = []
    for (const combo of combinations) {
      for (const val of values) {
        nextCombos.push({ ...combo, [key]: val })
      }
    }
    combinations = nextCombos
  }
  return combinations
}

/**
 * Generates N random hyperparameter combinations from search space.
 *
 * @param {Record<string, Array<any>>} space
 * @param {number} maxTrials
 * @returns {Array<Record<string, any>>}
 */
export function generateRandomCombinations(space = {}, maxTrials = 10) {
  const grid = generateGridCombinations(space)
  if (grid.length <= maxTrials) return grid

  // Shuffle grid and take top maxTrials
  const shuffled = [...grid].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, maxTrials)
}

/**
 * In-memory storage bag for sweeps and trial results.
 */
const SWEEPS_REGISTRY = [
  {
    id: 'sweep-001',
    name: 'PCOD Nightly Grid Sweep',
    modelId: 'pcod_risk_classifier',
    modelName: 'PCOD Risk Classifier',
    sweepType: 'grid',
    cronExpression: '0 0 * * *',
    hyperparameterSpace: {
      learningRate: [0.0001, 0.0005, 0.001],
      batchSize: [32, 64],
      optimizer: ['Adam', 'AdamW'],
    },
    maxTrials: 12,
    status: 'scheduled',
    lastRunAt: '2026-08-30T00:00:00.000Z',
    nextRunAt: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
    bestTrial: {
      trialIndex: 5,
      hyperparameters: { learningRate: 0.0001, batchSize: 32, optimizer: 'AdamW' },
      accuracy: 0.928,
      loss: 0.215,
      valLoss: 0.231,
    },
    createdAt: '2026-08-25T10:00:00.000Z',
  },
  {
    id: 'sweep-002',
    name: 'Cycle Regressor 6-Hour Random Sweep',
    modelId: 'cycle_length_regressor',
    modelName: 'Cycle Length Predictor',
    sweepType: 'random',
    cronExpression: '0 */6 * * *',
    hyperparameterSpace: {
      learningRate: [0.0001, 0.0005, 0.001, 0.01],
      batchSize: [32, 64, 128],
      optimizer: ['AdamW', 'SGD'],
    },
    maxTrials: 6,
    status: 'scheduled',
    lastRunAt: '2026-08-31T12:00:00.000Z',
    nextRunAt: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
    bestTrial: {
      trialIndex: 3,
      hyperparameters: { learningRate: 0.0001, batchSize: 64, optimizer: 'AdamW' },
      accuracy: 0.902,
      loss: 0.268,
      valLoss: 0.289,
    },
    createdAt: '2026-08-28T14:00:00.000Z',
  },
]

const SWEEP_TRIALS = [
  {
    id: 'trial-001-1',
    sweepId: 'sweep-001',
    trialIndex: 1,
    hyperparameters: { learningRate: 0.001, batchSize: 32, optimizer: 'Adam' },
    accuracy: 0.842,
    loss: 0.385,
    valLoss: 0.412,
    createdAt: '2026-08-30T00:01:00.000Z',
  },
  {
    id: 'trial-001-2',
    sweepId: 'sweep-001',
    trialIndex: 2,
    hyperparameters: { learningRate: 0.001, batchSize: 64, optimizer: 'Adam' },
    accuracy: 0.865,
    loss: 0.342,
    valLoss: 0.368,
    createdAt: '2026-08-30T00:02:00.000Z',
  },
  {
    id: 'trial-001-5',
    sweepId: 'sweep-001',
    trialIndex: 5,
    hyperparameters: { learningRate: 0.0001, batchSize: 32, optimizer: 'AdamW' },
    accuracy: 0.928,
    loss: 0.215,
    valLoss: 0.231,
    createdAt: '2026-08-30T00:05:00.000Z',
  },
]

/**
 * Registers a new scheduled hyperparameter sweep.
 *
 * @param {object} config Sweep config object
 * @returns {object} Registered sweep
 */
export function registerSweep(config) {
  const { name, modelId, modelName, sweepType, cronExpression, hyperparameterSpace, maxTrials } = config

  const now = new Date()
  const nextRunAt = computeNextRunTimestamp(cronExpression, now).toISOString()

  const sweep = {
    id: `sweep-${Date.now().toString(36)}`,
    name: name || `${modelName || modelId} Sweep`,
    modelId: modelId || 'pcod_risk_classifier',
    modelName: modelName || 'PCOD Risk Classifier',
    sweepType: sweepType === 'random' ? 'random' : 'grid',
    cronExpression: cronExpression || '0 0 * * *',
    hyperparameterSpace: hyperparameterSpace || {
      learningRate: [0.0001, 0.0005, 0.001],
      batchSize: [32, 64],
    },
    maxTrials: Number(maxTrials) || 10,
    status: 'scheduled',
    lastRunAt: null,
    nextRunAt,
    bestTrial: null,
    createdAt: now.toISOString(),
  }

  SWEEPS_REGISTRY.push(sweep)
  return sweep
}

/**
 * Simulates / executes a sweep run, evaluating parameter combinations and updating best trial.
 *
 * @param {string} sweepId
 * @returns {object} Execution result with evaluated trials and new best trial
 */
export function executeSweepRun(sweepId) {
  const sweep = SWEEPS_REGISTRY.find((s) => s.id === sweepId)
  if (!sweep) {
    throw new Error(`Sweep with ID ${sweepId} not found`)
  }

  const combinations =
    sweep.sweepType === 'grid'
      ? generateGridCombinations(sweep.hyperparameterSpace)
      : generateRandomCombinations(sweep.hyperparameterSpace, sweep.maxTrials)

  const newTrials = []
  let bestTrial = sweep.bestTrial || null

  combinations.slice(0, sweep.maxTrials).forEach((params, idx) => {
    // Evaluation heuristic: smaller learning rates & AdamW give higher accuracy
    const lr = params.learningRate || 0.001
    const opt = params.optimizer || 'Adam'
    const bs = params.batchSize || 32

    let baseAcc = 0.82
    if (lr <= 0.0001) baseAcc += 0.08
    else if (lr <= 0.0005) baseAcc += 0.05
    if (opt === 'AdamW') baseAcc += 0.03
    if (bs === 32 || bs === 64) baseAcc += 0.02

    const noise = (Math.random() - 0.5) * 0.02
    const accuracy = Number(Math.min(0.96, Math.max(0.75, baseAcc + noise)).toFixed(3))
    const loss = Number((0.85 - accuracy * 0.65).toFixed(3))
    const valLoss = Number((loss + 0.02).toFixed(3))

    const trialRecord = {
      id: `trial-${sweep.id}-${idx + 1}`,
      sweepId: sweep.id,
      trialIndex: idx + 1,
      hyperparameters: params,
      accuracy,
      loss,
      valLoss,
      createdAt: new Date().toISOString(),
    }

    newTrials.push(trialRecord)
    SWEEP_TRIALS.push(trialRecord)

    if (!bestTrial || accuracy > bestTrial.accuracy) {
      bestTrial = trialRecord
    }
  })

  const now = new Date()
  sweep.lastRunAt = now.toISOString()
  sweep.nextRunAt = computeNextRunTimestamp(sweep.cronExpression, now).toISOString()
  sweep.bestTrial = bestTrial

  return {
    sweep,
    executedTrials: newTrials,
    bestTrial,
  }
}

/**
 * Returns all scheduled sweeps and trial history.
 */
export function getSweepsData() {
  // Sort sweeps by created_at desc
  const sweeps = [...SWEEPS_REGISTRY].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))

  // Find global best configuration across all completed sweeps
  let globalBest = null
  sweeps.forEach((s) => {
    if (s.bestTrial && (!globalBest || s.bestTrial.accuracy > globalBest.accuracy)) {
      globalBest = {
        modelId: s.modelId,
        modelName: s.modelName,
        sweepName: s.name,
        ...s.bestTrial,
      }
    }
  })

  return {
    sweeps,
    trials: SWEEP_TRIALS,
    globalBest,
  }
}
