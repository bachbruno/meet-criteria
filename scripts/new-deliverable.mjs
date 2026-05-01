#!/usr/bin/env node
// CLI: orquestra a fase de criação de entregável Meet Criteria.
//
// Inputs: lê JSON de stdin contendo:
//   {
//     "ticketRef": "<string livre — vira slug kebab>",
//     "problemStatement": "<texto colado do ticket>",
//     "flows":     [ { "name": "...", "screens": <int> }, ... ]   // feature
//     "pairs":     [ { "label": "..." }, ... ]                    // mudanca
//     "variants":  [ "Variante A", "Variante B", ... ]            // conceito
//     "decisionCriteria": "<texto>",                              // conceito
//     "identity":  { "mode": "default" | "auto", "overrides": { ... } }
//   }
//
// Flags:
//   --type <feature|mudanca|conceito>   obrigatório
//   --cwd <path>                        diretório onde criar .meet-criteria/ (default: cwd atual)
//   --created-at <ISO8601>              timestamp determinístico (default: agora)
//   --dry-run                           não escreve em disco; só imprime manifest
//   --templates-dir <path>              override de templates dir (testing)
//
// Saída:
//   stdout: manifest JSON pretty-printed
//   stderr: warnings (ex: identity auto sem overrides) + summary final humano

import { resolve } from 'node:path'
import { readFileSync } from 'node:fs'
import { normalizeTicketSlug } from '../lib/slug.mjs'
import { loadTemplate, TemplateLoadError } from '../lib/template-loader.mjs'
import { resolveIdentity, VisualIdentityError } from '../lib/visual-identity.mjs'
import { buildRenderManifest, RenderInputError } from '../lib/render-manifest.mjs'
import { TokenNotFoundError } from '../lib/visual-tokens.mjs'
import { bootstrapLocalStore } from '../lib/local-store.mjs'
import { buildRenderJs, RenderJsError } from '../lib/figma-render.mjs'

function parseArgs(argv) {
  const out = { type: null, cwd: process.cwd(), createdAt: null, dryRun: false, templatesDir: null, withRenderJs: false }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--type') out.type = argv[++i]
    else if (a === '--cwd') out.cwd = argv[++i]
    else if (a === '--created-at') out.createdAt = argv[++i]
    else if (a === '--dry-run') out.dryRun = true
    else if (a === '--templates-dir') out.templatesDir = argv[++i]
    else if (a === '--with-render-js') out.withRenderJs = true
    else if (a === '--help' || a === '-h') out.help = true
    else {
      console.error(`Argumento desconhecido: ${a}`)
      process.exit(2)
    }
  }
  return out
}

function readStdinSync() {
  // Node 20+: readFileSync(0) lê stdin até EOF.
  try { return readFileSync(0, 'utf8') } catch { return '' }
}

function fail(message, code = 1) {
  console.error(message)
  process.exit(code)
}

function main() {
  const args = parseArgs(process.argv.slice(2))
  if (args.help) {
    console.log('Usage: new-deliverable.mjs --type <feature|mudanca|conceito> [--cwd <path>] [--dry-run] [--with-render-js] [--created-at <ISO>] < inputs.json')
    process.exit(0)
  }
  if (!args.type) fail('--type é obrigatório (feature|mudanca|conceito)', 2)

  let inputs
  try {
    const raw = readStdinSync()
    if (!raw.trim()) fail('Inputs JSON ausentes em stdin', 2)
    inputs = JSON.parse(raw)
  } catch (err) {
    fail(`Falha ao parsear stdin como JSON: ${err.message}`, 2)
  }

  const ticketRef = String(inputs.ticketRef ?? '').trim()
  if (!ticketRef) fail('inputs.ticketRef é obrigatório', 1)

  let slug
  try { slug = normalizeTicketSlug(ticketRef) } catch (err) { fail(err.message, 1) }

  let template
  try {
    template = loadTemplate(args.type, args.templatesDir ? { templatesDir: resolve(args.templatesDir) } : {})
  } catch (err) {
    if (err instanceof TemplateLoadError) fail(err.message, 2)
    throw err
  }

  let identity
  try {
    identity = resolveIdentity({ mode: inputs.identity?.mode ?? 'default', overrides: inputs.identity?.overrides ?? {} })
  } catch (err) {
    if (err instanceof VisualIdentityError) fail(err.message, 1)
    throw err
  }
  for (const w of identity.warnings ?? []) {
    const text = typeof w === 'string' ? w : (w?.message ?? JSON.stringify(w))
    console.error(`warn: ${text}`)
  }

  const createdAt = args.createdAt ?? new Date().toISOString()

  let manifest
  try {
    manifest = buildRenderManifest({ template, identity, slug, ticketRef, createdAt, inputs })
  } catch (err) {
    if (err instanceof RenderInputError) fail(err.message, 1)
    if (err instanceof TokenNotFoundError) fail(`Token visual desconhecido: ${err.tokenName}`, 1)
    throw err
  }

  if (!args.dryRun) {
    const r = bootstrapLocalStore({ cwd: resolve(args.cwd), manifest })
    if (!r.created) {
      console.error(`warn: local store não criado (${r.reason}). Continuando em modo Figma-only.`)
    } else if (r.alreadyExisted) {
      console.error(`info: ${r.path} já existia; arquivos pré-existentes preservados.`)
    } else {
      console.error(`info: local store criado em ${r.path}.`)
    }
  }

  let output
  if (args.withRenderJs) {
    const selectionIds = inputs.selectionIds
    if (!Array.isArray(selectionIds)) {
      fail('--with-render-js exige inputs.selectionIds (array de node IDs em ordem).', 1)
    }
    let renderJs
    try {
      renderJs = buildRenderJs({ manifest, selectionIds })
    } catch (err) {
      if (err instanceof RenderJsError) fail(err.message, 1)
      throw err
    }
    output = { manifest, renderJs }
  } else {
    output = manifest
  }

  const payload = JSON.stringify(output, null, 2) + '\n'
  if (!process.stdout.write(payload)) {
    process.stdout.once('drain', () => process.exit(0))
  } else {
    process.exit(0)
  }
}

main()
