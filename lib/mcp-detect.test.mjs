import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  CLIENT_CONFIG_PATHS,
  parseFigmaConsolePresence,
  detectClients,
} from './mcp-detect.mjs'

function makeFakeHome() {
  const dir = mkdtempSync(join(tmpdir(), 'mc-mcp-detect-'))
  after(() => rmSync(dir, { recursive: true, force: true }))
  return dir
}

test('CLIENT_CONFIG_PATHS lista os 4 clientes do MVP', () => {
  const ids = CLIENT_CONFIG_PATHS.map((c) => c.id).sort()
  assert.deepEqual(ids, ['claude-code', 'claude-desktop', 'cursor', 'windsurf'])
})

test('parseFigmaConsolePresence detecta figma-console em mcpServers', () => {
  const cfg = {
    mcpServers: {
      'figma-console': {
        command: 'npx',
        args: ['-y', 'figma-console-mcp@latest'],
        env: { FIGMA_ACCESS_TOKEN: 'figd_abcdef1234567890' },
      },
    },
  }
  const r = parseFigmaConsolePresence(cfg)
  assert.equal(r.installed, true)
  assert.equal(r.hasToken, true)
  assert.equal(r.tokenLooksValid, true)
})

test('parseFigmaConsolePresence aceita variantes de chave (mcp.servers, servers)', () => {
  for (const key of ['mcp.servers', 'servers']) {
    const cfg = {}
    cfg[key] = { 'figma-console': { command: 'npx', args: [], env: {} } }
    const r = parseFigmaConsolePresence(cfg)
    assert.equal(r.installed, true, `falhou para chave "${key}"`)
  }
})

test('parseFigmaConsolePresence reporta token ausente', () => {
  const cfg = {
    mcpServers: {
      'figma-console': { command: 'npx', args: [], env: {} },
    },
  }
  const r = parseFigmaConsolePresence(cfg)
  assert.equal(r.installed, true)
  assert.equal(r.hasToken, false)
})

test('parseFigmaConsolePresence reporta token mal-formado', () => {
  const cfg = {
    mcpServers: {
      'figma-console': { command: 'npx', args: [], env: { FIGMA_ACCESS_TOKEN: 'not-a-figd-token' } },
    },
  }
  const r = parseFigmaConsolePresence(cfg)
  assert.equal(r.hasToken, true)
  assert.equal(r.tokenLooksValid, false)
})

test('parseFigmaConsolePresence reporta ausência total', () => {
  const r = parseFigmaConsolePresence({ mcpServers: {} })
  assert.equal(r.installed, false)
  assert.equal(r.hasToken, false)
})

test('parseFigmaConsolePresence em config null devolve installed=false', () => {
  const r = parseFigmaConsolePresence(null)
  assert.equal(r.installed, false)
})

test('detectClients lê arquivos existentes e ignora os ausentes', () => {
  const home = makeFakeHome()
  // Claude Code: ~/.claude.json
  writeFileSync(join(home, '.claude.json'), JSON.stringify({
    mcpServers: { 'figma-console': { command: 'npx', args: [], env: { FIGMA_ACCESS_TOKEN: 'figd_test_token_long' } } },
  }))
  // Cursor: ~/.cursor/mcp.json
  mkdirSync(join(home, '.cursor'))
  writeFileSync(join(home, '.cursor', 'mcp.json'), JSON.stringify({ mcpServers: {} }))

  const result = detectClients({ home, platform: 'linux' })
  const byId = Object.fromEntries(result.map((r) => [r.id, r]))

  assert.equal(byId['claude-code'].present, true)
  assert.equal(byId['claude-code'].figmaConsole.installed, true)
  assert.equal(byId['claude-code'].figmaConsole.hasToken, true)

  assert.equal(byId['cursor'].present, true)
  assert.equal(byId['cursor'].figmaConsole.installed, false)

  assert.equal(byId['windsurf'].present, false)
  assert.equal(byId['claude-desktop'].present, false)
})

test('detectClients no macOS resolve o path do Claude Desktop em Application Support', () => {
  const home = makeFakeHome()
  const desktopCfgDir = join(home, 'Library', 'Application Support', 'Claude')
  mkdirSync(desktopCfgDir, { recursive: true })
  writeFileSync(join(desktopCfgDir, 'claude_desktop_config.json'), JSON.stringify({ mcpServers: {} }))

  const result = detectClients({ home, platform: 'darwin' })
  const desktop = result.find((r) => r.id === 'claude-desktop')
  assert.equal(desktop.present, true)
})

test('detectClients no Windows resolve o path do Claude Desktop via APPDATA', () => {
  const home = makeFakeHome()
  const appData = join(home, 'AppData', 'Roaming')
  const desktopCfgDir = join(appData, 'Claude')
  mkdirSync(desktopCfgDir, { recursive: true })
  writeFileSync(join(desktopCfgDir, 'claude_desktop_config.json'), JSON.stringify({ mcpServers: {} }))

  const result = detectClients({ home, platform: 'win32', env: { APPDATA: appData } })
  const desktop = result.find((r) => r.id === 'claude-desktop')
  assert.equal(desktop.present, true)
})

test('detectClients aceita JSONC com comentários no Claude Code', () => {
  const home = makeFakeHome()
  writeFileSync(join(home, '.claude.json'), '// comentário\n{\n  "mcpServers": {}\n}\n')

  const result = detectClients({ home, platform: 'linux' })
  const claudeCode = result.find((r) => r.id === 'claude-code')
  assert.equal(claudeCode.present, true)
  assert.equal(claudeCode.figmaConsole.installed, false)
})

test('detectClients propaga parseError para arquivo JSONC corrompido', () => {
  const home = makeFakeHome()
  writeFileSync(join(home, '.claude.json'), '{invalid json {{{')

  const result = detectClients({ home, platform: 'linux' })
  const cc = result.find((r) => r.id === 'claude-code')
  assert.equal(cc.present, true)
  assert.ok(typeof cc.parseError === 'string' && cc.parseError.length > 0)
  assert.equal(cc.figmaConsole.installed, false)
})
