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
