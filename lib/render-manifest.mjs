// Constrói o manifest de renderização — plano declarativo consumido pela skill
// /meet-criteria-new para emitir chamadas figma_execute. Função pura: sem I/O,
// sem time-of-day implícito (createdAt é parâmetro).
//
// Forma do manifest:
// {
//   version, type, slug, ticketRef, createdAt,
//   identity: { mode, overrides },
//   tokens:   { <tokenName>: <hex> },
//   layout:   { kind, gap, padding, background },
//   page:     { name },
//   container:{ name, pluginData: { role:'root', ... } },
//   nodes:    [ { id, component, ...content/children } ],
//   checks:   { deterministic: [string] }
// }

import { resolveTokenRefs } from './visual-tokens.mjs'

export const MANIFEST_VERSION = '1.0.0'

export class RenderInputError extends Error {
  constructor(message, { code = 'UNKNOWN' } = {}) {
    super(message)
    this.name = 'RenderInputError'
    this.code = code
  }
}

function requireString(value, label, code = 'INVALID_INPUT') {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new RenderInputError(`${label} deve ser string não-vazia`, { code })
  }
  return value.trim()
}

function buildContextNode(structureNode, { ticketRef }) {
  return {
    id: structureNode.id,
    component: structureNode.component,
    title: ticketRef,
    icon: structureNode.props?.icon ?? 'star',
    pluginData: { role: 'context-macro' },
    style: {
      background: structureNode.props?.tokenBackground ?? '#ffffff',
    },
  }
}

function buildProblemStatementNode(structureNode, { problemStatement }) {
  if (typeof problemStatement !== 'string' || problemStatement.trim() === '') {
    throw new RenderInputError('problem-statement vazio (check determinístico problem-statement-not-empty)', { code: 'EMPTY_PROBLEM_STATEMENT' })
  }
  return {
    id: structureNode.id,
    component: structureNode.component,
    text: problemStatement.trim(),
    pluginData: { role: 'problem-statement' },
  }
}

function buildFlowsNode(structureNode, { flows }) {
  const minCount = structureNode.minCount ?? 1
  const maxCount = structureNode.maxCount ?? 10
  const list = Array.isArray(flows) ? flows : []
  if (list.length < minCount) {
    throw new RenderInputError(`feature.flows tem ${list.length} item(s); mínimo ${minCount} (minCount)`, { code: 'FLOWS_BELOW_MIN' })
  }
  if (list.length > maxCount) {
    throw new RenderInputError(`feature.flows tem ${list.length} item(s); máximo ${maxCount} (maxCount)`, { code: 'FLOWS_ABOVE_MAX' })
  }
  const minScreens = structureNode.itemTemplate?.props?.minScreens ?? 1
  const maxScreens = structureNode.itemTemplate?.props?.maxScreens ?? 20

  const children = list.map((f, i) => {
    const flowId = `flow-${i + 1}`
    const name = requireString(f?.name ?? `Fluxo ${i + 1}`, `flows[${i}].name`, 'INVALID_FLOW_NAME')
    const screensCount = Number(f?.screens ?? 0)
    if (!Number.isInteger(screensCount) || screensCount < minScreens) {
      throw new RenderInputError(`flows[${i}].screens=${f?.screens} abaixo do minScreens=${minScreens}`, { code: 'SCREENS_BELOW_MIN' })
    }
    if (screensCount > maxScreens) {
      throw new RenderInputError(`flows[${i}].screens=${screensCount} acima do maxScreens=${maxScreens}`, { code: 'SCREENS_ABOVE_MAX' })
    }
    const screens = Array.from({ length: screensCount }, (_, j) => ({
      pluginData: { role: 'screen-slot', flowId, screenIndex: j },
    }))
    return {
      pluginData: { role: 'flow', flowId },
      header: { component: 'SectionHeader', text: name },
      screens,
    }
  })
  return { id: structureNode.id, component: 'FlowList', pluginData: { role: 'flow-list' }, children }
}

function buildComparativeNode(structureNode, { pairs }) {
  const minCount = structureNode.minCount ?? 1
  const maxCount = structureNode.maxCount ?? 20
  const list = Array.isArray(pairs) ? pairs : []
  if (list.length < minCount) {
    throw new RenderInputError(`${structureNode.id}.pairs tem ${list.length}; mínimo ${minCount} (minCount)`, { code: 'PAIRS_BELOW_MIN' })
  }
  if (list.length > maxCount) {
    throw new RenderInputError(`${structureNode.id}.pairs tem ${list.length}; máximo ${maxCount} (maxCount)`, { code: 'PAIRS_ABOVE_MAX' })
  }
  const labels = structureNode.props?.labels ?? ['Antes', 'Depois']
  const children = list.map((pair, i) => {
    const slots = labels.map((label) => ({
      label,
      pluginData: { role: 'screen-slot', pairIndex: i, label },
    }))
    return {
      pluginData: {
        role: 'comparative',
        kind: 'before-after',
        pairIndex: i,
        name: pair?.label ?? `Tela ${String(i + 1).padStart(2, '0')}`,
      },
      slots,
    }
  })
  return { id: structureNode.id, component: 'Comparative', pluginData: { role: 'comparative-list' }, children }
}

function buildVariantsNode(structureNode, { variants }) {
  const minCount = structureNode.minCount ?? 2
  const maxCount = structureNode.maxCount ?? 5
  const list = Array.isArray(variants) ? variants : []
  if (list.length < minCount) {
    throw new RenderInputError(`conceito.variants tem ${list.length}; mínimo ${minCount} (minCount)`, { code: 'VARIANTS_BELOW_MIN' })
  }
  if (list.length > maxCount) {
    throw new RenderInputError(`conceito.variants tem ${list.length}; máximo ${maxCount} (maxCount)`, { code: 'VARIANTS_ABOVE_MAX' })
  }
  const labels = structureNode.props?.labels ?? ['Variante A', 'Variante B', 'Variante C', 'Variante D', 'Variante E']
  const slots = list.map((v, i) => ({
    label: labels[i] ?? `Variante ${i + 1}`,
    note: typeof v === 'string' ? v : (v?.note ?? ''),
    pluginData: { role: 'screen-slot', variantIndex: i },
  }))
  return {
    id: structureNode.id,
    component: 'Comparative',
    pluginData: { role: 'comparative-list', kind: 'variants' },
    children: [{ pluginData: { role: 'comparative', kind: 'variants' }, slots }],
  }
}

function buildDecisionCriteriaNode(structureNode, { decisionCriteria }) {
  return {
    id: structureNode.id,
    component: 'DecisionCriteria',
    text: typeof decisionCriteria === 'string' ? decisionCriteria : '',
    pluginData: { role: 'decision-criteria' },
  }
}

function buildFinalAnalysisNode(structureNode) {
  const sections = structureNode.sections ?? ['resolution', 'strengths', 'attention', 'discussion']
  return {
    id: structureNode.id,
    component: 'FinalAnalysis',
    sections: sections.map((key) => ({ key, text: '' })),
    pluginData: { role: 'final-analysis' },
  }
}

const NODE_BUILDERS = {
  ContextMacro: buildContextNode,
  ProblemStatement: buildProblemStatementNode,
  FlowList: buildFlowsNode,
  Comparative: (structureNode, inputs) =>
    structureNode.props?.kind === 'variants' ? buildVariantsNode(structureNode, inputs) : buildComparativeNode(structureNode, inputs),
  DecisionCriteria: buildDecisionCriteriaNode,
  FinalAnalysis: buildFinalAnalysisNode,
}

export function buildRenderManifest({ template, identity, slug, ticketRef, createdAt, inputs }) {
  const ref = requireString(ticketRef, 'ticketRef', 'INVALID_TICKET_REF')
  const sanitizedSlug = requireString(slug, 'slug', 'INVALID_SLUG')
  const created = requireString(createdAt, 'createdAt', 'INVALID_CREATED_AT')
  if (!template || typeof template !== 'object') throw new RenderInputError('template é obrigatório', { code: 'MISSING_TEMPLATE' })
  if (!identity || !identity.tokens) throw new RenderInputError('identity é obrigatório (chame resolveIdentity antes)', { code: 'MISSING_IDENTITY' })
  if (!inputs || typeof inputs !== 'object') throw new RenderInputError('inputs é obrigatório', { code: 'MISSING_INPUTS' })

  const tokens = identity.tokens
  const nodes = template.structure.map((s) => {
    const builder = NODE_BUILDERS[s.component]
    if (!builder) throw new RenderInputError(`Sem builder para componente "${s.component}"`, { code: 'UNKNOWN_COMPONENT' })
    // Resolve tokens recursively em props ANTES de chamar o builder — garante que
    // qualquer {token:...} em qualquer prop seja resolvido sem o builder precisar
    // se preocupar com isso.
    const resolved = { ...s, props: s.props ? resolveTokenRefs(s.props, tokens) : s.props }
    return builder(resolved, { ...inputs, ticketRef: ref, type: template.type }, tokens)
  })

  const layout = {
    kind: template.layout.kind,
    gap: template.layout.gap ?? 80,
    padding: template.layout.padding ?? 64,
    background: resolveTokenRefs(template.layout.background ?? '{token:template.background}', tokens),
  }

  return {
    version: MANIFEST_VERSION,
    type: template.type,
    slug: sanitizedSlug,
    ticketRef: ref,
    createdAt: created,
    identity: { mode: identity.mode, overrides: identity.overrides ?? {} },
    tokens,
    layout,
    page: { name: `MC — ${sanitizedSlug}` },
    container: {
      name: `Meet Criteria — ${ref}`,
      pluginData: {
        role: 'root',
        ticketRef: ref,
        type: template.type,
        templateVersion: template.version,
        createdAt: created,
        lastExecutedAt: created,
        visualIdentity: identity.mode,
        slug: sanitizedSlug,
      },
    },
    nodes,
    checks: { deterministic: template.checks?.deterministic ?? [] },
  }
}
