import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, existsSync, chmodSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { bootstrapLocalStore } from './local-store.mjs'
import { loadTemplate } from './template-loader.mjs'
import { resolveIdentity } from './visual-identity.mjs'
import { buildRenderManifest } from './render-manifest.mjs'

function makeManifest(type, inputs) {
  const template = loadTemplate(type)
  const identity = resolveIdentity({ mode: 'default' })
  return buildRenderManifest({
    template,
    identity,
    slug: 'prod-1234',
    ticketRef: 'PROD-1234',
    createdAt: '2026-05-01T15:30:00.000Z',
    inputs,
  })
}

test('bootstrap feature: cria árvore esperada', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'mc-store-'))
  const manifest = makeManifest('feature', { problemStatement: 'Texto', flows: [{ name: 'Flow A', screens: 2 }] })
  const r = bootstrapLocalStore({ cwd, manifest })
  assert.equal(r.created, true)
  assert.equal(r.path, join(cwd, '.meet-criteria', 'prod-1234'))
  for (const f of ['metadata.json', 'problem-statement.md', 'flows.md', 'anchors.json', 'references/.gitkeep']) {
    assert.equal(existsSync(join(r.path, f)), true, `falta ${f}`)
  }
})

test('bootstrapLocalStore does NOT generate screen-justifications.md or analysis.md', () => {
  // Figma é a fonte da verdade para análises; markdown duplicado removido.
  const cwd = mkdtempSync(join(tmpdir(), 'mc-store-no-md-'))
  const manifest = makeManifest('feature', { problemStatement: 'Texto', flows: [{ name: 'Flow A', screens: 2 }] })
  const r = bootstrapLocalStore({ cwd, manifest })
  assert.equal(r.created, true)
  assert.equal(existsSync(join(r.path, 'screen-justifications.md')), false, 'screen-justifications.md não deve ser gerado')
  assert.equal(existsSync(join(r.path, 'analysis.md')), false, 'analysis.md não deve ser gerado')
})

test('bootstrap mudanca: only writes problem-statement and analysis-overview md skeletons', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'mc-store-mudanca-'))
  const manifest = makeManifest('mudanca', { problemStatement: 'Stub change description.' })
  const r = bootstrapLocalStore({ cwd, manifest })
  assert.equal(r.created, true)
  assert.equal(existsSync(join(r.path, 'flows.md')), false)
  const ps = readFileSync(join(r.path, 'problem-statement.md'), 'utf8')
  assert.match(ps, /Stub change description\./)
})

test('bootstrap conceito: same shape as mudanca stub', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'mc-store-conceito-'))
  const manifest = makeManifest('conceito', { problemStatement: 'Stub variants.' })
  const r = bootstrapLocalStore({ cwd, manifest })
  assert.equal(r.created, true)
  assert.equal(existsSync(join(r.path, 'flows.md')), false)
})

test('metadata.json includes section, omits tokens/nodes/layout', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'mc-store-meta-'))
  const manifest = makeManifest('feature', { problemStatement: 'Texto', flows: [{ name: 'F', screens: 1 }] })
  const r = bootstrapLocalStore({ cwd, manifest })
  const meta = JSON.parse(readFileSync(join(r.path, 'metadata.json'), 'utf8'))
  assert.equal(meta.slug, 'prod-1234')
  assert.equal(meta.ticketRef, 'PROD-1234')
  assert.equal(meta.type, 'feature')
  assert.equal(meta.createdAt, '2026-05-01T15:30:00.000Z')
  assert.equal(meta.identity?.mode, 'default')
  assert.equal(meta.section?.name, 'Meet Criteria - PROD-1234')
  assert.equal(meta.tokens, undefined)
  assert.equal(meta.nodes, undefined)
  assert.equal(meta.layout, undefined)
})

test('problem-statement.md tem o texto do ticket', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'mc-store-ps-'))
  const manifest = makeManifest('feature', { problemStatement: 'Crítico: precisa funcionar.', flows: [{ name: 'F', screens: 1 }] })
  const r = bootstrapLocalStore({ cwd, manifest })
  const ps = readFileSync(join(r.path, 'problem-statement.md'), 'utf8')
  assert.match(ps, /Crítico: precisa funcionar\./)
})

test('idempotência: chamada repetida não falha e não sobrescreve arquivos modificados', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'mc-store-idem-'))
  const manifest = makeManifest('feature', { problemStatement: 'Original', flows: [{ name: 'F', screens: 1 }] })
  const r1 = bootstrapLocalStore({ cwd, manifest })
  const psPath = join(r1.path, 'problem-statement.md')
  writeFileSync(psPath, '# Editado pelo designer\n')
  const r2 = bootstrapLocalStore({ cwd, manifest })
  assert.equal(r2.created, true)
  assert.equal(r2.alreadyExisted, true)
  assert.equal(readFileSync(psPath, 'utf8'), '# Editado pelo designer\n')
})

test('fallback gracioso quando filesystem é read-only', { skip: process.platform === 'win32' }, () => {
  const cwd = mkdtempSync(join(tmpdir(), 'mc-store-ro-'))
  chmodSync(cwd, 0o555)
  try {
    const manifest = makeManifest('feature', { problemStatement: 'X', flows: [{ name: 'F', screens: 1 }] })
    const r = bootstrapLocalStore({ cwd, manifest })
    assert.equal(r.created, false)
    assert.match(r.reason, /permission|EACCES|read-only|EROFS/i)
  } finally {
    chmodSync(cwd, 0o755)
  }
})

test('catch propaga TypeError de manifest malformado em vez de virar fallback silencioso', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'mc-store-bug-'))
  // Manifest inválido: nodes vazio (faltando problem-statement node).
  const broken = {
    version: '1.0.0',
    type: 'feature',
    slug: 'broken',
    ticketRef: 'BROKEN-1',
    createdAt: '2026-05-01T15:30:00.000Z',
    identity: { mode: 'default', overrides: {} },
    page: { name: 'MC — broken' },
    section: { name: 'X', pluginData: { role: 'root' } },
    nodes: [], // <- vai quebrar no problem-statement lookup (.find returns undefined)
    checks: { deterministic: [] },
  }
  assert.throws(() => bootstrapLocalStore({ cwd, manifest: broken }), TypeError)
})

test('fallback retorna path mesmo quando created=false', { skip: process.platform === 'win32' }, () => {
  const cwd = mkdtempSync(join(tmpdir(), 'mc-store-path-'))
  chmodSync(cwd, 0o555)
  try {
    const template = loadTemplate('feature')
    const identity = resolveIdentity({ mode: 'default' })
    const manifest = buildRenderManifest({
      template, identity, slug: 'prod-x', ticketRef: 'PROD-X',
      createdAt: '2026-05-01T15:30:00.000Z',
      inputs: { problemStatement: 'X', flows: [{ name: 'F', screens: 1 }] },
    })
    const r = bootstrapLocalStore({ cwd, manifest })
    assert.equal(r.created, false)
    assert.equal(typeof r.path, 'string')
    assert.equal(r.path, join(cwd, '.meet-criteria', 'prod-x'))
  } finally {
    chmodSync(cwd, 0o755)
  }
})

test('metadata.json omite tokens, nodes e layout', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'mc-store-omit-'))
  const manifest = makeManifest('feature', { problemStatement: 'X', flows: [{ name: 'F', screens: 1 }] })
  const r = bootstrapLocalStore({ cwd, manifest })
  const meta = JSON.parse(readFileSync(join(r.path, 'metadata.json'), 'utf8'))
  assert.equal(meta.tokens, undefined)
  assert.equal(meta.nodes, undefined)
  assert.equal(meta.layout, undefined)
})
