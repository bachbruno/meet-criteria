import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { validateTemplate } from './validate-templates.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const fixtures = join(here, '..', 'schemas', '__fixtures__')

test('valid-minimal.jsonc passa', () => {
  const result = validateTemplate(join(fixtures, 'valid-minimal.jsonc'))
  assert.equal(result.valid, true, JSON.stringify(result.errors))
  assert.deepEqual(result.errors, [])
})

test('invalid-missing-type.jsonc falha com erro mencionando "type"', () => {
  const result = validateTemplate(join(fixtures, 'invalid-missing-type.jsonc'))
  assert.equal(result.valid, false)
  const message = result.errors.map((e) => e.message + ' ' + (e.params?.missingProperty ?? '')).join(' | ')
  assert.match(message, /type/)
})

test('invalid-bad-component.jsonc falha com erro de enum', () => {
  const result = validateTemplate(join(fixtures, 'invalid-bad-component.jsonc'))
  assert.equal(result.valid, false)
  const hasEnumError = result.errors.some((e) => e.keyword === 'enum')
  assert.equal(hasEnumError, true)
})

test('arquivo inexistente devolve erro de IO', () => {
  const result = validateTemplate(join(fixtures, '__missing__.jsonc'))
  assert.equal(result.valid, false)
  assert.match(result.errors[0].message, /ENOENT|not found|no such file/i)
})
