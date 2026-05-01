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

test('Truncado com lastDash > midpoint preserva borda de palavra exata', () => {
  // 9 segmentos de 8 chars cada com '-' no fim → 'abcdefg-' x 9 = 72 chars,
  // dashes em 7,15,23,31,39,47,55,63. Cut em 64 → 'abcdefg-' x 8 + 'a'.
  // lastDash em 63 > 32, então slice(0, 63) → 'abcdefg-' x 7 + 'abcdefg' (63 chars, sem trailing dash).
  const input = 'abcdefg-'.repeat(9)
  const expected = ('abcdefg-'.repeat(7) + 'abcdefg')
  assert.equal(normalizeTicketSlug(input), expected)
  assert.equal(expected.length, 63)
})

test('Truncado com lastDash exatamente no midpoint cai no hard-cut', () => {
  // dash em 32 (exatamente MAX_SLUG_LEN/2): condição é > (estrito), não >=,
  // então cai no hard-cut e mantém o dash interno.
  const left = 'a'.repeat(32)
  const right = 'b'.repeat(40)
  const input = left + '-' + right // 73 chars; dash em 32
  const slug = normalizeTicketSlug(input)
  assert.equal(slug.length, 64)
  assert.equal(slug, (left + '-' + 'b'.repeat(31)))
})

test('Input só com caracteres não-latinos joga TypeError', () => {
  assert.throws(() => normalizeTicketSlug('สวัสดี'), /inválido|invalid/i)
})
