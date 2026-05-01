// Registry default + resolver para tokens visuais Meet Criteria.
// Tokens são derivados da paleta default do Tailwind CSS — ver
// `lib/tailwind-palette.mjs` e a tabela em
// `docs/superpowers/specs/2026-05-01-meet-criteria-design.md`.

import { TAILWIND, TAILWIND_FONT_SANS_DEFAULT } from './tailwind-palette.mjs'

// Mapeamento token semântico → nome Tailwind (documentação executável).
export const TOKEN_TAILWIND_REF = Object.freeze({
  'tag.screen.background': 'pink-500',
  'tag.screen.text': 'white',
  'tag.section.background': 'neutral-900',
  'tag.section.text': 'white',
  'tag.context.background': 'white',
  'tag.context.border': 'pink-500',
  'anchor.box.background': 'white',
  'anchor.box.border': 'neutral-200',
  'anchor.dot.color': 'rose-600',
  'anchor.line.color': 'rose-600',
  'template.background': 'neutral-800',
})

// Resolução estática de cada token → hex (ou família, no caso da fonte).
function buildDefaultTokens() {
  const tokens = {}
  for (const [name, ref] of Object.entries(TOKEN_TAILWIND_REF)) {
    const hex = TAILWIND[ref]
    if (!hex) {
      throw new Error(`Tailwind reference "${ref}" not present in TAILWIND palette`)
    }
    tokens[name] = hex
  }
  tokens['font.family.default'] = TAILWIND_FONT_SANS_DEFAULT
  return Object.freeze(tokens)
}

export const DEFAULT_TOKENS = buildDefaultTokens()

export class TokenNotFoundError extends Error {
  constructor(name) {
    super(`Unknown visual token: "${name}"`)
    this.name = 'TokenNotFoundError'
    this.tokenName = name
  }
}

export function resolveToken(name, overrides = {}) {
  if (Object.prototype.hasOwnProperty.call(overrides, name)) return overrides[name]
  if (Object.prototype.hasOwnProperty.call(DEFAULT_TOKENS, name)) return DEFAULT_TOKENS[name]
  throw new TokenNotFoundError(name)
}

// Token names são lowercase por convenção. Strings com `{TOKEN:...}` ou outras
// variações maiúsculas são tratadas como texto literal (não match).
const TOKEN_REF = /\{token:([a-z0-9.-]+)\}/g

export function resolveTokenRefs(value, overrides = {}) {
  if (typeof value === 'string') {
    return value.replace(TOKEN_REF, (_, tokenName) => resolveToken(tokenName, overrides))
  }
  if (Array.isArray(value)) {
    return value.map((v) => resolveTokenRefs(v, overrides))
  }
  if (value && typeof value === 'object') {
    const out = {}
    for (const [k, v] of Object.entries(value)) out[k] = resolveTokenRefs(v, overrides)
    return out
  }
  return value
}
