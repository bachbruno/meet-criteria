# Meet Criteria — Setup & Onboarding Implementation Plan (Plano 2 de 6)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar o fluxo `/meet-criteria-setup` em 6 passos — detectar pré-requisitos (Node.js 18+, Figma Desktop), detectar/instalar `figma-console MCP` no cliente atual (foco MVP: Claude Code), guiar criação de Personal Access Token + import do Bridge plugin no Figma Desktop, e persistir preferências em `~/.config/meet-criteria/config.json`. Saída desta fase: o usuário pode rodar o slash command e ficar com ambiente pronto pra usar a ferramenta nos planos seguintes.

**Architecture:** Pequenos utilitários Node.js puros e testáveis (`lib/system-checks.mjs`, `lib/mcp-detect.mjs`, `lib/config.mjs`) + um script CLI (`scripts/check-environment.mjs`) que o agente roda via Bash para coletar diagnóstico em JSON. Um segundo script CLI (`scripts/init-config.mjs`) materializa o `config.json` final. O "cérebro" do onboarding mora em `skills/setup-helper.md` (instruções narrativas pro agente) e o gatilho fica em `commands/meet-criteria-setup.md`. **Token `figd_*` nunca toca o filesystem da skill** — ele é injetado como env var na config do MCP do cliente.

**Tech Stack:** Node.js 20+ (matches project), `node:fs`, `node:os`, `node:path`, `node:child_process`, `jsonc-parser` (já instalado, lê `.claude.json` e similares), `node:test`. Sem dependências novas no `package.json`.

**Foco MVP — clientes MCP suportados nesta fase:**
- ✅ **Claude Code** (CLI) — fluxo automatizado completo via `claude mcp add`
- 📋 **Cursor / Windsurf / Claude Desktop** — detectados, mas a skill emite instruções manuais e pula a edição automática do JSON deles. Automação pra esses clientes fica como follow-up explícito no `setup-helper.md`.

**Escopo (não cobertos aqui):**
- Plano 3 — Geração de templates (`/meet-criteria-new`)
- Plano 4 — Análise IA (`/meet-criteria-analyze`)
- Plano 5 — Âncoras
- Plano 6 — Checks determinísticos

**Premissas dependentes do Plano 1 (já confirmadas):**
- `package.json` existe com `"type": "module"` e Node 20+ no `engines`
- `jsonc-parser` está em `dependencies`
- `node --test` é o test runner

---

## File Structure

Novo nesta fase:

- Create: `lib/system-checks.mjs` — detecção de Node version + Figma Desktop por plataforma
- Create: `lib/system-checks.test.mjs` — testes do módulo
- Create: `lib/mcp-detect.mjs` — leitura/análise de configs MCP de clientes conhecidos
- Create: `lib/mcp-detect.test.mjs` — testes do módulo
- Create: `lib/config.mjs` — leitura/escrita atômica de `~/.config/meet-criteria/config.json` com perms 600
- Create: `lib/config.test.mjs` — testes do módulo
- Create: `scripts/check-environment.mjs` — CLI: roda os checks e imprime relatório JSON
- Create: `scripts/check-environment.test.mjs` — testes de smoke do CLI
- Create: `scripts/init-config.mjs` — CLI: escreve config.json a partir de flags
- Create: `skills/setup-helper.md` — skill narrativa que orquestra os 6 passos
- Create: `commands/meet-criteria-setup.md` — slash command (gatilho)

Modify:
- `package.json` — adicionar scripts `check:environment` e `setup:write-config`
- `README.md` — atualizar Roadmap (marcar Plano 2 ✅) e adicionar seção "Setup"

Delete:
- `skills/.gitkeep` (após Task 7)
- `commands/.gitkeep` (após Task 8)

Cada módulo tem responsabilidade única:
- `system-checks` é puro: recebe valores, devolve `{ ok, detail }`. Sem efeito colateral além de `fs.existsSync` injetável.
- `mcp-detect` é leitor: parseia configs de clientes conhecidos, devolve `{ client, hasFigmaConsole, source }`. Não escreve nada.
- `config` é o único módulo com efeito colateral em disco — escrita atômica + chmod 600.
- `check-environment.mjs` orquestra os três e imprime JSON estável (consumível pelo agente).
- `init-config.mjs` é o write-side; lê flags, valida, chama `config.write()`.
- A skill `.md` lê esses outputs e conduz o usuário em prosa.

---

## Tasks

### Task 1: Testes de `lib/system-checks.mjs` (TDD-first)

**Files:**
- Create: `lib/system-checks.test.mjs`

- [ ] **Step 1: Escrever os testes (módulo ainda não existe)**

Crie `lib/system-checks.test.mjs`:

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  checkNodeVersion,
  checkFigmaDesktop,
  MIN_NODE_MAJOR,
} from './system-checks.mjs'

test('MIN_NODE_MAJOR é 18 (requisito do figma-console MCP)', () => {
  assert.equal(MIN_NODE_MAJOR, 18)
})

test('checkNodeVersion aprova 20.10.0', () => {
  const r = checkNodeVersion({ nodeVersion: '20.10.0' })
  assert.equal(r.ok, true)
  assert.equal(r.major, 20)
  assert.equal(r.detected, '20.10.0')
})

test('checkNodeVersion aprova exatamente 18.0.0 (limite inclusivo)', () => {
  const r = checkNodeVersion({ nodeVersion: '18.0.0' })
  assert.equal(r.ok, true)
  assert.equal(r.major, 18)
})

test('checkNodeVersion reprova 16.20.0 com mensagem clara', () => {
  const r = checkNodeVersion({ nodeVersion: '16.20.0' })
  assert.equal(r.ok, false)
  assert.equal(r.major, 16)
  assert.match(r.message, /18/)
})

test('checkNodeVersion reprova string mal-formada', () => {
  const r = checkNodeVersion({ nodeVersion: 'banana' })
  assert.equal(r.ok, false)
  assert.match(r.message, /parse|invalid|version/i)
})

test('checkFigmaDesktop encontra app no macOS via path padrão', () => {
  const r = checkFigmaDesktop({
    platform: 'darwin',
    exists: (p) => p === '/Applications/Figma.app',
  })
  assert.equal(r.ok, true)
  assert.equal(r.path, '/Applications/Figma.app')
})

test('checkFigmaDesktop reporta não encontrado no macOS quando ausente', () => {
  const r = checkFigmaDesktop({
    platform: 'darwin',
    exists: () => false,
  })
  assert.equal(r.ok, false)
  assert.match(r.message, /Figma Desktop/i)
})

test('checkFigmaDesktop encontra Figma no Windows em LOCALAPPDATA', () => {
  const r = checkFigmaDesktop({
    platform: 'win32',
    env: { LOCALAPPDATA: 'C:/Users/me/AppData/Local' },
    exists: (p) => p === 'C:/Users/me/AppData/Local/Figma/Figma.exe',
  })
  assert.equal(r.ok, true)
  assert.match(r.path, /Figma\.exe$/)
})

test('checkFigmaDesktop em Linux reporta não-suportado-com-detecção (fallback informativo)', () => {
  const r = checkFigmaDesktop({
    platform: 'linux',
    exists: () => false,
  })
  assert.equal(r.ok, false)
  assert.equal(r.unsupported, true)
  assert.match(r.message, /Linux|manual/i)
})
```

- [ ] **Step 2: Rodar — devem falhar com `ERR_MODULE_NOT_FOUND`**

Run: `npm test`
Expected: erros `ERR_MODULE_NOT_FOUND` apontando pra `system-checks.mjs`.

---

### Task 2: Implementar `lib/system-checks.mjs`

**Files:**
- Create: `lib/system-checks.mjs`

- [ ] **Step 1: Criar `lib/system-checks.mjs`**

```js
// Detecção de pré-requisitos do ambiente:
// - Node.js 18+ (requisito do figma-console MCP)
// - Figma Desktop (Bridge plugin não roda em Figma web)
//
// Funções são puras: recebem dependências como parâmetros (DI), não usam
// `process.*` ou `fs.*` diretamente. Isso permite testar sem mocks.

import { existsSync } from 'node:fs'

export const MIN_NODE_MAJOR = 18

const SEMVER_RE = /^(\d+)\.(\d+)\.(\d+)/

export function checkNodeVersion({ nodeVersion = process.versions.node, minMajor = MIN_NODE_MAJOR } = {}) {
  const m = SEMVER_RE.exec(String(nodeVersion))
  if (!m) {
    return {
      ok: false,
      detected: nodeVersion,
      major: null,
      message: `Não foi possível parsear a versão do Node: "${nodeVersion}"`,
    }
  }
  const major = Number(m[1])
  if (major < minMajor) {
    return {
      ok: false,
      detected: nodeVersion,
      major,
      message: `Node ${nodeVersion} detectado; requer Node ${minMajor}+ para o figma-console MCP.`,
    }
  }
  return { ok: true, detected: nodeVersion, major }
}

const FIGMA_PATHS_BY_PLATFORM = {
  darwin: () => ['/Applications/Figma.app'],
  win32: ({ env }) => {
    const localAppData = env.LOCALAPPDATA
    if (!localAppData) return []
    return [
      `${localAppData}/Figma/Figma.exe`,
      `${localAppData}/Programs/Figma/Figma.exe`,
    ]
  },
}

export function checkFigmaDesktop({
  platform = process.platform,
  env = process.env,
  exists = existsSync,
} = {}) {
  const resolver = FIGMA_PATHS_BY_PLATFORM[platform]
  if (!resolver) {
    return {
      ok: false,
      unsupported: true,
      platform,
      message: `Detecção automática de Figma Desktop não suportada em ${platform === 'linux' ? 'Linux' : platform}. Verifique manualmente que o app desktop esteja aberto antes de seguir.`,
    }
  }
  const candidates = resolver({ env })
  for (const path of candidates) {
    if (exists(path)) return { ok: true, path, platform }
  }
  return {
    ok: false,
    platform,
    message: 'Figma Desktop não encontrado nos caminhos padrão. Instale em https://www.figma.com/downloads/ ou aponte o caminho manualmente.',
    triedPaths: candidates,
  }
}
```

- [ ] **Step 2: Remover `lib/.gitkeep` se ainda existir**

Run: `[ -f lib/.gitkeep ] && rm lib/.gitkeep || true`
Expected: silencioso (no Plano 1 já foi removido).

- [ ] **Step 3: Rodar testes — todos devem passar**

Run: `npm test`
Expected: 9 novos testes passando, mais os 20 do Plano 1 → 29 ✔.

- [ ] **Step 4: Commit**

```bash
git add lib/system-checks.mjs lib/system-checks.test.mjs
git commit -m "feat(lib): add system-checks for Node version + Figma Desktop detection"
```

---

### Task 3: Testes de `lib/mcp-detect.mjs` (TDD-first)

Esta lib lê configs de clientes MCP conhecidos e responde duas perguntas: (1) qual cliente está em uso? (2) o `figma-console` MCP já está configurado nele?

**Clientes suportados nesta fase:** `claude-code` (full), `cursor`, `windsurf`, `claude-desktop` (apenas detecção; instrução manual no skill).

**Files:**
- Create: `lib/mcp-detect.test.mjs`

- [ ] **Step 1: Criar `lib/mcp-detect.test.mjs`**

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  CLIENT_CONFIG_PATHS,
  parseFigmaConsolePresence,
  detectClients,
} from './mcp-detect.mjs'

function makeFakeHome() {
  return mkdtempSync(join(tmpdir(), 'mc-mcp-detect-'))
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
        env: { FIGMA_ACCESS_TOKEN: 'figd_xxx' },
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
    mcpServers: { 'figma-console': { command: 'npx', args: [], env: { FIGMA_ACCESS_TOKEN: 'figd_abc' } } },
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

test('detectClients aceita JSONC com comentários no Claude Code', () => {
  const home = makeFakeHome()
  writeFileSync(join(home, '.claude.json'), '// comentário\n{\n  "mcpServers": {}\n}\n')

  const result = detectClients({ home, platform: 'linux' })
  const claudeCode = result.find((r) => r.id === 'claude-code')
  assert.equal(claudeCode.present, true)
  assert.equal(claudeCode.figmaConsole.installed, false)
})
```

- [ ] **Step 2: Rodar — falham com módulo ausente**

Run: `npm test`
Expected: erros de módulo apontando pra `mcp-detect.mjs`.

---

### Task 4: Implementar `lib/mcp-detect.mjs`

**Files:**
- Create: `lib/mcp-detect.mjs`

- [ ] **Step 1: Criar `lib/mcp-detect.mjs`**

```js
// Detecção de clientes MCP conhecidos e do estado do `figma-console` neles.
// Leitura apenas — nenhum side-effect de escrita.
//
// Cobertura MVP:
//   - claude-code     → ~/.claude.json
//   - cursor          → ~/.cursor/mcp.json
//   - windsurf        → ~/.codeium/windsurf/mcp_config.json
//   - claude-desktop  → macOS: ~/Library/Application Support/Claude/claude_desktop_config.json
//                       Windows: %APPDATA%/Claude/claude_desktop_config.json
//                       Linux: ~/.config/Claude/claude_desktop_config.json

import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { parse as parseJsonc } from 'jsonc-parser'

const FIGD_RE = /^figd_[A-Za-z0-9_-]{10,}$/

function claudeDesktopPath({ home, platform, env }) {
  if (platform === 'darwin') {
    return join(home, 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json')
  }
  if (platform === 'win32') {
    const appData = (env && env.APPDATA) || join(home, 'AppData', 'Roaming')
    return join(appData, 'Claude', 'claude_desktop_config.json')
  }
  return join(home, '.config', 'Claude', 'claude_desktop_config.json')
}

export const CLIENT_CONFIG_PATHS = [
  {
    id: 'claude-code',
    label: 'Claude Code',
    resolve: ({ home }) => join(home, '.claude.json'),
  },
  {
    id: 'cursor',
    label: 'Cursor',
    resolve: ({ home }) => join(home, '.cursor', 'mcp.json'),
  },
  {
    id: 'windsurf',
    label: 'Windsurf',
    resolve: ({ home }) => join(home, '.codeium', 'windsurf', 'mcp_config.json'),
  },
  {
    id: 'claude-desktop',
    label: 'Claude Desktop',
    resolve: claudeDesktopPath,
  },
]

function getMcpServersBucket(cfg) {
  if (!cfg || typeof cfg !== 'object') return null
  if (cfg.mcpServers && typeof cfg.mcpServers === 'object') return cfg.mcpServers
  if (cfg['mcp.servers'] && typeof cfg['mcp.servers'] === 'object') return cfg['mcp.servers']
  if (cfg.servers && typeof cfg.servers === 'object') return cfg.servers
  return null
}

export function parseFigmaConsolePresence(cfg) {
  const bucket = getMcpServersBucket(cfg)
  if (!bucket) return { installed: false, hasToken: false, tokenLooksValid: false }
  const entry = bucket['figma-console']
  if (!entry || typeof entry !== 'object') {
    return { installed: false, hasToken: false, tokenLooksValid: false }
  }
  const token = entry.env && typeof entry.env === 'object' ? entry.env.FIGMA_ACCESS_TOKEN : undefined
  const hasToken = typeof token === 'string' && token.length > 0
  const tokenLooksValid = hasToken && FIGD_RE.test(token)
  return { installed: true, hasToken, tokenLooksValid }
}

function readJsoncSafe(path) {
  if (!existsSync(path)) return { exists: false, parsed: null, parseError: null }
  let raw
  try {
    raw = readFileSync(path, 'utf8')
  } catch (err) {
    return { exists: true, parsed: null, parseError: err.message }
  }
  const errors = []
  const parsed = parseJsonc(raw, errors, { allowTrailingComma: true })
  if (errors.length > 0) {
    return { exists: true, parsed: null, parseError: `JSONC parse error code ${errors[0].error} at offset ${errors[0].offset}` }
  }
  return { exists: true, parsed, parseError: null }
}

export function detectClients({ home = homedir(), platform = process.platform, env = process.env } = {}) {
  return CLIENT_CONFIG_PATHS.map((client) => {
    const path = client.resolve({ home, platform, env })
    const { exists, parsed, parseError } = readJsoncSafe(path)
    return {
      id: client.id,
      label: client.label,
      path,
      present: exists,
      parseError,
      figmaConsole: parsed ? parseFigmaConsolePresence(parsed) : { installed: false, hasToken: false, tokenLooksValid: false },
    }
  })
}
```

- [ ] **Step 2: Rodar testes — devem passar**

Run: `npm test`
Expected: 10 novos testes passando, total agora 39 ✔.

- [ ] **Step 3: Commit**

```bash
git add lib/mcp-detect.mjs lib/mcp-detect.test.mjs
git commit -m "feat(lib): add MCP client detection for figma-console presence"
```

---

### Task 5: Testes de `lib/config.mjs` (TDD-first)

`lib/config.mjs` é o único módulo desta fase com efeito colateral em disco. Escreve atômico (write em tmp + rename) e aplica chmod 600 em Unix.

**Files:**
- Create: `lib/config.test.mjs`

- [ ] **Step 1: Criar `lib/config.test.mjs`**

```js
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
```

- [ ] **Step 2: Rodar — devem falhar com módulo ausente**

Run: `npm test`
Expected: erros de módulo apontando pra `config.mjs`.

---

### Task 6: Implementar `lib/config.mjs`

**Files:**
- Create: `lib/config.mjs`

- [ ] **Step 1: Criar `lib/config.mjs`**

```js
// Persistência de preferências do usuário em ~/.config/meet-criteria/config.json.
// IMPORTANTE: o token figd_* NUNCA fica aqui — ele vive como env var no config
// MCP do cliente (~/.claude.json, ~/.cursor/mcp.json, etc.).
//
// Escrita é atômica: grava em <path>.tmp e renomeia. Aplica chmod 600 em Unix
// (silently ignored em Windows pelo Node).

import { mkdirSync, writeFileSync, renameSync, chmodSync, readFileSync, existsSync, unlinkSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'

export const CONFIG_VERSION = '1.0.0'

export const SUPPORTED_CLIENTS = ['claude-code', 'cursor', 'windsurf', 'claude-desktop']
export const SUPPORTED_LANGUAGES = ['pt-BR']
export const SUPPORTED_VISUAL_IDENTITIES = ['ask', 'auto', 'default']

export function configPath({ home = homedir() } = {}) {
  return join(home, '.config', 'meet-criteria', 'config.json')
}

export function defaultConfig({ mcpClient }) {
  return {
    setup_complete: false,
    setup_version: CONFIG_VERSION,
    mcp_client: mcpClient,
    preferences: {
      language: 'pt-BR',
      default_visual_identity: 'ask',
    },
  }
}

export function validateConfig(cfg) {
  const errors = []
  if (!cfg || typeof cfg !== 'object') {
    return { valid: false, errors: ['config deve ser um objeto'] }
  }
  if (typeof cfg.setup_complete !== 'boolean') errors.push('setup_complete deve ser boolean')
  if (cfg.setup_version !== CONFIG_VERSION) errors.push(`setup_version deve ser "${CONFIG_VERSION}"`)
  if (!SUPPORTED_CLIENTS.includes(cfg.mcp_client)) {
    errors.push(`mcp_client deve ser um de: ${SUPPORTED_CLIENTS.join(', ')}`)
  }
  if (!cfg.preferences || typeof cfg.preferences !== 'object') {
    errors.push('preferences deve ser um objeto')
  } else {
    if (!SUPPORTED_LANGUAGES.includes(cfg.preferences.language)) {
      errors.push(`preferences.language deve ser um de: ${SUPPORTED_LANGUAGES.join(', ')}`)
    }
    if (!SUPPORTED_VISUAL_IDENTITIES.includes(cfg.preferences.default_visual_identity)) {
      errors.push(`preferences.default_visual_identity deve ser um de: ${SUPPORTED_VISUAL_IDENTITIES.join(', ')}`)
    }
  }
  return { valid: errors.length === 0, errors }
}

export function writeConfig(cfg, { home = homedir() } = {}) {
  const { valid, errors } = validateConfig(cfg)
  if (!valid) throw new Error(`Config inválido: ${errors.join('; ')}`)

  const path = configPath({ home })
  mkdirSync(dirname(path), { recursive: true })

  const tmpPath = path + '.tmp'
  const json = JSON.stringify(cfg, null, 2) + '\n'
  try {
    writeFileSync(tmpPath, json, { encoding: 'utf8', mode: 0o600 })
    if (process.platform !== 'win32') chmodSync(tmpPath, 0o600)
    renameSync(tmpPath, path)
    if (process.platform !== 'win32') chmodSync(path, 0o600)
  } catch (err) {
    if (existsSync(tmpPath)) {
      try { unlinkSync(tmpPath) } catch {}
    }
    throw err
  }
  return path
}

export function readConfig({ home = homedir() } = {}) {
  const path = configPath({ home })
  if (!existsSync(path)) return null
  const raw = readFileSync(path, 'utf8')
  try {
    return JSON.parse(raw)
  } catch (err) {
    throw new Error(`Falha ao parsear ${path}: ${err.message}`)
  }
}
```

- [ ] **Step 2: Rodar testes — devem passar**

Run: `npm test`
Expected: 13 novos testes do config (1 pulado em Windows), total agora ~52 ✔.

- [ ] **Step 3: Commit**

```bash
git add lib/config.mjs lib/config.test.mjs
git commit -m "feat(lib): add config read/write with atomic writes + 600 perms"
```

---

### Task 7: Script CLI `scripts/check-environment.mjs`

Orquestra os três checks (Node, Figma Desktop, MCP clients) e imprime um relatório JSON estável que o agente lê e narra ao usuário.

**Files:**
- Create: `scripts/check-environment.mjs`
- Create: `scripts/check-environment.test.mjs`

- [ ] **Step 1: Escrever testes (TDD-first)**

Crie `scripts/check-environment.test.mjs`:

```js
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
```

- [ ] **Step 2: Rodar — falham por CLI inexistente**

Run: `npm test`
Expected: testes do `scripts/check-environment.test.mjs` falham (`spawnSync` retorna erro porque o arquivo CLI não existe ou módulo retorna 1).

- [ ] **Step 3: Implementar `scripts/check-environment.mjs`**

```js
#!/usr/bin/env node
// CLI: roda system-checks + mcp-detect e imprime relatório.
// Modo padrão: texto humano (pt-BR). Com --json: saída estruturada estável
// para o agente parsear no skill setup-helper.
//
// Flags:
//   --json           Imprime JSON em vez de texto.
//   --home <path>    Sobrescreve HOME (útil em testes).

import { homedir } from 'node:os'
import { checkNodeVersion, checkFigmaDesktop } from '../lib/system-checks.mjs'
import { detectClients } from '../lib/mcp-detect.mjs'

function parseArgs(argv) {
  const args = { json: false, home: null }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--json') args.json = true
    else if (a === '--home') args.home = argv[++i]
    else if (a === '--help' || a === '-h') args.help = true
    else {
      console.error(`Argumento desconhecido: ${a}`)
      process.exit(2)
    }
  }
  return args
}

function buildReport({ home }) {
  const node = checkNodeVersion()
  const figmaDesktop = checkFigmaDesktop()
  const clients = detectClients({ home })
  const figmaConsoleInAnyClient = clients.some((c) => c.figmaConsole.installed)
  const tokenValidInAnyClient = clients.some((c) => c.figmaConsole.tokenLooksValid)
  const summary = {
    allCriticalOk: node.ok && figmaConsoleInAnyClient && tokenValidInAnyClient,
    nodeOk: node.ok,
    figmaDesktopOk: figmaDesktop.ok,
    figmaConsoleInstalled: figmaConsoleInAnyClient,
    figmaTokenValid: tokenValidInAnyClient,
  }
  return { node, figmaDesktop, clients, summary }
}

function statusGlyph(ok) {
  return ok ? 'OK ' : 'PEND'
}

function renderHuman(report) {
  const lines = []
  lines.push('Meet Criteria — diagnóstico de ambiente')
  lines.push('')
  lines.push(`[${statusGlyph(report.node.ok)}] Node.js ${report.node.detected ?? '(não detectado)'}`)
  if (!report.node.ok) lines.push(`     ${report.node.message}`)
  lines.push(`[${statusGlyph(report.figmaDesktop.ok)}] Figma Desktop`)
  if (!report.figmaDesktop.ok) lines.push(`     ${report.figmaDesktop.message}`)
  else lines.push(`     ${report.figmaDesktop.path}`)
  lines.push('')
  lines.push('Clientes MCP:')
  for (const c of report.clients) {
    if (!c.present) {
      lines.push(`  [    ] ${c.label} — config não encontrado em ${c.path}`)
      continue
    }
    const fc = c.figmaConsole
    if (!fc.installed) {
      lines.push(`  [PEND] ${c.label} — figma-console MCP ainda não configurado`)
    } else if (!fc.tokenLooksValid) {
      lines.push(`  [PEND] ${c.label} — figma-console presente; token Figma ausente ou mal-formado`)
    } else {
      lines.push(`  [ OK ] ${c.label} — figma-console + token figd_* prontos`)
    }
  }
  lines.push('')
  lines.push(report.summary.allCriticalOk
    ? 'Tudo crítico OK. Pronto pra rodar /meet-criteria-setup → validação final.'
    : 'Itens pendentes acima precisam ser resolvidos antes de marcar setup_complete.')
  return lines.join('\n')
}

function main() {
  const args = parseArgs(process.argv.slice(2))
  if (args.help) {
    console.log('Usage: check-environment.mjs [--json] [--home <path>]')
    process.exit(0)
  }
  const home = args.home || homedir()
  const report = buildReport({ home })
  if (args.json) {
    process.stdout.write(JSON.stringify(report, null, 2) + '\n')
  } else {
    process.stdout.write(renderHuman(report) + '\n')
  }
  process.exit(0)
}

main()
```

- [ ] **Step 4: Adicionar script no `package.json`**

Edite `package.json` e na seção `"scripts"` acrescente as duas linhas (mantendo as existentes):

```json
{
  "scripts": {
    "test": "node --test --test-reporter=spec",
    "validate:templates": "node scripts/validate-templates.mjs templates/*.jsonc",
    "check:environment": "node scripts/check-environment.mjs",
    "setup:write-config": "node scripts/init-config.mjs"
  }
}
```

- [ ] **Step 5: Rodar testes**

Run: `npm test`
Expected: 4 novos testes do CLI passando, total ~56 ✔.

- [ ] **Step 6: Sanity check do CLI**

Run: `npm run check:environment`
Expected: relatório humano em pt-BR no stdout, exit 0 mesmo com itens pendentes.

Run: `npm run check:environment -- --json | head -20`
Expected: JSON válido com chaves `node`, `figmaDesktop`, `clients`, `summary`.

- [ ] **Step 7: Commit**

```bash
git add scripts/check-environment.mjs scripts/check-environment.test.mjs package.json
git commit -m "feat(scripts): add check-environment CLI for setup diagnostics"
```

---

### Task 8: Script CLI `scripts/init-config.mjs`

Wrapper fino sobre `lib/config.mjs`. Sem testes próprios (já cobertos via `lib/config.test.mjs`); só aceita `--client <id>` e flags de preferences, valida e escreve.

**Files:**
- Create: `scripts/init-config.mjs`

- [ ] **Step 1: Criar `scripts/init-config.mjs`**

```js
#!/usr/bin/env node
// CLI: escreve ~/.config/meet-criteria/config.json com setup_complete=true.
// Invocado pelo skill setup-helper quando os 6 passos do onboarding terminam.
//
// Flags obrigatórias:
//   --client <claude-code|cursor|windsurf|claude-desktop>
//
// Flags opcionais:
//   --language <pt-BR>                       (default: pt-BR)
//   --visual-identity <ask|auto|default>     (default: ask)
//   --home <path>                            (override de HOME — útil em testes)
//   --incomplete                             (grava com setup_complete=false; útil pra recovery)

import { homedir } from 'node:os'
import { defaultConfig, writeConfig, SUPPORTED_CLIENTS, SUPPORTED_VISUAL_IDENTITIES } from '../lib/config.mjs'

function parseArgs(argv) {
  const out = { client: null, language: 'pt-BR', visualIdentity: 'ask', home: null, incomplete: false }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--client') out.client = argv[++i]
    else if (a === '--language') out.language = argv[++i]
    else if (a === '--visual-identity') out.visualIdentity = argv[++i]
    else if (a === '--home') out.home = argv[++i]
    else if (a === '--incomplete') out.incomplete = true
    else if (a === '--help' || a === '-h') out.help = true
    else {
      console.error(`Argumento desconhecido: ${a}`)
      process.exit(2)
    }
  }
  return out
}

function main() {
  const args = parseArgs(process.argv.slice(2))
  if (args.help) {
    console.log('Usage: init-config.mjs --client <id> [--language pt-BR] [--visual-identity ask|auto|default] [--home <path>] [--incomplete]')
    console.log(`Clients: ${SUPPORTED_CLIENTS.join(', ')}`)
    console.log(`Visual identities: ${SUPPORTED_VISUAL_IDENTITIES.join(', ')}`)
    process.exit(0)
  }
  if (!args.client) {
    console.error('--client é obrigatório')
    process.exit(2)
  }
  const cfg = defaultConfig({ mcpClient: args.client })
  cfg.preferences.language = args.language
  cfg.preferences.default_visual_identity = args.visualIdentity
  cfg.setup_complete = !args.incomplete

  try {
    const path = writeConfig(cfg, { home: args.home || homedir() })
    console.log(`Config escrito: ${path}`)
    console.log(`setup_complete=${cfg.setup_complete}, mcp_client=${cfg.mcp_client}`)
    process.exit(0)
  } catch (err) {
    console.error(`Falha ao escrever config: ${err.message}`)
    process.exit(1)
  }
}

main()
```

- [ ] **Step 2: Sanity check com fake home**

Run: `mkdir -p /tmp/mc-init-test && node scripts/init-config.mjs --client claude-code --home /tmp/mc-init-test && cat /tmp/mc-init-test/.config/meet-criteria/config.json`
Expected:
```
Config escrito: /tmp/mc-init-test/.config/meet-criteria/config.json
setup_complete=true, mcp_client=claude-code
{
  "setup_complete": true,
  "setup_version": "1.0.0",
  "mcp_client": "claude-code",
  "preferences": {
    "language": "pt-BR",
    "default_visual_identity": "ask"
  }
}
```

Cleanup: `rm -rf /tmp/mc-init-test`

- [ ] **Step 3: Garantir que os testes ainda passam**

Run: `npm test`
Expected: total ~56 ✔, sem regressões.

- [ ] **Step 4: Commit**

```bash
git add scripts/init-config.mjs
git commit -m "feat(scripts): add init-config CLI to materialize config.json"
```

---

### Task 9: Skill `skills/setup-helper.md`

Esta é a skill narrativa que o agente lê para conduzir os 6 passos do onboarding. Não é "código" — é prosa estruturada com frontmatter.

**Files:**
- Create: `skills/setup-helper.md`
- Delete: `skills/.gitkeep`

- [ ] **Step 1: Criar `skills/setup-helper.md`**

```markdown
---
name: setup-helper
description: Use ao executar /meet-criteria-setup ou quando o usuário relata problema de ambiente — orienta o agente a diagnosticar Node.js, Figma Desktop, figma-console MCP, Personal Access Token e Bridge plugin, e a persistir o resultado em ~/.config/meet-criteria/config.json.
---

# Meet Criteria — Setup Helper Skill

Conduza o usuário pelos 6 passos do onboarding. Cada passo: **diagnostique antes de pedir ação**, mostre o estado atual, ofereça o próximo movimento. Não tente "consertar tudo de uma vez" — peça confirmação a cada gate.

> Linguagem da conversa: pt-BR. Tom: direto, pragmático, sem floreio. O usuário é designer técnico.

## Princípios

1. **Token `figd_*` nunca toca a skill.** Ele vai como env var `FIGMA_ACCESS_TOKEN` no config do MCP do cliente. Se o usuário colar o token na conversa, **agradeça e use, mas peça pra ele revogá-lo depois** se a conversa for compartilhável.
2. **Cliente atual define o passo 3.** Para Claude Code, automatizamos via `claude mcp add`. Para Cursor / Windsurf / Claude Desktop, emita instruções manuais e prossiga.
3. **Idempotência.** O setup pode ser re-rodado a qualquer hora sem destruir estado. Se já está OK, fale "tudo pronto" e pare.
4. **Falha é informação, não erro fatal.** Se algo dá errado, registre em `setup_complete=false` (use `--incomplete`) e diga ao usuário o próximo movimento concreto.

## Passo 0 — Diagnóstico inicial

Antes de qualquer ação, rode:

```bash
npm run check:environment -- --json
```

Parseie o JSON e leia ao usuário um resumo de 3 linhas: Node, Figma Desktop, qual cliente MCP detectado, e se o `figma-console` já está configurado.

Se `summary.allCriticalOk === true`, pule para o **Passo 6** (validação final) — provavelmente o usuário só quer reconfirmar.

Caso contrário, identifique qual cliente está em uso. Heurísticas (em ordem):
1. Variável de ambiente do cliente (`CLAUDE_CODE_*`, `CURSOR_*`, etc.) — se houver.
2. Cliente cujo arquivo já tem `figma-console` configurado.
3. Pergunte explicitamente: "Você está usando Claude Code, Cursor, Windsurf ou Claude Desktop?"

Guarde o cliente identificado em uma variável `CLIENT` que será usada nos passos seguintes e como `--client` ao escrever o config no Passo 6.

## Passo 1 — Node.js 18+

Olhe `report.node`:

- `ok=true` → "Node OK ({detected})." Avance.
- `ok=false`, major < 18 → instrua install via [nvm](https://github.com/nvm-sh/nvm) (`nvm install 20 && nvm use 20`). Pare e peça pro usuário rodar de novo o `/meet-criteria-setup` depois.

## Passo 2 — Figma Desktop

Olhe `report.figmaDesktop`:

- `ok=true` → "Figma Desktop encontrado em {path}." Avance.
- `ok=false`, `unsupported=true` (Linux) → "Não consegui detectar automaticamente; confirme que o Figma Desktop está aberto. Bridge plugin **não funciona** no Figma web."
- `ok=false` no macOS/Windows → instruir download em https://www.figma.com/downloads/ e abrir o app.

## Passo 3 — figma-console MCP

Olhe `report.clients`. Encontre o cliente atual e veja `figmaConsole.installed`.

### Se `installed=false` e `CLIENT==="claude-code"`

Apresente o comando para o usuário e ofereça rodá-lo via Bash (com confirmação). **Não inclua o token ainda** — ele entra no Passo 4.

```
claude mcp add figma-console -s user \
  -e FIGMA_ACCESS_TOKEN=__TOKEN_AQUI__ \
  -e ENABLE_MCP_APPS=true \
  -- npx -y figma-console-mcp@latest
```

Diga ao usuário: "Vou rodar esse comando depois que você me passar o token figd_*. Esse comando salva no `~/.claude.json` do Claude Code, em escopo de usuário."

### Se `installed=false` e `CLIENT` ≠ Claude Code

Mostre o snippet a inserir manualmente no arquivo do cliente (`{client.path}` do JSON). Ex. para Cursor:

```jsonc
{
  "mcpServers": {
    "figma-console": {
      "command": "npx",
      "args": ["-y", "figma-console-mcp@latest"],
      "env": {
        "FIGMA_ACCESS_TOKEN": "figd_SEU_TOKEN",
        "ENABLE_MCP_APPS": "true"
      }
    }
  }
}
```

Peça ao usuário pra editar manualmente, salvar e reiniciar o cliente. Continue para o Passo 4.

### Se `installed=true` mas `tokenLooksValid=false`

Diga: "figma-console já está configurado, mas o token `FIGMA_ACCESS_TOKEN` está vazio ou mal-formado." Vá direto pro Passo 4.

### Se `installed=true` e `tokenLooksValid=true`

"figma-console + token prontos." Avance pro Passo 5.

## Passo 4 — Personal Access Token (figd_*)

Mostre essas instruções literalmente:

> 1. Vá em https://help.figma.com/hc/en-us/articles/8085703771159-Manage-personal-access-tokens
> 2. Clique em "Generate new token"
> 3. Marque os escopos: **File content (Read)**, **Variables (Read)**, **Comments (Read+Write)**
> 4. Copie o token (começa com `figd_`)

Peça ao usuário: "Cole aqui o token quando estiver pronto. Vou usá-lo apenas para gravá-lo na config do MCP — ele não fica no repositório nem em logs."

Quando receber o token:
- Valide formato com regex: deve casar `^figd_[A-Za-z0-9_-]{10,}$`. Se não casar, peça outro.
- Para **Claude Code**: rode o comando do Passo 3 substituindo `__TOKEN_AQUI__` pelo token recebido. Confirme com o usuário antes de executar.
- Para **outros clientes**: o usuário já vai ter colado no JSON manualmente — apenas reforce que o reinício do cliente é necessário.
- Após o `claude mcp add`, rode novamente `npm run check:environment -- --json` e confirme `figmaConsole.installed===true && tokenLooksValid===true`. Se não, peça pra ele reiniciar o Claude Code e rodar `/meet-criteria-setup` outra vez.

## Passo 5 — Bridge plugin no Figma Desktop

Mostre essas instruções literalmente:

> 1. Abra qualquer arquivo no Figma Desktop.
> 2. No menu superior: `Plugins` → `Development` → `Import plugin from manifest...`
> 3. Selecione: `~/.figma-console-mcp/plugin/manifest.json`
>    (O arquivo é criado automaticamente na primeira vez que o MCP server roda. Se não existir, peça ao usuário pra rodar qualquer ação que dispare o MCP — ou simplesmente: feche e reabra o cliente, depois mande qualquer mensagem que use o MCP.)
> 4. Rode o plugin uma vez (`Plugins` → `Development` → `figma-console`).

Aguarde o usuário responder "feito".

> Bootloader carrega UI dinamicamente — não precisa re-importar em updates futuros.

## Passo 6 — Validação final + persistir config

Rode duas validações, **nesta ordem**:

1. `npm run check:environment -- --json` e confirme `summary.allCriticalOk===true`.
2. Pergunte ao usuário se ele consegue rodar (no chat, não no Bash) uma operação simples que use a MCP, como pedir para "listar arquivos abertos no Figma" (que invoca `figma_list_open_files`). Se ele confirmar que funcionou, prossiga.

Se as duas validações passarem, escreva o config:

```bash
npm run setup:write-config -- --client <CLIENT>
```

Se uma das validações falhar, escreva com `--incomplete`:

```bash
npm run setup:write-config -- --client <CLIENT> --incomplete
```

E diga ao usuário exatamente qual passo ainda precisa de atenção.

## Mensagem final

Em caso de sucesso:

> Setup completo. `~/.config/meet-criteria/config.json` salvo com `setup_complete=true`.
> Próximo passo: rode `/meet-criteria-new feature` (ou `mudanca` / `conceito`) pra criar seu primeiro entregável.

Em caso de pendência:

> Setup parcial. Faltam: <lista>. Re-rode `/meet-criteria-setup` quando os itens estiverem resolvidos.
```

- [ ] **Step 2: Remover `.gitkeep`**

```bash
rm skills/.gitkeep
```

- [ ] **Step 3: Commit**

```bash
git add skills/setup-helper.md
git rm skills/.gitkeep 2>/dev/null || true
git commit -m "feat(skills): add setup-helper skill orchestrating 6-step onboarding"
```

---

### Task 10: Slash command `commands/meet-criteria-setup.md`

Comando enxuto — só dispara a skill `setup-helper`.

**Files:**
- Create: `commands/meet-criteria-setup.md`
- Delete: `commands/.gitkeep`

- [ ] **Step 1: Criar `commands/meet-criteria-setup.md`**

```markdown
---
description: Onboarding em 6 passos do Meet Criteria — detecta Node 18+, Figma Desktop, figma-console MCP, configura token e Bridge plugin, valida, persiste preferências.
---

# /meet-criteria-setup

Você foi invocado pelo usuário via `/meet-criteria-setup`.

**Use a skill `setup-helper`** para conduzir o fluxo. Comece pelo Passo 0 (diagnóstico via `npm run check:environment -- --json`).

Antes de qualquer comando que altere o sistema do usuário (`claude mcp add`, `npm run setup:write-config`), peça confirmação. O fluxo é idempotente — re-rodar é seguro.

Se o usuário já passou pelo setup antes (existir `~/.config/meet-criteria/config.json` com `setup_complete=true`), comece dizendo isso e ofereça três opções:

1. **Re-validar** (rodar checks novamente sem mudar nada)
2. **Re-instalar** (forçar reconfiguração — ex: trocou de máquina, token expirou)
3. **Cancelar**

Linguagem: pt-BR. Tom: direto.
```

- [ ] **Step 2: Remover `.gitkeep`**

```bash
rm commands/.gitkeep
```

- [ ] **Step 3: Commit**

```bash
git add commands/meet-criteria-setup.md
git rm commands/.gitkeep 2>/dev/null || true
git commit -m "feat(commands): add /meet-criteria-setup slash command"
```

---

### Task 11: Atualizar `README.md` + verificação final

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Editar `README.md`**

Substitua a seção "Comandos" por (mantendo o resto do README):

```markdown
## Comandos

```bash
npm install                  # instala deps (ajv, ajv-formats, jsonc-parser)
npm test                     # roda suíte node:test (validador + tokens + setup)
npm run validate:templates   # valida templates/*.jsonc contra o schema
npm run check:environment    # diagnostica Node, Figma Desktop e clientes MCP
npm run setup:write-config   # escreve ~/.config/meet-criteria/config.json
```

## Setup

Se você já tem Claude Code (ou Cursor / Windsurf / Claude Desktop) rodando, basta invocar `/meet-criteria-setup` no agente. O fluxo guiará 6 passos: Node 18+, Figma Desktop, `figma-console MCP`, Personal Access Token, Bridge plugin no Figma Desktop, validação final.

Detalhes em [`skills/setup-helper.md`](skills/setup-helper.md).
```

E na seção "Roadmap", marque o Plano 2 como ✅:

```markdown
## Roadmap (planos restantes)

1. ✅ Foundation — schema, templates, tokens, validador
2. ✅ Setup & onboarding (`/meet-criteria-setup`)
3. ⏭ Geração de templates (`/meet-criteria-new`)
4. ⏭ Análise IA (`/meet-criteria-analyze`)
5. ⏭ Âncoras (`/meet-criteria-anchor`, `/meet-criteria-export-annotations`)
6. ⏭ Checks determinísticos (`/meet-criteria-check`)
```

- [ ] **Step 2: Verificar diff do README**

Run: `git diff README.md`
Expected: apenas as duas seções acima alteradas; resto do arquivo intacto.

- [ ] **Step 3: Rodar suíte completa**

Run: `npm test`
Expected: ~56 tests pass (20 do Plano 1 + ~36 novos), 0 failures.

- [ ] **Step 4: Smoke test do `check:environment` no ambiente real**

Run: `npm run check:environment`
Expected: relatório humano com status real do sistema do usuário; exit 0.

- [ ] **Step 5: Verificar git limpo**

Run: `git status`
Expected: só o README modificado pendente de commit.

- [ ] **Step 6: Commit do README + tag de checkpoint**

```bash
git add README.md
git commit -m "docs: update README with setup commands and Plan 2 roadmap"
git tag -a v0.2.0-setup -m "Plano 2 (Setup & Onboarding) concluído"
```

- [ ] **Step 7: Log dos commits desta fase**

Run: `git log --oneline v0.1.0-foundation..HEAD`
Expected: ver os ~9 commits da fase, do system-checks ao README.

---

## Self-Review

**1. Cobertura do spec — seção "Onboarding" + "Estado da skill":**

- Passo 1 (Node 18+) — `lib/system-checks.mjs::checkNodeVersion` (Tasks 1-2) ✅
- Passo 2 (Figma Desktop) — `lib/system-checks.mjs::checkFigmaDesktop` (Tasks 1-2) ✅
- Passo 3 (figma-console MCP) — `lib/mcp-detect.mjs` lê os 4 clientes; skill orienta `claude mcp add` (Tasks 3-4, 9) ✅
- Passo 4 (Personal Access Token) — skill `setup-helper` Passo 4; regex de validação `^figd_[A-Za-z0-9_-]{10,}$` em `mcp-detect` e na skill (Tasks 4, 9) ✅
- Passo 5 (Bridge plugin) — instruções literais no skill `setup-helper` Passo 5 (Task 9) ✅
- Passo 6 (validação final) — `scripts/check-environment.mjs` + skill conduz reteste; `scripts/init-config.mjs` materializa `setup_complete` (Tasks 7-9) ✅
- Estado da skill (`~/.config/meet-criteria/config.json` com perms 600) — `lib/config.mjs` (Tasks 5-6) ✅
- Token `figd_*` **nunca em arquivo da skill** — explicitado em `lib/config.mjs`, no skill `setup-helper` Princípio 1, e em testes (`SUPPORTED_*` enum não inclui token) ✅
- Slash command `/meet-criteria-setup` — `commands/meet-criteria-setup.md` (Task 10) ✅
- Skill `setup-helper.md` — Task 9 ✅

Itens fora do escopo (próximos planos): renderização Figma, slash commands de criação/análise/checks, prompts IA, automação completa de Cursor/Windsurf/Claude Desktop edição de JSON. Os três últimos clientes têm detecção implementada e instrução manual no skill — automação completa é follow-up explícito.

**2. Placeholders:** nenhum step diz "TBD". Todos os trechos de código aparecem na íntegra. Comandos exatos têm `Expected:` correspondente.

**3. Consistência de tipos:**

- `checkNodeVersion({ nodeVersion?, minMajor? })` → `{ ok, detected, major, message? }` — assinatura idêntica em testes e implementação.
- `checkFigmaDesktop({ platform?, env?, exists? })` → `{ ok, path?, platform, message?, unsupported? }` — idem.
- `parseFigmaConsolePresence(cfg)` → `{ installed, hasToken, tokenLooksValid }` — idem.
- `detectClients({ home?, platform?, env? })` → `Array<{ id, label, path, present, parseError, figmaConsole }>` — idem.
- `configPath({ home? })` → string; `defaultConfig({ mcpClient })` → object; `validateConfig(cfg)` → `{ valid, errors }`; `writeConfig(cfg, { home? })` → string (path); `readConfig({ home? })` → object|null. Todas as assinaturas batem entre `lib/config.mjs`, `lib/config.test.mjs` e `scripts/init-config.mjs`.
- IDs de cliente — `'claude-code' | 'cursor' | 'windsurf' | 'claude-desktop'` — idênticos em `CLIENT_CONFIG_PATHS`, `SUPPORTED_CLIENTS`, fixtures de testes, skill, e CLI.
- Regex de token figd — `^figd_[A-Za-z0-9_-]{10,}$` — definido em `mcp-detect.mjs` (`FIGD_RE`); skill `setup-helper` referencia a mesma forma textualmente.
- Versão do config — `CONFIG_VERSION = '1.0.0'` — bate com a spec (`setup_version: "1.0.0"`).

Self-review concluída. Plano pronto pra execução.
