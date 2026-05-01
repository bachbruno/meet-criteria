// Resolve a identidade visual final a partir da escolha do designer.
// Modo "default": usa DEFAULT_TOKENS literalmente.
// Modo "auto":    parte de DEFAULT_TOKENS e aplica overrides recebidos
//                 da skill (que coletou do Figma via figma_get_variables).
//
// Saída padronizada: { mode, tokens, overrides, warnings }.
// Tokens é sempre um objeto plain { tokenName: hex } pronto pra serializar.

import { DEFAULT_TOKENS, TOKEN_TAILWIND_REF } from './visual-tokens.mjs'

export const IDENTITY_MODES = Object.freeze(['default', 'auto'])

const HEX_RE = /^#[0-9a-fA-F]{6}$/

export class VisualIdentityError extends Error {
  constructor(message) {
    super(message)
    this.name = 'VisualIdentityError'
  }
}

function validateOverrides(overrides) {
  if (overrides && typeof overrides !== 'object') {
    throw new VisualIdentityError('overrides deve ser um objeto')
  }
  const valid = {}
  for (const [name, value] of Object.entries(overrides || {})) {
    if (!Object.prototype.hasOwnProperty.call(TOKEN_TAILWIND_REF, name)) {
      throw new VisualIdentityError(`Override em token desconhecido: "${name}"`)
    }
    if (typeof value !== 'string') {
      throw new VisualIdentityError(`Override "${name}" deve ser string, recebeu ${typeof value}`)
    }
    if (!HEX_RE.test(value)) {
      throw new VisualIdentityError(`Override "${name}" inválido: "${value}" não é hex #rrggbb`)
    }
    valid[name] = value.toLowerCase()
  }
  return valid
}

export function resolveIdentity({ mode, overrides = {} } = {}) {
  if (!IDENTITY_MODES.includes(mode)) {
    throw new VisualIdentityError(`Modo inválido "${mode}". Use ${IDENTITY_MODES.join(' ou ')}.`)
  }

  if (mode === 'default') {
    return { mode, tokens: { ...DEFAULT_TOKENS }, overrides: {}, warnings: [] }
  }

  const validOverrides = validateOverrides(overrides)
  const tokens = { ...DEFAULT_TOKENS, ...validOverrides }
  const warnings = []
  if (Object.keys(validOverrides).length === 0) {
    warnings.push('Modo "auto" sem overrides — caindo no default. Rode figma_get_variables na skill antes de chamar o CLI.')
  }
  return { mode, tokens, overrides: validOverrides, warnings }
}
