import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildRenderJs, RENDER_TEMPLATE_JS, RenderJsError } from './figma-render.mjs'
import { loadTemplate } from './template-loader.mjs'
import { resolveIdentity } from './visual-identity.mjs'
import { buildRenderManifest } from './render-manifest.mjs'

const FIXED_DATE = '2026-05-01T15:30:00.000Z'

function makeManifest(type, inputs) {
  const template = loadTemplate(type)
  const identity = resolveIdentity({ mode: 'default' })
  return buildRenderManifest({
    template,
    identity,
    slug: 'prod-1234',
    ticketRef: 'PROD-1234',
    createdAt: FIXED_DATE,
    inputs,
  })
}

test('RENDER_TEMPLATE_JS contém os 8 helpers nominais', () => {
  for (const helper of [
    'hexToRgb',
    'setPluginData',
    'createContextMacro',
    'createProblemStatement',
    'createSectionHeader',
    'createScreenSlot',
    'createDecisionCriteria',
    'createFinalAnalysis',
  ]) {
    assert.match(RENDER_TEMPLATE_JS, new RegExp(`\\b${helper}\\b`), `helper "${helper}" ausente do template`)
  }
})

test('RENDER_TEMPLATE_JS contém os placeholders esperados', () => {
  assert.match(RENDER_TEMPLATE_JS, /__MANIFEST_JSON__/)
  assert.match(RENDER_TEMPLATE_JS, /__SELECTION_JSON__/)
})

test('RENDER_TEMPLATE_JS aplica setSharedPluginData no namespace meetCriteria', () => {
  assert.match(RENDER_TEMPLATE_JS, /setSharedPluginData\(\s*['"]meetCriteria['"]/)
})

test('RENDER_TEMPLATE_JS chama loadFontAsync para Regular e Bold', () => {
  assert.match(RENDER_TEMPLATE_JS, /style:\s*['"]Regular['"]/)
  assert.match(RENDER_TEMPLATE_JS, /style:\s*['"]Bold['"]/)
})

test('RENDER_TEMPLATE_JS aborta se page já existir (retorna error)', () => {
  assert.match(RENDER_TEMPLATE_JS, /já existe/)
})

test('buildRenderJs substitui __MANIFEST_JSON__ pelo manifest serializado', () => {
  const m = makeManifest('feature', { problemStatement: 'X', flows: [{ name: 'F', screens: 1 }] })
  const js = buildRenderJs({ manifest: m, selectionIds: ['1:1'] })
  assert.doesNotMatch(js, /__MANIFEST_JSON__/)
  assert.match(js, /"slug":\s*"prod-1234"/)
  assert.match(js, /"ticketRef":\s*"PROD-1234"/)
})

test('buildRenderJs substitui __SELECTION_JSON__ pelo array de IDs', () => {
  const m = makeManifest('feature', { problemStatement: 'X', flows: [{ name: 'F', screens: 2 }] })
  const js = buildRenderJs({ manifest: m, selectionIds: ['1:1', '1:2'] })
  assert.doesNotMatch(js, /__SELECTION_JSON__/)
  assert.match(js, /"1:1"/)
  assert.match(js, /"1:2"/)
})

test('buildRenderJs gera código sintaticamente válido (parse-only)', () => {
  const m = makeManifest('feature', { problemStatement: 'X', flows: [{ name: 'F', screens: 1 }] })
  const js = buildRenderJs({ manifest: m, selectionIds: ['1:1'] })
  assert.doesNotThrow(() => new Function(`return (async () => { ${js} })`))
})

test('buildRenderJs valida que selectionIds tem o tamanho correto pra feature', () => {
  const m = makeManifest('feature', { problemStatement: 'X', flows: [{ name: 'F', screens: 3 }, { name: 'G', screens: 2 }] })
  assert.throws(
    () => buildRenderJs({ manifest: m, selectionIds: ['a','b','c','d'] }),
    RenderJsError,
  )
  assert.doesNotThrow(() => buildRenderJs({ manifest: m, selectionIds: ['a','b','c','d','e'] }))
})

test('buildRenderJs valida selection pra mudanca (pares × 2)', () => {
  const m = makeManifest('mudanca', { problemStatement: 'X', pairs: [{ label: 'T01' }, { label: 'T02' }] })
  assert.throws(() => buildRenderJs({ manifest: m, selectionIds: ['a','b','c'] }), RenderJsError)
  assert.doesNotThrow(() => buildRenderJs({ manifest: m, selectionIds: ['a','b','c','d'] }))
})

test('buildRenderJs valida selection pra conceito (uma por variante)', () => {
  const m = makeManifest('conceito', { problemStatement: 'X', variants: ['A','B','C'], decisionCriteria: 'X' })
  assert.throws(() => buildRenderJs({ manifest: m, selectionIds: ['a','b'] }), /3/)
  assert.doesNotThrow(() => buildRenderJs({ manifest: m, selectionIds: ['a','b','c'] }))
})

test('buildRenderJs aceita selectionIds correto pra feature mínimo', () => {
  const m = makeManifest('feature', { problemStatement: 'X', flows: [{ name: 'F', screens: 1 }] })
  assert.doesNotThrow(() => buildRenderJs({ manifest: m, selectionIds: ['x'] }))
})

test('RenderJsError tem code discriminator', () => {
  let caught
  try { buildRenderJs({ manifest: makeManifest('feature', { problemStatement: 'X', flows: [{ name: 'F', screens: 1 }] }), selectionIds: [] }) }
  catch (e) { caught = e }
  assert.ok(caught instanceof RenderJsError)
  assert.equal(caught.code, 'SELECTION_LENGTH_MISMATCH')
})
