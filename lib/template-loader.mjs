// Localiza, valida e devolve um template canônico parseado.
// Reusa o validador do Plano 1 (`scripts/validate-templates.mjs::validateTemplate`),
// mas oferece uma API dedicada por tipo para a skill /meet-criteria-new.

import { existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { validateTemplate } from '../scripts/validate-templates.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const DEFAULT_TEMPLATES_DIR = resolve(here, '..', 'templates')

export const SUPPORTED_TYPES = Object.freeze(['feature', 'mudanca', 'conceito'])

export class TemplateLoadError extends Error {
  constructor(message, { errors = [], code = 'UNKNOWN' } = {}) {
    super(message)
    this.name = 'TemplateLoadError'
    this.errors = errors
    this.code = code
  }
}

export function loadTemplate(type, { templatesDir = DEFAULT_TEMPLATES_DIR } = {}) {
  if (typeof type !== 'string') {
    throw new TypeError(`loadTemplate espera string, recebeu ${typeof type}`)
  }
  if (!SUPPORTED_TYPES.includes(type)) {
    throw new TemplateLoadError(`Tipo desconhecido "${type}". Suportados: ${SUPPORTED_TYPES.join(', ')}`, { code: 'UNKNOWN_TYPE' })
  }
  const path = join(templatesDir, `${type}.jsonc`)
  if (!existsSync(path)) {
    throw new TemplateLoadError(`Template não encontrado em ${path}`, { code: 'FILE_NOT_FOUND' })
  }

  const { valid, errors, data } = validateTemplate(path)
  if (!valid) {
    const summary = errors
      .slice(0, 5)
      .map((e) => `${e.instancePath || '(root)'} ${e.keyword || ''}: ${e.message}`)
      .join('; ')
    throw new TemplateLoadError(`Template ${type} inválido: ${summary}`, { errors, code: 'SCHEMA_INVALID' })
  }
  return data
}
