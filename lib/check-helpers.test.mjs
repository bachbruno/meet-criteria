import test from 'node:test'
import assert from 'node:assert/strict'
import { CheckError } from './check-helpers.mjs'

test('CheckError carries name, code, and details', () => {
  const err = new CheckError('boom', { code: 'X', details: { foo: 1 } })
  assert.equal(err.name, 'CheckError')
  assert.equal(err.message, 'boom')
  assert.equal(err.code, 'X')
  assert.deepEqual(err.details, { foo: 1 })
})

test('CheckError defaults code to UNKNOWN and details to null', () => {
  const err = new CheckError('boom')
  assert.equal(err.code, 'UNKNOWN')
  assert.equal(err.details, null)
})
