// Pure helpers for /meet-criteria-analyze. No I/O, no Figma runtime dependency
// — all builders return strings of JS to be passed to figma_execute by the
// orchestrating skill. Validators throw structured AnalyzeError on bad input.

import { LAYOUT_CONSTANTS } from './layout-feature.mjs'

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

export function formatGapCheckForFigma(gapCheck) {
  // Caller is expected to have passed gapCheck through validateGapCheck.
  const header = gapCheck.summary
  if (gapCheck.gaps.length === 0) return header
  const lines = [header, '']
  for (const g of gapCheck.gaps) {
    lines.push(`• [${g.kind.toUpperCase()}] ${g.ticketAspect} — ${g.evidence}`)
  }
  const out = lines.join('\n')
  if (out.length <= GAP_CHECK_FORMATTED_MAX) return out
  // Hard truncate with ellipsis. Caller has been warned at validation step
  // that summary alone is fine; bullet overflow indicates too many gaps.
  return out.slice(0, GAP_CHECK_FORMATTED_MAX - 1) + '…'
}

const ROW_DELTA = LAYOUT_CONSTANTS.JUSTIFICATION_HEIGHT + LAYOUT_CONSTANTS.IPHONE_TO_JUSTIFICATION_GAP

// Note on shiftBelow / flowChildIds: when a legacy deliverable has 2+ flows
// and the first one needs a justification backfill, the flows below must
// shift down. This requires `slotsReport.flowChildIds[flowId]` to enumerate
// the node IDs to shift. buildListSlotsJs (Task 11) does NOT populate this
// field for the MVP — the orchestrating skill is expected to either supply
// it via a follow-up Figma query, or accept the limitation that legacy
// migrations of multi-flow deliverables may misalign. Single-flow legacy
// deliverables and new deliverables are unaffected.
export function planMigration({ slotsReport, hasGapCheck }) {
  const addJustifications = []
  const shiftBelow = []

  // Track which flows lack at least one justification — they cause subsequent
  // flow rows to shift downward.
  const flowsNeedingGrow = new Set()

  for (const flow of slotsReport.flows) {
    let flowNeeds = false
    for (const slot of flow.slots) {
      if (slot.justificationId) continue
      const ph = slot.placeholderRect
      if (!ph) continue
      addJustifications.push({
        flowId: slot.flowId,
        screenIndex: slot.screenIndex,
        x: ph.x,
        y: ph.y + ph.height + LAYOUT_CONSTANTS.IPHONE_TO_JUSTIFICATION_GAP,
        width: ph.width,
        height: LAYOUT_CONSTANTS.JUSTIFICATION_HEIGHT,
      })
      flowNeeds = true
    }
    if (flowNeeds) flowsNeedingGrow.add(flow.flowId)
  }

  // For each flow that gained justifications, shift all flows BELOW it by ROW_DELTA.
  // Cumulative: if both flow-1 and flow-2 grow, flow-3 shifts by 2 * ROW_DELTA.
  let cumulativeShift = 0
  for (const flow of slotsReport.flows) {
    if (cumulativeShift > 0 && slotsReport.flowChildIds?.[flow.flowId]) {
      shiftBelow.push({ childIds: slotsReport.flowChildIds[flow.flowId], deltaY: cumulativeShift })
    }
    if (flowsNeedingGrow.has(flow.flowId)) cumulativeShift += ROW_DELTA
  }

  const totalGrowth = ROW_DELTA * flowsNeedingGrow.size

  const addGapCheckSubsection = hasGapCheck ? null : {
    analysisOverviewId: slotsReport.analysisOverviewId,
    key: 'gap-check',
    heading: 'Gap check vs ticket',
    body: 'Run /meet-criteria-analyze to compare the ticket against the delivered screens.',
  }

  if (addJustifications.length === 0 && !addGapCheckSubsection) {
    return null
  }

  return {
    addJustifications,
    shiftBelow,
    growSection: totalGrowth > 0
      ? { newHeight: (slotsReport.sectionHeight ?? 0) + totalGrowth }
      : null,
    resizeSideCards: totalGrowth > 0 ? {
      problemStatement: { id: slotsReport.sideCardIds.problemStatement, height: slotsReport.rowsHeight + totalGrowth },
      analysisOverview: { id: slotsReport.sideCardIds.analysisOverview, height: slotsReport.rowsHeight + totalGrowth },
    } : null,
    addGapCheckSubsection,
  }
}

function jsonStringify(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c')
}

export function buildDetectDeliverableJs({ slug = null } = {}) {
  const slugLiteral = jsonStringify(slug)
  return `
const TARGET_SLUG = ${slugLiteral}
await figma.loadAllPagesAsync()

function readMeta(node) {
  const role = node.getSharedPluginData('meetCriteria', 'role')
  if (role !== 'root') return null
  // config is JSON-serialized by render-manifest. Defensive parse — malformed
  // values (e.g. user edits) must not crash the detection scan.
  const configRaw = node.getSharedPluginData('meetCriteria', 'config') || ''
  let configSlug = ''
  try { configSlug = (JSON.parse(configRaw).slug || '') } catch (_) {}
  return {
    sectionId: node.id,
    pageId: node.parent && node.parent.id,
    ticketRef: node.getSharedPluginData('meetCriteria', 'ticketRef'),
    slug: configSlug,
    type: node.getSharedPluginData('meetCriteria', 'type'),
  }
}

const candidates = []
const scope = TARGET_SLUG
  ? figma.root.children.flatMap((p) => p.children)
  : figma.currentPage.children
for (const node of scope) {
  const meta = readMeta(node)
  if (!meta) continue
  if (TARGET_SLUG && meta.slug !== TARGET_SLUG && meta.ticketRef !== TARGET_SLUG) continue
  candidates.push(meta)
}

if (candidates.length === 0) {
  return JSON.stringify({ found: false })
}
if (candidates.length > 1) {
  return JSON.stringify({ found: true, ambiguous: true, candidates })
}
return JSON.stringify({ found: true, ambiguous: false, ...candidates[0] })
`
}
