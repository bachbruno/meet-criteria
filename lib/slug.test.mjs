import { test } from 'node:test'
import assert from 'node:assert/strict'
import { normalizeTicketSlug, MAX_SLUG_LEN } from './slug.mjs'

test('MAX_SLUG_LEN é 64 (limite seguro pra sistemas de arquivos e Figma)', () => {
  assert.equal(MAX_SLUG_LEN, 64)
})

test('ID estilo "PROD-1234" vira "prod-1234"', () => {
  assert.equal(normalizeTicketSlug('PROD-1234'), 'prod-1234')
})

test('Frase com espaços vira kebab-case', () => {
  assert.equal(normalizeTicketSlug('Onboarding flow update'), 'onboarding-flow-update')
})

test('Combinação "[PROD-1234] Onboarding update" vira "prod-1234-onboarding-update"', () => {
  assert.equal(normalizeTicketSlug('[PROD-1234] Onboarding update'), 'prod-1234-onboarding-update')
})

test('Diacríticos são removidos via NFD', () => {
  assert.equal(normalizeTicketSlug('Revisão do checkout'), 'revisao-do-checkout')
})

test('Caracteres especiais viram hífen', () => {
  assert.equal(normalizeTicketSlug('Login / Logout (v2)'), 'login-logout-v2')
})

test('Hífens repetidos colapsam em um só', () => {
  assert.equal(normalizeTicketSlug('foo---bar___baz'), 'foo-bar-baz')
})

test('Hífens nas pontas são removidos', () => {
  assert.equal(normalizeTicketSlug('  -prod-1234-  '), 'prod-1234')
})

test('Truncado em MAX_SLUG_LEN sem cortar em meio de palavra quando possível', () => {
  const long = 'a'.repeat(80)
  const slug = normalizeTicketSlug(long)
  assert.ok(slug.length <= MAX_SLUG_LEN, `len=${slug.length}`)
})

test('Truncado preserva limite mesmo com palavras', () => {
  const slug = normalizeTicketSlug('palavra '.repeat(20))
  assert.ok(slug.length <= MAX_SLUG_LEN)
  assert.doesNotMatch(slug, /-$/)
})

test('Input vazio joga TypeError descritivo', () => {
  assert.throws(() => normalizeTicketSlug(''), /vazio|empty/i)
})

test('Input só com símbolos joga TypeError', () => {
  assert.throws(() => normalizeTicketSlug('!!!'), /vazio|inválido|empty|invalid/i)
})

test('Input não-string joga TypeError', () => {
  assert.throws(() => normalizeTicketSlug(null), /string/i)
  assert.throws(() => normalizeTicketSlug(123), /string/i)
})
