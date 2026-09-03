/**
 * lib/dataset-versioning.js
 *
 * Dataset versioning and content hashing engine for HerCycle AI models.
 * Computes deterministic SHA-256 hashes of training dataset contents, records
 * version snapshots along with preprocessing metadata, and resolves data lineage.
 */

import crypto from 'crypto'

/**
 * Computes a deterministic SHA-256 content hash for dataset payload (string, Buffer, or array/object).
 *
 * @param {string|Buffer|Array<object>|object} payload
 * @returns {string} SHA-256 hexadecimal hash string (64 characters)
 */
export function computeDatasetHash(payload) {
  if (payload === undefined || payload === null) {
    throw new Error('Cannot compute dataset hash for null or undefined payload')
  }

  let bufferToHash
  if (Buffer.isBuffer(payload)) {
    bufferToHash = payload
  } else if (typeof payload === 'string') {
    bufferToHash = Buffer.from(payload, 'utf-8')
  } else if (typeof payload === 'object') {
    // Sort keys recursively for canonical JSON representation
    const canonicalJson = stringifyCanonical(payload)
    bufferToHash = Buffer.from(canonicalJson, 'utf-8')
  } else {
    bufferToHash = Buffer.from(String(payload), 'utf-8')
  }

  return crypto.createHash('sha256').update(bufferToHash).digest('hex')
}

/**
 * Serializes JS objects into deterministic canonical JSON string.
 */
function stringifyCanonical(obj) {
  if (obj === null || typeof obj !== 'object') {
    return JSON.stringify(obj)
  }

  if (Array.isArray(obj)) {
    return '[' + obj.map(stringifyCanonical).join(',') + ']'
  }

  const keys = Object.keys(obj).sort()
  const entries = keys.map((key) => JSON.stringify(key) + ':' + stringifyCanonical(obj[key]))
  return '{' + entries.join(',') + '}'
}

/**
 * In-memory registry fallback for dataset versions when database is unconfigured.
 */
const DATASET_REGISTRY = new Map()

/**
 * Registers or updates a dataset version entry with content hash and preprocessing metadata.
 *
 * @param {string} name Dataset label (e.g. 'pcod_dataset')
 * @param {Array<object>|string|Buffer} data Dataset raw or preprocessed rows
 * @param {object} [preprocessingMetadata] Preprocessing parameters (steps, parameters, source)
 * @returns {object} Dataset version record
 */
export function registerDatasetVersion(name, data, preprocessingMetadata = {}) {
  const versionHash = computeDatasetHash(data)
  const sampleCount = Array.isArray(data) ? data.length : 0

  const record = {
    id: `ds-${versionHash.slice(0, 8)}`,
    name,
    versionHash,
    sampleCount,
    preprocessingMetadata: {
      steps: preprocessingMetadata.steps || ['raw_ingestion'],
      parameters: preprocessingMetadata.parameters || {},
      features: preprocessingMetadata.features || [],
      ingestedAt: new Date().toISOString(),
      ...preprocessingMetadata,
    },
    createdAt: new Date().toISOString(),
  }

  DATASET_REGISTRY.set(versionHash, record)
  DATASET_REGISTRY.set(record.id, record)

  return record
}

/**
 * Resolves dataset version information by version hash or dataset ID.
 *
 * @param {string} hashOrId
 * @returns {object|null}
 */
export function resolveDatasetVersion(hashOrId) {
  if (!hashOrId) return null
  return DATASET_REGISTRY.get(hashOrId) || null
}

/**
 * Returns all registered dataset versions.
 *
 * @returns {Array<object>}
 */
export function getAllDatasetVersions() {
  const uniqueRecords = new Map()
  for (const record of DATASET_REGISTRY.values()) {
    uniqueRecords.set(record.versionHash, record)
  }
  return Array.from(uniqueRecords.values())
}
