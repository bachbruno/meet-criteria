// Pure helpers for /meet-criteria-analyze. No I/O, no Figma runtime dependency
// — all builders return strings of JS to be passed to figma_execute by the
// orchestrating skill. Validators throw structured AnalyzeError on bad input.

export class AnalyzeError extends Error {
  constructor(message, { code = 'UNKNOWN', details = null } = {}) {
    super(message)
    this.name = 'AnalyzeError'
    this.code = code
    this.details = details
  }
}

const SCREEN_JUSTIFICATION_MAX = 240
const FINAL_SECTION_MAX = 600
const GAP_CHECK_FORMATTED_MAX = 800
const GAP_KINDS = new Set(['missing', 'ambiguous', 'extra'])

export function validateScreenJustification(text) {
  if (typeof text !== 'string') {
    throw new AnalyzeError('screen justification must be a string', { code: 'JUSTIFICATION_INVALID_TYPE' })
  }
  const trimmed = text.trim()
  if (trimmed === '') {
    throw new AnalyzeError('screen justification is empty', { code: 'JUSTIFICATION_EMPTY' })
  }
  return trimmed.length > SCREEN_JUSTIFICATION_MAX
    ? trimmed.slice(0, SCREEN_JUSTIFICATION_MAX)
    : trimmed
}

const FINAL_KEYS = ['resolution', 'validation', 'attention', 'discussion']

export function validateFinalAnalysis(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
    throw new AnalyzeError('final analysis must be an object', { code: 'FINAL_ANALYSIS_INVALID_JSON' })
  }
  const out = {}
  for (const key of FINAL_KEYS) {
    const v = obj[key]
    if (typeof v !== 'string' || v.trim() === '') {
      throw new AnalyzeError(`final analysis is missing key "${key}"`, {
        code: 'FINAL_ANALYSIS_MISSING_KEY', details: { key },
      })
    }
    const trimmed = v.trim()
    out[key] = trimmed.length > FINAL_SECTION_MAX ? trimmed.slice(0, FINAL_SECTION_MAX) : trimmed
  }
  return out
}

export function validateGapCheck(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
    throw new AnalyzeError('gap-check must be an object', { code: 'GAP_CHECK_INVALID_JSON' })
  }
  if (typeof obj.summary !== 'string' || obj.summary.trim() === '') {
    throw new AnalyzeError('gap-check.summary missing', { code: 'GAP_CHECK_INVALID_JSON' })
  }
  if (!Array.isArray(obj.gaps)) {
    throw new AnalyzeError('gap-check.gaps must be an array', { code: 'GAP_CHECK_INVALID_JSON' })
  }
  for (const [i, g] of obj.gaps.entries()) {
    if (!g || typeof g !== 'object' || !GAP_KINDS.has(g.kind)) {
      throw new AnalyzeError(`gap-check.gaps[${i}].kind invalid`, {
        code: 'GAP_CHECK_INVALID_GAP', details: { index: i, kind: g?.kind },
      })
    }
    if (typeof g.ticketAspect !== 'string' || g.ticketAspect.trim() === '' ||
        typeof g.evidence !== 'string' || g.evidence.trim() === '') {
      throw new AnalyzeError(`gap-check.gaps[${i}] missing ticketAspect or evidence`, {
        code: 'GAP_CHECK_INVALID_GAP', details: { index: i },
      })
    }
  }
  return {
    summary: obj.summary.trim(),
    gaps: obj.gaps.map((g) => ({
      kind: g.kind,
      ticketAspect: g.ticketAspect.trim(),
      evidence: g.evidence.trim(),
    })),
  }
}
