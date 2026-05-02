import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildRenderManifest, MANIFEST_VERSION, RenderInputError, LAYOUT_CONSTANTS } from './render-manifest.mjs'
import { loadTemplate } from './template-loader.mjs'
import { resolveIdentity } from './visual-identity.mjs'
import { DEFAULT_TOKENS } from './visual-tokens.mjs'

const FIXED_DATE = '2026-05-01T15:30:00.000Z'

function baseArgs(type, overrides = {}) {
  const template = loadTemplate(type)
  const identity = resolveIdentity({ mode: 'default' })
  return {
    template,
    identity,
    slug: 'prod-1234',
    ticketRef: 'PROD-1234',
    createdAt: FIXED_DATE,
    inputs: { problemStatement: 'Sample text' },
    ...overrides,
  }
}

test('MANIFEST_VERSION is "2.0.0"', () => {
  assert.equal(MANIFEST_VERSION, '2.0.0')
})

test('feature: produces section with computed dimensions and node list', () => {
  const m = buildRenderManifest(baseArgs('feature', {
    inputs: { problemStatement: 'X', flows: [{ name: 'Flow A', screens: 4 }] },
  }))
  assert.equal(m.version, MANIFEST_VERSION)
  assert.equal(m.type, 'feature')
  assert.equal(m.section.name, 'Meet Criteria - PROD-1234')
  assert.equal(m.section.pluginData.role, 'root')
  assert.equal(m.section.width, 4468)
  assert.equal(m.section.height, 1900)
  assert.equal(m.layout.kind, 'section')
  assert.equal(m.layout.padding, LAYOUT_CONSTANTS.SECTION_PADDING)
  assert.match(m.layout.background, /^#[0-9a-f]{6}$/)

  const ids = m.nodes.map((n) => n.id)
  assert.deepEqual(ids, ['problem-statement', 'flows', 'analysis-overview'])
})

test('feature: problem-statement carries x/y and heading constant', () => {
  const m = buildRenderManifest(baseArgs('feature', {
    inputs: { problemStatement: 'Hello world', flows: [{ name: 'F', screens: 1 }] },
  }))
  const ps = m.nodes.find((n) => n.id === 'problem-statement')
  assert.equal(ps.x, 280)
  assert.equal(ps.y, 280)
  assert.equal(ps.width, 738)
  assert.equal(ps.heading, 'Problem statement')
  assert.equal(ps.body, 'Hello world')
})

test('feature: flows node has child per flow with banner + screens (tag + placeholder coords)', () => {
  const m = buildRenderManifest(baseArgs('feature', {
    inputs: { problemStatement: 'X', flows: [{ name: 'Flow A', screens: 2 }, { name: 'Flow B', screens: 1 }] },
  }))
  const flows = m.nodes.find((n) => n.id === 'flows')
  assert.equal(flows.children.length, 2)
  const f1 = flows.children[0]
  assert.equal(f1.flowId, 'flow-1')
  assert.equal(f1.name, 'Flow A')
  assert.equal(f1.banner.text, 'Flow A')
  assert.equal(f1.screens.length, 2)
  assert.equal(f1.screens[0].slotPluginData.role, 'screen-slot')
  assert.equal(f1.screens[0].slotPluginData.flowId, 'flow-1')
  assert.equal(f1.screens[0].slotPluginData.screenIndex, 0)
  // Tag and placeholder share the same x; placeholder y > tag y
  assert.equal(f1.screens[0].tag.x, f1.screens[0].placeholder.x)
  assert.ok(f1.screens[0].placeholder.y > f1.screens[0].tag.y)
})

test('feature: tag.text falls back to "Screen name" when selectionNames is absent', () => {
  const m = buildRenderManifest(baseArgs('feature', {
    inputs: { problemStatement: 'X', flows: [{ name: 'Flow A', screens: 2 }] },
  }))
  const flows = m.nodes.find((n) => n.id === 'flows')
  assert.equal(flows.children[0].screens[0].tag.text, 'Screen name')
  assert.equal(flows.children[0].screens[1].tag.text, 'Screen name')
})

test('feature: tag.text uses selectionNames in flat order across flows', () => {
  const m = buildRenderManifest(baseArgs('feature', {
    inputs: {
      problemStatement: 'X',
      flows: [{ name: 'Flow A', screens: 2 }, { name: 'Flow B', screens: 1 }],
      selectionNames: ['Login', 'Home', 'Settings'],
    },
  }))
  const flows = m.nodes.find((n) => n.id === 'flows')
  assert.equal(flows.children[0].screens[0].tag.text, 'Login')
  assert.equal(flows.children[0].screens[1].tag.text, 'Home')
  assert.equal(flows.children[1].screens[0].tag.text, 'Settings')
})

test('feature: empty/whitespace selectionNames entries fall back to "Screen name"', () => {
  const m = buildRenderManifest(baseArgs('feature', {
    inputs: {
      problemStatement: 'X',
      flows: [{ name: 'Flow A', screens: 3 }],
      selectionNames: ['Login', '', '   '],
    },
  }))
  const screens = m.nodes.find((n) => n.id === 'flows').children[0].screens
  assert.equal(screens[0].tag.text, 'Login')
  assert.equal(screens[1].tag.text, 'Screen name')
  assert.equal(screens[2].tag.text, 'Screen name')
})

test('feature: analysis-overview has 4 sections with English headings', () => {
  const m = buildRenderManifest(baseArgs('feature', {
    inputs: { problemStatement: 'X', flows: [{ name: 'F', screens: 1 }] },
  }))
  const ao = m.nodes.find((n) => n.id === 'analysis-overview')
  assert.equal(ao.heading, 'Analysis Overview')
  assert.equal(ao.sections.length, 4)
  assert.deepEqual(ao.sections.map((s) => s.heading), [
    'Resolution',
    'What validates it',
    'Attention to',
    'Topics for discussion',
  ])
  assert.deepEqual(ao.sections.map((s) => s.key), ['resolution', 'validation', 'attention', 'discussion'])
})

test('feature: rejects empty flows', () => {
  assert.throws(
    () => buildRenderManifest(baseArgs('feature', { inputs: { problemStatement: 'X', flows: [] } })),
    RenderInputError,
  )
})

test('feature: rejects empty problemStatement', () => {
  assert.throws(
    () => buildRenderManifest(baseArgs('feature', { inputs: { problemStatement: '   ', flows: [{ name: 'F', screens: 1 }] } })),
    /problem-statement/,
  )
})

test('feature: rejects flow with screens above maxScreens', () => {
  assert.throws(
    () => buildRenderManifest(baseArgs('feature', { inputs: { problemStatement: 'X', flows: [{ name: 'F', screens: 999 }] } })),
    /maxScreens/,
  )
})

test('feature: tokens fully resolved (no {token:...} survives)', () => {
  const m = buildRenderManifest(baseArgs('feature', {
    inputs: { problemStatement: 'X', flows: [{ name: 'F', screens: 1 }] },
  }))
  const stringified = JSON.stringify(m)
  assert.doesNotMatch(stringified, /\{token:[^}]+\}/)
  assert.equal(m.layout.background, DEFAULT_TOKENS['section.background'])
})

test('mudanca stub: produces problem-statement + analysis-overview only, no flows', () => {
  const m = buildRenderManifest(baseArgs('mudanca'))
  assert.equal(m.type, 'mudanca')
  const ids = m.nodes.map((n) => n.id)
  assert.deepEqual(ids, ['problem-statement', 'analysis-overview'])
})

test('conceito stub: produces problem-statement + analysis-overview only', () => {
  const m = buildRenderManifest(baseArgs('conceito'))
  assert.equal(m.type, 'conceito')
  const ids = m.nodes.map((n) => n.id)
  assert.deepEqual(ids, ['problem-statement', 'analysis-overview'])
})

test('rejects empty ticketRef', () => {
  assert.throws(
    () => buildRenderManifest(baseArgs('feature', { ticketRef: '   ', inputs: { problemStatement: 'X', flows: [{ name: 'F', screens: 1 }] } })),
    /ticketRef/,
  )
})

test('section name uses ASCII hyphen (not em-dash)', () => {
  const m = buildRenderManifest(baseArgs('feature', {
    inputs: { problemStatement: 'X', flows: [{ name: 'F', screens: 1 }] },
  }))
  assert.match(m.section.name, /^Meet Criteria - PROD-1234$/)
  assert.doesNotMatch(m.section.name, /—/)
})

test('checks.deterministic copied verbatim from template', () => {
  const m = buildRenderManifest(baseArgs('feature', {
    inputs: { problemStatement: 'X', flows: [{ name: 'F', screens: 1 }] },
  }))
  assert.deepEqual(m.checks.deterministic, [
    'problem-statement-not-empty',
    'no-empty-screen-slots',
    'no-placeholder-text',
    'analysis-overview-not-empty',
  ])
})

test('buildRenderManifest disambiguates screen-tag and screen-slot roles', () => {
  const template = loadTemplate('feature')
  const identity = resolveIdentity({ mode: 'default' })
  const manifest = buildRenderManifest({
    template, identity,
    slug: 'foo-1', ticketRef: 'FOO-1',
    createdAt: '2026-05-02T00:00:00Z',
    inputs: {
      problemStatement: 'Test problem',
      flows: [{ name: 'Flow A', screens: 2 }],
    },
  })
  const flows = manifest.nodes.find((n) => n.id === 'flows')
  const screen = flows.children[0].screens[0]
  assert.equal(screen.tag.pluginData.role, 'screen-tag')
  assert.equal(screen.tag.pluginData.flowId, 'flow-1')
  assert.equal(screen.tag.pluginData.screenIndex, 0)
  assert.equal(screen.slotPluginData.role, 'screen-slot')
  assert.equal(screen.slotPluginData.flowId, 'flow-1')
  assert.equal(screen.slotPluginData.screenIndex, 0)
})

test('analysis-overview sub-sections carry placeholder body text per key', () => {
  const m = buildRenderManifest(baseArgs('feature', {
    inputs: { problemStatement: 'X', flows: [{ name: 'F', screens: 1 }] },
  }))
  const ao = m.nodes.find((n) => n.id === 'analysis-overview')
  const byKey = Object.fromEntries(ao.sections.map((s) => [s.key, s.body]))
  assert.match(byKey.resolution, /problem statement/i)
  assert.match(byKey.validation, /criteria/i)
  assert.match(byKey.attention, /risks|edge|constraints/i)
  assert.match(byKey.discussion, /questions|trade-offs/i)
  // Each placeholder is a non-empty single line
  for (const sec of ao.sections) {
    assert.ok(sec.body.length > 0, `section ${sec.key} has empty body`)
  }
})
