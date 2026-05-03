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

import { ruleEmptyScreenSlot } from './check-helpers.mjs'

test('ruleEmptyScreenSlot returns [] when all slots have content', () => {
  assert.deepEqual(ruleEmptyScreenSlot(makeSnapshot()), [])
})

test('ruleEmptyScreenSlot flags slot with slotId=null (slot never created)', () => {
  const s = makeSnapshot()
  s.flows[0].slots[0].slotId = null
  s.flows[0].slots[0].slotChildCount = 0
  const findings = ruleEmptyScreenSlot(s)
  assert.equal(findings.length, 1)
  assert.equal(findings[0].rule, 'empty-screen-slot')
  assert.equal(findings[0].severity, 'error')
  assert.equal(findings[0].nodeId, 'tag-0') // falls back to tagId when slotId is null
  assert.match(findings[0].message, /Tela 1 do flow "Onboarding"/)
  assert.deepEqual(findings[0].context, { flowId: 'flow-1', screenIndex: 0 })
})

test('ruleEmptyScreenSlot flags slot with 0 children (designer cleared the clone)', () => {
  const s = makeSnapshot()
  s.flows[0].slots[1].slotChildCount = 0
  const findings = ruleEmptyScreenSlot(s)
  assert.equal(findings.length, 1)
  assert.equal(findings[0].nodeId, 'slot-1')
  assert.match(findings[0].message, /Tela 2 do flow "Onboarding"/)
})

test('ruleEmptyScreenSlot reports one finding per affected slot', () => {
  const s = makeSnapshot()
  s.flows[0].slots[0].slotChildCount = 0
  s.flows[0].slots[1].slotId = null
  s.flows[0].slots[1].slotChildCount = 0
  assert.equal(ruleEmptyScreenSlot(s).length, 2)
})

import { ruleEmptyJustification } from './check-helpers.mjs'

test('ruleEmptyJustification returns [] when all justifications are filled', () => {
  assert.deepEqual(ruleEmptyJustification(makeSnapshot()), [])
})

test('ruleEmptyJustification flags filled slots with empty justification', () => {
  const s = makeSnapshot()
  s.flows[0].slots[0].justificationText = '   '
  const findings = ruleEmptyJustification(s)
  assert.equal(findings.length, 1)
  assert.equal(findings[0].rule, 'empty-justification')
  assert.equal(findings[0].severity, 'warn')
  assert.equal(findings[0].nodeId, 'just-0')
  assert.match(findings[0].message, /Tela 1 do flow "Onboarding" sem justificativa/)
})

test('ruleEmptyJustification skips pristine slots (slotChildCount=0)', () => {
  const s = makeSnapshot()
  s.flows[0].slots[0].slotChildCount = 0
  s.flows[0].slots[0].justificationText = ''
  assert.deepEqual(ruleEmptyJustification(s), []) // covered by empty-screen-slot
})

test('ruleEmptyJustification skips slots without justificationId', () => {
  const s = makeSnapshot()
  s.flows[0].slots[0].justificationId = null
  s.flows[0].slots[0].justificationText = ''
  assert.deepEqual(ruleEmptyJustification(s), [])
})

import { ruleEmptyAnalysisSection } from './check-helpers.mjs'

test('ruleEmptyAnalysisSection returns [] when all sections have content', () => {
  assert.deepEqual(ruleEmptyAnalysisSection(makeSnapshot()), [])
})

test('ruleEmptyAnalysisSection flags whitespace-only sections', () => {
  const s = makeSnapshot()
  s.analysisOverview.sections[2].text = '  \n  '
  const findings = ruleEmptyAnalysisSection(s)
  assert.equal(findings.length, 1)
  assert.equal(findings[0].rule, 'empty-analysis-section')
  assert.equal(findings[0].severity, 'error')
  assert.equal(findings[0].nodeId, 'att-body')
  assert.match(findings[0].message, /sub-seção "attention"/i)
  assert.deepEqual(findings[0].context, { key: 'attention' })
})

test('ruleEmptyAnalysisSection falls back to section.nodeId when bodyTextNodeId is null', () => {
  const s = makeSnapshot()
  s.analysisOverview.sections[0] = { key: 'resolution', nodeId: 'sub-res', bodyTextNodeId: null, text: '' }
  const findings = ruleEmptyAnalysisSection(s)
  assert.equal(findings[0].nodeId, 'sub-res')
})

test('ruleEmptyAnalysisSection returns [] when analysisOverview is null', () => {
  assert.deepEqual(ruleEmptyAnalysisSection(makeSnapshot({ analysisOverview: null })), [])
})

import { rulePlaceholderTextNotReplaced } from './check-helpers.mjs'

test('rulePlaceholderTextNotReplaced returns [] when bodies differ from placeholder', () => {
  assert.deepEqual(rulePlaceholderTextNotReplaced(makeSnapshot()), [])
})

test('rulePlaceholderTextNotReplaced flags exact placeholder match (trim-aware)', () => {
  const s = makeSnapshot()
  s.analysisOverview.sections[0].text = '  Describe how this delivery solves the problem statement.  '
  const findings = rulePlaceholderTextNotReplaced(s)
  assert.equal(findings.length, 1)
  assert.equal(findings[0].rule, 'placeholder-text-not-replaced')
  assert.equal(findings[0].severity, 'warn')
  assert.equal(findings[0].nodeId, 'res-body')
  assert.match(findings[0].message, /sub-seção "resolution".+placeholder/i)
})

test('rulePlaceholderTextNotReplaced is mutually exclusive with empty-analysis-section', () => {
  // empty text matches "" trim, never equals a non-empty placeholder
  const s = makeSnapshot()
  s.analysisOverview.sections[0].text = ''
  assert.deepEqual(rulePlaceholderTextNotReplaced(s), [])
})

test('rulePlaceholderTextNotReplaced ignores sections without a known placeholder', () => {
  const s = makeSnapshot()
  s.analysisOverview.sections.push({
    key: 'unknown', nodeId: 'sub-x', bodyTextNodeId: 'x-body', text: 'whatever',
  })
  assert.deepEqual(rulePlaceholderTextNotReplaced(s), [])
})

import { ruleAnalyzeNeverRun } from './check-helpers.mjs'

test('ruleAnalyzeNeverRun returns [] when lastAnalyzedAt is set', () => {
  assert.deepEqual(ruleAnalyzeNeverRun(makeSnapshot()), [])
})

test('ruleAnalyzeNeverRun flags missing lastAnalyzedAt', () => {
  const findings = ruleAnalyzeNeverRun(makeSnapshot({ lastAnalyzedAt: null }))
  assert.equal(findings.length, 1)
  assert.equal(findings[0].rule, 'analyze-never-run')
  assert.equal(findings[0].severity, 'warn')
  assert.equal(findings[0].nodeId, 'sec-1')
  assert.match(findings[0].message, /lastAnalyzedAt/)
})

import { runRules } from './check-helpers.mjs'

test('runRules returns [] for an all-green snapshot', () => {
  assert.deepEqual(runRules(makeSnapshot()), [])
})

test('runRules orders findings: errors before warns', () => {
  const s = makeSnapshot({ lastAnalyzedAt: null }) // warn
  s.problemStatement.text = ''                      // error
  const findings = runRules(s)
  assert.equal(findings.length, 2)
  assert.equal(findings[0].severity, 'error')
  assert.equal(findings[1].severity, 'warn')
})

test('runRules orders within same severity by flowId then screenIndex', () => {
  const s = makeSnapshot()
  s.flows.push({
    flowId: 'flow-2',
    flowNodeId: 'flow-node-2',
    flowName: 'Checkout',
    slots: [
      { flowId: 'flow-2', screenIndex: 0, tagId: 't20', slotId: null,
        slotChildCount: 0, justificationId: null, justificationText: '' },
    ],
  })
  s.flows[0].slots[1].slotId = null
  s.flows[0].slots[1].slotChildCount = 0
  const findings = runRules(s).filter((f) => f.rule === 'empty-screen-slot')
  assert.equal(findings.length, 2)
  assert.equal(findings[0].context.flowId, 'flow-1')
  assert.equal(findings[0].context.screenIndex, 1)
  assert.equal(findings[1].context.flowId, 'flow-2')
})

test('runRules: placeholder match does not duplicate empty-analysis-section', () => {
  const s = makeSnapshot()
  s.analysisOverview.sections[0].text = ''
  const findings = runRules(s)
  const keys = findings.map((f) => f.rule)
  assert.ok(keys.includes('empty-analysis-section'))
  assert.ok(!keys.includes('placeholder-text-not-replaced'))
})

import { formatReport } from './check-helpers.mjs'

test('formatReport returns "tudo verde" for empty findings', () => {
  const out = formatReport([], makeSnapshot())
  assert.match(out, /Tudo verde/)
  assert.match(out, /PROD-1234/)
})

test('formatReport prints summary counts and ordered list', () => {
  const findings = [
    { rule: 'empty-problem-statement', severity: 'error', nodeId: 'x',
      message: 'Problem Statement está vazio.', context: {} },
    { rule: 'analyze-never-run', severity: 'warn', nodeId: 'sec-1',
      message: 'Análise nunca foi rodada.', context: {} },
  ]
  const out = formatReport(findings, makeSnapshot())
  assert.match(out, /1 erro/)
  assert.match(out, /1 aviso/)
  assert.match(out, /Problem Statement está vazio/)
  assert.match(out, /Análise nunca foi rodada/)
  // errors precede warns in the rendered list
  assert.ok(out.indexOf('Problem Statement') < out.indexOf('Análise nunca'))
})

test('formatReport preserves pt-BR diacritics', () => {
  const out = formatReport([
    { rule: 'empty-problem-statement', severity: 'error', nodeId: 'x',
      message: 'Aspectos críticos não foram avaliados.', context: {} },
  ], makeSnapshot())
  assert.match(out, /críticos não foram avaliados/)
})
