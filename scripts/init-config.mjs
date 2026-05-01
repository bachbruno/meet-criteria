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
