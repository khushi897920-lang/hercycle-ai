/**
 * lib/dashboard-metrics.js
 * 
 * Engine for querying, filtering, and aggregating model performance metrics
 * (accuracy, loss, inference time, hyper-parameters) for HerCycle AI ML models.
 */

// Mock dataset registry with version hashes and preprocessing metadata
export const MOCK_DATASETS = [
  {
    id: 'ds-pcod-v1',
    name: 'pcod_v1',
    versionHash: 'a1b2c3d4e5f67890123456789abcdef0123456789abcdef0123456789abcdef0',
    sampleCount: 1000,
    createdAt: '2026-07-25T10:00:00Z',
    preprocessingMetadata: {
      steps: ['Deduplication', 'Binary Symptom Encoding', 'Risk Score Tiering'],
      parameters: { min_gap_days: 20, seed: 42 }
    }
  },
  {
    id: 'ds-pcod-v2',
    name: 'pcod_v2',
    versionHash: 'b2c3d4e5f67890123456789abcdef0123456789abcdef0123456789abcdef01',
    sampleCount: 2500,
    createdAt: '2026-08-10T14:30:00Z',
    preprocessingMetadata: {
      steps: ['Deduplication', 'IQR Outlier Clipping', 'Binary Symptom Encoding', 'SMOTE Oversampling'],
      parameters: { min_gap_days: 20, iqr_multiplier: 2.5, smote_k: 5 }
    }
  },
  {
    id: 'ds-cycle-v1',
    name: 'cycle_v1',
    versionHash: 'c3d4e5f67890123456789abcdef0123456789abcdef0123456789abcdef012',
    sampleCount: 1200,
    createdAt: '2026-07-28T09:00:00Z',
    preprocessingMetadata: {
      steps: ['Chronological Sorting', 'Deduplication (20-day threshold)'],
      parameters: { min_gap_days: 20 }
    }
  },
  {
    id: 'ds-cycle-v2',
    name: 'cycle_v2',
    versionHash: 'd4e5f67890123456789abcdef0123456789abcdef0123456789abcdef0123',
    sampleCount: 3000,
    createdAt: '2026-08-14T11:15:00Z',
    preprocessingMetadata: {
      steps: ['Chronological Sorting', 'Deduplication (20-day threshold)', 'IQR Outlier Filtering (2.5 std)'],
      parameters: { min_gap_days: 20, std_threshold: 2.5 }
    }
  },
  {
    id: 'ds-symptoms-v1',
    name: 'symptoms_v1',
    versionHash: 'e5f67890123456789abcdef0123456789abcdef0123456789abcdef01234',
    sampleCount: 800,
    createdAt: '2026-08-01T12:00:00Z',
    preprocessingMetadata: {
      steps: ['Frequency Vectorization', 'TF-IDF Normalization'],
      parameters: { max_features: 50 }
    }
  },
  {
    id: 'ds-symptoms-v2',
    name: 'symptoms_v2',
    versionHash: 'f67890123456789abcdef0123456789abcdef0123456789abcdef012345',
    sampleCount: 1800,
    createdAt: '2026-08-16T15:45:00Z',
    preprocessingMetadata: {
      steps: ['Frequency Vectorization', 'TF-IDF Normalization', 'Co-occurrence Matrix Weighting'],
      parameters: { max_features: 100 }
    }
  },
  {
    id: 'ds-mood-v1',
    name: 'mood_v1',
    versionHash: '7890123456789abcdef0123456789abcdef0123456789abcdef0123456',
    sampleCount: 1500,
    createdAt: '2026-08-05T16:20:00Z',
    preprocessingMetadata: {
      steps: ['Multi-class One-Hot Label Encoding', 'Min-Max Latency Scaling'],
      parameters: { num_classes: 4 }
    }
  }
]

// Comprehensive sample evaluation log database of model training and evaluation runs
export const MOCK_TRAINING_LOGS = [
  // PCOD Risk Classifier runs
  {
    id: 'run-pcod-001',
    modelId: 'pcod_risk_classifier',
    modelName: 'PCOD Risk Classifier',
    dataset: 'pcod_v1',
    timestamp: '2026-08-01T08:30:00Z',
    date: '2026-08-01',
    accuracy: 0.842,
    loss: 0.385,
    valLoss: 0.412,
    inferenceTimeMs: 18.5,
    precision: 0.835,
    recall: 0.840,
    f1Score: 0.837,
    hyperparameters: { learningRate: 0.001, batchSize: 32, optimizer: 'Adam', epochs: 50 },
    confusionMatrix: {
      labels: ['Low Risk', 'Medium Risk', 'High Risk'],
      values: [
        [120, 15, 5],
        [10, 110, 12],
        [4, 14, 96]
      ]
    }
  },
  {
    id: 'run-pcod-002',
    modelId: 'pcod_risk_classifier',
    modelName: 'PCOD Risk Classifier',
    dataset: 'pcod_v1',
    timestamp: '2026-08-05T11:15:00Z',
    date: '2026-08-05',
    accuracy: 0.865,
    loss: 0.342,
    valLoss: 0.368,
    inferenceTimeMs: 16.2,
    precision: 0.860,
    recall: 0.862,
    f1Score: 0.861,
    hyperparameters: { learningRate: 0.001, batchSize: 64, optimizer: 'Adam', epochs: 50 },
    confusionMatrix: {
      labels: ['Low Risk', 'Medium Risk', 'High Risk'],
      values: [
        [125, 11, 4],
        [8, 116, 8],
        [3, 11, 100]
      ]
    }
  },
  {
    id: 'run-pcod-003',
    modelId: 'pcod_risk_classifier',
    modelName: 'PCOD Risk Classifier',
    dataset: 'pcod_v2',
    timestamp: '2026-08-12T14:20:00Z',
    date: '2026-08-12',
    accuracy: 0.898,
    loss: 0.284,
    valLoss: 0.301,
    inferenceTimeMs: 14.8,
    precision: 0.894,
    recall: 0.895,
    f1Score: 0.894,
    hyperparameters: { learningRate: 0.0005, batchSize: 32, optimizer: 'AdamW', epochs: 100 },
    confusionMatrix: {
      labels: ['Low Risk', 'Medium Risk', 'High Risk'],
      values: [
        [132, 6, 2],
        [5, 122, 5],
        [2, 7, 105]
      ]
    }
  },
  {
    id: 'run-pcod-004',
    modelId: 'pcod_risk_classifier',
    modelName: 'PCOD Risk Classifier',
    dataset: 'pcod_v2',
    timestamp: '2026-08-20T09:45:00Z',
    date: '2026-08-20',
    accuracy: 0.914,
    loss: 0.241,
    valLoss: 0.258,
    inferenceTimeMs: 13.5,
    precision: 0.910,
    recall: 0.912,
    f1Score: 0.911,
    hyperparameters: { learningRate: 0.0005, batchSize: 64, optimizer: 'AdamW', epochs: 100 },
    confusionMatrix: {
      labels: ['Low Risk', 'Medium Risk', 'High Risk'],
      values: [
        [135, 4, 1],
        [4, 124, 4],
        [1, 5, 108]
      ]
    }
  },
  {
    id: 'run-pcod-005',
    modelId: 'pcod_risk_classifier',
    modelName: 'PCOD Risk Classifier',
    dataset: 'pcod_v2',
    timestamp: '2026-08-26T16:00:00Z',
    date: '2026-08-26',
    accuracy: 0.928,
    loss: 0.215,
    valLoss: 0.231,
    inferenceTimeMs: 12.9,
    precision: 0.925,
    recall: 0.927,
    f1Score: 0.926,
    hyperparameters: { learningRate: 0.0001, batchSize: 32, optimizer: 'AdamW', epochs: 150 },
    confusionMatrix: {
      labels: ['Low Risk', 'Medium Risk', 'High Risk'],
      values: [
        [137, 3, 0],
        [3, 126, 3],
        [1, 4, 109]
      ]
    }
  },

  // Cycle Length Regressor runs
  {
    id: 'run-cycle-001',
    modelId: 'cycle_length_regressor',
    modelName: 'Cycle Length Predictor',
    dataset: 'cycle_v1',
    timestamp: '2026-08-02T10:00:00Z',
    date: '2026-08-02',
    accuracy: 0.795,
    loss: 0.512,
    valLoss: 0.548,
    inferenceTimeMs: 9.4,
    precision: 0.790,
    recall: 0.792,
    f1Score: 0.791,
    hyperparameters: { learningRate: 0.01, batchSize: 32, optimizer: 'SGD', epochs: 40 },
    confusionMatrix: {
      labels: ['Short (<24d)', 'Normal (24-35d)', 'Long (>35d)'],
      values: [
        [85, 18, 2],
        [14, 180, 16],
        [3, 15, 75]
      ]
    }
  },
  {
    id: 'run-cycle-002',
    modelId: 'cycle_length_regressor',
    modelName: 'Cycle Length Predictor',
    dataset: 'cycle_v1',
    timestamp: '2026-08-08T13:30:00Z',
    date: '2026-08-08',
    accuracy: 0.838,
    loss: 0.420,
    valLoss: 0.445,
    inferenceTimeMs: 8.8,
    precision: 0.831,
    recall: 0.835,
    f1Score: 0.833,
    hyperparameters: { learningRate: 0.001, batchSize: 32, optimizer: 'Adam', epochs: 60 },
    confusionMatrix: {
      labels: ['Short (<24d)', 'Normal (24-35d)', 'Long (>35d)'],
      values: [
        [90, 12, 1],
        [10, 192, 11],
        [2, 10, 81]
      ]
    }
  },
  {
    id: 'run-cycle-003',
    modelId: 'cycle_length_regressor',
    modelName: 'Cycle Length Predictor',
    dataset: 'cycle_v2',
    timestamp: '2026-08-15T15:10:00Z',
    date: '2026-08-15',
    accuracy: 0.874,
    loss: 0.325,
    valLoss: 0.350,
    inferenceTimeMs: 8.2,
    precision: 0.870,
    recall: 0.872,
    f1Score: 0.871,
    hyperparameters: { learningRate: 0.0005, batchSize: 64, optimizer: 'AdamW', epochs: 80 },
    confusionMatrix: {
      labels: ['Short (<24d)', 'Normal (24-35d)', 'Long (>35d)'],
      values: [
        [95, 8, 0],
        [7, 201, 7],
        [1, 7, 86]
      ]
    }
  },
  {
    id: 'run-cycle-004',
    modelId: 'cycle_length_regressor',
    modelName: 'Cycle Length Predictor',
    dataset: 'cycle_v2',
    timestamp: '2026-08-22T17:40:00Z',
    date: '2026-08-22',
    accuracy: 0.902,
    loss: 0.268,
    valLoss: 0.289,
    inferenceTimeMs: 7.9,
    precision: 0.898,
    recall: 0.901,
    f1Score: 0.899,
    hyperparameters: { learningRate: 0.0001, batchSize: 64, optimizer: 'AdamW', epochs: 120 },
    confusionMatrix: {
      labels: ['Short (<24d)', 'Normal (24-35d)', 'Long (>35d)'],
      values: [
        [98, 5, 0],
        [5, 206, 4],
        [0, 5, 89]
      ]
    }
  },

  // Symptom Correlation Model runs
  {
    id: 'run-symp-001',
    modelId: 'symptom_correlation_model',
    modelName: 'Symptom Correlation Model',
    dataset: 'symptoms_v1',
    timestamp: '2026-08-04T09:00:00Z',
    date: '2026-08-04',
    accuracy: 0.812,
    loss: 0.465,
    valLoss: 0.490,
    inferenceTimeMs: 14.1,
    precision: 0.805,
    recall: 0.810,
    f1Score: 0.807,
    hyperparameters: { learningRate: 0.001, batchSize: 32, optimizer: 'Adam', epochs: 40 },
    confusionMatrix: {
      labels: ['Mild Correlation', 'Moderate', 'Strong Correlation'],
      values: [
        [100, 15, 3],
        [12, 130, 14],
        [2, 11, 95]
      ]
    }
  },
  {
    id: 'run-symp-002',
    modelId: 'symptom_correlation_model',
    modelName: 'Symptom Correlation Model',
    dataset: 'symptoms_v1',
    timestamp: '2026-08-11T12:00:00Z',
    date: '2026-08-11',
    accuracy: 0.854,
    loss: 0.370,
    valLoss: 0.395,
    inferenceTimeMs: 12.8,
    precision: 0.850,
    recall: 0.852,
    f1Score: 0.851,
    hyperparameters: { learningRate: 0.0005, batchSize: 32, optimizer: 'AdamW', epochs: 80 },
    confusionMatrix: {
      labels: ['Mild Correlation', 'Moderate', 'Strong Correlation'],
      values: [
        [105, 10, 2],
        [8, 138, 10],
        [1, 8, 102]
      ]
    }
  },
  {
    id: 'run-symp-003',
    modelId: 'symptom_correlation_model',
    modelName: 'Symptom Correlation Model',
    dataset: 'symptoms_v2',
    timestamp: '2026-08-18T16:30:00Z',
    date: '2026-08-18',
    accuracy: 0.889,
    loss: 0.295,
    valLoss: 0.315,
    inferenceTimeMs: 11.5,
    precision: 0.885,
    recall: 0.888,
    f1Score: 0.886,
    hyperparameters: { learningRate: 0.0005, batchSize: 64, optimizer: 'AdamW', epochs: 100 },
    confusionMatrix: {
      labels: ['Mild Correlation', 'Moderate', 'Strong Correlation'],
      values: [
        [110, 6, 1],
        [5, 143, 6],
        [1, 5, 107]
      ]
    }
  },
  {
    id: 'run-symp-004',
    modelId: 'symptom_correlation_model',
    modelName: 'Symptom Correlation Model',
    dataset: 'symptoms_v2',
    timestamp: '2026-08-25T11:00:00Z',
    date: '2026-08-25',
    accuracy: 0.918,
    loss: 0.230,
    valLoss: 0.248,
    inferenceTimeMs: 10.9,
    precision: 0.915,
    recall: 0.917,
    f1Score: 0.916,
    hyperparameters: { learningRate: 0.0001, batchSize: 64, optimizer: 'AdamW', epochs: 120 },
    confusionMatrix: {
      labels: ['Mild Correlation', 'Moderate', 'Strong Correlation'],
      values: [
        [114, 3, 0],
        [3, 147, 4],
        [0, 3, 111]
      ]
    }
  },

  // Mood Predictor runs
  {
    id: 'run-mood-001',
    modelId: 'mood_predictor',
    modelName: 'Mood Predictor',
    dataset: 'mood_v1',
    timestamp: '2026-08-07T08:00:00Z',
    date: '2026-08-07',
    accuracy: 0.825,
    loss: 0.440,
    valLoss: 0.465,
    inferenceTimeMs: 6.5,
    precision: 0.820,
    recall: 0.823,
    f1Score: 0.821,
    hyperparameters: { learningRate: 0.001, batchSize: 32, optimizer: 'Adam', epochs: 50 },
    confusionMatrix: {
      labels: ['Calm/Happy', 'Anxious', 'Irritable', 'Fatigued'],
      values: [
        [90, 8, 4, 3],
        [7, 85, 6, 2],
        [5, 5, 80, 5],
        [3, 2, 4, 88]
      ]
    }
  },
  {
    id: 'run-mood-002',
    modelId: 'mood_predictor',
    modelName: 'Mood Predictor',
    dataset: 'mood_v1',
    timestamp: '2026-08-24T14:00:00Z',
    date: '2026-08-24',
    accuracy: 0.882,
    loss: 0.310,
    valLoss: 0.330,
    inferenceTimeMs: 5.9,
    precision: 0.878,
    recall: 0.880,
    f1Score: 0.879,
    hyperparameters: { learningRate: 0.0005, batchSize: 64, optimizer: 'AdamW', epochs: 100 },
    confusionMatrix: {
      labels: ['Calm/Happy', 'Anxious', 'Irritable', 'Fatigued'],
      values: [
        [98, 4, 2, 1],
        [3, 92, 3, 2],
        [2, 3, 88, 2],
        [1, 2, 2, 92]
      ]
    }
  }
]

/**
 * Filter logs based on date range, modelId, dataset, learningRate, and batchSize
 */
export function filterTrainingLogs(logs = MOCK_TRAINING_LOGS, filters = {}) {
  const {
    startDate,
    endDate,
    modelId = 'all',
    dataset = 'all',
    learningRate = 'all',
    batchSize = 'all'
  } = filters

  return logs.filter((log) => {
    // Date Range Filter
    if (startDate && log.date < startDate) return false
    if (endDate && log.date > endDate) return false

    // Model Filter
    if (modelId && modelId !== 'all' && log.modelId !== modelId) return false

    // Dataset Filter
    if (dataset && dataset !== 'all' && log.dataset !== dataset) return false

    // Hyperparameter: Learning Rate Filter
    if (learningRate && learningRate !== 'all') {
      const targetLr = Number(learningRate)
      if (!Number.isNaN(targetLr) && Math.abs(log.hyperparameters.learningRate - targetLr) > 1e-7) {
        return false
      }
    }

    // Hyperparameter: Batch Size Filter
    if (batchSize && batchSize !== 'all') {
      const targetBs = Number(batchSize)
      if (!Number.isNaN(targetBs) && log.hyperparameters.batchSize !== targetBs) {
        return false
      }
    }

    return true
  })
}

/**
 * Aggregates logs into KPIs, time series, model comparisons, and heatmaps
 */
export function aggregateMetrics(filteredLogs = []) {
  if (filteredLogs.length === 0) {
    return {
      kpis: {
        latestAccuracy: 0,
        averageAccuracy: 0,
        averageLoss: 0,
        avgInferenceTimeMs: 0,
        totalRuns: 0
      },
      timeSeries: [],
      modelBenchmarks: [],
      hyperparameterHeatmap: [],
      confusionMatrix: null
    }
  }

  // Sort chronologically
  const sortedLogs = [...filteredLogs].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))

  // 1. KPIs
  const totalRuns = sortedLogs.length
  const totalAccuracy = sortedLogs.reduce((sum, item) => sum + item.accuracy, 0)
  const totalLoss = sortedLogs.reduce((sum, item) => sum + item.loss, 0)
  const totalInferenceTime = sortedLogs.reduce((sum, item) => sum + item.inferenceTimeMs, 0)

  const latestLog = sortedLogs[sortedLogs.length - 1]

  const kpis = {
    latestAccuracy: latestLog ? Number((latestLog.accuracy * 100).toFixed(1)) : 0,
    averageAccuracy: Number(((totalAccuracy / totalRuns) * 100).toFixed(1)),
    averageLoss: Number((totalLoss / totalRuns).toFixed(3)),
    avgInferenceTimeMs: Number((totalInferenceTime / totalRuns).toFixed(1)),
    totalRuns
  }

  // 2. Time Series Data (Accuracy, Loss, Inference Time by date)
  const timeSeries = sortedLogs.map((log) => ({
    id: log.id,
    date: log.date,
    timestamp: log.timestamp,
    modelId: log.modelId,
    modelName: log.modelName,
    accuracy: Number((log.accuracy * 100).toFixed(1)),
    loss: Number(log.loss.toFixed(3)),
    valLoss: Number(log.valLoss.toFixed(3)),
    inferenceTimeMs: log.inferenceTimeMs,
    precision: Number((log.precision * 100).toFixed(1)),
    recall: Number((log.recall * 100).toFixed(1)),
    f1Score: Number((log.f1Score * 100).toFixed(1))
  }))

  // 3. Model Benchmark Summaries (Grouped by modelId)
  const modelGroupMap = new Map()
  sortedLogs.forEach((log) => {
    if (!modelGroupMap.has(log.modelId)) {
      modelGroupMap.set(log.modelId, {
        modelId: log.modelId,
        modelName: log.modelName,
        totalAccuracy: 0,
        totalLoss: 0,
        totalInferenceMs: 0,
        count: 0
      })
    }
    const group = modelGroupMap.get(log.modelId)
    group.totalAccuracy += log.accuracy
    group.totalLoss += log.loss
    group.totalInferenceMs += log.inferenceTimeMs
    group.count += 1
  })

  const modelBenchmarks = Array.from(modelGroupMap.values()).map((g) => ({
    modelId: g.modelId,
    modelName: g.modelName,
    avgAccuracy: Number(((g.totalAccuracy / g.count) * 100).toFixed(1)),
    avgLoss: Number((g.totalLoss / g.count).toFixed(3)),
    avgInferenceTimeMs: Number((g.totalInferenceMs / g.count).toFixed(1)),
    runCount: g.count
  }))

  // 4. 2D Hyperparameter Accuracy Heatmap (Learning Rate vs Batch Size)
  const hyperMap = new Map()
  sortedLogs.forEach((log) => {
    const lr = log.hyperparameters.learningRate
    const bs = log.hyperparameters.batchSize
    const key = `${lr}__${bs}`
    if (!hyperMap.has(key)) {
      hyperMap.set(key, { learningRate: lr, batchSize: bs, totalAcc: 0, count: 0 })
    }
    const cell = hyperMap.get(key)
    cell.totalAcc += log.accuracy
    cell.count += 1
  })

  const hyperparameterHeatmap = Array.from(hyperMap.values()).map((c) => ({
    learningRate: c.learningRate,
    batchSize: c.batchSize,
    avgAccuracy: Number(((c.totalAcc / c.count) * 100).toFixed(1)),
    runCount: c.count
  }))

  // 5. Representative Confusion Matrix (from the latest run in selection)
  const confusionMatrix = latestLog.confusionMatrix || null

  return {
    kpis,
    timeSeries,
    modelBenchmarks,
    hyperparameterHeatmap,
    confusionMatrix
  }
}

/**
 * Returns available filter options from the logs bag
 */
export function getAvailableFilterOptions(logs = MOCK_TRAINING_LOGS) {
  const modelsMap = new Map()
  const datasetsSet = new Set()
  const learningRatesSet = new Set()
  const batchSizesSet = new Set()

  logs.forEach((log) => {
    modelsMap.set(log.modelId, log.modelName)
    datasetsSet.add(log.dataset)
    learningRatesSet.add(log.hyperparameters.learningRate)
    batchSizesSet.add(log.hyperparameters.batchSize)
  })

  return {
    models: Array.from(modelsMap.entries()).map(([id, name]) => ({ id, name })),
    datasets: Array.from(datasetsSet).sort(),
    learningRates: Array.from(learningRatesSet).sort((a, b) => a - b),
    batchSizes: Array.from(batchSizesSet).sort((a, b) => a - b)
  }
}

/**
 * Constructs dataset lineage graph topology (Dataset Version -> Preprocessing -> Model)
 */
export function getDatasetLineageGraph(filters = {}) {
  const filteredLogs = filterTrainingLogs(MOCK_TRAINING_LOGS, filters)

  const datasetMap = new Map()
  const preprocessingMap = new Map()
  const modelMap = new Map()
  const edges = []

  MOCK_DATASETS.forEach((ds) => {
    // Filter out datasets if a specific dataset filter is applied
    if (filters.dataset && filters.dataset !== 'all' && ds.name !== filters.dataset) {
      return
    }

    datasetMap.set(ds.name, {
      id: `ds_${ds.name}`,
      label: ds.name,
      versionHash: ds.versionHash,
      shortHash: ds.versionHash.slice(0, 8),
      sampleCount: ds.sampleCount,
      createdAt: ds.createdAt,
      type: 'dataset'
    })

    const prepId = `prep_${ds.name}`
    preprocessingMap.set(prepId, {
      id: prepId,
      label: `Prep (${ds.name})`,
      steps: ds.preprocessingMetadata.steps,
      parameters: ds.preprocessingMetadata.parameters,
      type: 'preprocessing'
    })

    edges.push({
      source: `ds_${ds.name}`,
      target: prepId,
      label: 'transforms'
    })
  })

  filteredLogs.forEach((log) => {
    if (!modelMap.has(log.modelId)) {
      modelMap.set(log.modelId, {
        id: `model_${log.modelId}`,
        label: log.modelName,
        modelId: log.modelId,
        latestAccuracy: Number((log.accuracy * 100).toFixed(1)),
        type: 'model'
      })
    } else {
      const existing = modelMap.get(log.modelId)
      if (log.accuracy * 100 > existing.latestAccuracy) {
        existing.latestAccuracy = Number((log.accuracy * 100).toFixed(1))
      }
    }

    const prepId = `prep_${log.dataset}`
    const modelNodeId = `model_${log.modelId}`
    const edgeKey = `${prepId}->${modelNodeId}`

    if (preprocessingMap.has(prepId) && !edges.some((e) => `${e.source}->${e.target}` === edgeKey)) {
      edges.push({
        source: prepId,
        target: modelNodeId,
        label: 'trains'
      })
    }
  })

  return {
    datasets: Array.from(datasetMap.values()),
    preprocessing: Array.from(preprocessingMap.values()),
    models: Array.from(modelMap.values()),
    edges,
    totalVersions: datasetMap.size
  }
}

/**
 * Main dashboard metrics processing entrypoint
 */
export function getDashboardMetrics(filters = {}) {
  const filtered = filterTrainingLogs(MOCK_TRAINING_LOGS, filters)
  const aggregated = aggregateMetrics(filtered)
  const options = getAvailableFilterOptions(MOCK_TRAINING_LOGS)
  const lineageGraph = getDatasetLineageGraph(filters)

  return {
    filtersApplied: {
      startDate: filters.startDate || '',
      endDate: filters.endDate || '',
      modelId: filters.modelId || 'all',
      dataset: filters.dataset || 'all',
      learningRate: filters.learningRate || 'all',
      batchSize: filters.batchSize || 'all'
    },
    filterOptions: options,
    metrics: aggregated,
    lineageGraph
  }
}

