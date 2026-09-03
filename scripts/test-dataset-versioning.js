/**
 * scripts/test-dataset-versioning.js
 *
 * Comprehensive test suite for Dataset Versioning & Lineage Tracking.
 */

import assert from 'assert'
import { computeDatasetHash, registerDatasetVersion, resolveDatasetVersion, getAllDatasetVersions } from '../lib/dataset-versioning.js'
import { getDatasetLineageGraph, MOCK_DATASETS, MOCK_TRAINING_LOGS } from '../lib/dashboard-metrics.js'

function testContentHashing() {
  console.log('Test 1: SHA-256 Content Hashing')

  const textPayload = 'sample,cycle_length,symptom\n1,28,acne\n2,32,hirsutism'
  const hash1 = computeDatasetHash(textPayload)
  assert.strictEqual(typeof hash1, 'string')
  assert.strictEqual(hash1.length, 64)

  // Test deterministic hash output for identical objects with different key order
  const objA = { b: 2, a: 1, nested: { y: 'test', x: 10 } }
  const objB = { a: 1, b: 2, nested: { x: 10, y: 'test' } }
  const hashA = computeDatasetHash(objA)
  const hashB = computeDatasetHash(objB)
  assert.strictEqual(hashA, hashB, 'Hashes for canonically identical objects must match')

  // Test hash changes on content modification
  const objC = { a: 1, b: 3, nested: { x: 10, y: 'test' } }
  const hashC = computeDatasetHash(objC)
  assert.notStrictEqual(hashA, hashC, 'Hashes for different content must be distinct')

  // Test null / undefined throws error
  assert.throws(() => computeDatasetHash(null), /Cannot compute dataset hash/)

  console.log('  ✓ Hashing functions passed.')
}

function testDatasetRegistry() {
  console.log('\nTest 2: Dataset Registry & Version Resolution')

  const datasetName = 'test_pcod_dataset'
  const sampleData = [
    { avg_cycle_length: 28, has_acne: 1 },
    { avg_cycle_length: 35, has_acne: 0 }
  ]
  const metadata = {
    steps: ['Deduplication', 'IQR Outlier Filtering'],
    parameters: { threshold: 2.5 }
  }

  const record = registerDatasetVersion(datasetName, sampleData, metadata)
  assert.strictEqual(record.name, datasetName)
  assert.strictEqual(record.sampleCount, 2)
  assert.strictEqual(typeof record.versionHash, 'string')
  assert.strictEqual(record.versionHash.length, 64)
  assert.deepStrictEqual(record.preprocessingMetadata.steps, ['Deduplication', 'IQR Outlier Filtering'])

  // Resolve by hash
  const resolvedByHash = resolveDatasetVersion(record.versionHash)
  assert.strictEqual(resolvedByHash.id, record.id)

  // Resolve by ID
  const resolvedById = resolveDatasetVersion(record.id)
  assert.strictEqual(resolvedById.versionHash, record.versionHash)

  // Non-existent hash
  assert.strictEqual(resolveDatasetVersion('non_existent_hash'), null)

  console.log('  ✓ Registry & resolution functions passed.')
}

function testLineageGraphTopology() {
  console.log('\nTest 3: Lineage Graph Topology Construction')

  const fullGraph = getDatasetLineageGraph()
  assert(fullGraph.datasets.length > 0, 'Must contain dataset nodes')
  assert(fullGraph.preprocessing.length > 0, 'Must contain preprocessing nodes')
  assert(fullGraph.models.length > 0, 'Must contain model nodes')
  assert(fullGraph.edges.length > 0, 'Must contain graph edges')

  // Verify dataset node structure
  const dsNode = fullGraph.datasets[0]
  assert(dsNode.id.startsWith('ds_'))
  assert.strictEqual(typeof dsNode.versionHash, 'string')
  assert.strictEqual(dsNode.versionHash.length, 64)
  assert.strictEqual(dsNode.type, 'dataset')

  // Verify edges connect Dataset -> Preprocessing -> Model
  const transformsEdges = fullGraph.edges.filter((e) => e.label === 'transforms')
  const trainsEdges = fullGraph.edges.filter((e) => e.label === 'trains')
  assert(transformsEdges.length > 0, 'Must have transform edges')
  assert(trainsEdges.length > 0, 'Must have train edges')

  // Test filtering graph by dataset
  const filteredGraph = getDatasetLineageGraph({ dataset: 'pcod_v1' })
  assert.strictEqual(filteredGraph.datasets.length, 1)
  assert.strictEqual(filteredGraph.datasets[0].label, 'pcod_v1')

  console.log('  ✓ Lineage topology tests passed.')
}

function runAllTests() {
  console.log('=== Running Dataset Versioning Test Suite ===\n')
  testContentHashing()
  testDatasetRegistry()
  testLineageGraphTopology()
  console.log('\n=== All Tests Passed Successfully! ===')
}

runAllTests()
