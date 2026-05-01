import { test } from 'node:test'
import assert from 'node:assert/strict'
import { TAILWIND } from './tailwind-palette.mjs'
import {
  DEFAULT_TOKENS,
  TOKEN_TAILWIND_REF,
  resolveToken,
  resolveTokenRefs,
  TokenNotFoundError,
} from './visual-tokens.mjs'

test('TAILWIND expõe subset da paleta default Tailwind', () => {
  assert.equal(TAILWIND.white, '#ffffff')
  assert.equal(TAILWIND['neutral-200'], '#e5e5e5')
  assert.equal(TAILWIND['neutral-800'], '#262626')
  assert.equal(TAILWIND['neutral-900'], '#171717')
  assert.equal(TAILWIND['pink-500'], '#ec4899')
  assert.equal(TAILWIND['rose-600'], '#e11d48')
})

test('TOKEN_TAILWIND_REF mapeia cada token semântico ao nome Tailwind', () => {
  assert.equal(TOKEN_TAILWIND_REF['tag.screen.background'], 'pink-500')
  assert.equal(TOKEN_TAILWIND_REF['tag.screen.text'], 'white')
  assert.equal(TOKEN_TAILWIND_REF['tag.section.background'], 'neutral-900')
  assert.equal(TOKEN_TAILWIND_REF['tag.section.text'], 'white')
  assert.equal(TOKEN_TAILWIND_REF['tag.context.background'], 'white')
  assert.equal(TOKEN_TAILWIND_REF['tag.context.border'], 'pink-500')
  assert.equal(TOKEN_TAILWIND_REF['anchor.box.background'], 'white')
  assert.equal(TOKEN_TAILWIND_REF['anchor.box.border'], 'neutral-200')
  assert.equal(TOKEN_TAILWIND_REF['anchor.dot.color'], 'rose-600')
  assert.equal(TOKEN_TAILWIND_REF['anchor.line.color'], 'rose-600')
  assert.equal(TOKEN_TAILWIND_REF['template.background'], 'neutral-800')
})

test('DEFAULT_TOKENS resolve cada referência Tailwind para hex', () => {
  assert.equal(DEFAULT_TOKENS['tag.screen.background'], '#ec4899')
  assert.equal(DEFAULT_TOKENS['tag.screen.text'], '#ffffff')
  assert.equal(DEFAULT_TOKENS['tag.section.background'], '#171717')
  assert.equal(DEFAULT_TOKENS['tag.section.text'], '#ffffff')
  assert.equal(DEFAULT_TOKENS['tag.context.background'], '#ffffff')
  assert.equal(DEFAULT_TOKENS['tag.context.border'], '#ec4899')
  assert.equal(DEFAULT_TOKENS['anchor.box.background'], '#ffffff')
  assert.equal(DEFAULT_TOKENS['anchor.box.border'], '#e5e5e5')
  assert.equal(DEFAULT_TOKENS['anchor.dot.color'], '#e11d48')
  assert.equal(DEFAULT_TOKENS['anchor.line.color'], '#e11d48')
  assert.equal(DEFAULT_TOKENS['template.background'], '#262626')
  assert.equal(DEFAULT_TOKENS['font.family.default'], 'Inter')
})

test('resolveToken devolve valor default quando não há override', () => {
  assert.equal(resolveToken('tag.screen.background'), '#ec4899')
})

test('resolveToken aplica override quando fornecido', () => {
  const overrides = { 'tag.screen.background': '#000000' }
  assert.equal(resolveToken('tag.screen.background', overrides), '#000000')
})

test('resolveToken lança TokenNotFoundError em token desconhecido', () => {
  assert.throws(() => resolveToken('nonexistent.token'), TokenNotFoundError)
})

test('resolveTokenRefs substitui {token:nome} em strings', () => {
  assert.equal(
    resolveTokenRefs('bg={token:template.background};fg={token:tag.screen.text}'),
    'bg=#262626;fg=#ffffff'
  )
})

test('resolveTokenRefs deixa strings sem ref intactas', () => {
  assert.equal(resolveTokenRefs('plain string'), 'plain string')
})

test('resolveTokenRefs com overrides usa overrides', () => {
  const overrides = { 'template.background': '#ffffff' }
  assert.equal(resolveTokenRefs('{token:template.background}', overrides), '#ffffff')
})

test('resolveTokenRefs em objeto recursivamente', () => {
  const input = {
    fill: '{token:tag.screen.background}',
    nested: { line: '{token:anchor.line.color}', literal: 'no-ref' },
    items: ['{token:tag.screen.text}', 'plain'],
  }
  const out = resolveTokenRefs(input)
  assert.deepEqual(out, {
    fill: '#ec4899',
    nested: { line: '#e11d48', literal: 'no-ref' },
    items: ['#ffffff', 'plain'],
  })
})

test('resolveTokenRefs lança em token desconhecido', () => {
  assert.throws(() => resolveTokenRefs('{token:does.not.exist}'), TokenNotFoundError)
})

test('TokenNotFoundError carries code="UNKNOWN_TOKEN"', () => {
  let caught
  try { resolveToken('definitely.not.a.token') } catch (e) { caught = e }
  assert.ok(caught instanceof TokenNotFoundError)
  assert.equal(caught.code, 'UNKNOWN_TOKEN')
  assert.equal(caught.tokenName, 'definitely.not.a.token')
})
