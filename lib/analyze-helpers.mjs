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

export function buildListSlotsJs({ sectionId } = {}) {
  if (!sectionId || typeof sectionId !== 'string') {
    throw new AnalyzeError('sectionId is required', { code: 'MISSING_SECTION_ID' })
  }
  const idLit = jsonStringify(sectionId)
  return `
await figma.loadAllPagesAsync()
const section = await figma.getNodeByIdAsync(${idLit})
if (!section) return JSON.stringify({ error: 'SECTION_NOT_FOUND' })

function meta(node, key) { return node.getSharedPluginData('meetCriteria', key) }
function role(node) { return meta(node, 'role') }
function intMeta(node, key) {
  const v = meta(node, key)
  return v === '' ? null : Number(v)
}

const tagsBySlot = new Map() // key = flowId|screenIndex
const slotsBySlot = new Map()
const justBySlot = new Map()
const slotKey = (f, i) => f + '|' + i

let analysisOverviewId = null
let analysisSubsectionKeys = []
const sideCardIds = { problemStatement: null, analysisOverview: null }

const flowMeta = new Map() // flowId -> { id, y }

function visit(node) {
  const r = role(node)
  if (r === 'screen-tag') {
    const fid = meta(node, 'flowId')
    const idx = intMeta(node, 'screenIndex')
    tagsBySlot.set(slotKey(fid, idx), { id: node.id, flowId: fid, screenIndex: idx })
  } else if (r === 'screen-slot') {
    const fid = meta(node, 'flowId')
    const idx = intMeta(node, 'screenIndex')
    slotsBySlot.set(slotKey(fid, idx), { id: node.id, flowId: fid, screenIndex: idx,
      x: node.x, y: node.y, width: node.width, height: node.height })
  } else if (r === 'screen-justification') {
    const fid = meta(node, 'flowId')
    const idx = intMeta(node, 'screenIndex')
    justBySlot.set(slotKey(fid, idx), { id: node.id, flowId: fid, screenIndex: idx,
      x: node.x, y: node.y, width: node.width, height: node.height })
  } else if (r === 'analysis-overview') {
    analysisOverviewId = node.id
    sideCardIds.analysisOverview = node.id
    if (node.children) {
      for (const c of node.children) {
        if (role(c) === 'analysis-section') {
          analysisSubsectionKeys.push(meta(c, 'key'))
        }
      }
    }
  } else if (r === 'problem-statement') {
    sideCardIds.problemStatement = node.id
  } else if (r === 'flow') {
    const fid = meta(node, 'flowId')
    flowMeta.set(fid, { id: node.id, y: node.y })
  }
  if (node.children) for (const c of node.children) visit(c)
}
visit(section)

// Build per-flow slot list, ordered by screenIndex.
const flowsOut = []
for (const [fid, fInfo] of flowMeta.entries()) {
  const slots = []
  const keys = [...new Set([...tagsBySlot.keys(), ...slotsBySlot.keys(), ...justBySlot.keys()])]
    .filter((k) => k.startsWith(fid + '|'))
    .sort((a, b) => Number(a.split('|')[1]) - Number(b.split('|')[1]))
  for (const k of keys) {
    const tag = tagsBySlot.get(k)
    const slot = slotsBySlot.get(k)
    const jus = justBySlot.get(k)
    if (!tag) continue
    slots.push({
      flowId: fid,
      screenIndex: tag.screenIndex,
      tagId: tag.id,
      slotId: slot ? slot.id : null,
      slotRect: slot ? { x: slot.x, y: slot.y, width: slot.width, height: slot.height } : null,
      justificationId: jus ? jus.id : null,
      placeholderRect: slot ? { x: slot.x, y: slot.y, width: slot.width, height: slot.height } : null,
    })
  }
  flowsOut.push({ flowId: fid, y: fInfo.y, slots })
}

return JSON.stringify({
  sectionId: section.id,
  sectionHeight: section.height,
  flows: flowsOut,
  analysisOverviewId,
  analysisSubsectionKeys,
  sideCardIds,
  rowsHeight: sideCardIds.problemStatement
    ? (await figma.getNodeByIdAsync(sideCardIds.problemStatement)).height
    : 0,
})
`
}

export function buildMigrateLayoutJs({ sectionId, layoutDelta } = {}) {
  if (!sectionId) throw new AnalyzeError('sectionId required', { code: 'MISSING_SECTION_ID' })
  if (!layoutDelta) throw new AnalyzeError('layoutDelta required', { code: 'MISSING_LAYOUT_DELTA' })

  const deltaLit = jsonStringify(layoutDelta)
  const sectionLit = jsonStringify(sectionId)

  return `
await figma.loadAllPagesAsync()
await figma.loadFontAsync({ family: 'Inter', style: 'Regular' })
await figma.loadFontAsync({ family: 'Inter', style: 'Semi Bold' })

const SECTION_ID = ${sectionLit}
const DELTA = ${deltaLit}
const section = await figma.getNodeByIdAsync(SECTION_ID)
if (!section) return JSON.stringify({ error: 'SECTION_NOT_FOUND' })

function setPD(node, data) {
  for (const [k, v] of Object.entries(data || {})) {
    const value = (typeof v === 'object' && v !== null) ? JSON.stringify(v) : String(v)
    node.setSharedPluginData('meetCriteria', k, value)
  }
}

// 1) Add missing screen-justification text nodes (idempotent: skip if any
//    sibling already carries the same flowId/screenIndex with that role).
const existingJustifications = new Set()
function visit(node) {
  if (node.getSharedPluginData('meetCriteria', 'role') === 'screen-justification') {
    const k = node.getSharedPluginData('meetCriteria', 'flowId') + '|' +
              node.getSharedPluginData('meetCriteria', 'screenIndex')
    existingJustifications.add(k)
  }
  if (node.children) for (const c of node.children) visit(c)
}
visit(section)

const created = []
for (const j of (DELTA.addJustifications || [])) {
  const key = j.flowId + '|' + j.screenIndex
  if (existingJustifications.has(key)) continue
  const t = figma.createText()
  t.fontName = { family: 'Inter', style: 'Regular' }
  t.fontSize = 18
  t.lineHeight = { unit: 'PERCENT', value: 130 }
  t.characters = ''
  t.x = j.x
  t.y = j.y
  t.resize(j.width, j.height)
  t.textAutoResize = 'HEIGHT'
  t.name = 'Screen justification — ' + j.flowId + ' / ' + j.screenIndex
  setPD(t, { role: 'screen-justification', flowId: j.flowId, screenIndex: j.screenIndex })
  section.appendChild(t)
  created.push(t.id)
}

// 2) Shift specified children downward.
//    NOT IDEMPOTENT in isolation: each invocation adds deltaY again. Safe under
//    the detect → list-slots → planMigration → migrate cycle (re-listing slots
//    after a shift produces no new shift). Do NOT execute this JS twice with
//    the same delta without re-running buildListSlotsJs in between.
for (const op of (DELTA.shiftBelow || [])) {
  for (const id of op.childIds) {
    const node = await figma.getNodeByIdAsync(id)
    if (node && typeof node.y === 'number') node.y = node.y + op.deltaY
  }
}

// 3) Grow section.
if (DELTA.growSection) {
  section.resizeWithoutConstraints(section.width, DELTA.growSection.newHeight)
}

// 4) Resize side cards (height only).
if (DELTA.resizeSideCards) {
  for (const key of ['problemStatement', 'analysisOverview']) {
    const card = DELTA.resizeSideCards[key]
    if (!card) continue
    const node = await figma.getNodeByIdAsync(card.id)
    if (node) node.resize(node.width, card.height)
  }
}

// 5) Add gap-check sub-section if missing.
if (DELTA.addGapCheckSubsection) {
  const ao = await figma.getNodeByIdAsync(DELTA.addGapCheckSubsection.analysisOverviewId)
  if (ao && ao.children) {
    const exists = ao.children.find((c) =>
      c.getSharedPluginData('meetCriteria', 'role') === 'analysis-section' &&
      c.getSharedPluginData('meetCriteria', 'key') === DELTA.addGapCheckSubsection.key)
    if (!exists) {
      const sub = figma.createFrame()
      sub.name = 'Section — ' + DELTA.addGapCheckSubsection.key
      sub.layoutMode = 'VERTICAL'
      sub.itemSpacing = 20
      sub.fills = []
      const heading = figma.createText()
      heading.fontName = { family: 'Inter', style: 'Semi Bold' }
      heading.fontSize = 28
      heading.characters = DELTA.addGapCheckSubsection.heading
      heading.textAutoResize = 'HEIGHT'
      sub.appendChild(heading)
      heading.layoutSizingHorizontal = 'FILL'
      const body = figma.createText()
      body.fontName = { family: 'Inter', style: 'Regular' }
      body.fontSize = 20
      body.lineHeight = { unit: 'PERCENT', value: 120 }
      body.characters = DELTA.addGapCheckSubsection.body
      body.textAutoResize = 'HEIGHT'
      sub.appendChild(body)
      body.layoutSizingHorizontal = 'FILL'
      setPD(sub, { role: 'analysis-section', key: DELTA.addGapCheckSubsection.key })
      ao.appendChild(sub)
      sub.layoutSizingHorizontal = 'FILL'
      sub.layoutSizingVertical = 'HUG'
    }
  }
}

return JSON.stringify({ migrated: true, createdJustificationIds: created })
`
}
