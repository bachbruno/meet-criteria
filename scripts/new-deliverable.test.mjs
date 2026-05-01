import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { mkdtempSync, existsSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'

const here = dirname(fileURLToPath(import.meta.url))
const cli = join(here, 'new-deliverable.mjs')

function run(args, { stdin, env } = {}) {
  return spawnSync(process.execPath, [cli, ...args], {
    encoding: 'utf8',
    input: stdin,
    env: { ...process.env, ...(env || {}) },
  })
}

const FEATURE_INPUTS = {
  ticketRef: 'PROD-1234',
  problemStatement: 'Reduzir cliques no checkout de 5 pra 2.',
  flows: [
    { name: 'Checkout principal', screens: 3 },
    { name: 'Checkout alternativo', screens: 2 },
  ],
  identity: { mode: 'default' },
}

test('CLI sem --type joga código 2', () => {
  const r = run([])
  assert.equal(r.status, 2, r.stderr)
  assert.match(r.stderr, /--type/)
})

test('CLI --type desconhecido joga 2', () => {
  const r = run(['--type', 'epic'], { stdin: JSON.stringify(FEATURE_INPUTS) })
  assert.equal(r.status, 2, r.stderr)
  assert.match(r.stderr, /Tipo desconhecido|unknown/i)
})

test('CLI feature: imprime manifest válido em stdout', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'mc-cli-'))
  const r = run(['--type', 'feature', '--cwd', cwd, '--created-at', '2026-05-01T15:30:00.000Z'], { stdin: JSON.stringify(FEATURE_INPUTS) })
  assert.equal(r.status, 0, r.stderr)
  const manifest = JSON.parse(r.stdout)
  assert.equal(manifest.version, '1.0.0')
  assert.equal(manifest.type, 'feature')
  assert.equal(manifest.slug, 'prod-1234')
  assert.equal(manifest.container.name, 'Meet Criteria — PROD-1234')
})

test('CLI feature: cria local store em <cwd>/.meet-criteria/<slug>/', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'mc-cli-store-'))
  const r = run(['--type', 'feature', '--cwd', cwd, '--created-at', '2026-05-01T15:30:00.000Z'], { stdin: JSON.stringify(FEATURE_INPUTS) })
  assert.equal(r.status, 0, r.stderr)
  const root = join(cwd, '.meet-criteria', 'prod-1234')
  assert.equal(existsSync(join(root, 'metadata.json')), true)
  const meta = JSON.parse(readFileSync(join(root, 'metadata.json'), 'utf8'))
  assert.equal(meta.ticketRef, 'PROD-1234')
})

test('CLI feature: --dry-run não cria local store', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'mc-cli-dry-'))
  const r = run(['--type', 'feature', '--cwd', cwd, '--dry-run', '--created-at', '2026-05-01T15:30:00.000Z'], { stdin: JSON.stringify(FEATURE_INPUTS) })
  assert.equal(r.status, 0, r.stderr)
  assert.equal(existsSync(join(cwd, '.meet-criteria')), false)
})

test('CLI conceito: aceita variants em inputs', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'mc-cli-conc-'))
  const inputs = {
    ticketRef: 'CONC-1',
    problemStatement: 'Decidir entre 3 layouts.',
    variants: ['A', 'B', 'C'],
    decisionCriteria: 'Custo, acessibilidade, conversão.',
    identity: { mode: 'default' },
  }
  const r = run(['--type', 'conceito', '--cwd', cwd, '--created-at', '2026-05-01T15:30:00.000Z'], { stdin: JSON.stringify(inputs) })
  assert.equal(r.status, 0, r.stderr)
  const manifest = JSON.parse(r.stdout)
  assert.equal(manifest.type, 'conceito')
  assert.equal(manifest.slug, 'conc-1')
})

test('CLI auto identity sem overrides imprime warning em stderr', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'mc-cli-auto-'))
  const inputs = { ...FEATURE_INPUTS, identity: { mode: 'auto', overrides: {} } }
  const r = run(['--type', 'feature', '--cwd', cwd, '--created-at', '2026-05-01T15:30:00.000Z'], { stdin: JSON.stringify(inputs) })
  assert.equal(r.status, 0, r.stderr)
  assert.match(r.stderr, /sem overrides|no overrides/i)
})

test('CLI input inválido (problemStatement vazio) sai com 1 e mensagem', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'mc-cli-bad-'))
  const inputs = { ...FEATURE_INPUTS, problemStatement: '' }
  const r = run(['--type', 'feature', '--cwd', cwd, '--created-at', '2026-05-01T15:30:00.000Z'], { stdin: JSON.stringify(inputs) })
  assert.equal(r.status, 1)
  assert.match(r.stderr, /problem-statement/)
})
