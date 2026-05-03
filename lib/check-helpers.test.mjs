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

// ----- snapshot fixture builder -----
// Builds a minimal but valid snapshot. Tests pass partial overrides for the
// fields they care about; everything else defaults to "all green".
function makeSnapshot(overrides = {}) {
  const base = {
    sectionId: 'sec-1',
    ticketRef: 'PROD-1234',
    type: 'feature',
    lastAnalyzedAt: '2026-05-02T15:00:00.000Z',
    problemStatement: { nodeId: 'ps-text-1', text: 'A real problem statement.' },
    flows: [
      {
        flowId: 'flow-1',
        flowNodeId: 'flow-node-1',
        flowName: 'Onboarding',
        slots: [
          { flowId: 'flow-1', screenIndex: 0, tagId: 'tag-0', slotId: 'slot-0',
            slotChildCount: 2, justificationId: 'just-0', justificationText: 'How this screen helps.' },
          { flowId: 'flow-1', screenIndex: 1, tagId: 'tag-1', slotId: 'slot-1',
            slotChildCount: 3, justificationId: 'just-1', justificationText: 'Another justification.' },
        ],
      },
    ],
    analysisOverview: {
      nodeId: 'ao-1',
      sections: [
        { key: 'resolution', nodeId: 'sub-res', bodyTextNodeId: 'res-body', text: 'Resolution body.' },
        { key: 'validation', nodeId: 'sub-val', bodyTextNodeId: 'val-body', text: 'Validation body.' },
        { key: 'attention',  nodeId: 'sub-att', bodyTextNodeId: 'att-body', text: 'Attention body.' },
        { key: 'discussion', nodeId: 'sub-dis', bodyTextNodeId: 'dis-body', text: 'Discussion body.' },
        { key: 'gap-check',  nodeId: 'sub-gap', bodyTextNodeId: 'gap-body', text: 'Gap check body.' },
      ],
    },
    knownPlaceholders: {
      'analysis.resolution': 'Describe how this delivery solves the problem statement.',
      'analysis.validation': 'List the criteria that confirm the resolution works.',
      'analysis.attention':  'Flag risks, edge cases, or constraints the team should mind.',
      'analysis.discussion': 'Open questions or trade-offs to align on during the review.',
      'analysis.gap-check':  'Run /meet-criteria-analyze to compare the ticket against the delivered screens.',
    },
  }
  return { ...base, ...overrides }
}

test('makeSnapshot fixture is well-formed (sanity)', () => {
  const s = makeSnapshot()
  assert.equal(s.sectionId, 'sec-1')
  assert.equal(s.flows[0].slots.length, 2)
  assert.equal(s.analysisOverview.sections.length, 5)
})

import { ruleEmptyProblemStatement } from './check-helpers.mjs'

test('ruleEmptyProblemStatement returns [] when text is non-empty', () => {
  const findings = ruleEmptyProblemStatement(makeSnapshot())
  assert.deepEqual(findings, [])
})

test('ruleEmptyProblemStatement flags whitespace-only text', () => {
  const findings = ruleEmptyProblemStatement(makeSnapshot({
    problemStatement: { nodeId: 'ps-text-1', text: '   \n  ' },
  }))
  assert.equal(findings.length, 1)
  assert.equal(findings[0].rule, 'empty-problem-statement')
  assert.equal(findings[0].severity, 'error')
  assert.equal(findings[0].nodeId, 'ps-text-1')
  assert.match(findings[0].message, /Problem Statement está vazio/)
})

test('ruleEmptyProblemStatement flags missing problemStatement (null)', () => {
  const findings = ruleEmptyProblemStatement(makeSnapshot({ problemStatement: null }))
  assert.equal(findings.length, 1)
  assert.equal(findings[0].nodeId, 'sec-1')
})
