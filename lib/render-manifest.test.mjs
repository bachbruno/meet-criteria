import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildRenderManifest, MANIFEST_VERSION, RenderInputError } from './render-manifest.mjs'
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
    inputs: { problemStatement: 'Texto do ticket' },
    ...overrides,
  }
}

test('MANIFEST_VERSION é "1.0.0"', () => {
  assert.equal(MANIFEST_VERSION, '1.0.0')
})

test('feature: requer flows>=1 com screensPerFlow>=1', () => {
  const args = baseArgs('feature', { inputs: { problemStatement: 'x', flows: [{ name: 'Flow A', screens: 2 }] } })
  const m = buildRenderManifest(args)
  assert.equal(m.version, MANIFEST_VERSION)
  assert.equal(m.type, 'feature')
  assert.equal(m.slug, 'prod-1234')
  assert.equal(m.ticketRef, 'PROD-1234')
  assert.equal(m.createdAt, FIXED_DATE)
  assert.equal(m.identity.mode, 'default')
  assert.deepEqual(m.tokens, DEFAULT_TOKENS)
  assert.equal(m.container.name, 'Meet Criteria — PROD-1234')
  assert.equal(m.container.pluginData.role, 'root')
  assert.equal(m.container.pluginData.ticketRef, 'PROD-1234')
  assert.equal(m.container.pluginData.type, 'feature')
  assert.equal(m.container.pluginData.templateVersion, '1.0.0')
  assert.equal(m.page.name, 'MC — prod-1234')
  const ids = m.nodes.map((n) => n.id)
  assert.deepEqual(ids, ['context', 'problem-statement', 'flows', 'final-analysis'])
  const flows = m.nodes.find((n) => n.id === 'flows')
  assert.equal(flows.children.length, 1)
  assert.equal(flows.children[0].pluginData.role, 'flow')
  assert.equal(flows.children[0].screens.length, 2)
  assert.equal(flows.children[0].screens[0].pluginData.role, 'screen-slot')
  assert.equal(flows.children[0].screens[0].pluginData.flowId, 'flow-1')
  assert.equal(flows.children[0].screens[0].pluginData.screenIndex, 0)
})

test('feature: rejeita flows abaixo do minCount do template', () => {
  const args = baseArgs('feature', { inputs: { problemStatement: 'x', flows: [] } })
  assert.throws(() => buildRenderManifest(args), RenderInputError)
})

test('feature: rejeita flow.screens > maxScreens', () => {
  const args = baseArgs('feature', { inputs: { problemStatement: 'x', flows: [{ name: 'F', screens: 999 }] } })
  assert.throws(() => buildRenderManifest(args), /maxScreens|máximo/i)
})

test('mudanca: pares antes/depois exigem >=1', () => {
  const args = baseArgs('mudanca', { inputs: { problemStatement: 'x', pairs: [{ label: 'Tela 01' }] } })
  const m = buildRenderManifest(args)
  assert.equal(m.type, 'mudanca')
  const cmp = m.nodes.find((n) => n.id === 'comparative')
  assert.equal(cmp.children.length, 1)
  assert.equal(cmp.children[0].pluginData.role, 'comparative')
  assert.equal(cmp.children[0].slots.length, 2)
  assert.equal(cmp.children[0].slots[0].label, 'Antes')
  assert.equal(cmp.children[0].slots[1].label, 'Depois')
})

test('mudanca: rejeita pairs vazio', () => {
  const args = baseArgs('mudanca', { inputs: { problemStatement: 'x', pairs: [] } })
  assert.throws(() => buildRenderManifest(args), RenderInputError)
})

test('conceito: variants 2..5; um nó variants + decision-criteria', () => {
  const args = baseArgs('conceito', {
    inputs: { problemStatement: 'x', variants: ['A', 'B', 'C'], decisionCriteria: 'Critério X' },
  })
  const m = buildRenderManifest(args)
  const variants = m.nodes.find((n) => n.id === 'variants')
  assert.equal(variants.children.length, 1)
  assert.equal(variants.children[0].slots.length, 3)
  assert.equal(variants.children[0].slots[0].label, 'Variante A')
  const dc = m.nodes.find((n) => n.id === 'decision-criteria')
  assert.ok(dc, 'falta decision-criteria')
  assert.equal(dc.text, 'Critério X')
})

test('conceito: rejeita variants<2', () => {
  const args = baseArgs('conceito', { inputs: { problemStatement: 'x', variants: ['Só'] } })
  assert.throws(() => buildRenderManifest(args), /minCount|mínimo|2/i)
})

test('conceito: rejeita variants>5', () => {
  const args = baseArgs('conceito', { inputs: { problemStatement: 'x', variants: ['A','B','C','D','E','F'] } })
  assert.throws(() => buildRenderManifest(args), /maxCount|máximo|5/i)
})

test('layout: tokens {token:...} são resolvidos para hex', () => {
  const m = buildRenderManifest(baseArgs('feature', {
    inputs: { problemStatement: 'x', flows: [{ name: 'Flow A', screens: 1 }] },
  }))
  assert.equal(m.layout.background, DEFAULT_TOKENS['template.background'])
  assert.match(m.layout.background, /^#[0-9a-f]{6}$/)
})

test('rejeita problemStatement vazio (check determinístico do schema)', () => {
  const args = baseArgs('feature', { inputs: { problemStatement: '   ', flows: [{ name: 'F', screens: 1 }] } })
  assert.throws(() => buildRenderManifest(args), /problem-statement/)
})

test('rejeita ticketRef vazio', () => {
  const args = baseArgs('feature', { ticketRef: '   ', inputs: { problemStatement: 'x', flows: [{ name: 'F', screens: 1 }] } })
  assert.throws(() => buildRenderManifest(args), /ticketRef/)
})

test('checks deterministas do template são copiados para o manifest', () => {
  const m = buildRenderManifest(baseArgs('feature', {
    inputs: { problemStatement: 'x', flows: [{ name: 'F', screens: 1 }] },
  }))
  assert.deepEqual(m.checks.deterministic, [
    'problem-statement-not-empty',
    'no-empty-screen-slots',
    'no-placeholder-text',
    'final-analysis-not-empty',
  ])
})
