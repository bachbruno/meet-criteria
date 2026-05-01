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
  for (const f of ['metadata.json', 'problem-statement.md', 'flows.md', 'screen-justifications.md', 'analysis.md', 'anchors.json', 'references/.gitkeep']) {
    assert.equal(existsSync(join(r.path, f)), true, `falta ${f}`)
  }
})

test('bootstrap mudanca: não cria flows.md, mas cria pares em screen-justifications', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'mc-store-mudanca-'))
  const manifest = makeManifest('mudanca', { problemStatement: 'Texto', pairs: [{ label: 'Tela 01' }, { label: 'Tela 02' }] })
  const r = bootstrapLocalStore({ cwd, manifest })
  assert.equal(r.created, true)
  assert.equal(existsSync(join(r.path, 'flows.md')), false)
  const justif = readFileSync(join(r.path, 'screen-justifications.md'), 'utf8')
  assert.match(justif, /Tela 01/)
  assert.match(justif, /Tela 02/)
})

test('bootstrap conceito: cria seções por variante', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'mc-store-conceito-'))
  const manifest = makeManifest('conceito', { problemStatement: 'Texto', variants: ['A', 'B', 'C'], decisionCriteria: 'X' })
  const r = bootstrapLocalStore({ cwd, manifest })
  assert.equal(r.created, true)
  const justif = readFileSync(join(r.path, 'screen-justifications.md'), 'utf8')
  assert.match(justif, /Variante A/)
  assert.match(justif, /Variante B/)
  assert.match(justif, /Variante C/)
})

test('metadata.json contém slug, ticketRef, type, createdAt, identity.mode (sem tokens nem nodes)', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'mc-store-meta-'))
  const manifest = makeManifest('feature', { problemStatement: 'Texto', flows: [{ name: 'F', screens: 1 }] })
  const r = bootstrapLocalStore({ cwd, manifest })
  const meta = JSON.parse(readFileSync(join(r.path, 'metadata.json'), 'utf8'))
  assert.equal(meta.slug, 'prod-1234')
  assert.equal(meta.ticketRef, 'PROD-1234')
  assert.equal(meta.type, 'feature')
  assert.equal(meta.createdAt, '2026-05-01T15:30:00.000Z')
  assert.equal(meta.identity?.mode, 'default')
  assert.equal(meta.tokens, undefined)
  assert.equal(meta.nodes, undefined)
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
