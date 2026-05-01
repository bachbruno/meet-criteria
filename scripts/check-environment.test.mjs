import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'

const here = dirname(fileURLToPath(import.meta.url))
const cli = join(here, 'check-environment.mjs')

function run(args = [], env = {}) {
  return spawnSync(process.execPath, [cli, ...args], {
    env: { ...process.env, ...env },
    encoding: 'utf8',
  })
}

test('CLI sem args imprime JSON com chaves esperadas', () => {
  const r = run(['--json'])
  assert.equal(r.status, 0, r.stderr)
  const out = JSON.parse(r.stdout)
  assert.ok(out.node, 'falta node')
  assert.ok(out.figmaDesktop, 'falta figmaDesktop')
  assert.ok(Array.isArray(out.clients), 'clients deve ser array')
  assert.ok(typeof out.summary === 'object', 'falta summary')
  assert.equal(typeof out.summary.allCriticalOk, 'boolean')
})

test('CLI com --home aponta para HOME custom (sem detectar clients reais)', () => {
  const fakeHome = mkdtempSync(join(tmpdir(), 'mc-env-'))
  // sem nenhum config → todos os clients com present=false
  const r = run(['--json', '--home', fakeHome])
  assert.equal(r.status, 0, r.stderr)
  const out = JSON.parse(r.stdout)
  for (const c of out.clients) assert.equal(c.present, false, `${c.id} deveria estar ausente`)
})

test('CLI detecta figma-console em fake home', () => {
  const fakeHome = mkdtempSync(join(tmpdir(), 'mc-env-'))
  writeFileSync(join(fakeHome, '.claude.json'), JSON.stringify({
    mcpServers: { 'figma-console': { command: 'npx', args: [], env: { FIGMA_ACCESS_TOKEN: 'figd_xxxxxxxxxx' } } },
  }))
  const r = run(['--json', '--home', fakeHome])
  assert.equal(r.status, 0, r.stderr)
  const out = JSON.parse(r.stdout)
  const claudeCode = out.clients.find((c) => c.id === 'claude-code')
  assert.equal(claudeCode.present, true)
  assert.equal(claudeCode.figmaConsole.installed, true)
  assert.equal(claudeCode.figmaConsole.tokenLooksValid, true)
})

test('CLI sem --json imprime relatório legível em pt-BR', () => {
  const fakeHome = mkdtempSync(join(tmpdir(), 'mc-env-'))
  const r = run(['--home', fakeHome])
  assert.equal(r.status, 0, r.stderr)
  assert.match(r.stdout, /Node\.js/)
  assert.match(r.stdout, /Figma Desktop/)
  assert.match(r.stdout, /MCP/)
})
