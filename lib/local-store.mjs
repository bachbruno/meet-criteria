// Bootstrap de `.meet-criteria/<slug>/`. Único módulo desta fase com efeito
// colateral em disco. Em filesystem read-only ou sem permissão, devolve
// `{ created: false, reason }` sem lançar — a skill segue em modo Figma-only.

import { mkdirSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const FS_ERROR_CODES = new Set(['EACCES', 'EROFS', 'EPERM', 'ENOENT', 'ENOSPC'])

function metadataFromManifest(manifest) {
  // Omits intentionally: tokens (large + re-derivable from identity),
  // nodes (large + re-derivable from template + inputs), layout
  // (re-derivable from template; not needed for identity checks or future plans).
  return {
    version: manifest.version,
    type: manifest.type,
    slug: manifest.slug,
    ticketRef: manifest.ticketRef,
    createdAt: manifest.createdAt,
    identity: manifest.identity,
    page: manifest.page,
    section: manifest.section,
    checks: manifest.checks,
  }
}

function buildFlowsMd(manifest) {
  if (manifest.type !== 'feature') return null
  const flows = manifest.nodes.find((n) => n.id === 'flows')
  if (!flows || !Array.isArray(flows.children)) return null
  const lines = ['# Flows', '']
  for (const flow of flows.children) {
    lines.push(`## ${flow.name}`, '', `${flow.screens.length} screen(s)`, '')
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
      `# Problem statement\n\n${manifest.nodes.find((n) => n.id === 'problem-statement').body}\n`)
    const flowsMd = buildFlowsMd(manifest)
    if (flowsMd) writeIfMissing(join(root, 'flows.md'), flowsMd + '\n')
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
