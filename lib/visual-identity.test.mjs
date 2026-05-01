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
    'tag.screen.background': '#ff00ff',
    'template.background': '#000000',
  }
  const r = resolveIdentity({ mode: 'auto', overrides })
  assert.equal(r.mode, 'auto')
  assert.equal(r.tokens['tag.screen.background'], '#ff00ff')
  assert.equal(r.tokens['template.background'], '#000000')
  assert.equal(r.tokens['anchor.dot.color'], DEFAULT_TOKENS['anchor.dot.color'])
  assert.deepEqual(r.overrides, overrides)
})

test('resolveIdentity({mode:"auto"}) sem overrides equivale a default e avisa via warnings', () => {
  const r = resolveIdentity({ mode: 'auto', overrides: {} })
  assert.deepEqual(r.tokens, DEFAULT_TOKENS)
  assert.ok(Array.isArray(r.warnings))
  assert.match(r.warnings.join(' '), /sem overrides|no overrides/i)
})

test('resolveIdentity rejeita modo inválido', () => {
  assert.throws(() => resolveIdentity({ mode: 'rainbow' }), VisualIdentityError)
})

test('resolveIdentity rejeita override em token desconhecido', () => {
  assert.throws(
    () => resolveIdentity({ mode: 'auto', overrides: { 'tag.fake.token': '#fff' } }),
    /token.*desconhecido|unknown token/i,
  )
})

test('resolveIdentity rejeita override com valor não-string', () => {
  assert.throws(
    () => resolveIdentity({ mode: 'auto', overrides: { 'tag.screen.background': 123 } }),
    /string/i,
  )
})

test('resolveIdentity normaliza hex em uppercase para lowercase', () => {
  const r = resolveIdentity({ mode: 'auto', overrides: { 'tag.screen.background': '#FF00FF' } })
  assert.equal(r.tokens['tag.screen.background'], '#ff00ff')
})

test('resolveIdentity rejeita hex mal-formado', () => {
  assert.throws(
    () => resolveIdentity({ mode: 'auto', overrides: { 'tag.screen.background': 'not-a-hex' } }),
    /hex/i,
  )
})
