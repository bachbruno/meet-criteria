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
    template, identity,
    slug: 'prod-1234',
    ticketRef: 'PROD-1234',
    createdAt: FIXED_DATE,
    inputs,
  })
}

test('RENDER_TEMPLATE_JS contains the new helper names', () => {
  for (const helper of [
    'hexToRgb',
    'setPluginData',
    'makeText',
    'makeAutoFrame',
    'buildProblemStatementCard',
    'buildFlowNameBanner',
    'buildScreenNameTag',
    'cloneScreen',
    'buildAnalysisOverviewCard',
    'buildScreenJustificationText',
  ]) {
    assert.match(RENDER_TEMPLATE_JS, new RegExp(`\\b${helper}\\b`), `helper "${helper}" missing from template`)
  }
})

test('RENDER_TEMPLATE_JS does NOT create an iPhone wrapper frame (paste-to-replace)', () => {
  assert.doesNotMatch(RENDER_TEMPLATE_JS, /iPhone 13 & 14/)
  assert.doesNotMatch(RENDER_TEMPLATE_JS, /buildIPhonePlaceholder/)
})

test('RENDER_TEMPLATE_JS uses figma.createSection (not createPage/createFrame for root)', () => {
  assert.match(RENDER_TEMPLATE_JS, /figma\.createSection/)
})

test('RENDER_TEMPLATE_JS uses setCurrentPageAsync (figma-use rule 9)', () => {
  assert.match(RENDER_TEMPLATE_JS, /setCurrentPageAsync\s*\(/)
  assert.doesNotMatch(RENDER_TEMPLATE_JS, /figma\.currentPage\s*=\s*page/)
})

test('RENDER_TEMPLATE_JS loads Inter Medium and Semi Bold (used by typography spec)', () => {
  assert.match(RENDER_TEMPLATE_JS, /style:\s*['"]Medium['"]/)
  assert.match(RENDER_TEMPLATE_JS, /style:\s*['"]Semi Bold['"]/)
})

test('buildRenderJs substitutes both placeholders globally', () => {
  const m = makeManifest('feature', { problemStatement: 'X', flows: [{ name: 'F', screens: 1 }] })
  const js = buildRenderJs({ manifest: m, selectionIds: ['1:1'] })
  assert.doesNotMatch(js, /__MANIFEST_JSON__/)
  assert.doesNotMatch(js, /__SELECTION_JSON__/)
  assert.match(js, /"slug":\s*"prod-1234"/)
  assert.match(js, /"1:1"/)
})

test('buildRenderJs produces parseable JS (new Function smoke parse)', () => {
  const m = makeManifest('feature', { problemStatement: 'X', flows: [{ name: 'F', screens: 1 }] })
  const js = buildRenderJs({ manifest: m, selectionIds: ['1:1'] })
  assert.doesNotThrow(() => new Function(`return (async () => { ${js} })`))
})

test('buildRenderJs serializes both screen-tag and screen-slot roles into the manifest payload', () => {
  const m = makeManifest('feature', { problemStatement: 'X', flows: [{ name: 'F', screens: 1 }] })
  const js = buildRenderJs({ manifest: m, selectionIds: ['1:1'] })
  assert.match(js, /"role":\s*"screen-tag"/)
  assert.match(js, /"role":\s*"screen-slot"/)
})

test('buildRenderJs validates selectionIds length for feature', () => {
  const m = makeManifest('feature', { problemStatement: 'X', flows: [{ name: 'F', screens: 3 }, { name: 'G', screens: 2 }] })
  assert.throws(() => buildRenderJs({ manifest: m, selectionIds: ['a','b','c','d'] }), RenderJsError)
  assert.doesNotThrow(() => buildRenderJs({ manifest: m, selectionIds: ['a','b','c','d','e'] }))
})

test('buildRenderJs allows zero selectionIds for stub mudanca/conceito', () => {
  const mMud = makeManifest('mudanca', { problemStatement: 'X' })
  assert.doesNotThrow(() => buildRenderJs({ manifest: mMud, selectionIds: [] }))
  const mCon = makeManifest('conceito', { problemStatement: 'X' })
  assert.doesNotThrow(() => buildRenderJs({ manifest: mCon, selectionIds: [] }))
})

test('RenderJsError carries code discriminator', () => {
  let caught
  try { buildRenderJs({ manifest: makeManifest('feature', { problemStatement: 'X', flows: [{ name: 'F', screens: 1 }] }), selectionIds: [] }) }
  catch (e) { caught = e }
  assert.ok(caught instanceof RenderJsError)
  assert.equal(caught.code, 'SELECTION_LENGTH_MISMATCH')
})

test('RENDER_TEMPLATE_JS contains the section name (Meet Criteria - <ref>) format string', () => {
  // The literal name comes from MANIFEST.section.name; the template references it by property.
  assert.match(RENDER_TEMPLATE_JS, /MANIFEST\.section\.name/)
})

test('buildRenderJs with malformed manifest throws RenderJsError code=INVALID_MANIFEST', () => {
  let caught
  try { buildRenderJs({ manifest: { type: 'feature', nodes: null }, selectionIds: [] }) } catch (e) { caught = e }
  assert.ok(caught instanceof RenderJsError)
  assert.equal(caught.code, 'INVALID_MANIFEST')
})

test('render JS creates screen-justification text node per slot', () => {
  const m = makeManifest('feature', { problemStatement: 'X', flows: [{ name: 'F', screens: 2 }] })
  const js = buildRenderJs({ manifest: m, selectionIds: [null, null] })
  // Helper exists in the template
  assert.match(js, /buildScreenJustificationText/)
  // setSharedPluginData with 'screen-justification' role serialized in the manifest payload
  assert.match(js, /"role":\s*"screen-justification"/)
})

test('render JS applies analysis-section pluginData per sub-section', () => {
  const m = makeManifest('feature', { problemStatement: 'X', flows: [{ name: 'F', screens: 1 }] })
  const js = buildRenderJs({ manifest: m, selectionIds: [null] })
  assert.match(js, /"role":\s*"analysis-section"/)
  for (const k of ['resolution', 'validation', 'attention', 'discussion', 'gap-check']) {
    assert.match(js, new RegExp(`"key":\\s*"${k}"`), `missing key ${k} in pluginData`)
  }
})
