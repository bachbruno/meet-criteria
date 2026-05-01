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

// Aceita três variantes de chave para o bucket de servers:
//   - mcpServers   → padrão atual (Claude Code, Claude Desktop)
//   - mcp.servers  → variante observada em alguns configs Cursor antigos
//   - servers      → variante futura/genérica (compat de leitura defensiva)
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
