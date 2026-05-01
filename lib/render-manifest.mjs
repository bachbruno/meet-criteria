// Builds the render manifest — the declarative plan consumed by the
// /meet-criteria-new skill to draw the deliverable in Figma. Pure: no I/O,
// no implicit time (createdAt is a parameter).
//
// Manifest shape (v2 — Plan 3.6):
// {
//   version: '2.0.0',
//   type, slug, ticketRef, createdAt,
//   identity: { mode, overrides },
//   tokens:   { <tokenName>: <hex> },
//   layout:   { kind: 'section', padding, background },
//   page:     { name: 'MC - <slug>' },
//   section:  { name, width, height, pluginData: { role: 'root', ... } },
//   nodes:    [ {...} ],
//   checks:   { deterministic: [string] }
// }

import { resolveTokenRefs } from './visual-tokens.mjs'
import { computeFeatureLayout, LAYOUT_CONSTANTS } from './layout-feature.mjs'

export const MANIFEST_VERSION = '2.0.0'

export class RenderInputError extends Error {
  constructor(message, { code = 'UNKNOWN' } = {}) {
    super(message)
    this.name = 'RenderInputError'
    this.code = code
  }
}

const ANALYSIS_SECTION_HEADINGS = Object.freeze({
  resolution: 'Resolution',
  validation: 'What validates it',
  attention:  'Attention to',
  discussion: 'Topics for discussion',
})

// Placeholder body text per analysis section. Designer sees a guidance line
// under each heading until /meet-criteria-analyze (Plan 4) fills real content.
const ANALYSIS_SECTION_PLACEHOLDERS = Object.freeze({
  resolution: 'Describe how this delivery solves the problem statement.',
  validation: 'List the criteria that confirm the resolution works.',
  attention:  'Flag risks, edge cases, or constraints the team should mind.',
  discussion: 'Open questions or trade-offs to align on during the review.',
})

function requireString(value, label, code = 'INVALID_INPUT') {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new RenderInputError(`${label} must be a non-empty string`, { code })
  }
  return value.trim()
}

function buildProblemStatementNode(structureNode, inputs, layout) {
  const text = inputs.problemStatement
  if (typeof text !== 'string' || text.trim() === '') {
    throw new RenderInputError('problem-statement is empty (deterministic check problem-statement-not-empty)', { code: 'EMPTY_PROBLEM_STATEMENT' })
  }
  return {
    id: structureNode.id,
    component: structureNode.component,
    x: layout.problemStatement.x,
    y: layout.problemStatement.y,
    width: layout.problemStatement.width,
    height: layout.problemStatement.height,
    heading: 'Problem statement',
    body: text.trim(),
    pluginData: { role: 'problem-statement' },
  }
}

function buildFlowsNode(structureNode, inputs, layout) {
  const minCount = structureNode.minCount ?? 1
  const maxCount = structureNode.maxCount ?? 10
  const flows = Array.isArray(inputs.flows) ? inputs.flows : []
  if (flows.length < minCount) throw new RenderInputError(`feature.flows has ${flows.length}; minimum ${minCount}`, { code: 'FLOWS_BELOW_MIN' })
  if (flows.length > maxCount) throw new RenderInputError(`feature.flows has ${flows.length}; maximum ${maxCount}`, { code: 'FLOWS_ABOVE_MAX' })

  const minScreens = structureNode.itemTemplate?.props?.minScreens ?? 1
  const maxScreens = structureNode.itemTemplate?.props?.maxScreens ?? 20

  // Validate each flow's screens count within bounds
  flows.forEach((f, i) => {
    if (!Number.isInteger(f.screens) || f.screens < minScreens) {
      throw new RenderInputError(`flows[${i}].screens=${f.screens} below minScreens=${minScreens}`, { code: 'SCREENS_BELOW_MIN' })
    }
    if (f.screens > maxScreens) {
      throw new RenderInputError(`flows[${i}].screens=${f.screens} above maxScreens=${maxScreens}`, { code: 'SCREENS_ABOVE_MAX' })
    }
    requireString(f.name, `flows[${i}].name`, 'INVALID_FLOW_NAME')
  })

  const children = layout.flows.map((flowLayout, i) => {
    const flowId = flowLayout.flowId
    const name = flows[i].name.trim()
    return {
      flowId,
      name,
      pluginData: { role: 'flow', flowId },
      banner: {
        x: flowLayout.banner.x, y: flowLayout.banner.y,
        width: flowLayout.banner.width, height: flowLayout.banner.height,
        text: name,
      },
      screens: flowLayout.screens.map((s) => ({
        x: s.tag.x, // wrapper x (matches tag/placeholder x)
        y: s.tag.y, // wrapper y top (tag origin)
        tag: { ...s.tag, text: `Screen name` },
        placeholder: { ...s.placeholder },
        pluginData: { role: 'screen-slot', flowId, screenIndex: s.screenIndex },
      })),
    }
  })

  return {
    id: structureNode.id,
    component: 'FlowList',
    pluginData: { role: 'flow-list' },
    children,
  }
}

function buildAnalysisOverviewNode(structureNode, inputs, layout) {
  const sectionKeys = structureNode.sections ?? ['resolution', 'validation', 'attention', 'discussion']
  return {
    id: structureNode.id,
    component: 'AnalysisOverview',
    x: layout.analysisOverview.x,
    y: layout.analysisOverview.y,
    width: layout.analysisOverview.width,
    height: layout.analysisOverview.height,
    heading: 'Analysis Overview',
    sections: sectionKeys.map((key) => ({
      key,
      heading: ANALYSIS_SECTION_HEADINGS[key] ?? key,
      body: ANALYSIS_SECTION_PLACEHOLDERS[key] ?? '',
    })),
    pluginData: { role: 'analysis-overview' },
  }
}

const NODE_BUILDERS = {
  ProblemStatement: buildProblemStatementNode,
  FlowList: buildFlowsNode,
  AnalysisOverview: buildAnalysisOverviewNode,
}

export { LAYOUT_CONSTANTS }

export function buildRenderManifest({ template, identity, slug, ticketRef, createdAt, inputs }) {
  const ref = requireString(ticketRef, 'ticketRef', 'INVALID_TICKET_REF')
  const sanitizedSlug = requireString(slug, 'slug', 'INVALID_SLUG')
  const created = requireString(createdAt, 'createdAt', 'INVALID_CREATED_AT')
  if (!template || typeof template !== 'object') throw new RenderInputError('template is required', { code: 'MISSING_TEMPLATE' })
  if (!identity || !identity.tokens) throw new RenderInputError('identity is required (call resolveIdentity first)', { code: 'MISSING_IDENTITY' })
  if (!inputs || typeof inputs !== 'object') throw new RenderInputError('inputs is required', { code: 'MISSING_INPUTS' })

  const tokens = identity.tokens

  // Compute layout from inputs (only feature uses computeFeatureLayout for now;
  // the stub mudanca/conceito templates render without flows but still need a section).
  let layout
  if (template.type === 'feature') {
    if (!Array.isArray(inputs.flows) || inputs.flows.length === 0) {
      throw new RenderInputError('feature requires at least one flow in inputs.flows', { code: 'FLOWS_BELOW_MIN' })
    }
    layout = computeFeatureLayout({ flows: inputs.flows })
  } else {
    // Stub layout: side cards full-height of one virtual block; no flows row.
    const C = LAYOUT_CONSTANTS
    const stubInner = C.BANNER_HEIGHT + C.FLOW_BANNER_TO_TAG_GAP + C.TAG_HEIGHT + C.TAG_TO_IPHONE_GAP + C.IPHONE_HEIGHT
    const sectionHeight = 2 * C.SECTION_PADDING + stubInner
    const sectionWidth = 2 * C.SECTION_PADDING + 2 * C.SIDE_CARD_WIDTH + 2 * C.SIDE_CARD_TO_SCREENS_GAP // no screens
    layout = {
      section: { width: sectionWidth, height: sectionHeight },
      problemStatement: { x: C.SECTION_PADDING, y: C.SECTION_PADDING, width: C.SIDE_CARD_WIDTH, height: stubInner },
      analysisOverview: { x: sectionWidth - C.SECTION_PADDING - C.SIDE_CARD_WIDTH, y: C.SECTION_PADDING, width: C.SIDE_CARD_WIDTH, height: stubInner },
      flows: [],
    }
  }

  const nodes = template.structure.map((s) => {
    const builder = NODE_BUILDERS[s.component]
    if (!builder) throw new RenderInputError(`No builder for component "${s.component}"`, { code: 'UNKNOWN_COMPONENT' })
    const resolved = { ...s, props: s.props ? resolveTokenRefs(s.props, tokens) : s.props }
    return builder(resolved, inputs, layout)
  })

  const layoutOut = {
    kind: template.layout.kind,
    padding: template.layout.padding ?? LAYOUT_CONSTANTS.SECTION_PADDING,
    background: resolveTokenRefs(template.layout.background ?? '{token:section.background}', tokens),
  }

  return {
    version: MANIFEST_VERSION,
    type: template.type,
    slug: sanitizedSlug,
    ticketRef: ref,
    createdAt: created,
    identity: { mode: identity.mode, overrides: identity.overrides ?? {} },
    tokens,
    layout: layoutOut,
    page: { name: `MC - ${sanitizedSlug}` },
    section: {
      name: `Meet Criteria - ${ref}`,
      width: layout.section.width,
      height: layout.section.height,
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
