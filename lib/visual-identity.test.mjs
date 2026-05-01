import { test } from 'node:test'
import assert from 'node:assert/strict'
import { resolveIdentity, IDENTITY_MODES, VisualIdentityError } from './visual-identity.mjs'
import { DEFAULT_TOKENS } from './visual-tokens.mjs'

test('IDENTITY_MODES contém exatamente "default" e "auto"', () => {
  assert.deepEqual([...IDENTITY_MODES].sort(), ['auto', 'default'])
})

test('resolveIdentity({mode:"default"}) retorna tokens === DEFAULT_TOKENS', () => {
  const r = resolveIdentity({ mode: 'default' })
  assert.equal(r.mode, 'default')
  assert.deepEqual(r.tokens, DEFAULT_TOKENS)
  assert.deepEqual(r.overrides, {})
})

test('resolveIdentity({mode:"auto", overrides}) substitui apenas chaves válidas', () => {
  const overrides = {
    'card.background': '#ff00ff',
    'section.background': '#000000',
  }
  const r = resolveIdentity({ mode: 'auto', overrides })
  assert.equal(r.mode, 'auto')
  assert.equal(r.tokens['card.background'], '#ff00ff')
  assert.equal(r.tokens['section.background'], '#000000')
  assert.equal(r.tokens['text.primary'], DEFAULT_TOKENS['text.primary'])
  assert.deepEqual(r.overrides, overrides)
})

test('resolveIdentity({mode:"auto"}) sem overrides equivale a default e avisa via warnings', () => {
  const r = resolveIdentity({ mode: 'auto', overrides: {} })
  assert.deepEqual(r.tokens, DEFAULT_TOKENS)
  assert.ok(Array.isArray(r.warnings))
  assert.equal(r.warnings.length, 1)
  assert.equal(r.warnings[0].code, 'EMPTY_OVERRIDES')
  assert.match(r.warnings[0].message, /sem overrides/i)
})

test('resolveIdentity rejeita modo inválido', () => {
  assert.throws(() => resolveIdentity({ mode: 'rainbow' }), VisualIdentityError)
})

test('resolveIdentity rejeita override em token desconhecido', () => {
  assert.throws(
    () => resolveIdentity({ mode: 'auto', overrides: { 'not.a.token': '#fff' } }),
    /token.*desconhecido|unknown token/i,
  )
})

test('resolveIdentity rejeita override com valor não-string', () => {
  assert.throws(
    () => resolveIdentity({ mode: 'auto', overrides: { 'card.background': 123 } }),
    /string/i,
  )
})

test('resolveIdentity normaliza hex em uppercase para lowercase', () => {
  const r = resolveIdentity({ mode: 'auto', overrides: { 'card.background': '#FF00FF' } })
  assert.equal(r.tokens['card.background'], '#ff00ff')
})

test('resolveIdentity rejeita hex mal-formado', () => {
  assert.throws(
    () => resolveIdentity({ mode: 'auto', overrides: { 'card.background': 'not-a-hex' } }),
    /hex/i,
  )
})

test('VisualIdentityError code="INVALID_MODE" para modo desconhecido', () => {
  let caught
  try { resolveIdentity({ mode: 'rainbow' }) } catch (e) { caught = e }
  assert.ok(caught instanceof VisualIdentityError)
  assert.equal(caught.code, 'INVALID_MODE')
})

test('VisualIdentityError code="UNKNOWN_TOKEN" para chave fora de TOKEN_TAILWIND_REF', () => {
  let caught
  try { resolveIdentity({ mode: 'auto', overrides: { 'not.a.token': '#fff000' } }) } catch (e) { caught = e }
  assert.equal(caught.code, 'UNKNOWN_TOKEN')
})

test('VisualIdentityError code="INVALID_OVERRIDE_VALUE_TYPE" para valor não-string', () => {
  let caught
  try { resolveIdentity({ mode: 'auto', overrides: { 'card.background': 123 } }) } catch (e) { caught = e }
  assert.equal(caught.code, 'INVALID_OVERRIDE_VALUE_TYPE')
})

test('VisualIdentityError code="INVALID_HEX_VALUE" para hex malformado', () => {
  let caught
  try { resolveIdentity({ mode: 'auto', overrides: { 'card.background': '#xyz' } }) } catch (e) { caught = e }
  assert.equal(caught.code, 'INVALID_HEX_VALUE')
})

test('VisualIdentityError code="INVALID_OVERRIDES_TYPE" para overrides não-objeto', () => {
  let caught
  try { resolveIdentity({ mode: 'auto', overrides: 'not-an-object' }) } catch (e) { caught = e }
  assert.ok(caught instanceof VisualIdentityError)
  assert.equal(caught.code, 'INVALID_OVERRIDES_TYPE')
})
