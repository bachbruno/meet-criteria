// Normaliza input livre do designer (ID, nome, ou combinação) em slug kebab-case
// usado como nome de page Figma (`MC — <slug>`), nome de container raiz, e
// nome de pasta local `.meet-criteria/<slug>/`.
//
// Regras (ordem):
// 1. Trim + NFD (decompõe diacríticos) + remove combining marks.
// 2. Lowercase.
// 3. Caracteres não [a-z0-9] viram '-'.
// 4. Sequências de '-' colapsam em um só.
// 5. Trim de hífens nas bordas.
// 6. Truncado em MAX_SLUG_LEN preferindo borda de palavra (split em '-').

export const MAX_SLUG_LEN = 64

export function normalizeTicketSlug(input) {
  if (typeof input !== 'string') {
    throw new TypeError(`normalizeTicketSlug espera string, recebeu ${typeof input}`)
  }
  const trimmed = input.trim()
  if (!trimmed) throw new TypeError('Ticket reference vazio — informe um ID ou nome')

  const ascii = trimmed
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  if (!ascii) throw new TypeError(`Ticket reference inválido: "${input}" não contém caracteres alfanuméricos`)

  if (ascii.length <= MAX_SLUG_LEN) return ascii

  // Trunca preservando borda de palavra apenas quando o último '-' cai na
  // segunda metade do limite — mantém >= 50% do MAX_SLUG_LEN.
  const cut = ascii.slice(0, MAX_SLUG_LEN)
  const lastDash = cut.lastIndexOf('-')
  return lastDash > MAX_SLUG_LEN / 2 ? cut.slice(0, lastDash) : cut
}
