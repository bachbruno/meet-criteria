# Meet Criteria — `/meet-criteria-new` Implementation Plan (Plano 3 de 6)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar o slash command `/meet-criteria-new <tipo>` que cria um entregável Meet Criteria do zero — colhe inputs do designer (ticket-ref, problem statement, contagem de fluxos × telas / pares / variantes, escolha de identidade visual), monta um *render manifest* determinístico, materializa a pasta local `.meet-criteria/<slug>/` com metadata e arquivos-âncora, e fornece à skill o JS canônico para o agente renderizar no Figma via `figma-console MCP`. Saída: o designer roda o comando, escolhe inputs, e fica com (a) uma nova page `MC — <slug>` no Figma com container `Meet Criteria — <ticketRef>`, telas selecionadas duplicadas e organizadas dentro do template, plugin data anexada para detecção; e (b) `.meet-criteria/<slug>/` populado.

**Architecture:** Pequenas libs Node puras e testáveis (`lib/slug.mjs`, `lib/template-loader.mjs`, `lib/visual-identity.mjs`, `lib/render-manifest.mjs`, `lib/local-store.mjs`) compõem-se num CLI (`scripts/new-deliverable.mjs`) que valida tudo, escreve o local-store e imprime o manifest em JSON. A renderização Figma é orquestrada pela skill `skills/creating-templates.md` — ela conduz o diálogo, chama o CLI, e executa um JS canônico via `figma_execute` que consome o manifest e cria os nós (com `setSharedPluginData('meetCriteria', ...)` em todos eles). Nenhum byte de figma rendering vai para `lib/` — código que precisa do Figma Desktop não é unit-testável; fica isolado na skill.

**Tech Stack:** Node 20+, `node:fs`, `node:os`, `node:path`, `jsonc-parser` (já em deps), `ajv` (já em deps via Plano 1), `node:test`. Sem dependências novas no `package.json`.

**Foco MVP:**
- ✅ 3 tipos suportados: `feature` (N fluxos × M telas), `mudanca` (N pares antes/depois), `conceito` (2-5 variantes)
- ✅ Identidade visual default (paleta Tailwind do `lib/visual-tokens.mjs`) e auto-detect via overrides recebidos da skill após `figma_get_variables`
- ✅ Local store em `.meet-criteria/<slug>/` com fallback gracioso se filesystem read-only
- ✅ Plugin data (`meetCriteria.role`, `ticketRef`, `type`, etc.) emitida no manifest e instruída na skill
- ✅ Slug do ticket normalizado a partir de input livre (ID, nome, ou combinação)
- 📋 Renderização real (operações `figma_execute`) testada **manualmente** pelo usuário; o JS canônico vive na skill, não em `lib/`

**Escopo (não cobertos aqui):**
- Plano 4 — Análise IA (`/meet-criteria-analyze`) — geração de justificativas, análise final, sugestão de âncoras
- Plano 5 — Âncoras (`/meet-criteria-anchor`, `/meet-criteria-export-annotations`)
- Plano 6 — Checks determinísticos (`/meet-criteria-check`)

**Premissas (já entregues nos Planos 1–2):**
- `package.json` com `"type": "module"` e Node 20+
- `lib/visual-tokens.mjs` exporta `DEFAULT_TOKENS`, `resolveToken`, `resolveTokenRefs`, `TOKEN_TAILWIND_REF` e `TokenNotFoundError`
- `scripts/validate-templates.mjs` exporta `validateTemplate(filePath)` retornando `{ valid, errors }`
- Templates em `templates/{feature,mudanca,conceito}.jsonc` validados pelo schema canônico em `schemas/template.schema.json`
- `~/.config/meet-criteria/config.json` existe (escrito no Plano 2). `default_visual_identity` ∈ `{ ask, auto, default }`

---

## File Structure

Novo nesta fase:

- Create: `lib/slug.mjs` — `normalizeTicketSlug(input)` puro
- Create: `lib/slug.test.mjs`
- Create: `lib/template-loader.mjs` — `loadTemplate(type, { templatesDir? })` lê + valida + retorna estrutura
- Create: `lib/template-loader.test.mjs`
- Create: `lib/visual-identity.mjs` — `resolveIdentity({ mode, overrides? })` retorna `{ mode, tokens, overrides }`
- Create: `lib/visual-identity.test.mjs`
- Create: `lib/render-manifest.mjs` — `buildRenderManifest({ template, inputs, identity, slug, ticketRef, createdAt })` pura
- Create: `lib/render-manifest.test.mjs`
- Create: `lib/local-store.mjs` — `bootstrapLocalStore({ cwd, slug, manifest })` cria `.meet-criteria/<slug>/`
- Create: `lib/local-store.test.mjs`
- Create: `scripts/new-deliverable.mjs` — CLI: valida flags, monta manifest, grava local store, imprime JSON
- Create: `scripts/new-deliverable.test.mjs` — smoke do CLI
- Create: `skills/creating-templates.md` — skill narrativa (orquestra diálogo + render no Figma)
- Create: `commands/meet-criteria-new.md` — slash command

Modify:
- `package.json` — adicionar script `new:deliverable`
- `README.md` — atualizar Roadmap (Plano 3 ✅) e seção "Comandos"

Cada lib tem responsabilidade única:
- `slug` é puro (string in / string out, sem I/O).
- `template-loader` lê disco mas não escreve — apenas reusa `validateTemplate` do Plano 1 e devolve o objeto parseado.
- `visual-identity` é puro: dada a escolha do usuário e (opcionalmente) overrides do Figma, devolve um mapa de tokens.
- `render-manifest` é puro: combina template + inputs + tokens em um plano declarativo (não toca Figma).
- `local-store` é o único módulo desta fase com efeito colateral em disco; encapsula a árvore `.meet-criteria/<slug>/`.
- `scripts/new-deliverable.mjs` orquestra. Em `--json`, imprime o manifest pra skill consumir.
- A skill `.md` traduz o manifest em chamadas `figma_execute` e atribui plugin data.

---

## Tasks

### Task 1: Testes de `lib/slug.mjs` (TDD-first)

`normalizeTicketSlug` aceita input livre do designer e devolve um slug kebab-case usado em três lugares (nome de page Figma, nome de container, pasta local).

**Files:**
- Create: `lib/slug.test.mjs`

- [ ] **Step 1: Escrever os testes**

```js
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
```

- [ ] **Step 2: Rodar — devem falhar com `ERR_MODULE_NOT_FOUND`**

Run: `npm test`
Expected: erros apontando pra `slug.mjs`.

---

### Task 2: Implementar `lib/slug.mjs`

**Files:**
- Create: `lib/slug.mjs`

- [ ] **Step 1: Criar `lib/slug.mjs`**

```js
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

  // Trunca preservando borda de palavra quando possível.
  const cut = ascii.slice(0, MAX_SLUG_LEN)
  const lastDash = cut.lastIndexOf('-')
  const safe = lastDash > MAX_SLUG_LEN / 2 ? cut.slice(0, lastDash) : cut
  return safe.replace(/-+$/g, '')
}
```

- [ ] **Step 2: Rodar testes — todos devem passar**

Run: `npm test`
Expected: 13 novos testes passando, sem regressão nos do Plano 1–2.

- [ ] **Step 3: Commit**

```bash
git add lib/slug.mjs lib/slug.test.mjs
git commit -m "feat(lib): add ticket slug normalization for /meet-criteria-new"
```

---

### Task 3: Testes de `lib/template-loader.mjs` (TDD-first)

`loadTemplate(type)` é um wrapper sobre `validateTemplate` do Plano 1: localiza `templates/<type>.jsonc`, valida, e devolve o objeto parseado pronto pra uso.

**Files:**
- Create: `lib/template-loader.test.mjs`

- [ ] **Step 1: Escrever os testes**

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { loadTemplate, SUPPORTED_TYPES, TemplateLoadError } from './template-loader.mjs'

test('SUPPORTED_TYPES é exatamente os 3 tipos do MVP', () => {
  assert.deepEqual([...SUPPORTED_TYPES].sort(), ['conceito', 'feature', 'mudanca'])
})

test('loadTemplate("feature") devolve template válido com type/version/structure', () => {
  const tpl = loadTemplate('feature')
  assert.equal(tpl.type, 'feature')
  assert.equal(typeof tpl.version, 'string')
  assert.ok(Array.isArray(tpl.structure))
  assert.ok(tpl.structure.length > 0)
})

test('loadTemplate("mudanca") devolve type="mudanca"', () => {
  const tpl = loadTemplate('mudanca')
  assert.equal(tpl.type, 'mudanca')
})

test('loadTemplate("conceito") devolve type="conceito"', () => {
  const tpl = loadTemplate('conceito')
  assert.equal(tpl.type, 'conceito')
})

test('loadTemplate com tipo desconhecido joga TemplateLoadError', () => {
  assert.throws(() => loadTemplate('mvp'), TemplateLoadError)
  assert.throws(() => loadTemplate('mvp'), /tipo desconhecido|unknown type/i)
})

test('loadTemplate com tipo não-string joga TypeError', () => {
  assert.throws(() => loadTemplate(null), /string/i)
})

test('loadTemplate aceita templatesDir override', () => {
  const dir = mkdtempSync(join(tmpdir(), 'mc-tpl-'))
  // copia o template feature válido para um dir custom
  const cfg = {
    $schema: '../schemas/template.schema.json',
    type: 'feature',
    version: '9.9.9',
    label: 'Custom feature',
    layout: { kind: 'horizontal-columns', gap: 80, padding: 64 },
    structure: [
      { id: 'context', component: 'ContextMacro', required: true },
      { id: 'problem-statement', component: 'ProblemStatement', required: true },
      { id: 'flows', component: 'FlowList', required: true, minCount: 1, maxCount: 10,
        itemTemplate: { component: 'Flow' } },
      { id: 'final-analysis', component: 'FinalAnalysis', required: true,
        sections: ['resolution', 'strengths', 'attention', 'discussion'] },
    ],
  }
  writeFileSync(join(dir, 'feature.jsonc'), JSON.stringify(cfg))
  const tpl = loadTemplate('feature', { templatesDir: dir })
  assert.equal(tpl.version, '9.9.9')
  assert.equal(tpl.label, 'Custom feature')
})

test('loadTemplate com arquivo ausente no templatesDir custom joga TemplateLoadError', () => {
  const dir = mkdtempSync(join(tmpdir(), 'mc-tpl-empty-'))
  assert.throws(() => loadTemplate('feature', { templatesDir: dir }), TemplateLoadError)
})

test('loadTemplate com schema inválido propaga errors detalhados', () => {
  const dir = mkdtempSync(join(tmpdir(), 'mc-tpl-bad-'))
  // estrutura inválida: faltando "structure"
  writeFileSync(join(dir, 'feature.jsonc'), JSON.stringify({
    type: 'feature',
    version: '1.0.0',
    label: 'Bad',
    layout: { kind: 'horizontal-columns' },
  }))
  let caught
  try {
    loadTemplate('feature', { templatesDir: dir })
  } catch (err) {
    caught = err
  }
  assert.ok(caught instanceof TemplateLoadError)
  assert.match(caught.message, /structure/i)
  assert.ok(Array.isArray(caught.errors))
  assert.ok(caught.errors.length > 0)
})
```

- [ ] **Step 2: Rodar — devem falhar**

Run: `npm test`
Expected: erros de módulo ausente apontando pra `template-loader.mjs`.

---

### Task 4: Implementar `lib/template-loader.mjs`

**Files:**
- Create: `lib/template-loader.mjs`

- [ ] **Step 1: Criar `lib/template-loader.mjs`**

```js
// Localiza, valida e devolve um template canônico parseado.
// Reusa o validador do Plano 1 (`scripts/validate-templates.mjs::validateTemplate`),
// mas oferece uma API dedicada por tipo para a skill /meet-criteria-new.

import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse as parseJsonc } from 'jsonc-parser'
import { validateTemplate } from '../scripts/validate-templates.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const DEFAULT_TEMPLATES_DIR = resolve(here, '..', 'templates')

export const SUPPORTED_TYPES = Object.freeze(['feature', 'mudanca', 'conceito'])

export class TemplateLoadError extends Error {
  constructor(message, { errors = [] } = {}) {
    super(message)
    this.name = 'TemplateLoadError'
    this.errors = errors
  }
}

export function loadTemplate(type, { templatesDir = DEFAULT_TEMPLATES_DIR } = {}) {
  if (typeof type !== 'string') {
    throw new TypeError(`loadTemplate espera string, recebeu ${typeof type}`)
  }
  if (!SUPPORTED_TYPES.includes(type)) {
    throw new TemplateLoadError(`Tipo desconhecido "${type}". Suportados: ${SUPPORTED_TYPES.join(', ')}`)
  }
  const path = join(templatesDir, `${type}.jsonc`)
  if (!existsSync(path)) {
    throw new TemplateLoadError(`Template não encontrado em ${path}`)
  }

  const { valid, errors } = validateTemplate(path)
  if (!valid) {
    const summary = errors
      .slice(0, 5)
      .map((e) => `${e.instancePath || '(root)'} ${e.keyword || ''}: ${e.message}`)
      .join('; ')
    throw new TemplateLoadError(`Template ${type} inválido: ${summary}`, { errors })
  }

  // Validador já garantiu que parseia. Lemos de novo para devolver o objeto.
  const raw = readFileSync(path, 'utf8')
  const parsed = parseJsonc(raw, [], { allowTrailingComma: true })
  return parsed
}
```

- [ ] **Step 2: Rodar testes**

Run: `npm test`
Expected: 9 novos testes passando, sem regressão.

- [ ] **Step 3: Commit**

```bash
git add lib/template-loader.mjs lib/template-loader.test.mjs
git commit -m "feat(lib): add template-loader wrapping validator for typed lookup"
```

---

### Task 5: Testes de `lib/visual-identity.mjs` (TDD-first)

`resolveIdentity` recebe a escolha do designer (`default` ou `auto`) e, no modo `auto`, um mapa de overrides (proveniente de `figma_get_variables` da skill). Devolve `{ mode, tokens, overrides }` pronto para o manifest. Em `default`, `tokens === DEFAULT_TOKENS`.

**Files:**
- Create: `lib/visual-identity.test.mjs`

- [ ] **Step 1: Escrever os testes**

```js
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
  // chaves não sobrescritas mantêm default
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
```

- [ ] **Step 2: Rodar — falham por módulo ausente**

Run: `npm test`
Expected: erros de módulo apontando pra `visual-identity.mjs`.

---

### Task 6: Implementar `lib/visual-identity.mjs`

**Files:**
- Create: `lib/visual-identity.mjs`

- [ ] **Step 1: Criar `lib/visual-identity.mjs`**

```js
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
```

- [ ] **Step 2: Rodar testes**

Run: `npm test`
Expected: 9 novos testes passando, sem regressão.

- [ ] **Step 3: Commit**

```bash
git add lib/visual-identity.mjs lib/visual-identity.test.mjs
git commit -m "feat(lib): resolve visual identity (default vs auto with overrides)"
```

---

### Task 7: Testes de `lib/render-manifest.mjs` (TDD-first)

`buildRenderManifest` é o coração da fase: combina `template + inputs + identity + slug + ticketRef + createdAt` num plano declarativo que a skill traduz em chamadas Figma. Pura: sem I/O, sem `Date.now()` (recebe `createdAt` por parâmetro).

**Files:**
- Create: `lib/render-manifest.test.mjs`

- [ ] **Step 1: Escrever os testes**

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildRenderManifest, MANIFEST_VERSION, RenderInputError } from './render-manifest.mjs'
import { loadTemplate } from './template-loader.mjs'
import { resolveIdentity } from './visual-identity.mjs'
import { DEFAULT_TOKENS } from './visual-tokens.mjs'

const FIXED_DATE = '2026-05-01T15:30:00.000Z'

function baseArgs(type, overrides = {}) {
  const template = loadTemplate(type)
  const identity = resolveIdentity({ mode: 'default' })
  return {
    template,
    identity,
    slug: 'prod-1234',
    ticketRef: 'PROD-1234',
    createdAt: FIXED_DATE,
    inputs: { problemStatement: 'Texto do ticket' },
    ...overrides,
  }
}

test('MANIFEST_VERSION é "1.0.0"', () => {
  assert.equal(MANIFEST_VERSION, '1.0.0')
})

test('feature: requer flows>=1 com screensPerFlow>=1', () => {
  const args = baseArgs('feature', { inputs: { problemStatement: 'x', flows: [{ name: 'Flow A', screens: 2 }] } })
  const m = buildRenderManifest(args)
  assert.equal(m.version, MANIFEST_VERSION)
  assert.equal(m.type, 'feature')
  assert.equal(m.slug, 'prod-1234')
  assert.equal(m.ticketRef, 'PROD-1234')
  assert.equal(m.createdAt, FIXED_DATE)
  assert.equal(m.identity.mode, 'default')
  assert.deepEqual(m.tokens, DEFAULT_TOKENS)
  // root container
  assert.equal(m.container.name, 'Meet Criteria — PROD-1234')
  assert.equal(m.container.pluginData.role, 'root')
  assert.equal(m.container.pluginData.ticketRef, 'PROD-1234')
  assert.equal(m.container.pluginData.type, 'feature')
  assert.equal(m.container.pluginData.templateVersion, '1.0.0')
  // page
  assert.equal(m.page.name, 'MC — prod-1234')
  // nodes (ordenados conforme template.structure)
  const ids = m.nodes.map((n) => n.id)
  assert.deepEqual(ids, ['context', 'problem-statement', 'flows', 'final-analysis'])
  // flows expandido em 1 flow x 2 screens
  const flows = m.nodes.find((n) => n.id === 'flows')
  assert.equal(flows.children.length, 1)
  assert.equal(flows.children[0].pluginData.role, 'flow')
  assert.equal(flows.children[0].screens.length, 2)
  assert.equal(flows.children[0].screens[0].pluginData.role, 'screen-slot')
  assert.equal(flows.children[0].screens[0].pluginData.flowId, 'flow-1')
  assert.equal(flows.children[0].screens[0].pluginData.screenIndex, 0)
})

test('feature: rejeita flows abaixo do minCount do template', () => {
  const args = baseArgs('feature', { inputs: { problemStatement: 'x', flows: [] } })
  assert.throws(() => buildRenderManifest(args), RenderInputError)
})

test('feature: rejeita flow.screens > maxScreens', () => {
  const args = baseArgs('feature', { inputs: { problemStatement: 'x', flows: [{ name: 'F', screens: 999 }] } })
  assert.throws(() => buildRenderManifest(args), /maxScreens|máximo/i)
})

test('mudanca: pares antes/depois exigem >=1', () => {
  const args = baseArgs('mudanca', { inputs: { problemStatement: 'x', pairs: [{ label: 'Tela 01' }] } })
  const m = buildRenderManifest(args)
  assert.equal(m.type, 'mudanca')
  const cmp = m.nodes.find((n) => n.id === 'comparative')
  assert.equal(cmp.children.length, 1)
  assert.equal(cmp.children[0].pluginData.role, 'comparative')
  assert.equal(cmp.children[0].slots.length, 2) // antes / depois
  assert.equal(cmp.children[0].slots[0].label, 'Antes')
  assert.equal(cmp.children[0].slots[1].label, 'Depois')
})

test('mudanca: rejeita pairs vazio', () => {
  const args = baseArgs('mudanca', { inputs: { problemStatement: 'x', pairs: [] } })
  assert.throws(() => buildRenderManifest(args), RenderInputError)
})

test('conceito: variants 2..5; um nó variants + decision-criteria', () => {
  const args = baseArgs('conceito', {
    inputs: { problemStatement: 'x', variants: ['A', 'B', 'C'], decisionCriteria: 'Critério X' },
  })
  const m = buildRenderManifest(args)
  const variants = m.nodes.find((n) => n.id === 'variants')
  assert.equal(variants.children.length, 1)
  assert.equal(variants.children[0].slots.length, 3)
  assert.equal(variants.children[0].slots[0].label, 'Variante A')
  const dc = m.nodes.find((n) => n.id === 'decision-criteria')
  assert.ok(dc, 'falta decision-criteria')
  assert.equal(dc.text, 'Critério X')
})

test('conceito: rejeita variants<2', () => {
  const args = baseArgs('conceito', { inputs: { problemStatement: 'x', variants: ['Só'] } })
  assert.throws(() => buildRenderManifest(args), /minCount|mínimo|2/i)
})

test('conceito: rejeita variants>5', () => {
  const args = baseArgs('conceito', { inputs: { problemStatement: 'x', variants: ['A','B','C','D','E','F'] } })
  assert.throws(() => buildRenderManifest(args), /maxCount|máximo|5/i)
})

test('layout: tokens {token:...} são resolvidos para hex', () => {
  const m = buildRenderManifest(baseArgs('feature', {
    inputs: { problemStatement: 'x', flows: [{ name: 'Flow A', screens: 1 }] },
  }))
  assert.equal(m.layout.background, DEFAULT_TOKENS['template.background'])
  assert.match(m.layout.background, /^#[0-9a-f]{6}$/)
})

test('rejeita problemStatement vazio (check determinístico do schema)', () => {
  const args = baseArgs('feature', { inputs: { problemStatement: '   ', flows: [{ name: 'F', screens: 1 }] } })
  assert.throws(() => buildRenderManifest(args), /problem-statement/)
})

test('rejeita ticketRef vazio', () => {
  const args = baseArgs('feature', { ticketRef: '   ', inputs: { problemStatement: 'x', flows: [{ name: 'F', screens: 1 }] } })
  assert.throws(() => buildRenderManifest(args), /ticketRef/)
})

test('checks deterministas do template são copiados para o manifest', () => {
  const m = buildRenderManifest(baseArgs('feature', {
    inputs: { problemStatement: 'x', flows: [{ name: 'F', screens: 1 }] },
  }))
  assert.deepEqual(m.checks.deterministic, [
    'problem-statement-not-empty',
    'no-empty-screen-slots',
    'no-placeholder-text',
    'final-analysis-not-empty',
  ])
})
```

- [ ] **Step 2: Rodar — falham por módulo ausente**

Run: `npm test`
Expected: erros apontando pra `render-manifest.mjs`.

---

### Task 8: Implementar `lib/render-manifest.mjs`

**Files:**
- Create: `lib/render-manifest.mjs`

- [ ] **Step 1: Criar `lib/render-manifest.mjs`**

```js
// Constrói o manifest de renderização — plano declarativo consumido pela skill
// /meet-criteria-new para emitir chamadas figma_execute. Função pura: sem I/O,
// sem time-of-day implícito (createdAt é parâmetro).
//
// Forma do manifest:
// {
//   version, type, slug, ticketRef, createdAt,
//   identity: { mode, overrides },
//   tokens:   { <tokenName>: <hex> },
//   layout:   { kind, gap, padding, background },
//   page:     { name },
//   container:{ name, pluginData: { role:'root', ... } },
//   nodes:    [ { id, component, ...content/children } ],
//   checks:   { deterministic: [string] }
// }

import { resolveTokenRefs } from './visual-tokens.mjs'

export const MANIFEST_VERSION = '1.0.0'

export class RenderInputError extends Error {
  constructor(message) {
    super(message)
    this.name = 'RenderInputError'
  }
}

function requireString(value, label) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new RenderInputError(`${label} deve ser string não-vazia`)
  }
  return value.trim()
}

function findStructure(template, id) {
  const node = template.structure.find((n) => n.id === id)
  if (!node) throw new RenderInputError(`Template ${template.type} não declara nó "${id}"`)
  return node
}

function buildContextNode(structureNode, { ticketRef, type }, tokens) {
  return {
    id: structureNode.id,
    component: structureNode.component,
    title: ticketRef,
    icon: structureNode.props?.icon ?? 'star',
    pluginData: { role: 'context-macro' },
    style: {
      background: resolveTokenRefs(structureNode.props?.tokenBackground ?? '{token:tag.context.background}', tokens),
    },
  }
}

function buildProblemStatementNode(structureNode, { problemStatement }) {
  if (!problemStatement || problemStatement.trim() === '') {
    throw new RenderInputError('problem-statement vazio (check determinístico problem-statement-not-empty)')
  }
  return {
    id: structureNode.id,
    component: structureNode.component,
    text: problemStatement.trim(),
    pluginData: { role: 'problem-statement' },
  }
}

function buildFlowsNode(structureNode, { flows }) {
  const minCount = structureNode.minCount ?? 1
  const maxCount = structureNode.maxCount ?? 10
  const list = Array.isArray(flows) ? flows : []
  if (list.length < minCount) {
    throw new RenderInputError(`feature.flows tem ${list.length} item(s); mínimo ${minCount} (minCount)`)
  }
  if (list.length > maxCount) {
    throw new RenderInputError(`feature.flows tem ${list.length} item(s); máximo ${maxCount} (maxCount)`)
  }
  const minScreens = structureNode.itemTemplate?.props?.minScreens ?? 1
  const maxScreens = structureNode.itemTemplate?.props?.maxScreens ?? 20

  const children = list.map((f, i) => {
    const flowId = `flow-${i + 1}`
    const name = requireString(f?.name ?? `Fluxo ${i + 1}`, `flows[${i}].name`)
    const screensCount = Number(f?.screens ?? 0)
    if (!Number.isInteger(screensCount) || screensCount < minScreens) {
      throw new RenderInputError(`flows[${i}].screens=${f?.screens} abaixo do minScreens=${minScreens}`)
    }
    if (screensCount > maxScreens) {
      throw new RenderInputError(`flows[${i}].screens=${screensCount} acima do maxScreens=${maxScreens}`)
    }
    const screens = Array.from({ length: screensCount }, (_, j) => ({
      pluginData: { role: 'screen-slot', flowId, screenIndex: j },
    }))
    return {
      pluginData: { role: 'flow', flowId },
      header: { component: 'SectionHeader', text: name },
      screens,
    }
  })
  return { id: structureNode.id, component: 'FlowList', pluginData: { role: 'flow-list' }, children }
}

function buildComparativeNode(structureNode, { pairs }) {
  const minCount = structureNode.minCount ?? 1
  const maxCount = structureNode.maxCount ?? 20
  const list = Array.isArray(pairs) ? pairs : []
  if (list.length < minCount) {
    throw new RenderInputError(`mudanca.pairs tem ${list.length}; mínimo ${minCount} (minCount)`)
  }
  if (list.length > maxCount) {
    throw new RenderInputError(`mudanca.pairs tem ${list.length}; máximo ${maxCount} (maxCount)`)
  }
  const labels = structureNode.props?.labels ?? ['Antes', 'Depois']
  const children = list.map((pair, i) => {
    const slots = labels.map((label) => ({
      label,
      pluginData: { role: 'screen-slot', pairIndex: i, label },
    }))
    return {
      pluginData: { role: 'comparative', kind: 'before-after', pairIndex: i, name: pair?.label ?? `Tela ${String(i + 1).padStart(2, '0')}` },
      slots,
    }
  })
  return { id: structureNode.id, component: 'Comparative', pluginData: { role: 'comparative-list' }, children }
}

function buildVariantsNode(structureNode, { variants }) {
  const minCount = structureNode.minCount ?? 2
  const maxCount = structureNode.maxCount ?? 5
  const list = Array.isArray(variants) ? variants : []
  if (list.length < minCount) {
    throw new RenderInputError(`conceito.variants tem ${list.length}; mínimo ${minCount} (minCount)`)
  }
  if (list.length > maxCount) {
    throw new RenderInputError(`conceito.variants tem ${list.length}; máximo ${maxCount} (maxCount)`)
  }
  const labels = structureNode.props?.labels ?? ['Variante A', 'Variante B', 'Variante C', 'Variante D', 'Variante E']
  const slots = list.map((v, i) => ({
    label: labels[i] ?? `Variante ${i + 1}`,
    note: typeof v === 'string' ? v : (v?.note ?? ''),
    pluginData: { role: 'screen-slot', variantIndex: i },
  }))
  return {
    id: structureNode.id,
    component: 'Comparative',
    pluginData: { role: 'comparative-list', kind: 'variants' },
    children: [{ pluginData: { role: 'comparative', kind: 'variants' }, slots }],
  }
}

function buildDecisionCriteriaNode(structureNode, { decisionCriteria }) {
  return {
    id: structureNode.id,
    component: 'DecisionCriteria',
    text: typeof decisionCriteria === 'string' ? decisionCriteria : '',
    pluginData: { role: 'decision-criteria' },
  }
}

function buildFinalAnalysisNode(structureNode) {
  const sections = structureNode.sections ?? ['resolution', 'strengths', 'attention', 'discussion']
  return {
    id: structureNode.id,
    component: 'FinalAnalysis',
    sections: sections.map((key) => ({ key, text: '' })),
    pluginData: { role: 'final-analysis' },
  }
}

const NODE_BUILDERS = {
  ContextMacro: buildContextNode,
  ProblemStatement: buildProblemStatementNode,
  FlowList: buildFlowsNode,
  Comparative: (structureNode, inputs) =>
    structureNode.id === 'variants' ? buildVariantsNode(structureNode, inputs) : buildComparativeNode(structureNode, inputs),
  DecisionCriteria: buildDecisionCriteriaNode,
  FinalAnalysis: buildFinalAnalysisNode,
}

export function buildRenderManifest({ template, identity, slug, ticketRef, createdAt, inputs }) {
  const ref = requireString(ticketRef, 'ticketRef')
  const sanitizedSlug = requireString(slug, 'slug')
  const created = requireString(createdAt, 'createdAt')
  if (!template || typeof template !== 'object') throw new RenderInputError('template é obrigatório')
  if (!identity || !identity.tokens) throw new RenderInputError('identity é obrigatório (chame resolveIdentity antes)')
  if (!inputs || typeof inputs !== 'object') throw new RenderInputError('inputs é obrigatório')

  const tokens = identity.tokens
  const nodes = template.structure.map((s) => {
    const builder = NODE_BUILDERS[s.component]
    if (!builder) throw new RenderInputError(`Sem builder para componente "${s.component}"`)
    return builder(s, { ...inputs, ticketRef: ref, type: template.type }, tokens)
  })

  const layout = {
    kind: template.layout.kind,
    gap: template.layout.gap ?? 80,
    padding: template.layout.padding ?? 64,
    background: resolveTokenRefs(template.layout.background ?? '{token:template.background}', tokens),
  }

  return {
    version: MANIFEST_VERSION,
    type: template.type,
    slug: sanitizedSlug,
    ticketRef: ref,
    createdAt: created,
    identity: { mode: identity.mode, overrides: identity.overrides ?? {} },
    tokens,
    layout,
    page: { name: `MC — ${sanitizedSlug}` },
    container: {
      name: `Meet Criteria — ${ref}`,
      pluginData: {
        role: 'root',
        ticketRef: ref,
        type: template.type,
        templateVersion: template.version,
        createdAt: created,
        lastExecutedAt: created,
        visualIdentity: identity.mode,
        slug: sanitizedSlug,
      },
    },
    nodes,
    checks: { deterministic: template.checks?.deterministic ?? [] },
  }
}
```

- [ ] **Step 2: Rodar testes**

Run: `npm test`
Expected: 12 novos testes passando, sem regressão.

- [ ] **Step 3: Commit**

```bash
git add lib/render-manifest.mjs lib/render-manifest.test.mjs
git commit -m "feat(lib): add render-manifest builder consumed by /meet-criteria-new skill"
```

---

### Task 9: Testes de `lib/local-store.mjs` (TDD-first)

`bootstrapLocalStore` cria `.meet-criteria/<slug>/` com:
- `metadata.json` (shape igual ao manifest minus `tokens` e `nodes`)
- `problem-statement.md`
- `flows.md` (apenas `feature`)
- `screen-justifications.md` (skeleton com seções por tela/par/variante)
- `analysis.md` (skeleton)
- `anchors.json` (= `[]`)
- `references/.gitkeep` (placeholder pra evitar pasta vazia perdida no git)

Em filesystem read-only ou sem permissão, devolve `{ created: false, reason }` sem lançar.

**Files:**
- Create: `lib/local-store.test.mjs`

- [ ] **Step 1: Escrever os testes**

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, existsSync, statSync, chmodSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { bootstrapLocalStore } from './local-store.mjs'
import { loadTemplate } from './template-loader.mjs'
import { resolveIdentity } from './visual-identity.mjs'
import { buildRenderManifest } from './render-manifest.mjs'

function makeManifest(type, inputs) {
  const template = loadTemplate(type)
  const identity = resolveIdentity({ mode: 'default' })
  return buildRenderManifest({
    template,
    identity,
    slug: 'prod-1234',
    ticketRef: 'PROD-1234',
    createdAt: '2026-05-01T15:30:00.000Z',
    inputs,
  })
}

test('bootstrap feature: cria árvore esperada', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'mc-store-'))
  const manifest = makeManifest('feature', { problemStatement: 'Texto', flows: [{ name: 'Flow A', screens: 2 }] })
  const r = bootstrapLocalStore({ cwd, manifest })
  assert.equal(r.created, true)
  assert.equal(r.path, join(cwd, '.meet-criteria', 'prod-1234'))
  for (const f of ['metadata.json', 'problem-statement.md', 'flows.md', 'screen-justifications.md', 'analysis.md', 'anchors.json', 'references/.gitkeep']) {
    assert.equal(existsSync(join(r.path, f)), true, `falta ${f}`)
  }
})

test('bootstrap mudanca: não cria flows.md, mas cria pares em screen-justifications', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'mc-store-mudanca-'))
  const manifest = makeManifest('mudanca', { problemStatement: 'Texto', pairs: [{ label: 'Tela 01' }, { label: 'Tela 02' }] })
  const r = bootstrapLocalStore({ cwd, manifest })
  assert.equal(r.created, true)
  assert.equal(existsSync(join(r.path, 'flows.md')), false)
  const justif = readFileSync(join(r.path, 'screen-justifications.md'), 'utf8')
  assert.match(justif, /Tela 01/)
  assert.match(justif, /Tela 02/)
})

test('bootstrap conceito: cria seções por variante', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'mc-store-conceito-'))
  const manifest = makeManifest('conceito', { problemStatement: 'Texto', variants: ['A', 'B', 'C'], decisionCriteria: 'X' })
  const r = bootstrapLocalStore({ cwd, manifest })
  assert.equal(r.created, true)
  const justif = readFileSync(join(r.path, 'screen-justifications.md'), 'utf8')
  assert.match(justif, /Variante A/)
  assert.match(justif, /Variante B/)
  assert.match(justif, /Variante C/)
})

test('metadata.json contém slug, ticketRef, type, createdAt, identity.mode (sem tokens nem nodes)', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'mc-store-meta-'))
  const manifest = makeManifest('feature', { problemStatement: 'Texto', flows: [{ name: 'F', screens: 1 }] })
  const r = bootstrapLocalStore({ cwd, manifest })
  const meta = JSON.parse(readFileSync(join(r.path, 'metadata.json'), 'utf8'))
  assert.equal(meta.slug, 'prod-1234')
  assert.equal(meta.ticketRef, 'PROD-1234')
  assert.equal(meta.type, 'feature')
  assert.equal(meta.createdAt, '2026-05-01T15:30:00.000Z')
  assert.equal(meta.identity?.mode, 'default')
  assert.equal(meta.tokens, undefined)
  assert.equal(meta.nodes, undefined)
})

test('problem-statement.md tem o texto do ticket', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'mc-store-ps-'))
  const manifest = makeManifest('feature', { problemStatement: 'Crítico: precisa funcionar.', flows: [{ name: 'F', screens: 1 }] })
  const r = bootstrapLocalStore({ cwd, manifest })
  const ps = readFileSync(join(r.path, 'problem-statement.md'), 'utf8')
  assert.match(ps, /Crítico: precisa funcionar\./)
})

test('idempotência: chamada repetida não falha e não sobrescreve arquivos modificados', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'mc-store-idem-'))
  const manifest = makeManifest('feature', { problemStatement: 'Original', flows: [{ name: 'F', screens: 1 }] })
  const r1 = bootstrapLocalStore({ cwd, manifest })
  // simula edição manual do designer
  const psPath = join(r1.path, 'problem-statement.md')
  // mtime existe; abrimos e gravamos algo diferente
  const fs = require('node:fs')
  fs.writeFileSync(psPath, '# Editado pelo designer\n')
  // segunda chamada
  const r2 = bootstrapLocalStore({ cwd, manifest })
  assert.equal(r2.created, true)
  assert.equal(r2.alreadyExisted, true)
  assert.equal(fs.readFileSync(psPath, 'utf8'), '# Editado pelo designer\n')
})

test('fallback gracioso quando filesystem é read-only', { skip: process.platform === 'win32' }, () => {
  const cwd = mkdtempSync(join(tmpdir(), 'mc-store-ro-'))
  chmodSync(cwd, 0o555)
  try {
    const manifest = makeManifest('feature', { problemStatement: 'X', flows: [{ name: 'F', screens: 1 }] })
    const r = bootstrapLocalStore({ cwd, manifest })
    assert.equal(r.created, false)
    assert.match(r.reason, /permission|EACCES|read-only|EROFS/i)
  } finally {
    chmodSync(cwd, 0o755) // permite cleanup
  }
})
```

> **Nota:** o teste de idempotência usa `require('node:fs')` em ESM via `createRequire`. Substitua por import direto se preferir — ver implementação abaixo.

- [ ] **Step 2: Ajustar import do `fs` no teste**

Substitua a linha `const fs = require('node:fs')` por importar `writeFileSync` e `readFileSync` no topo do arquivo:

```js
import { mkdtempSync, readFileSync, existsSync, statSync, chmodSync, writeFileSync } from 'node:fs'
```

E no teste de idempotência, troque `fs.writeFileSync(psPath, ...)` por `writeFileSync(psPath, ...)` e `fs.readFileSync(psPath, 'utf8')` por `readFileSync(psPath, 'utf8')`.

- [ ] **Step 3: Rodar — falham por módulo ausente**

Run: `npm test`
Expected: erros apontando pra `local-store.mjs`.

---

### Task 10: Implementar `lib/local-store.mjs`

**Files:**
- Create: `lib/local-store.mjs`

- [ ] **Step 1: Criar `lib/local-store.mjs`**

```js
// Bootstrap de `.meet-criteria/<slug>/`. Único módulo desta fase com efeito
// colateral em disco. Em filesystem read-only ou sem permissão, devolve
// `{ created: false, reason }` sem lançar — a skill segue em modo Figma-only.

import { mkdirSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const FILES_BASE = ['metadata.json', 'problem-statement.md', 'screen-justifications.md', 'analysis.md', 'anchors.json']

function metadataFromManifest(manifest) {
  return {
    version: manifest.version,
    type: manifest.type,
    slug: manifest.slug,
    ticketRef: manifest.ticketRef,
    createdAt: manifest.createdAt,
    identity: manifest.identity,
    page: manifest.page,
    container: manifest.container,
    checks: manifest.checks,
  }
}

function buildScreenJustificationsMd(manifest) {
  const lines = ['# Justificativas por tela', '']
  if (manifest.type === 'feature') {
    const flows = manifest.nodes.find((n) => n.id === 'flows')
    for (const flow of flows.children) {
      lines.push(`## ${flow.header.text}`, '')
      for (let i = 0; i < flow.screens.length; i++) {
        lines.push(`### Tela ${String(i + 1).padStart(2, '0')}`, '', '<!-- como essa tela resolve aspecto X do problema -->', '')
      }
    }
  } else if (manifest.type === 'mudanca') {
    const cmp = manifest.nodes.find((n) => n.id === 'comparative')
    for (const pair of cmp.children) {
      lines.push(`## ${pair.pluginData.name}`, '', '### Antes', '', '<!-- contexto / problema observado -->', '', '### Depois', '', '<!-- mudança proposta + justificativa -->', '')
    }
  } else if (manifest.type === 'conceito') {
    const variants = manifest.nodes.find((n) => n.id === 'variants')
    for (const slot of variants.children[0].slots) {
      lines.push(`## ${slot.label}`, '', '<!-- prós / contras / quando faz sentido -->', '')
    }
  }
  return lines.join('\n')
}

function buildFlowsMd(manifest) {
  if (manifest.type !== 'feature') return null
  const flows = manifest.nodes.find((n) => n.id === 'flows')
  const lines = ['# Fluxos', '']
  for (const flow of flows.children) {
    lines.push(`## ${flow.header.text}`, '', `${flow.screens.length} tela(s)`, '')
  }
  return lines.join('\n')
}

function buildAnalysisMd(manifest) {
  const final = manifest.nodes.find((n) => n.component === 'FinalAnalysis')
  const lines = ['# Análise final', '']
  for (const sec of final.sections) {
    lines.push(`## ${sec.key}`, '', '<!-- preencha após /meet-criteria-analyze -->', '')
  }
  return lines.join('\n')
}

function writeIfMissing(path, content) {
  if (existsSync(path)) return false
  writeFileSync(path, content)
  return true
}

export function bootstrapLocalStore({ cwd, manifest }) {
  if (!cwd || typeof cwd !== 'string') throw new TypeError('cwd deve ser string')
  if (!manifest || !manifest.slug) throw new TypeError('manifest com slug é obrigatório')

  const root = join(cwd, '.meet-criteria', manifest.slug)
  let alreadyExisted = false
  try {
    if (existsSync(root)) alreadyExisted = true
    mkdirSync(join(root, 'references'), { recursive: true })

    writeIfMissing(join(root, 'metadata.json'), JSON.stringify(metadataFromManifest(manifest), null, 2) + '\n')
    writeIfMissing(join(root, 'problem-statement.md'),
      `# Problem statement\n\n${manifest.nodes.find((n) => n.id === 'problem-statement').text}\n`)
    const flowsMd = buildFlowsMd(manifest)
    if (flowsMd) writeIfMissing(join(root, 'flows.md'), flowsMd + '\n')
    writeIfMissing(join(root, 'screen-justifications.md'), buildScreenJustificationsMd(manifest) + '\n')
    writeIfMissing(join(root, 'analysis.md'), buildAnalysisMd(manifest) + '\n')
    writeIfMissing(join(root, 'anchors.json'), '[]\n')
    writeIfMissing(join(root, 'references', '.gitkeep'), '')

    return { created: true, path: root, alreadyExisted }
  } catch (err) {
    return { created: false, path: root, reason: err.message }
  }
}
```

- [ ] **Step 2: Rodar testes**

Run: `npm test`
Expected: 7 novos testes passando, sem regressão.

- [ ] **Step 3: Commit**

```bash
git add lib/local-store.mjs lib/local-store.test.mjs
git commit -m "feat(lib): add local-store bootstrap for .meet-criteria/<slug>/ tree"
```

---

### Task 11: Testes do CLI `scripts/new-deliverable.mjs` (TDD-first)

CLI é um wrapper fino que orquestra: `loadTemplate` → `resolveIdentity` → `buildRenderManifest` → `bootstrapLocalStore`. Aceita inputs de stdin (JSON) ou flags, e imprime o manifest no stdout.

**Files:**
- Create: `scripts/new-deliverable.test.mjs`

- [ ] **Step 1: Escrever os testes**

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { mkdtempSync, existsSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'

const here = dirname(fileURLToPath(import.meta.url))
const cli = join(here, 'new-deliverable.mjs')

function run(args, { stdin, env } = {}) {
  return spawnSync(process.execPath, [cli, ...args], {
    encoding: 'utf8',
    input: stdin,
    env: { ...process.env, ...(env || {}) },
  })
}

const FEATURE_INPUTS = {
  ticketRef: 'PROD-1234',
  problemStatement: 'Reduzir cliques no checkout de 5 pra 2.',
  flows: [
    { name: 'Checkout principal', screens: 3 },
    { name: 'Checkout alternativo', screens: 2 },
  ],
  identity: { mode: 'default' },
}

test('CLI sem --type joga código 2', () => {
  const r = run([])
  assert.equal(r.status, 2, r.stderr)
  assert.match(r.stderr, /--type/)
})

test('CLI --type desconhecido joga 2', () => {
  const r = run(['--type', 'epic'], { stdin: JSON.stringify(FEATURE_INPUTS) })
  assert.equal(r.status, 2, r.stderr)
  assert.match(r.stderr, /Tipo desconhecido|unknown/i)
})

test('CLI feature: imprime manifest válido em stdout', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'mc-cli-'))
  const r = run(['--type', 'feature', '--cwd', cwd, '--created-at', '2026-05-01T15:30:00.000Z'], { stdin: JSON.stringify(FEATURE_INPUTS) })
  assert.equal(r.status, 0, r.stderr)
  const manifest = JSON.parse(r.stdout)
  assert.equal(manifest.version, '1.0.0')
  assert.equal(manifest.type, 'feature')
  assert.equal(manifest.slug, 'prod-1234')
  assert.equal(manifest.container.name, 'Meet Criteria — PROD-1234')
})

test('CLI feature: cria local store em <cwd>/.meet-criteria/<slug>/', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'mc-cli-store-'))
  const r = run(['--type', 'feature', '--cwd', cwd, '--created-at', '2026-05-01T15:30:00.000Z'], { stdin: JSON.stringify(FEATURE_INPUTS) })
  assert.equal(r.status, 0, r.stderr)
  const root = join(cwd, '.meet-criteria', 'prod-1234')
  assert.equal(existsSync(join(root, 'metadata.json')), true)
  const meta = JSON.parse(readFileSync(join(root, 'metadata.json'), 'utf8'))
  assert.equal(meta.ticketRef, 'PROD-1234')
})

test('CLI feature: --dry-run não cria local store', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'mc-cli-dry-'))
  const r = run(['--type', 'feature', '--cwd', cwd, '--dry-run', '--created-at', '2026-05-01T15:30:00.000Z'], { stdin: JSON.stringify(FEATURE_INPUTS) })
  assert.equal(r.status, 0, r.stderr)
  assert.equal(existsSync(join(cwd, '.meet-criteria')), false)
})

test('CLI conceito: aceita variants em inputs', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'mc-cli-conc-'))
  const inputs = {
    ticketRef: 'CONC-1',
    problemStatement: 'Decidir entre 3 layouts.',
    variants: ['A', 'B', 'C'],
    decisionCriteria: 'Custo, acessibilidade, conversão.',
    identity: { mode: 'default' },
  }
  const r = run(['--type', 'conceito', '--cwd', cwd, '--created-at', '2026-05-01T15:30:00.000Z'], { stdin: JSON.stringify(inputs) })
  assert.equal(r.status, 0, r.stderr)
  const manifest = JSON.parse(r.stdout)
  assert.equal(manifest.type, 'conceito')
  assert.equal(manifest.slug, 'conc-1')
})

test('CLI auto identity sem overrides imprime warning em stderr', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'mc-cli-auto-'))
  const inputs = { ...FEATURE_INPUTS, identity: { mode: 'auto', overrides: {} } }
  const r = run(['--type', 'feature', '--cwd', cwd, '--created-at', '2026-05-01T15:30:00.000Z'], { stdin: JSON.stringify(inputs) })
  assert.equal(r.status, 0, r.stderr)
  assert.match(r.stderr, /sem overrides|no overrides/i)
})

test('CLI input inválido (problemStatement vazio) sai com 1 e mensagem', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'mc-cli-bad-'))
  const inputs = { ...FEATURE_INPUTS, problemStatement: '' }
  const r = run(['--type', 'feature', '--cwd', cwd, '--created-at', '2026-05-01T15:30:00.000Z'], { stdin: JSON.stringify(inputs) })
  assert.equal(r.status, 1)
  assert.match(r.stderr, /problem-statement/)
})
```

- [ ] **Step 2: Rodar — falham por CLI ausente**

Run: `npm test`
Expected: testes do `scripts/new-deliverable.test.mjs` falham (CLI não existe).

---

### Task 12: Implementar `scripts/new-deliverable.mjs` + script no `package.json`

**Files:**
- Create: `scripts/new-deliverable.mjs`
- Modify: `package.json`

- [ ] **Step 1: Criar `scripts/new-deliverable.mjs`**

```js
#!/usr/bin/env node
// CLI: orquestra a fase de criação de entregável Meet Criteria.
//
// Inputs: lê JSON de stdin contendo:
//   {
//     "ticketRef": "<string livre — vira slug kebab>",
//     "problemStatement": "<texto colado do ticket>",
//     "flows":     [ { "name": "...", "screens": <int> }, ... ]   // feature
//     "pairs":     [ { "label": "..." }, ... ]                    // mudanca
//     "variants":  [ "Variante A", "Variante B", ... ]            // conceito
//     "decisionCriteria": "<texto>",                              // conceito
//     "identity":  { "mode": "default" | "auto", "overrides": { ... } }
//   }
//
// Flags:
//   --type <feature|mudanca|conceito>   obrigatório
//   --cwd <path>                        diretório onde criar .meet-criteria/ (default: cwd atual)
//   --created-at <ISO8601>              timestamp determinístico (default: agora)
//   --dry-run                           não escreve em disco; só imprime manifest
//   --templates-dir <path>              override de templates dir (testing)
//
// Saída:
//   stdout: manifest JSON pretty-printed
//   stderr: warnings (ex: identity auto sem overrides) + summary final humano

import { homedir } from 'node:os'
import { resolve } from 'node:path'
import { readFileSync } from 'node:fs'
import { normalizeTicketSlug } from '../lib/slug.mjs'
import { loadTemplate, TemplateLoadError } from '../lib/template-loader.mjs'
import { resolveIdentity } from '../lib/visual-identity.mjs'
import { buildRenderManifest, RenderInputError } from '../lib/render-manifest.mjs'
import { bootstrapLocalStore } from '../lib/local-store.mjs'

function parseArgs(argv) {
  const out = { type: null, cwd: process.cwd(), createdAt: null, dryRun: false, templatesDir: null }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--type') out.type = argv[++i]
    else if (a === '--cwd') out.cwd = argv[++i]
    else if (a === '--created-at') out.createdAt = argv[++i]
    else if (a === '--dry-run') out.dryRun = true
    else if (a === '--templates-dir') out.templatesDir = argv[++i]
    else if (a === '--help' || a === '-h') out.help = true
    else {
      console.error(`Argumento desconhecido: ${a}`)
      process.exit(2)
    }
  }
  return out
}

function readStdinSync() {
  // Node 20: readFileSync(0) lê stdin até EOF.
  try { return readFileSync(0, 'utf8') } catch { return '' }
}

function fail(message, code = 1) {
  console.error(message)
  process.exit(code)
}

function main() {
  const args = parseArgs(process.argv.slice(2))
  if (args.help) {
    console.log('Usage: new-deliverable.mjs --type <feature|mudanca|conceito> [--cwd <path>] [--dry-run] [--created-at <ISO>] < inputs.json')
    process.exit(0)
  }
  if (!args.type) fail('--type é obrigatório (feature|mudanca|conceito)', 2)

  let inputs
  try {
    const raw = readStdinSync()
    if (!raw.trim()) fail('Inputs JSON ausentes em stdin', 2)
    inputs = JSON.parse(raw)
  } catch (err) {
    fail(`Falha ao parsear stdin como JSON: ${err.message}`, 2)
  }

  const ticketRef = String(inputs.ticketRef ?? '').trim()
  if (!ticketRef) fail('inputs.ticketRef é obrigatório', 1)

  let slug
  try { slug = normalizeTicketSlug(ticketRef) } catch (err) { fail(err.message, 1) }

  let template
  try {
    template = loadTemplate(args.type, args.templatesDir ? { templatesDir: resolve(args.templatesDir) } : {})
  } catch (err) {
    if (err instanceof TemplateLoadError) fail(err.message, 2)
    throw err
  }

  let identity
  try {
    identity = resolveIdentity({ mode: inputs.identity?.mode ?? 'default', overrides: inputs.identity?.overrides ?? {} })
  } catch (err) {
    fail(err.message, 1)
  }
  for (const w of identity.warnings ?? []) console.error(`warn: ${w}`)

  const createdAt = args.createdAt ?? new Date().toISOString()

  let manifest
  try {
    manifest = buildRenderManifest({ template, identity, slug, ticketRef, createdAt, inputs })
  } catch (err) {
    if (err instanceof RenderInputError) fail(err.message, 1)
    throw err
  }

  if (!args.dryRun) {
    const r = bootstrapLocalStore({ cwd: resolve(args.cwd), manifest })
    if (!r.created) {
      console.error(`warn: local store não criado (${r.reason}). Continuando em modo Figma-only.`)
    } else if (r.alreadyExisted) {
      console.error(`info: ${r.path} já existia; arquivos pré-existentes preservados.`)
    } else {
      console.error(`info: local store criado em ${r.path}.`)
    }
  }

  process.stdout.write(JSON.stringify(manifest, null, 2) + '\n')
  process.exit(0)
}

main()
```

- [ ] **Step 2: Adicionar script ao `package.json`**

Edite `package.json` mantendo os existentes e acrescentando:

```json
{
  "scripts": {
    "test": "node --test --test-reporter=spec",
    "validate:templates": "node scripts/validate-templates.mjs templates/*.jsonc",
    "check:environment": "node scripts/check-environment.mjs",
    "setup:write-config": "node scripts/init-config.mjs",
    "new:deliverable": "node scripts/new-deliverable.mjs"
  }
}
```

- [ ] **Step 3: Rodar testes**

Run: `npm test`
Expected: 8 novos testes do CLI passando, sem regressão. Total agregado >100 ✔.

- [ ] **Step 4: Sanity check do CLI feature**

Run:

```bash
mkdir -p /tmp/mc-cli-smoke && \
echo '{"ticketRef":"PROD-1234","problemStatement":"Reduzir cliques.","flows":[{"name":"Checkout","screens":2}],"identity":{"mode":"default"}}' \
  | node scripts/new-deliverable.mjs --type feature --cwd /tmp/mc-cli-smoke --created-at 2026-05-01T15:30:00.000Z \
  | jq '.container.name, .page.name, (.nodes | map(.id))'
```

Expected:
```
"Meet Criteria — PROD-1234"
"MC — prod-1234"
[
  "context",
  "problem-statement",
  "flows",
  "final-analysis"
]
```

Cleanup: `rm -rf /tmp/mc-cli-smoke`

- [ ] **Step 5: Commit**

```bash
git add scripts/new-deliverable.mjs scripts/new-deliverable.test.mjs package.json
git commit -m "feat(scripts): add new-deliverable CLI orchestrating manifest + local store"
```

---

### Task 13: Skill `skills/creating-templates.md`

Skill narrativa que conduz o agente: (a) sanity de pré-requisitos via `npm run check:environment`, (b) coleta inputs do designer, (c) chama o CLI `new:deliverable`, (d) consome o manifest e renderiza no Figma via `figma_execute` seguindo `figma-use`, (e) atribui plugin data, (f) reporta próximos passos.

**Files:**
- Create: `skills/creating-templates.md`

- [ ] **Step 1: Criar `skills/creating-templates.md`**

````markdown
---
name: creating-templates
description: Use ao executar /meet-criteria-new <feature|mudanca|conceito> ou quando o usuário pede para "criar um novo entregável Meet Criteria" — orienta o agente a coletar inputs do designer, chamar o CLI new:deliverable, e renderizar o template no Figma via figma-console MCP com plugin data persistida.
---

# Meet Criteria — Creating Templates Skill

Conduza o designer pelo fluxo de criação de um novo entregável. Mantenha o tom direto, em pt-BR. Cada passo: confirme o estado, peça o que falta, mostre exatamente o que vai fazer antes de executar.

> **Pré-requisito obrigatório:** invoque `figma-use` antes de qualquer chamada `figma_execute` (regras do skill oficial; sem isso seu JS pode quebrar nas regras 1, 2, 3a, 6, 7, 9 da `figma-use`).

## Princípios

1. **Não toca o canvas atual do designer.** Sempre cria uma page nova `MC — <slug>` e duplica as telas selecionadas pra lá. Originais ficam intactas.
2. **Plugin data em todo nó criado.** Container raiz e cada filho recebem `setSharedPluginData('meetCriteria', 'role', '<role>')` mais chaves contextuais (ver tabela abaixo). Isso é o que permite os outros comandos da skill detectarem o que é dela.
3. **Manifest é a fonte da verdade.** Você nunca calcula layout no improviso. Sempre roda o CLI, recebe o manifest JSON, e o consome literalmente. Se o manifest não tem o campo, o canvas não tem o nó.
4. **Falha cedo, sem cleanup parcial.** Se algo dá errado no meio (token expirado, page já existe, MCP fora do ar), pare e reporte. Não tente "consertar" criando nós soltos.

## Pré-checagem (Passo 0)

Antes de coletar qualquer input, confirme em silêncio:

1. `~/.config/meet-criteria/config.json` existe e `setup_complete=true`. Se não, instrua: "Rode `/meet-criteria-setup` antes."
2. `figma_get_status` ou `figma_list_open_files` — bridge plugin precisa estar ativo no Figma Desktop.

Se algo falhou, pare e reporte. Não siga.

## Passo 1 — Tipo do entregável

O comando vem como `/meet-criteria-new <tipo>`. Se o usuário não passou tipo, pergunte:

> Qual tipo? `feature` (greenfield), `mudanca` (correção/iteração antes/depois) ou `conceito` (variantes A/B/C)?

Guarde em `TYPE`.

## Passo 2 — Identificação do ticket

Pergunte:

> Qual a referência do ticket? Pode ser ID (`PROD-1234`), nome (`Onboarding flow update`) ou os dois juntos.

Guarde como `TICKET_REF`. O slug será gerado pelo CLI.

## Passo 3 — Problem statement

Peça ao designer:

> Cola aqui o problem statement do ticket — texto cru. Não precisa formatar.

Guarde em `PROBLEM_STATEMENT`. Se vier vazio, peça de novo (o CLI rejeita vazio).

## Passo 4 — Estrutura específica do tipo

### Se `TYPE === 'feature'`

Pergunte:

> Quantos fluxos? E quantas telas por fluxo?

Para cada fluxo, peça nome e contagem de telas. Estruture em `inputs.flows = [{ name, screens }]`. **Não selecione telas ainda** — só vai pedir após o manifest existir.

### Se `TYPE === 'mudanca'`

Pergunte:

> Quantos pares antes/depois? Pra cada par, qual o nome (ex.: "Tela 01 — Checkout")?

Estruture em `inputs.pairs = [{ label }]`.

### Se `TYPE === 'conceito'`

Pergunte:

> Quantas variantes (entre 2 e 5)? E me passa em uma frase os critérios de decisão.

Estruture em `inputs.variants = ['A', 'B', ...]` (uma string vazia ou nota curta por variante) e `inputs.decisionCriteria` com a frase.

## Passo 5 — Identidade visual

Olhe `~/.config/meet-criteria/config.json::preferences.default_visual_identity`:

- Se `default` → use `{ mode: 'default' }` direto.
- Se `auto` → siga a sub-rotina abaixo.
- Se `ask` → pergunte:

> Identidade visual: padrão Meet Criteria (paleta Tailwind) ou auto-detect das variáveis do seu arquivo Figma?

### Sub-rotina auto-detect

1. Rode `figma_get_variables` no arquivo aberto.
2. Mapeie variáveis disponíveis para os tokens conhecidos (ver `lib/visual-tokens.mjs::TOKEN_TAILWIND_REF`). Heurística:
   - cor "primary" / "brand" → `tag.screen.background`
   - cor "background" / "surface-base" → `template.background`
   - cor "border-subtle" / "neutral" claro → `anchor.box.border`
   - etc.
3. Mostre ao designer o mapping proposto e peça confirmação. Sem confirmação, caia no `default`.
4. Estruture em `inputs.identity = { mode: 'auto', overrides: { 'tag.screen.background': '#...', ... } }`.

## Passo 6 — Chamar o CLI

Monte o JSON de inputs e rode:

```bash
echo '<JSON_INPUTS>' | npm run new:deliverable -- --type <TYPE>
```

Onde `<JSON_INPUTS>` tem o shape:

```json
{
  "ticketRef": "PROD-1234",
  "problemStatement": "...",
  "flows": [...],
  "pairs": [...],
  "variants": [...],
  "decisionCriteria": "...",
  "identity": { "mode": "default" | "auto", "overrides": { ... } }
}
```

Capture stdout (manifest JSON) e stderr (warnings + info). Se `exit code !== 0`, reporte ao designer e pare.

## Passo 7 — Selecionar telas no Figma

**Antes** de renderizar o template, peça ao designer:

> Selecione no canvas atual as telas que devem entrar nesse entregável e me avise.

Aguarde confirmação textual. Depois rode `figma_get_selection` e capture os IDs em ordem.

Valide:
- `feature`: `selection.length === sum(flows[].screens)` (ordem importa: primeiras N telas vão pro Fluxo 1, próximas M pro Fluxo 2, etc).
- `mudanca`: `selection.length === pairs.length * 2` (ordem: par1.antes, par1.depois, par2.antes, par2.depois, ...).
- `conceito`: `selection.length === variants.length`.

Se a contagem não bate, reporte exatamente o gap e peça nova seleção.

## Passo 8 — Renderizar via figma_execute

> **Lembrete `figma-use` regra 7:** retorne IDs do nó criado, não o objeto. Regra 6: `setSharedPluginData` em UI — sem `await`. Regra 1: cada `figma_execute` é atômico — se erro no meio, reverta com `node.remove()`.

Use o JS abaixo como template. Substitua `__MANIFEST__` pelo manifest JSON serializado, `__SELECTION_IDS__` pelo array de IDs em ordem.

```js
// ============================================================================
// Meet Criteria — render template a partir de manifest declarativo.
// Premissa: manifest validado em new-deliverable.mjs (lib/render-manifest.mjs).
// ============================================================================
const MANIFEST = __MANIFEST__
const SELECTION = __SELECTION_IDS__

// 1. Carrega todas as fonts antes de criar texto (figma-use regra 2).
await figma.loadFontAsync({ family: 'Inter', style: 'Regular' })
await figma.loadFontAsync({ family: 'Inter', style: 'Bold' })

// 2. Cria/seleciona page nova (figma-use regra 3a).
await figma.loadAllPagesAsync()
let page = figma.root.children.find((p) => p.name === MANIFEST.page.name)
if (page) {
  return JSON.stringify({ error: `Page "${MANIFEST.page.name}" já existe — abortando para evitar sobrescrita. Renomeie ou apague antes.` })
}
page = figma.createPage()
page.name = MANIFEST.page.name
figma.currentPage = page

// 3. Container raiz (auto-layout horizontal).
const root = figma.createFrame()
root.name = MANIFEST.container.name
root.layoutMode = MANIFEST.layout.kind === 'vertical-stack' ? 'VERTICAL' : 'HORIZONTAL'
root.itemSpacing = MANIFEST.layout.gap
root.paddingTop = root.paddingBottom = root.paddingLeft = root.paddingRight = MANIFEST.layout.padding
root.fills = [{ type: 'SOLID', color: hexToRgb(MANIFEST.layout.background) }]
root.primaryAxisSizingMode = 'AUTO'
root.counterAxisSizingMode = 'AUTO'
page.appendChild(root)

// Plugin data (figma-use regra 6: sync, sem await em UI).
for (const [k, v] of Object.entries(MANIFEST.container.pluginData)) {
  root.setSharedPluginData('meetCriteria', k, String(v))
}

// 4. Itera nodes do manifest e cria componentes na ordem.
const cursorByFlow = {} // mantém posição de seleção quando duplicamos telas
let nextSelectionIdx = 0

for (const node of MANIFEST.nodes) {
  if (node.component === 'ContextMacro') {
    const f = createContextMacro(node, MANIFEST.tokens)
    root.appendChild(f)
  } else if (node.component === 'ProblemStatement') {
    const f = await createProblemStatement(node, MANIFEST.tokens)
    root.appendChild(f)
  } else if (node.component === 'FlowList') {
    for (const flow of node.children) {
      const flowFrame = figma.createFrame()
      flowFrame.name = flow.header.text
      flowFrame.layoutMode = 'VERTICAL'
      flowFrame.itemSpacing = 24
      flowFrame.fills = []
      flowFrame.primaryAxisSizingMode = 'AUTO'
      flowFrame.counterAxisSizingMode = 'AUTO'
      for (const [k, v] of Object.entries(flow.pluginData)) flowFrame.setSharedPluginData('meetCriteria', k, String(v))

      const header = await createSectionHeader(flow.header.text, MANIFEST.tokens)
      flowFrame.appendChild(header)

      for (let i = 0; i < flow.screens.length; i++) {
        const slot = flow.screens[i]
        const figId = SELECTION[nextSelectionIdx++]
        const screen = await createScreenSlot(slot, figId, MANIFEST.tokens)
        flowFrame.appendChild(screen)
      }
      root.appendChild(flowFrame)
    }
  } else if (node.component === 'Comparative') {
    for (const item of node.children) {
      const comp = figma.createFrame()
      comp.name = item.pluginData?.name ?? `Comparative ${item.pluginData?.pairIndex ?? ''}`
      comp.layoutMode = 'HORIZONTAL'
      comp.itemSpacing = 32
      comp.fills = []
      comp.primaryAxisSizingMode = 'AUTO'
      comp.counterAxisSizingMode = 'AUTO'
      for (const [k, v] of Object.entries(item.pluginData)) comp.setSharedPluginData('meetCriteria', k, String(v))
      for (const slot of item.slots) {
        const figId = SELECTION[nextSelectionIdx++]
        const slotFrame = await createScreenSlot({ pluginData: slot.pluginData, label: slot.label }, figId, MANIFEST.tokens)
        comp.appendChild(slotFrame)
      }
      root.appendChild(comp)
    }
  } else if (node.component === 'DecisionCriteria') {
    const f = await createDecisionCriteria(node, MANIFEST.tokens)
    root.appendChild(f)
  } else if (node.component === 'FinalAnalysis') {
    const f = await createFinalAnalysis(node, MANIFEST.tokens)
    root.appendChild(f)
  }
}

// 5. Retorna IDs (figma-use regra 7).
return JSON.stringify({
  page: page.id,
  container: root.id,
  name: root.name,
})

// ---------- helpers (definidos depois do return é inválido em Figma JS,
//             mantidos no topo num arquivo real; aqui condensados pra brevidade)
function hexToRgb(hex) { /* implementar: '#rrggbb' → { r, g, b } 0..1 */ }
function createContextMacro(node, tokens) { /* frame + título + ícone */ }
async function createProblemStatement(node, tokens) { /* texto rico */ }
async function createSectionHeader(text, tokens) { /* tag escura */ }
async function createScreenSlot(slot, figId, tokens) {
  // Duplica node selecionado (figId) para a page atual (figma-use regra 3a):
  const original = await figma.getNodeByIdAsync(figId)
  const dup = original.clone()
  // status-tag rosa em cima da imagem...
}
async function createDecisionCriteria(node, tokens) { /* lista bullets */ }
async function createFinalAnalysis(node, tokens) { /* 4 seções */ }
```

> **Importante:** as funções `create*` acima são esqueletos. Em produção, expanda-as inline (Figma JS não suporta function declarations após `return`). Mantenha cada função pura (recebe o node do manifest + tokens; cria e devolve um Frame).

Após `figma_execute` retornar, parseie o JSON: se houver `error`, reporte e pare. Se sucesso, peça ao usuário pra confirmar visualmente que as telas duplicadas estão na page nova.

## Passo 9 — Reporte ao designer

Confirmação final, sem ruído:

> Pronto. Page nova: `MC — <slug>`. Container: `Meet Criteria — <ticketRef>`. Local store: `.meet-criteria/<slug>/` (ou warning de fallback se não pôde escrever).
>
> Próximos passos:
> - `/meet-criteria-analyze` quando estiver pronto pra gerar justificativas e análise final
> - `/meet-criteria-anchor <texto>` pra ancorar uma decisão à tela selecionada
> - Editar texto direto no Figma — todos os textos são placeholders preenchíveis

## Tabela de roles e plugin data

| Componente do manifest         | role                  | chaves contextuais                          |
|--------------------------------|-----------------------|---------------------------------------------|
| container raiz                 | `root`                | `ticketRef`, `type`, `templateVersion`, `createdAt`, `lastExecutedAt`, `visualIdentity`, `slug` |
| `ContextMacro`                 | `context-macro`       | —                                           |
| `ProblemStatement`             | `problem-statement`   | —                                           |
| `FlowList`                     | `flow-list`           | —                                           |
| `Flow`                         | `flow`                | `flowId`                                    |
| `SectionHeader` (header de Flow)| —                     | (filho do `flow`; herda contexto)           |
| `ScreenSlot`                   | `screen-slot`         | `flowId`, `screenIndex` (feature) / `pairIndex`, `label` (mudanca) / `variantIndex` (conceito) |
| `Comparative` list wrapper     | `comparative-list`    | `kind`                                      |
| `Comparative` item             | `comparative`         | `kind`, `pairIndex` (mudanca) / —           |
| `DecisionCriteria`             | `decision-criteria`   | —                                           |
| `FinalAnalysis`                | `final-analysis`      | —                                           |
| `AnchorBox` (Plano 5)          | `anchor-box`          | `targetScreenSlotId`                        |

Toda escrita usa `setSharedPluginData('meetCriteria', <key>, <value>)`. Strings; objetos viram `JSON.stringify` antes.

## Em caso de erro

1. **Page já existe:** ofereça três opções — `Renomear (sufixo -v2)`, `Apagar a antiga`, `Cancelar`. Não decida sozinho.
2. **Token Figma expirou:** instrua `/meet-criteria-setup` (Passo 4 da skill setup-helper).
3. **MCP fora do ar:** `figma_reconnect` e tente de novo. Se persistir, reporte o erro literal.
4. **CLI saiu com 1:** o `stderr` tem a mensagem exata; mostre ao designer e peça correção do input específico.

````

- [ ] **Step 2: Commit**

```bash
git add skills/creating-templates.md
git commit -m "feat(skills): add creating-templates skill for /meet-criteria-new"
```

---

### Task 14: Slash command `commands/meet-criteria-new.md`

Comando enxuto — só dispara a skill `creating-templates`, normaliza o argumento posicional (`<tipo>`).

**Files:**
- Create: `commands/meet-criteria-new.md`

- [ ] **Step 1: Criar `commands/meet-criteria-new.md`**

```markdown
---
description: Cria um novo entregável Meet Criteria — feature (greenfield), mudanca (antes/depois) ou conceito (variantes A/B/C). Coleta inputs, monta render manifest e renderiza no Figma via figma-console MCP com plugin data persistida.
---

# /meet-criteria-new <tipo>

Você foi invocado pelo usuário via `/meet-criteria-new <tipo>` (ou `/meet-criteria-new` sem argumento — neste caso pergunte o tipo).

`<tipo>` ∈ `feature` | `mudanca` | `conceito`. Qualquer outro valor → reporte os 3 suportados e pare.

**Use a skill `creating-templates`** para conduzir o fluxo (9 passos: pré-checagem → tipo → ticket → problem statement → estrutura → identidade visual → CLI → seleção de telas → renderização → reporte).

Antes de qualquer comando que toque o Figma (`figma_execute`) ou crie a pasta local (`.meet-criteria/<slug>/`), peça confirmação ao designer com a contagem total de telas que vai duplicar.

Pré-requisito: `~/.config/meet-criteria/config.json::setup_complete === true`. Se faltar, instrua `/meet-criteria-setup` antes e pare.

Linguagem: pt-BR. Tom: direto, sem floreio.
```

- [ ] **Step 2: Commit**

```bash
git add commands/meet-criteria-new.md
git commit -m "feat(commands): add /meet-criteria-new slash command"
```

---

### Task 15: Atualizar `README.md` + verificação final

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Editar `README.md`**

Substitua a seção "Comandos" (mantendo o resto):

```markdown
## Comandos

```bash
npm install                  # instala deps (ajv, ajv-formats, jsonc-parser)
npm test                     # roda suíte node:test (validador + tokens + setup + new)
npm run validate:templates   # valida templates/*.jsonc contra o schema
npm run check:environment    # diagnostica Node, Figma Desktop e clientes MCP
npm run setup:write-config   # escreve ~/.config/meet-criteria/config.json
npm run new:deliverable      # CLI: gera manifest + bootstrap .meet-criteria/<slug>/
```
```

E na seção "Setup", logo abaixo, adicione um bloco "Criando um entregável":

```markdown
## Criando um entregável

Com `setup_complete=true`, invoque no agente: `/meet-criteria-new feature` (ou `mudanca` / `conceito`). A skill `creating-templates` conduz o fluxo (9 passos): coleta tipo, ticket-ref, problem statement, estrutura específica do tipo, identidade visual, chama o CLI `new:deliverable`, recebe o manifest, pede seleção das telas no Figma, e renderiza tudo na page nova `MC — <slug>` com container `Meet Criteria — <ticketRef>`. Estado fica em duas camadas: shared plugin data nos nós Figma + `.meet-criteria/<slug>/` no working directory.

Detalhes: [`skills/creating-templates.md`](skills/creating-templates.md).
```

E na seção "Roadmap", marque o Plano 3 como ✅:

```markdown
## Roadmap (planos restantes)

1. ✅ Foundation — schema, templates, tokens, validador
2. ✅ Setup & onboarding (`/meet-criteria-setup`)
3. ✅ Geração de templates (`/meet-criteria-new`)
4. ⏭ Análise IA (`/meet-criteria-analyze`)
5. ⏭ Âncoras (`/meet-criteria-anchor`, `/meet-criteria-export-annotations`)
6. ⏭ Checks determinísticos (`/meet-criteria-check`)
```

- [ ] **Step 2: Verificar diff**

Run: `git diff README.md`
Expected: apenas as três seções acima alteradas.

- [ ] **Step 3: Rodar suíte completa**

Run: `npm test`
Expected: ~58 tests do Plano 1–2 + ~58 novos do Plano 3 ≈ ~116 ✔, 0 failures.

- [ ] **Step 4: Sanity smoke do CLI nas três variantes**

Run:

```bash
TMPDIR_NEW=$(mktemp -d) && \
echo '{"ticketRef":"FEAT-1","problemStatement":"x","flows":[{"name":"F","screens":1}],"identity":{"mode":"default"}}' \
  | npm run new:deliverable --silent -- --type feature --cwd "$TMPDIR_NEW" --created-at 2026-05-01T15:30:00.000Z \
  > /dev/null && \
echo '{"ticketRef":"MUD-1","problemStatement":"x","pairs":[{"label":"Tela 01"}],"identity":{"mode":"default"}}' \
  | npm run new:deliverable --silent -- --type mudanca --cwd "$TMPDIR_NEW" --created-at 2026-05-01T15:30:00.000Z \
  > /dev/null && \
echo '{"ticketRef":"CONC-1","problemStatement":"x","variants":["A","B"],"decisionCriteria":"x","identity":{"mode":"default"}}' \
  | npm run new:deliverable --silent -- --type conceito --cwd "$TMPDIR_NEW" --created-at 2026-05-01T15:30:00.000Z \
  > /dev/null && \
ls "$TMPDIR_NEW/.meet-criteria" && \
rm -rf "$TMPDIR_NEW"
```

Expected:
```
conc-1
feat-1
mud-1
```

- [ ] **Step 5: Verificar git status limpo**

Run: `git status`
Expected: só o README pendente.

- [ ] **Step 6: Commit do README + tag de checkpoint**

```bash
git add README.md
git commit -m "docs: update README with new:deliverable command and Plan 3 roadmap"
git tag -a v0.3.0-new-deliverable -m "Plano 3 (/meet-criteria-new) concluído"
```

- [ ] **Step 7: Log dos commits do plano**

Run: `git log --oneline v0.2.0-setup..HEAD`
Expected: ~9 commits da fase: slug → template-loader → visual-identity → render-manifest → local-store → CLI → skill → command → README+tag.

---

## Self-Review

**1. Cobertura do spec — seções "Slash commands → /meet-criteria-new" + "Schema canônico" + "Conexão das telas com o template" + "Identidade visual" + "Persistência de estado" + "Distinção skill frames vs designer frames":**

- `/meet-criteria-new <tipo>` — slash command em `commands/meet-criteria-new.md` (Task 14) ✅
- Pede ticket-ref, paste do ticket, fluxos×telas, escolha de identidade visual — skill `creating-templates` Passos 2–5 (Task 13) ✅
- Schema canônico aplicado via `validateTemplate` no `template-loader` — Tasks 3–4 ✅
- Page nova `MC — <slug>` + container `Meet Criteria — <ticketRef>` — manifest (Tasks 7–8) + skill (Task 13) ✅
- Duplica telas selecionadas (originais intocadas) — skill Passos 7–8, helper `createScreenSlot` que clona node ✅
- Identidade visual: 2 caminhos (default / auto-detect) — `lib/visual-identity.mjs` (Tasks 5–6) + skill Passo 5 ✅
- Plugin data dual (root + nós internos com role + contexto) — manifest gera todos os campos; skill aplica via `setSharedPluginData` (Tasks 7–8 + 13) ✅
- Persistência dual: shared plugin data no Figma + `.meet-criteria/<slug>/` — `local-store` (Tasks 9–10) + skill Passo 6 (CLI faz o bootstrap) ✅
- Slug a partir de nome ou ID — `lib/slug.mjs` (Tasks 1–2) ✅
- 3 tipos suportados (feature/mudanca/conceito) com receitas distintas — `render-manifest` builders por componente (Tasks 7–8) ✅
- Idioma pt-BR — skill, command e mensagens do CLI ✅

Itens fora do escopo (próximos planos): análise IA, âncoras, checks determinísticos. O manifest **carrega** `checks.deterministic` mas não os executa — Plano 6 é quem implementa.

**2. Placeholder scan:** verificado. Único trecho com "esqueleto" intencional é o JS de renderização Figma na skill (Task 13 Passo 8), com comentário explícito de que helpers `create*` precisam ser expandidos inline pelo agente. Justificado: figma_execute roda em ambiente sem Node, sem hoisting de declarations após `return`, e cada layout depende de detalhes finos de auto-layout que são melhor inline. Os contratos (tokens, plugin data, IDs retornados) estão completos.

**3. Type consistency:**

- `normalizeTicketSlug(string)` → `string` — bate em testes, lib, e CLI.
- `loadTemplate(type, { templatesDir? })` → `Template` (objeto JSON) | `TemplateLoadError` — bate.
- `resolveIdentity({ mode, overrides? })` → `{ mode, tokens, overrides, warnings }` — bate em testes, lib, manifest builder, e CLI.
- `buildRenderManifest({ template, identity, slug, ticketRef, createdAt, inputs })` → `Manifest` — assinaturas batem.
- `bootstrapLocalStore({ cwd, manifest })` → `{ created: bool, path?, alreadyExisted?, reason? }` — bate.
- `manifest.container.pluginData.role === 'root'` — referenciado idênticamente em manifest builder, skill (Passo 8), e tabela de roles (Task 13).
- `manifest.tokens` é sempre `{ tokenName: hex }` (lower-case `#rrggbb`) — `visual-identity` normaliza para lowercase, `render-manifest` resolve `{token:...}` via `resolveTokenRefs`.
- `MANIFEST_VERSION = '1.0.0'` — único símbolo de versão; bate com `template.version` em fixtures.
- IDs de role — `'root' | 'context-macro' | 'problem-statement' | 'flow-list' | 'flow' | 'screen-slot' | 'comparative-list' | 'comparative' | 'decision-criteria' | 'final-analysis'` — idênticos em manifest builder e tabela da skill.

Self-review concluída. Plano pronto pra execução.
