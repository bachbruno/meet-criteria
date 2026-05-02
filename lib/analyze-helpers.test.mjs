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
