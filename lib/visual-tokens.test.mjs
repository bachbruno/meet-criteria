import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  TOKEN_TAILWIND_REF,
  DEFAULT_TOKENS,
  resolveToken,
  resolveTokenRefs,
  TokenNotFoundError,
} from './visual-tokens.mjs'

test('TOKEN_TAILWIND_REF lists all 4 firefly-based color tokens', () => {
  assert.deepEqual(Object.keys(TOKEN_TAILWIND_REF).sort(), [
    'banner.background',
    'card.background',
    'section.background',
    'text.primary',
  ])
})

test('DEFAULT_TOKENS resolves each color token to a hex string', () => {
  assert.equal(DEFAULT_TOKENS['section.background'], '#1d2b2c')
  assert.equal(DEFAULT_TOKENS['card.background'], '#f5f8f8')
  assert.equal(DEFAULT_TOKENS['banner.background'], '#dee9e8')
  assert.equal(DEFAULT_TOKENS['text.primary'], '#1d2b2c')
})

test('DEFAULT_TOKENS includes font.family.default = Inter', () => {
  assert.equal(DEFAULT_TOKENS['font.family.default'], 'Inter')
})

test('resolveToken returns hex for known tokens', () => {
  assert.equal(resolveToken('section.background'), '#1d2b2c')
})

test('resolveToken honors overrides', () => {
  assert.equal(resolveToken('section.background', { 'section.background': '#000000' }), '#000000')
})

test('resolveToken throws TokenNotFoundError with code', () => {
  let caught
  try { resolveToken('not.a.token') } catch (e) { caught = e }
  assert.ok(caught instanceof TokenNotFoundError)
  assert.equal(caught.code, 'UNKNOWN_TOKEN')
  assert.equal(caught.tokenName, 'not.a.token')
})

test('resolveTokenRefs replaces {token:...} inside strings', () => {
  assert.equal(resolveTokenRefs('{token:section.background}'), '#1d2b2c')
  assert.equal(resolveTokenRefs('bg-{token:card.background}-fg'), 'bg-#f5f8f8-fg')
})

test('resolveTokenRefs walks arrays and plain objects', () => {
  const out = resolveTokenRefs({ a: '{token:card.background}', b: ['{token:banner.background}'] })
  assert.equal(out.a, '#f5f8f8')
  assert.equal(out.b[0], '#dee9e8')
})

test('resolveTokenRefs is identity for non-string non-object values', () => {
  assert.equal(resolveTokenRefs(42), 42)
  assert.equal(resolveTokenRefs(null), null)
  assert.equal(resolveTokenRefs(undefined), undefined)
})
