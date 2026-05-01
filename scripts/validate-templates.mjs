#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import Ajv from 'ajv/dist/2020.js'
import addFormats from 'ajv-formats'
import { parse as parseJsonc } from 'jsonc-parser'

const here = dirname(fileURLToPath(import.meta.url))
const SCHEMA_PATH = resolve(here, '..', 'schemas', 'template.schema.json')

let cachedValidator = null

function getValidator() {
  if (cachedValidator) return cachedValidator
  const schema = JSON.parse(readFileSync(SCHEMA_PATH, 'utf8'))
  const ajv = new Ajv({ allErrors: true, strict: true })
  addFormats(ajv)
  cachedValidator = ajv.compile(schema)
  return cachedValidator
}

export function validateTemplate(filePath) {
  let raw
  try {
    raw = readFileSync(filePath, 'utf8')
  } catch (err) {
    return { valid: false, errors: [{ message: err.message, keyword: 'io' }] }
  }
  const parseErrors = []
  const data = parseJsonc(raw, parseErrors, { allowTrailingComma: true })
  if (parseErrors.length > 0) {
    return {
      valid: false,
      errors: parseErrors.map((e) => ({
        message: `JSONC parse error code ${e.error} at offset ${e.offset}`,
        keyword: 'parse',
      })),
    }
  }
  const validate = getValidator()
  const schemaValid = validate(data)
  const errors = schemaValid ? [] : [...(validate.errors ?? [])]

  // JSON Schema 2020-12 não tem keyword nativa de "uniqueItems by property".
  // Skills downstream usam `id` como chave de lookup — duplicatas seriam um bug
  // silencioso. Aplicamos a checagem aqui, depois do schema, e usamos `keyword: 'unique'`.
  if (Array.isArray(data?.structure)) {
    const seen = new Map()
    for (let i = 0; i < data.structure.length; i++) {
      const node = data.structure[i]
      const id = node?.id
      if (typeof id !== 'string') continue
      if (seen.has(id)) {
        errors.push({
          keyword: 'unique',
          instancePath: `/structure/${i}/id`,
          message: `duplicate id "${id}" in structure (also at index ${seen.get(id)})`,
          params: { duplicateId: id, firstIndex: seen.get(id), duplicateIndex: i },
        })
      } else {
        seen.set(id, i)
      }
    }
  }

  return { valid: errors.length === 0, errors }
}

async function main() {
  const args = process.argv.slice(2)
  if (args.length === 0) {
    console.error('Usage: validate-templates.mjs <file.jsonc> [more.jsonc ...]')
    process.exit(2)
  }
  let allValid = true
  for (const file of args) {
    const abs = resolve(file)
    const { valid, errors } = validateTemplate(abs)
    if (valid) {
      console.log(`OK  ${file}`)
    } else {
      allValid = false
      console.error(`ERR ${file}`)
      for (const e of errors) {
        const where = e.instancePath || '(root)'
        console.error(`     ${where} ${e.keyword ?? ''}: ${e.message}`)
        if (e.params) console.error(`       params: ${JSON.stringify(e.params)}`)
      }
    }
  }
  process.exit(allValid ? 0 : 1)
}

const isMain = import.meta.url === `file://${process.argv[1]}`
if (isMain) main()
