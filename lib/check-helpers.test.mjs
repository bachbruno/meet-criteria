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

import vm from 'node:vm'
import { buildCheckSnapshotJs } from './check-helpers.mjs'

function assertParseable(js) {
  const src = `(async () => { ${js} })`
  assert.doesNotThrow(() => new vm.Script(src), `JS must parse: ${js.slice(0, 200)}...`)
}

test('buildCheckSnapshotJs throws on missing sectionId', () => {
  assert.throws(() => buildCheckSnapshotJs({ knownPlaceholders: {} }),
    (err) => err.code === 'MISSING_SECTION_ID')
})

test('buildCheckSnapshotJs returns parseable JS that loads pages and reads roles', () => {
  const js = buildCheckSnapshotJs({ sectionId: 'sec-1', knownPlaceholders: {} })
  assertParseable(js)
  assert.match(js, /loadAllPagesAsync/)
  assert.match(js, /getNodeByIdAsync/)
  assert.match(js, /'role'/)
  assert.match(js, /'screen-slot'/)
  assert.match(js, /'screen-justification'/)
  assert.match(js, /'screen-tag'/)
  assert.match(js, /'problem-statement'/)
  assert.match(js, /'analysis-overview'/)
  assert.match(js, /'analysis-section'/)
  assert.match(js, /'flow'/)
  assert.match(js, /lastAnalyzedAt/)
})

test('buildCheckSnapshotJs embeds knownPlaceholders as JSON literal', () => {
  const js = buildCheckSnapshotJs({
    sectionId: 'sec-1',
    knownPlaceholders: { 'analysis.resolution': 'Run /analyze.' },
  })
  assert.match(js, /"analysis\.resolution":"Run \/analyze\."/)
})

test('buildCheckSnapshotJs escapes injection-prone sectionId', () => {
  const js = buildCheckSnapshotJs({
    sectionId: '</script><x>"\'\n',
    knownPlaceholders: {},
  })
  assert.doesNotMatch(js, /<\/script>/)
})
