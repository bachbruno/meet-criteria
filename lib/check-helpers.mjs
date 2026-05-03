// Pure helpers for /meet-criteria-check. No I/O, no Figma runtime dependency
// — builders return JS strings to be passed to figma_execute by the
// orchestrating skill. Rules are pure (snapshot) => Finding[] functions.

export class CheckError extends Error {
  constructor(message, { code = 'UNKNOWN', details = null } = {}) {
    super(message)
    this.name = 'CheckError'
    this.code = code
    this.details = details
  }
}

function jsonStringify(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c')
}

export function buildCheckSnapshotJs({ sectionId, knownPlaceholders = {} } = {}) {
  if (!sectionId || typeof sectionId !== 'string') {
    throw new CheckError('sectionId is required', { code: 'MISSING_SECTION_ID' })
  }
  const idLit = jsonStringify(sectionId)
  const knownLit = jsonStringify(knownPlaceholders)
  return `
await figma.loadAllPagesAsync()
const section = await figma.getNodeByIdAsync(${idLit})
if (!section) return JSON.stringify({ error: 'SECTION_NOT_FOUND' })

const KNOWN_PLACEHOLDERS = ${knownLit}

function meta(node, key) { return node.getSharedPluginData('meetCriteria', key) }
function role(node) { return meta(node, 'role') }
function intMeta(node, key) { const v = meta(node, key); return v === '' ? null : Number(v) }
function textOf(node) { return (node && node.type === 'TEXT') ? (node.characters || '') : '' }
function firstTextChild(node) {
  if (!node || !node.children) return null
  return node.children.find((c) => c.type === 'TEXT') || null
}
function nthTextChild(node, n) {
  if (!node || !node.children) return null
  const texts = node.children.filter((c) => c.type === 'TEXT')
  return texts[n] || null
}

let problemStatement = null
let analysisOverview = null
const flowMap = new Map()

function ensureFlow(flowId) {
  if (!flowMap.has(flowId)) {
    flowMap.set(flowId, { flowId, flowNodeId: null, flowName: '', slots: new Map() })
  }
  return flowMap.get(flowId)
}
function ensureSlot(flowId, idx) {
  const f = ensureFlow(flowId)
  if (!f.slots.has(idx)) {
    f.slots.set(idx, {
      flowId, screenIndex: idx,
      tagId: null, slotId: null, slotChildCount: 0,
      justificationId: null, justificationText: '',
    })
  }
  return f.slots.get(idx)
}

function visit(node) {
  const r = role(node)
  if (r === 'problem-statement') {
    const body = nthTextChild(node, 1) || firstTextChild(node)
    problemStatement = body
      ? { nodeId: body.id, text: textOf(body) }
      : { nodeId: node.id, text: '' }
  } else if (r === 'flow') {
    const flowId = meta(node, 'flowId')
    const f = ensureFlow(flowId)
    f.flowNodeId = node.id
    const banner = firstTextChild(node)
    f.flowName = banner ? textOf(banner) : ''
  } else if (r === 'screen-tag') {
    const flowId = meta(node, 'flowId')
    const idx = intMeta(node, 'screenIndex')
    const slot = ensureSlot(flowId, idx)
    slot.tagId = node.id
  } else if (r === 'screen-slot') {
    const flowId = meta(node, 'flowId')
    const idx = intMeta(node, 'screenIndex')
    const slot = ensureSlot(flowId, idx)
    slot.slotId = node.id
    slot.slotChildCount = (node.children || []).length
  } else if (r === 'screen-justification') {
    const flowId = meta(node, 'flowId')
    const idx = intMeta(node, 'screenIndex')
    const slot = ensureSlot(flowId, idx)
    slot.justificationId = node.id
    slot.justificationText = textOf(node)
  } else if (r === 'analysis-overview') {
    const sections = []
    if (node.children) {
      for (const sub of node.children) {
        if (role(sub) !== 'analysis-section') continue
        const key = meta(sub, 'key')
        const body = nthTextChild(sub, 1)
        sections.push({
          key,
          nodeId: sub.id,
          bodyTextNodeId: body ? body.id : null,
          text: body ? textOf(body) : '',
        })
      }
    }
    analysisOverview = { nodeId: node.id, sections }
  }
  if (node.children) for (const c of node.children) visit(c)
}
visit(section)

const flowsArr = [...flowMap.values()].map((f) => ({
  flowId: f.flowId,
  flowNodeId: f.flowNodeId,
  flowName: f.flowName,
  slots: [...f.slots.values()].sort((a, b) => a.screenIndex - b.screenIndex),
}))

let lastAnalyzedAt = null
const lar = section.getSharedPluginData('meetCriteria', 'lastAnalyzedAt')
if (lar && typeof lar === 'string' && lar.trim() !== '' && !Number.isNaN(Date.parse(lar))) {
  lastAnalyzedAt = lar
}

return JSON.stringify({
  sectionId: section.id,
  ticketRef: section.getSharedPluginData('meetCriteria', 'ticketRef') || '',
  type: section.getSharedPluginData('meetCriteria', 'type') || '',
  lastAnalyzedAt,
  problemStatement,
  flows: flowsArr,
  analysisOverview,
  knownPlaceholders: KNOWN_PLACEHOLDERS,
})
`
}

export function ruleEmptyProblemStatement(snapshot) {
  const ps = snapshot.problemStatement
  if (ps && typeof ps.text === 'string' && ps.text.trim() !== '') return []
  return [{
    rule: 'empty-problem-statement',
    severity: 'error',
    nodeId: ps?.nodeId ?? snapshot.sectionId,
    message: 'Problem Statement está vazio.',
    context: {},
  }]
}

export function ruleEmptyScreenSlot(snapshot) {
  const findings = []
  for (const flow of snapshot.flows ?? []) {
    for (const slot of flow.slots ?? []) {
      if (slot.slotId !== null && slot.slotChildCount > 0) continue
      findings.push({
        rule: 'empty-screen-slot',
        severity: 'error',
        nodeId: slot.slotId ?? slot.tagId ?? snapshot.sectionId,
        message: `Tela ${slot.screenIndex + 1} do flow "${flow.flowName}" não recebeu Paste-to-Replace.`,
        context: { flowId: slot.flowId, screenIndex: slot.screenIndex },
      })
    }
  }
  return findings
}

export function ruleEmptyJustification(snapshot) {
  const findings = []
  for (const flow of snapshot.flows ?? []) {
    for (const slot of flow.slots ?? []) {
      if (slot.slotChildCount === 0) continue           // pristine — caught by empty-screen-slot
      if (slot.justificationId === null) continue       // no node to point at
      if ((slot.justificationText ?? '').trim() !== '') continue
      findings.push({
        rule: 'empty-justification',
        severity: 'warn',
        nodeId: slot.justificationId,
        message: `Tela ${slot.screenIndex + 1} do flow "${flow.flowName}" sem justificativa — rode /meet-criteria-analyze.`,
        context: { flowId: slot.flowId, screenIndex: slot.screenIndex },
      })
    }
  }
  return findings
}
