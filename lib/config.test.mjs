import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, statSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  CONFIG_VERSION,
  configPath,
  defaultConfig,
  readConfig,
  writeConfig,
  validateConfig,
} from './config.mjs'

function makeRoot() {
  return mkdtempSync(join(tmpdir(), 'mc-config-'))
}

test('CONFIG_VERSION é "1.0.0"', () => {
  assert.equal(CONFIG_VERSION, '1.0.0')
})

test('configPath aponta para ~/.config/meet-criteria/config.json', () => {
  const home = '/home/test'
  assert.equal(configPath({ home }), '/home/test/.config/meet-criteria/config.json')
})

test('defaultConfig tem campos esperados', () => {
  const cfg = defaultConfig({ mcpClient: 'claude-code' })
  assert.equal(cfg.setup_complete, false)
  assert.equal(cfg.setup_version, CONFIG_VERSION)
  assert.equal(cfg.mcp_client, 'claude-code')
  assert.deepEqual(cfg.preferences, { language: 'pt-BR', default_visual_identity: 'ask' })
})

test('validateConfig aprova default', () => {
  const r = validateConfig(defaultConfig({ mcpClient: 'claude-code' }))
  assert.equal(r.valid, true)
  assert.deepEqual(r.errors, [])
})

test('validateConfig reprova mcp_client desconhecido', () => {
  const cfg = defaultConfig({ mcpClient: 'claude-code' })
  cfg.mcp_client = 'emacs-mcp'
  const r = validateConfig(cfg)
  assert.equal(r.valid, false)
  assert.match(r.errors.join(' '), /mcp_client/)
})

test('validateConfig reprova preferences.language fora do enum', () => {
  const cfg = defaultConfig({ mcpClient: 'claude-code' })
  cfg.preferences.language = 'klingon'
  const r = validateConfig(cfg)
  assert.equal(r.valid, false)
  assert.match(r.errors.join(' '), /language/)
})

test('writeConfig cria diretório e arquivo, retorna path absoluto', () => {
  const home = makeRoot()
  const cfg = defaultConfig({ mcpClient: 'claude-code' })
  cfg.setup_complete = true
  const path = writeConfig(cfg, { home })
  assert.equal(existsSync(path), true)
  const onDisk = JSON.parse(readFileSync(path, 'utf8'))
  assert.equal(onDisk.setup_complete, true)
  assert.equal(onDisk.mcp_client, 'claude-code')
})

test('writeConfig aplica permissões 600 em Unix', { skip: process.platform === 'win32' }, () => {
  const home = makeRoot()
  const path = writeConfig(defaultConfig({ mcpClient: 'claude-code' }), { home })
  const mode = statSync(path).mode & 0o777
  assert.equal(mode, 0o600)
})

test('writeConfig é atômico — sem arquivo .tmp residual após sucesso', () => {
  const home = makeRoot()
  const path = writeConfig(defaultConfig({ mcpClient: 'claude-code' }), { home })
  assert.equal(existsSync(path + '.tmp'), false)
})

test('writeConfig recusa salvar config inválido (não cria arquivo)', () => {
  const home = makeRoot()
  const cfg = defaultConfig({ mcpClient: 'claude-code' })
  cfg.mcp_client = 'invalid'
  assert.throws(() => writeConfig(cfg, { home }), /mcp_client/)
  assert.equal(existsSync(configPath({ home })), false)
})

test('readConfig devolve null quando arquivo não existe', () => {
  const home = makeRoot()
  const r = readConfig({ home })
  assert.equal(r, null)
})

test('readConfig parseia arquivo gravado por writeConfig (round-trip)', () => {
  const home = makeRoot()
  const cfg = defaultConfig({ mcpClient: 'cursor' })
  cfg.setup_complete = true
  cfg.preferences.default_visual_identity = 'auto'
  writeConfig(cfg, { home })
  const back = readConfig({ home })
  assert.deepEqual(back, cfg)
})

test('readConfig em arquivo malformado lança erro descritivo', () => {
  const home = makeRoot()
  mkdirSync(join(home, '.config', 'meet-criteria'), { recursive: true })
  writeFileSync(configPath({ home }), '{ not valid json')
  assert.throws(() => readConfig({ home }), /parse|JSON/i)
})

test('writeConfig descarta chaves extras (token figd_ nunca persiste)', () => {
  const home = makeRoot()
  const cfg = { ...defaultConfig({ mcpClient: 'claude-code' }), figd_token: 'figd_supersecretXXXXXXX', random_extra: 42 }
  const path = writeConfig(cfg, { home })
  const onDisk = JSON.parse(readFileSync(path, 'utf8'))
  assert.equal(Object.prototype.hasOwnProperty.call(onDisk, 'figd_token'), false)
  assert.equal(Object.prototype.hasOwnProperty.call(onDisk, 'random_extra'), false)
  assert.deepEqual(Object.keys(onDisk).sort(), ['mcp_client', 'preferences', 'setup_complete', 'setup_version'])
})

test('writeConfig descarta chaves extras dentro de preferences', () => {
  const home = makeRoot()
  const cfg = defaultConfig({ mcpClient: 'claude-code' })
  cfg.preferences.figd_secret = 'figd_xxxxxxxxxxxx'
  const path = writeConfig(cfg, { home })
  const onDisk = JSON.parse(readFileSync(path, 'utf8'))
  assert.equal(Object.prototype.hasOwnProperty.call(onDisk.preferences, 'figd_secret'), false)
  assert.deepEqual(Object.keys(onDisk.preferences).sort(), ['default_visual_identity', 'language'])
})

test('readConfig é race-safe — não usa existsSync intermediário', () => {
  // Smoke test: readConfig devolve null quando arquivo nunca existiu, sem throw.
  const home = makeRoot()
  assert.equal(readConfig({ home }), null)
})

test('validateConfig reprova arrays com mensagem de tipo top-level', () => {
  const r = validateConfig([1, 2, 3])
  assert.equal(r.valid, false)
  assert.match(r.errors.join(' '), /config deve ser um objeto/)
})
