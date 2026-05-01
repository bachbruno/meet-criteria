// Bootstrap de `.meet-criteria/<slug>/`. Único módulo desta fase com efeito
// colateral em disco. Em filesystem read-only ou sem permissão, devolve
// `{ created: false, reason }` sem lançar — a skill segue em modo Figma-only.

import { mkdirSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const FS_ERROR_CODES = new Set(['EACCES', 'EROFS', 'EPERM', 'ENOENT', 'ENOSPC'])

function metadataFromManifest(manifest) {
  // Omits intentionally: tokens (large + re-derivable from identity),
  // nodes (large + re-derivable from template + inputs), layout
  // (re-derivable from template; not needed for identity checks or Plano 4).
  return {
    version: manifest.version,
    type: manifest.type,
    slug: manifest.slug,
    ticketRef: manifest.ticketRef,
    createdAt: manifest.createdAt,
    identity: manifest.identity,
    page: manifest.page,
    container: manifest.container,
    checks: manifest.checks,
  }
}

function buildScreenJustificationsMd(manifest) {
  const lines = ['# Justificativas por tela', '']
  if (manifest.type === 'feature') {
    const flows = manifest.nodes.find((n) => n.id === 'flows')
    for (const flow of flows.children) {
      lines.push(`## ${flow.header.text}`, '')
      for (let i = 0; i < flow.screens.length; i++) {
        lines.push(`### Tela ${String(i + 1).padStart(2, '0')}`, '', '<!-- como essa tela resolve aspecto X do problema -->', '')
      }
    }
  } else if (manifest.type === 'mudanca') {
    const cmp = manifest.nodes.find((n) => n.id === 'comparative')
    for (const pair of cmp.children) {
      lines.push(`## ${pair.pluginData.name}`, '', '### Antes', '', '<!-- contexto / problema observado -->', '', '### Depois', '', '<!-- mudança proposta + justificativa -->', '')
    }
  } else if (manifest.type === 'conceito') {
    const variants = manifest.nodes.find((n) => n.id === 'variants')
    for (const slot of variants.children[0].slots) {
      lines.push(`## ${slot.label}`, '', '<!-- prós / contras / quando faz sentido -->', '')
    }
  }
  return lines.join('\n')
}

function buildFlowsMd(manifest) {
  if (manifest.type !== 'feature') return null
  const flows = manifest.nodes.find((n) => n.id === 'flows')
  const lines = ['# Fluxos', '']
  for (const flow of flows.children) {
    lines.push(`## ${flow.header.text}`, '', `${flow.screens.length} tela(s)`, '')
  }
  return lines.join('\n')
}

function buildAnalysisMd(manifest) {
  const final = manifest.nodes.find((n) => n.component === 'FinalAnalysis')
  const lines = ['# Análise final', '']
  for (const sec of final.sections) {
    lines.push(`## ${sec.key}`, '', '<!-- preencha após /meet-criteria-analyze -->', '')
  }
  return lines.join('\n')
}

function writeIfMissing(path, content) {
  if (existsSync(path)) return false
  writeFileSync(path, content)
  return true
}

export function bootstrapLocalStore({ cwd, manifest }) {
  if (!cwd || typeof cwd !== 'string') throw new TypeError('cwd deve ser string')
  if (!manifest || !manifest.slug) throw new TypeError('manifest com slug é obrigatório')

  const root = join(cwd, '.meet-criteria', manifest.slug)
  let alreadyExisted = false
  try {
    if (existsSync(root)) alreadyExisted = true
    mkdirSync(join(root, 'references'), { recursive: true })

    writeIfMissing(join(root, 'metadata.json'), JSON.stringify(metadataFromManifest(manifest), null, 2) + '\n')
    writeIfMissing(join(root, 'problem-statement.md'),
      `# Problem statement\n\n${manifest.nodes.find((n) => n.id === 'problem-statement').text}\n`)
    const flowsMd = buildFlowsMd(manifest)
    if (flowsMd) writeIfMissing(join(root, 'flows.md'), flowsMd + '\n')
    writeIfMissing(join(root, 'screen-justifications.md'), buildScreenJustificationsMd(manifest) + '\n')
    writeIfMissing(join(root, 'analysis.md'), buildAnalysisMd(manifest) + '\n')
    writeIfMissing(join(root, 'anchors.json'), '[]\n')
    writeIfMissing(join(root, 'references', '.gitkeep'), '')

    return { created: true, path: root, alreadyExisted }
  } catch (err) {
    // Absorve apenas erros do filesystem (read-only, sem permissão, etc.).
    // Bugs de lógica nos builders (TypeError/ReferenceError) propagam para
    // o caller surfar imediatamente — em vez de virar fallback silencioso.
    if (err && err.code && FS_ERROR_CODES.has(err.code)) {
      return { created: false, path: root, reason: err.message }
    }
    throw err
  }
}
