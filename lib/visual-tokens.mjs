// Default registry + resolver for Meet Criteria visual tokens.
// Tokens derive from the Tailwind firefly palette — see `lib/tailwind-palette.mjs`
// and the "Visual contract" section in
// `docs/superpowers/specs/2026-05-01-meet-criteria-design.md`.

import { TAILWIND, TAILWIND_FONT_SANS_DEFAULT } from './tailwind-palette.mjs'

// Semantic token name → Tailwind palette key (executable documentation).
export const TOKEN_TAILWIND_REF = Object.freeze({
  'section.background': 'firefly-950',
  'card.background':    'firefly-50',
  'banner.background':  'firefly-100',
  'text.primary':       'firefly-950',
})

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
    this.code = 'UNKNOWN_TOKEN'
  }
}

export function resolveToken(name, overrides = {}) {
  if (Object.prototype.hasOwnProperty.call(overrides, name)) return overrides[name]
  if (Object.prototype.hasOwnProperty.call(DEFAULT_TOKENS, name)) return DEFAULT_TOKENS[name]
  throw new TokenNotFoundError(name)
}

// Token names are lowercase by convention; uppercase variants are not matched.
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
