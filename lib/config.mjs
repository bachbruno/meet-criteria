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
  if (!cfg || typeof cfg !== 'object' || Array.isArray(cfg)) {
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
  const safe = {
    setup_complete: cfg.setup_complete,
    setup_version: cfg.setup_version,
    mcp_client: cfg.mcp_client,
    preferences: {
      language: cfg.preferences.language,
      default_visual_identity: cfg.preferences.default_visual_identity,
    },
  }
  const json = JSON.stringify(safe, null, 2) + '\n'
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
  const filePath = configPath({ home })
  let raw
  try {
    raw = readFileSync(filePath, 'utf8')
  } catch (err) {
    if (err.code === 'ENOENT') return null
    throw new Error(`Falha ao ler ${filePath}: ${err.message}`)
  }
  try {
    return JSON.parse(raw)
  } catch (err) {
    throw new Error(`Falha ao parsear ${filePath}: ${err.message}`)
  }
}
