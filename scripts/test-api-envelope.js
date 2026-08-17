import assert from 'node:assert/strict'
import { jsonSuccess, jsonError } from '../lib/api-helpers.js'

let passed = 0
let failed = 0

function check(actual, expected, label) {
  if (Object.is(actual, expected)) {
    passed += 1
    return
  }
  failed += 1
  console.error(`  ❌ ${label}`)
  console.error(`       expected: ${JSON.stringify(expected)}`)
  console.error(`       actual:   ${JSON.stringify(actual)}`)
}

function checkDeep(actual, expected, label) {
  const a = JSON.stringify(actual)
  const b = JSON.stringify(expected)
  if (a === b) {
    passed += 1
    return
  }
  failed += 1
  console.error(`  ❌ ${label}`)
  console.error(`       expected: ${b}`)
  console.error(`       actual:   ${a}`)
}

async function testEnvelope() {
  console.log('— Testing jsonSuccess')

  const res1 = jsonSuccess({ foo: 'bar' })
  check(res1.status, 200, 'default status is 200')
  const body1 = await res1.json()
  checkDeep(body1, { success: true, data: { foo: 'bar' } }, 'jsonSuccess data envelope')

  const res2 = jsonSuccess([1, 2, 3], 'List loaded', 201)
  check(res2.status, 201, 'status 201')
  const body2 = await res2.json()
  checkDeep(body2, { success: true, data: [1, 2, 3], message: 'List loaded' }, 'jsonSuccess message & status envelope')

  console.log('\n— Testing jsonError')

  const res3 = jsonError('Bad Request', 400)
  check(res3.status, 400, 'status 400')
  const body3 = await res3.json()
  checkDeep(body3, { success: false, error: 'Bad Request' }, 'jsonError basic envelope')

  const res4 = jsonError('Unauthorized access', 401, 'UNAUTHORIZED')
  check(res4.status, 401, 'status 401')
  const body4 = await res4.json()
  checkDeep(body4, { success: false, error: 'Unauthorized access', code: 'UNAUTHORIZED' }, 'jsonError code envelope')

  const res5 = jsonError('Validation failed', 422, 'INVALID_INPUT', { field: 'age' })
  check(res5.status, 422, 'status 422')
  const body5 = await res5.json()
  checkDeep(body5, { success: false, error: 'Validation failed', code: 'INVALID_INPUT', details: { field: 'age' } }, 'jsonError details envelope')

  console.log(`\n✅ All ${passed} API envelope assertions passed.`)
  if (failed > 0) process.exit(1)
}

testEnvelope()
