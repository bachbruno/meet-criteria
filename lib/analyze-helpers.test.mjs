import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  AnalyzeError,
  validateScreenJustification,
  validateFinalAnalysis,
  validateGapCheck,
  formatGapCheckForFigma,
} from './analyze-helpers.mjs'

test('AnalyzeError carries code and details', () => {
  const e = new AnalyzeError('boom', { code: 'TEST_CODE', details: { foo: 1 } })
  assert.equal(e.name, 'AnalyzeError')
  assert.equal(e.message, 'boom')
  assert.equal(e.code, 'TEST_CODE')
  assert.deepEqual(e.details, { foo: 1 })
})

test('validateScreenJustification trims and accepts ≤240 chars', () => {
  assert.equal(validateScreenJustification('  hello world  '), 'hello world')
})

test('validateScreenJustification truncates >240 chars with warning code', () => {
  const long = 'a'.repeat(300)
  const out = validateScreenJustification(long)
  assert.equal(out.length, 240)
})

test('validateScreenJustification throws on non-string or empty', () => {
  assert.throws(() => validateScreenJustification(''), (e) => e.code === 'JUSTIFICATION_EMPTY')
  assert.throws(() => validateScreenJustification(null), (e) => e.code === 'JUSTIFICATION_INVALID_TYPE')
  assert.throws(() => validateScreenJustification('   '), (e) => e.code === 'JUSTIFICATION_EMPTY')
})

test('validateFinalAnalysis accepts a well-formed object', () => {
  const ok = {
    resolution: 'A.', validation: 'B.', attention: 'C.', discussion: 'D.',
  }
  assert.deepEqual(validateFinalAnalysis(ok), ok)
})

test('validateFinalAnalysis throws on missing key', () => {
  assert.throws(() => validateFinalAnalysis({ resolution: 'A.', validation: 'B.', attention: 'C.' }),
    (e) => e.code === 'FINAL_ANALYSIS_MISSING_KEY')
})

test('validateFinalAnalysis throws on non-string value', () => {
  assert.throws(() => validateFinalAnalysis({ resolution: 1, validation: 'B', attention: 'C', discussion: 'D' }),
    (e) => e.code === 'FINAL_ANALYSIS_MISSING_KEY')
})

test('validateFinalAnalysis truncates each value to 600 chars', () => {
  const big = { resolution: 'a'.repeat(800), validation: 'b', attention: 'c', discussion: 'd' }
  const out = validateFinalAnalysis(big)
  assert.equal(out.resolution.length, 600)
  assert.equal(out.validation, 'b')
})

test('validateGapCheck accepts well-formed object', () => {
  const ok = {
    summary: 'No gaps.',
    gaps: [{ kind: 'missing', ticketAspect: 'X', evidence: 'Y' }],
  }
  assert.deepEqual(validateGapCheck(ok), ok)
})

test('validateGapCheck rejects invalid gap.kind', () => {
  assert.throws(() => validateGapCheck({
    summary: 'S', gaps: [{ kind: 'bogus', ticketAspect: 'X', evidence: 'Y' }],
  }), (e) => e.code === 'GAP_CHECK_INVALID_GAP')
})

test('validateGapCheck rejects gap with missing fields', () => {
  assert.throws(() => validateGapCheck({
    summary: 'S', gaps: [{ kind: 'missing', ticketAspect: 'X' }],
  }), (e) => e.code === 'GAP_CHECK_INVALID_GAP')
})

test('validateGapCheck rejects missing summary', () => {
  assert.throws(() => validateGapCheck({ gaps: [] }),
    (e) => e.code === 'GAP_CHECK_INVALID_JSON')
})

test('validateGapCheck accepts empty gaps array', () => {
  const ok = { summary: 'All good.', gaps: [] }
  assert.deepEqual(validateGapCheck(ok), ok)
})

test('formatGapCheckForFigma renders summary + bullet list', () => {
  const out = formatGapCheckForFigma({
    summary: 'Two gaps detected.',
    gaps: [
      { kind: 'missing', ticketAspect: '2FA confirmation', evidence: 'No screen shows it.' },
      { kind: 'ambiguous', ticketAspect: 'Granular permissions', evidence: 'Only a global toggle appears.' },
    ],
  })
  assert.match(out, /^Two gaps detected\./)
  assert.match(out, /\[MISSING\] 2FA confirmation/)
  assert.match(out, /\[AMBIGUOUS\] Granular permissions/)
})

test('formatGapCheckForFigma handles empty gaps', () => {
  const out = formatGapCheckForFigma({ summary: 'No gaps.', gaps: [] })
  assert.equal(out, 'No gaps.')
})

test('formatGapCheckForFigma truncates above 800 chars with ellipsis', () => {
  const big = {
    summary: 'A'.repeat(200),
    gaps: Array.from({ length: 30 }, (_, i) => ({
      kind: 'missing', ticketAspect: 'aspect ' + i, evidence: 'B'.repeat(50),
    })),
  }
  const out = formatGapCheckForFigma(big)
  assert.ok(out.length <= 800, `length ${out.length}`)
  assert.match(out, /…$/)
})

import { planMigration } from './analyze-helpers.mjs'

test('planMigration returns null when nothing to do', () => {
  const slotsReport = {
    sectionId: 'sec1',
    rowsHeight: 1000,
    flows: [
      { flowId: 'flow-1', y: 280, slots: [
        { flowId: 'flow-1', screenIndex: 0, tagId: 't1', slotId: 's1', justificationId: 'j1', justification: { x: 0, y: 0, width: 0, height: 0 } },
      ]},
    ],
    sideCardIds: { problemStatement: 'p1', analysisOverview: 'a1' },
  }
  const out = planMigration({ slotsReport, hasGapCheck: true })
  assert.equal(out, null)
})

test('planMigration adds justifications for slots that lack them', () => {
  const slotsReport = {
    sectionId: 'sec1',
    rowsHeight: 1000,
    flows: [
      { flowId: 'flow-1', y: 280, slots: [
        { flowId: 'flow-1', screenIndex: 0, tagId: 't1', slotId: 's1', justificationId: null,
          placeholderRect: { x: 100, y: 200, width: 390, height: 844 } },
      ]},
    ],
    sideCardIds: { problemStatement: 'p1', analysisOverview: 'a1' },
    analysisOverviewId: 'a1',
    flowRowYs: [280],
  }
  const delta = planMigration({ slotsReport, hasGapCheck: true })
  assert.ok(delta)
  assert.equal(delta.addJustifications.length, 1)
  assert.equal(delta.addJustifications[0].flowId, 'flow-1')
  assert.equal(delta.addJustifications[0].screenIndex, 0)
  assert.equal(delta.addJustifications[0].x, 100)
  assert.equal(delta.addJustifications[0].y, 200 + 844 + 16) // IPHONE_TO_JUSTIFICATION_GAP
  assert.equal(delta.addJustifications[0].width, 390)
  assert.equal(delta.addJustifications[0].height, 120) // JUSTIFICATION_HEIGHT
  assert.equal(delta.addGapCheckSubsection, null)
})

test('planMigration shifts subsequent flow rows and grows section', () => {
  const slotsReport = {
    sectionId: 'sec1',
    rowsHeight: 2000,
    sectionHeight: 2560,
    flows: [
      { flowId: 'flow-1', y: 280, slots: [
        { flowId: 'flow-1', screenIndex: 0, tagId: 't1', slotId: null, justificationId: null,
          placeholderRect: { x: 100, y: 200, width: 390, height: 844 } },
      ]},
      { flowId: 'flow-2', y: 1500, slots: [
        { flowId: 'flow-2', screenIndex: 0, tagId: 't2', slotId: null, justificationId: 'j2',
          placeholderRect: { x: 100, y: 1700, width: 390, height: 844 } },
      ]},
    ],
    sideCardIds: { problemStatement: 'p1', analysisOverview: 'a1' },
    analysisOverviewId: 'a1',
    flowRowYs: [280, 1500],
    flowChildIds: { 'flow-1': ['t1', 'b1'], 'flow-2': ['t2', 'b2', 'j2'] },
  }
  const delta = planMigration({ slotsReport, hasGapCheck: true })
  assert.equal(delta.addJustifications.length, 1) // only flow-1 needed
  assert.equal(delta.addJustifications[0].flowId, 'flow-1')
  // flow-2 must shift down by JUSTIFICATION_HEIGHT + IPHONE_TO_JUSTIFICATION_GAP = 136
  assert.deepEqual(delta.shiftBelow, [
    { childIds: ['t2', 'b2', 'j2'], deltaY: 136 },
  ])
  // section grows by 1 row * 136
  assert.equal(delta.growSection.newHeight, 2560 + 136)
  // side cards grow proportionally
  assert.equal(delta.resizeSideCards.problemStatement.height, 2000 + 136)
  assert.equal(delta.resizeSideCards.analysisOverview.height, 2000 + 136)
})

test('planMigration adds gap-check subsection when missing', () => {
  const slotsReport = {
    sectionId: 'sec1', rowsHeight: 1000, sectionHeight: 1560,
    flows: [{ flowId: 'flow-1', y: 280, slots: [
      { flowId: 'flow-1', screenIndex: 0, tagId: 't1', slotId: 's1', justificationId: 'j1' },
    ]}],
    sideCardIds: { problemStatement: 'p1', analysisOverview: 'a1' },
    analysisOverviewId: 'a1',
    flowRowYs: [280],
  }
  const delta = planMigration({ slotsReport, hasGapCheck: false })
  assert.ok(delta.addGapCheckSubsection)
  assert.equal(delta.addGapCheckSubsection.analysisOverviewId, 'a1')
  assert.equal(delta.addGapCheckSubsection.key, 'gap-check')
  assert.equal(delta.addGapCheckSubsection.heading, 'Gap check vs ticket')
})

import vm from 'node:vm'
import { buildDetectDeliverableJs } from './analyze-helpers.mjs'

function assertParseable(js) {
  // Wrap as async function body so top-level `await` parses.
  const src = `(async () => { ${js} })`
  assert.doesNotThrow(() => new vm.Script(src), `JS must parse: ${js.slice(0, 200)}...`)
}

test('buildDetectDeliverableJs returns parseable JS', () => {
  const js = buildDetectDeliverableJs({ slug: null })
  assertParseable(js)
  assert.match(js, /loadAllPagesAsync/)
  assert.match(js, /getSharedPluginData\(['"]meetCriteria['"], ['"]role['"]\)/)
  assert.match(js, /'root'/)
})

test('buildDetectDeliverableJs includes slug filter when provided', () => {
  const js = buildDetectDeliverableJs({ slug: 'prod-1234' })
  assert.match(js, /prod-1234/)
})

test('buildDetectDeliverableJs without slug only scans current page', () => {
  const js = buildDetectDeliverableJs({ slug: null })
  assert.match(js, /figma\.currentPage/)
})

test('buildDetectDeliverableJs escapes injection-prone slug input', () => {
  const js = buildDetectDeliverableJs({ slug: '</script><x>"\'\n' })
  assert.doesNotMatch(js, /<\/script>/)
  assertParseable(js)
})
