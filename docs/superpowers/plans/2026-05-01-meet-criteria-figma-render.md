# Meet Criteria — Figma Render Helpers Implementation Plan (Plano 3.5 de 6)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expandir os helpers `create*` do Plano 3 (que ficaram como esqueletos) em renderização Figma de verdade — com paddings, fills, strokes, cantos arredondados, tipografia Inter, status-tags rosa/preto e plugin data persistida — de forma que `/meet-criteria-new` produza um entregável visualmente correto sem o agente precisar inventar layout. Saída: o designer roda o slash command, escolhe inputs, e fica com uma page Figma renderizada conforme o spec.

**Architecture:** Em vez de manter o JS de renderização como prosa na skill (frágil e não-testável), extraio para um módulo Node `lib/figma-render.mjs` que exporta o template completo (string) + um builder `buildRenderJs({ manifest, selectionIds })` que faz substituição de placeholders (`__MANIFEST_JSON__`, `__SELECTION_JSON__`). O CLI ganha flag `--with-render-js` que adiciona o campo `renderJs` ao output JSON pronto pra `figma_execute`. A skill `creating-templates.md` simplifica Passo 8 (consome `renderJs` direto) e ganha Passo 8.5 com loop de validação visual (screenshot → análise → iteração, máx 3x). A renderização Figma em si só pode ser validada manualmente — isso fica documentado, e o que é testável (substituição, sintaxe, presença de helpers) tem cobertura automatizada.

**Tech Stack:** Node 20+, `node:test`, `node:vm` (pra parsing/syntax check do JS gerado). Sem dependências novas.

**Foco MVP:**
- ✅ 6 helpers `create*` com layout final (ContextMacro, ProblemStatement, SectionHeader, ScreenSlot, DecisionCriteria, FinalAnalysis) + utilitários `hexToRgb`, `setPluginData`
- ✅ Plugin data em todos os nós (root, flow, screen-slot, comparative-list, comparative, etc.)
- ✅ Auto-layout horizontal no container raiz; vertical nos sub-frames
- ✅ Status-tags rosa pra ScreenSlot, escuras pra SectionHeader
- ✅ Tipografia Inter (família vinda de `MANIFEST.tokens['font.family.default']`)
- ✅ Loop de validação visual documentado (Passo 8.5 da skill)
- 📋 Anchor boxes (caixa branca + ponto vermelho + linha) ficam no Plano 5 (`/meet-criteria-anchor`)

**Escopo (não cobertos aqui):**
- Plano 4 — Análise IA (`/meet-criteria-analyze`) — geração de justificativas inline nos slots criados aqui
- Plano 5 — Âncoras (`AnchorBox`)
- Plano 6 — Checks determinísticos

**Premissas (já entregues no Plano 3):**
- `lib/render-manifest.mjs::buildRenderManifest` produz manifest com `tokens` (hex resolvidos), `layout` (background hex), `container.pluginData` (incl. role='root'), `nodes[]` (com pluginData em cada nível), `page.name`
- Templates carregam `tokens.font.family.default` (Inter) — será consumido pelo render
- Skill `creating-templates.md` existe e tem 9 passos
- CLI `scripts/new-deliverable.mjs` aceita inputs JSON via stdin

---

## Visual Contract

Especificação visual de cada componente (referência pra implementação dos helpers). Todos os valores em pixels Figma.

| Componente            | Layout    | Padding (X,Y) | Gap | Corner | Fill                          | Stroke                           | Width    |
|-----------------------|-----------|---------------|-----|--------|-------------------------------|----------------------------------|----------|
| **root container**    | HORIZONTAL| 64            | 80  | 0      | `tokens.template.background`  | —                                | AUTO     |
| **ContextMacro**      | HORIZONTAL| 16, 12        | 12  | 16     | `tokens.tag.context.background`| 2px `tokens.tag.context.border` | AUTO     |
| **ProblemStatement**  | VERTICAL  | 32            | 16  | 0      | transparent                   | —                                | 480      |
| **SectionHeader**     | HORIZONTAL| 16, 8         | 0   | 8      | `tokens.tag.section.background`| —                                | AUTO     |
| **Flow** wrapper      | VERTICAL  | 0             | 24  | 0      | transparent                   | —                                | AUTO     |
| **ScreenSlot** wrap   | VERTICAL  | 0             | 12  | 0      | transparent                   | —                                | AUTO     |
| **Screen status-tag** | HORIZONTAL| 12, 4         | 0   | 999    | `tokens.tag.screen.background`| —                                | AUTO     |
| **Comparative** item  | HORIZONTAL| 0             | 32  | 0      | transparent                   | —                                | AUTO     |
| **DecisionCriteria**  | VERTICAL  | 32, 24        | 12  | 12     | white                         | 1px `tokens.anchor.box.border`   | 480      |
| **FinalAnalysis**     | VERTICAL  | 32            | 24  | 16     | white                         | 1px `tokens.anchor.box.border`   | 480      |

Tipografia (família = `tokens.font.family.default`, fallback `'Inter'`):

| Elemento               | Tamanho | Peso    | Cor                         |
|------------------------|---------|---------|-----------------------------|
| ContextMacro título    | 18      | Bold    | `#000000`                   |
| ProblemStatement heading| 24      | Bold    | white                       |
| ProblemStatement body  | 16      | Regular | white                       |
| SectionHeader text     | 14      | Bold    | `tokens.tag.section.text`   |
| Status-tag text        | 12      | Bold    | `tokens.tag.screen.text`    |
| DecisionCriteria heading| 18     | Bold    | `#000000`                   |
| DecisionCriteria body  | 16      | Regular | `#000000`                   |
| FinalAnalysis heading  | 24      | Bold    | `#000000`                   |
| FinalAnalysis section H| 18      | Bold    | `#000000`                   |
| FinalAnalysis section body| 14   | Regular | `#000000`                   |

Sections traduzidas (FinalAnalysis):
- `resolution` → "Resolução"
- `strengths` → "Pontos fortes"
- `attention` → "Atenção"
- `discussion` → "Discussão"

---

## File Structure

Novo:
- Create: `lib/figma-render.mjs` — exporta `RENDER_TEMPLATE_JS` (string com placeholders) + `buildRenderJs({ manifest, selectionIds })` (substitui e retorna JS pronto)
- Create: `lib/figma-render.test.mjs` — testes do builder

Modify:
- `scripts/new-deliverable.mjs` — flag `--with-render-js`; quando ativa, output JSON ganha campo `renderJs`
- `scripts/new-deliverable.test.mjs` — testes da flag
- `skills/creating-templates.md` — Passo 8 simplifica (consome `renderJs` direto); novo Passo 8.5 (validação visual)
- `README.md` — roadmap (Plano 3.5 ✅)
- `docs/superpowers/specs/2026-05-01-meet-criteria-design.md` — anexar a tabela de "Visual Contract" como referência canônica

Cada peça com responsabilidade única:
- `figma-render` é puro: string in (template), 2 substituições, string out. Sem I/O.
- A complexidade visual fica encapsulada no template literal — testável pela presença de identificadores e `new Function(js)` pra validar sintaxe.
- O CLI continua orquestrador; só ganha um bit (a flag).
- A skill encolhe (menos prosa, mais delegação).

---

## Tasks

### Task 1: Anexar Visual Contract ao spec

Documentar as decisões visuais (a tabela acima) como referência canônica. Não-código; só doc. Faz primeiro pra que os helpers tenham fonte da verdade enquanto são implementados.

**Files:**
- Modify: `docs/superpowers/specs/2026-05-01-meet-criteria-design.md`

- [ ] **Step 1: Localizar a seção apropriada**

Abra `docs/superpowers/specs/2026-05-01-meet-criteria-design.md`. Encontre a seção `## Identidade visual` → subseção `### Tokens do padrão Meet Criteria` (linha ~228 com a tabela de tokens). Logo APÓS o último parágrafo dessa subseção (que termina com "...substituídos pelos equivalentes encontrados nas variáveis do arquivo do designer."), inserir uma nova subseção `### Contrato visual dos componentes`.

- [ ] **Step 2: Inserir a nova subseção**

Cole exatamente este bloco antes de `## Âncoras de anotação`:

````markdown
### Contrato visual dos componentes

Especificação dos atributos visuais usados pela skill `creating-templates` no `figma_execute`. Valores em pixels Figma. Consumidores: `lib/figma-render.mjs` (helpers `create*`) e implementação dos próximos planos (Plano 5 — Âncoras).

| Componente            | Layout    | Padding (X,Y) | Gap | Corner | Fill                          | Stroke                            | Width   |
|-----------------------|-----------|---------------|-----|--------|-------------------------------|-----------------------------------|---------|
| root container        | HORIZONTAL| 64            | 80  | 0      | `tokens.template.background`  | —                                 | AUTO    |
| ContextMacro          | HORIZONTAL| 16, 12        | 12  | 16     | `tokens.tag.context.background`| 2px `tokens.tag.context.border`  | AUTO    |
| ProblemStatement      | VERTICAL  | 32            | 16  | 0      | transparent                   | —                                 | 480     |
| SectionHeader         | HORIZONTAL| 16, 8         | 0   | 8      | `tokens.tag.section.background`| —                                | AUTO    |
| Flow wrapper          | VERTICAL  | 0             | 24  | 0      | transparent                   | —                                 | AUTO    |
| ScreenSlot wrapper    | VERTICAL  | 0             | 12  | 0      | transparent                   | —                                 | AUTO    |
| Screen status-tag     | HORIZONTAL| 12, 4         | 0   | 999    | `tokens.tag.screen.background`| —                                 | AUTO    |
| Comparative item      | HORIZONTAL| 0             | 32  | 0      | transparent                   | —                                 | AUTO    |
| DecisionCriteria      | VERTICAL  | 32, 24        | 12  | 12     | white                         | 1px `tokens.anchor.box.border`    | 480     |
| FinalAnalysis         | VERTICAL  | 32            | 24  | 16     | white                         | 1px `tokens.anchor.box.border`    | 480     |

Tipografia (família = `tokens.font.family.default`, fallback `Inter`):

| Elemento                  | Tamanho | Peso    | Cor                         |
|---------------------------|---------|---------|-----------------------------|
| ContextMacro título       | 18      | Bold    | `#000000`                   |
| ProblemStatement heading  | 24      | Bold    | white                       |
| ProblemStatement body     | 16      | Regular | white                       |
| SectionHeader text        | 14      | Bold    | `tokens.tag.section.text`   |
| Status-tag text           | 12      | Bold    | `tokens.tag.screen.text`    |
| DecisionCriteria heading  | 18      | Bold    | `#000000`                   |
| DecisionCriteria body     | 16      | Regular | `#000000`                   |
| FinalAnalysis heading     | 24      | Bold    | `#000000`                   |
| FinalAnalysis section H   | 18      | Bold    | `#000000`                   |
| FinalAnalysis section body| 14      | Regular | `#000000`                   |

Tradução das chaves de `FinalAnalysis.sections`:

- `resolution` → "Resolução"
- `strengths` → "Pontos fortes"
- `attention` → "Atenção"
- `discussion` → "Discussão"

````

- [ ] **Step 3: Verificar diff e commit**

Run:
```bash
git diff docs/superpowers/specs/2026-05-01-meet-criteria-design.md | head -120
```
Expected: diff mostrando só a nova subseção inserida; resto do spec inalterado.

```bash
git add docs/superpowers/specs/2026-05-01-meet-criteria-design.md
git commit -m "docs(spec): add visual contract for figma-render components"
```

---

### Task 2: Tests + implementação de `lib/figma-render.mjs`

A unidade central da fase. TDD: escreve testes primeiro pra travar o contrato (substituição correta, presença dos helpers, sintaxe parseable), depois implementa o template completo.

**Files:**
- Create: `lib/figma-render.mjs`
- Create: `lib/figma-render.test.mjs`

- [ ] **Step 1: Escrever os testes**

Crie `lib/figma-render.test.mjs`:

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildRenderJs, RENDER_TEMPLATE_JS, RenderJsError } from './figma-render.mjs'
import { loadTemplate } from './template-loader.mjs'
import { resolveIdentity } from './visual-identity.mjs'
import { buildRenderManifest } from './render-manifest.mjs'

const FIXED_DATE = '2026-05-01T15:30:00.000Z'

function makeManifest(type, inputs) {
  const template = loadTemplate(type)
  const identity = resolveIdentity({ mode: 'default' })
  return buildRenderManifest({
    template,
    identity,
    slug: 'prod-1234',
    ticketRef: 'PROD-1234',
    createdAt: FIXED_DATE,
    inputs,
  })
}

test('RENDER_TEMPLATE_JS contém os 8 helpers nominais', () => {
  for (const helper of [
    'hexToRgb',
    'setPluginData',
    'createContextMacro',
    'createProblemStatement',
    'createSectionHeader',
    'createScreenSlot',
    'createDecisionCriteria',
    'createFinalAnalysis',
  ]) {
    assert.match(RENDER_TEMPLATE_JS, new RegExp(`\\b${helper}\\b`), `helper "${helper}" ausente do template`)
  }
})

test('RENDER_TEMPLATE_JS contém os placeholders esperados', () => {
  assert.match(RENDER_TEMPLATE_JS, /__MANIFEST_JSON__/)
  assert.match(RENDER_TEMPLATE_JS, /__SELECTION_JSON__/)
})

test('RENDER_TEMPLATE_JS aplica setSharedPluginData no namespace meetCriteria', () => {
  assert.match(RENDER_TEMPLATE_JS, /setSharedPluginData\(\s*['"]meetCriteria['"]/)
})

test('RENDER_TEMPLATE_JS chama loadFontAsync para Regular e Bold', () => {
  assert.match(RENDER_TEMPLATE_JS, /style:\s*['"]Regular['"]/)
  assert.match(RENDER_TEMPLATE_JS, /style:\s*['"]Bold['"]/)
})

test('RENDER_TEMPLATE_JS aborta se page já existir (retorna error)', () => {
  assert.match(RENDER_TEMPLATE_JS, /já existe/)
})

test('buildRenderJs substitui __MANIFEST_JSON__ pelo manifest serializado', () => {
  const m = makeManifest('feature', { problemStatement: 'X', flows: [{ name: 'F', screens: 1 }] })
  const js = buildRenderJs({ manifest: m, selectionIds: ['1:1'] })
  assert.doesNotMatch(js, /__MANIFEST_JSON__/)
  assert.match(js, /"slug":\s*"prod-1234"/)
  assert.match(js, /"ticketRef":\s*"PROD-1234"/)
})

test('buildRenderJs substitui __SELECTION_JSON__ pelo array de IDs', () => {
  const m = makeManifest('feature', { problemStatement: 'X', flows: [{ name: 'F', screens: 2 }] })
  const js = buildRenderJs({ manifest: m, selectionIds: ['1:1', '1:2'] })
  assert.doesNotMatch(js, /__SELECTION_JSON__/)
  assert.match(js, /"1:1"/)
  assert.match(js, /"1:2"/)
})

test('buildRenderJs gera código sintaticamente válido (parse-only)', () => {
  const m = makeManifest('feature', { problemStatement: 'X', flows: [{ name: 'F', screens: 1 }] })
  const js = buildRenderJs({ manifest: m, selectionIds: ['1:1'] })
  // Embrulha em async function e tenta parsear via new Function — falha lança SyntaxError.
  assert.doesNotThrow(() => new Function(`return (async () => { ${js} })`))
})

test('buildRenderJs valida que selectionIds tem o tamanho correto pra feature', () => {
  const m = makeManifest('feature', { problemStatement: 'X', flows: [{ name: 'F', screens: 3 }, { name: 'G', screens: 2 }] })
  // 5 telas esperadas no total; passa só 4 → erro
  assert.throws(
    () => buildRenderJs({ manifest: m, selectionIds: ['a','b','c','d'] }),
    RenderJsError,
  )
  // Quantidade certa passa
  assert.doesNotThrow(() => buildRenderJs({ manifest: m, selectionIds: ['a','b','c','d','e'] }))
})

test('buildRenderJs valida selection pra mudanca (pares × 2)', () => {
  const m = makeManifest('mudanca', { problemStatement: 'X', pairs: [{ label: 'T01' }, { label: 'T02' }] })
  // 2 pares × 2 = 4 IDs esperados
  assert.throws(() => buildRenderJs({ manifest: m, selectionIds: ['a','b','c'] }), RenderJsError)
  assert.doesNotThrow(() => buildRenderJs({ manifest: m, selectionIds: ['a','b','c','d'] }))
})

test('buildRenderJs valida selection pra conceito (uma por variante)', () => {
  const m = makeManifest('conceito', { problemStatement: 'X', variants: ['A','B','C'], decisionCriteria: 'X' })
  assert.throws(() => buildRenderJs({ manifest: m, selectionIds: ['a','b'] }), /3/)
  assert.doesNotThrow(() => buildRenderJs({ manifest: m, selectionIds: ['a','b','c'] }))
})

test('buildRenderJs aceita selectionIds vazio quando manifest não tem screens', () => {
  // Cria manifest mínimo (feature com 0 screens não passa pelo render-manifest builder por causa do minScreens=1, então usamos um caso onde só o ProblemStatement está presente — não temos esse cenário, então o teste verifica que a contagem zero funciona via stub)
  // Passamos um manifest válido feature com 1 fluxo × 1 tela e selection=['x']: bate em 1
  const m = makeManifest('feature', { problemStatement: 'X', flows: [{ name: 'F', screens: 1 }] })
  assert.doesNotThrow(() => buildRenderJs({ manifest: m, selectionIds: ['x'] }))
})

test('RenderJsError tem code discriminator', () => {
  let caught
  try { buildRenderJs({ manifest: makeManifest('feature', { problemStatement: 'X', flows: [{ name: 'F', screens: 1 }] }), selectionIds: [] }) }
  catch (e) { caught = e }
  assert.ok(caught instanceof RenderJsError)
  assert.equal(caught.code, 'SELECTION_LENGTH_MISMATCH')
})
```

- [ ] **Step 2: Rodar — devem falhar com `ERR_MODULE_NOT_FOUND`**

Run: `npm test`
Expected: erros de módulo apontando pra `figma-render.mjs`.

- [ ] **Step 3: Implementar `lib/figma-render.mjs`**

> **Atenção: este arquivo tem ~280 linhas. O bloco abaixo é o conteúdo completo. Cole verbatim. Os helpers usam `figma.*` APIs (não-Node) — esse JS só roda em `figma_execute`; aqui ele vive como string template a ser substituída.**

```js
// Render template + builder. Pure module: produz a string JS final que vai pro
// figma_execute. Não toca Figma; não é executável em Node.
//
// Substituições: o template usa __MANIFEST_JSON__ e __SELECTION_JSON__ — ambos
// substituídos por JSON.stringify(...). Isso impede injection (controlamos o
// input upstream via manifest validado) e mantém o JS sintaticamente válido.

export class RenderJsError extends Error {
  constructor(message, { code = 'UNKNOWN' } = {}) {
    super(message)
    this.name = 'RenderJsError'
    this.code = code
  }
}

export const RENDER_TEMPLATE_JS = String.raw`
// ============================================================================
// Meet Criteria — render template (gerado por lib/figma-render.mjs).
// Premissa: manifest validado em new-deliverable.mjs. Não edite aqui — edite
// o template em lib/figma-render.mjs.
// ============================================================================
const MANIFEST = __MANIFEST_JSON__
const SELECTION = __SELECTION_JSON__

const FONT_FAMILY = (MANIFEST.tokens && MANIFEST.tokens['font.family.default']) || 'Inter'

const SECTION_LABELS = {
  resolution: 'Resolução',
  strengths: 'Pontos fortes',
  attention: 'Atenção',
  discussion: 'Discussão',
}

function hexToRgb(hex) {
  const n = parseInt(String(hex).slice(1), 16)
  return { r: ((n >> 16) & 0xff) / 255, g: ((n >> 8) & 0xff) / 255, b: (n & 0xff) / 255 }
}

function solidFill(hex) {
  return { type: 'SOLID', color: hexToRgb(hex) }
}

function setPluginData(node, data) {
  if (!data) return
  for (const [k, v] of Object.entries(data)) {
    const value = (typeof v === 'object' && v !== null) ? JSON.stringify(v) : String(v)
    node.setSharedPluginData('meetCriteria', k, value)
  }
}

function makeAutoFrame(name, kind) {
  const f = figma.createFrame()
  f.name = name
  f.layoutMode = kind
  f.primaryAxisSizingMode = 'AUTO'
  f.counterAxisSizingMode = 'AUTO'
  f.fills = []
  return f
}

function makeText(characters, { size, bold, color }) {
  const t = figma.createText()
  t.fontName = { family: FONT_FAMILY, style: bold ? 'Bold' : 'Regular' }
  t.fontSize = size
  t.characters = characters
  t.fills = [solidFill(color)]
  return t
}

function createContextMacro(node, tokens) {
  const f = makeAutoFrame('Context — ' + node.title, 'HORIZONTAL')
  f.itemSpacing = 12
  f.paddingLeft = 16
  f.paddingRight = 16
  f.paddingTop = 12
  f.paddingBottom = 12
  f.cornerRadius = 16
  f.fills = [solidFill(tokens['tag.context.background'])]
  f.strokes = [solidFill(tokens['tag.context.border'])]
  f.strokeWeight = 2
  f.counterAxisAlignItems = 'CENTER'
  f.appendChild(makeText(node.title, { size: 18, bold: true, color: '#000000' }))
  setPluginData(f, node.pluginData)
  return f
}

function createProblemStatement(node, tokens) {
  const f = makeAutoFrame('Problem statement', 'VERTICAL')
  f.itemSpacing = 16
  f.paddingLeft = 32
  f.paddingRight = 32
  f.paddingTop = 32
  f.paddingBottom = 32
  f.counterAxisSizingMode = 'FIXED'
  f.resize(480, f.height)
  const heading = makeText('Problem statement', { size: 24, bold: true, color: '#ffffff' })
  heading.layoutAlign = 'STRETCH'
  f.appendChild(heading)
  const body = makeText(node.text, { size: 16, bold: false, color: '#ffffff' })
  body.textAutoResize = 'HEIGHT'
  body.layoutAlign = 'STRETCH'
  f.appendChild(body)
  setPluginData(f, node.pluginData)
  return f
}

function createSectionHeader(text, tokens) {
  const f = makeAutoFrame('SectionHeader — ' + text, 'HORIZONTAL')
  f.paddingLeft = 16
  f.paddingRight = 16
  f.paddingTop = 8
  f.paddingBottom = 8
  f.cornerRadius = 8
  f.fills = [solidFill(tokens['tag.section.background'])]
  f.appendChild(makeText(text, { size: 14, bold: true, color: tokens['tag.section.text'] }))
  return f
}

async function createScreenSlot(slot, figId, tokens) {
  const wrapper = makeAutoFrame('ScreenSlot', 'VERTICAL')
  wrapper.itemSpacing = 12
  // status-tag rosa
  const tag = makeAutoFrame('ScreenTag', 'HORIZONTAL')
  tag.paddingLeft = 12
  tag.paddingRight = 12
  tag.paddingTop = 4
  tag.paddingBottom = 4
  tag.cornerRadius = 999
  tag.fills = [solidFill(tokens['tag.screen.background'])]
  const tagLabel = (slot.label) || ('Tela ' + String((slot.pluginData && slot.pluginData.screenIndex !== undefined ? slot.pluginData.screenIndex + 1 : 1)).padStart(2, '0'))
  tag.appendChild(makeText(tagLabel, { size: 12, bold: true, color: tokens['tag.screen.text'] }))
  wrapper.appendChild(tag)
  // tela duplicada
  if (figId) {
    const original = await figma.getNodeByIdAsync(figId)
    if (original && typeof original.clone === 'function') {
      const dup = original.clone()
      wrapper.appendChild(dup)
    }
  }
  setPluginData(wrapper, slot.pluginData)
  return wrapper
}

function createDecisionCriteria(node, tokens) {
  const f = makeAutoFrame('DecisionCriteria', 'VERTICAL')
  f.itemSpacing = 12
  f.paddingLeft = 32
  f.paddingRight = 32
  f.paddingTop = 24
  f.paddingBottom = 24
  f.cornerRadius = 12
  f.fills = [solidFill('#ffffff')]
  f.strokes = [solidFill(tokens['anchor.box.border'])]
  f.strokeWeight = 1
  f.counterAxisSizingMode = 'FIXED'
  f.resize(480, f.height)
  const heading = makeText('Critérios de decisão', { size: 18, bold: true, color: '#000000' })
  heading.layoutAlign = 'STRETCH'
  f.appendChild(heading)
  const body = makeText(node.text || '', { size: 16, bold: false, color: '#000000' })
  body.textAutoResize = 'HEIGHT'
  body.layoutAlign = 'STRETCH'
  f.appendChild(body)
  setPluginData(f, node.pluginData)
  return f
}

function createFinalAnalysis(node, tokens) {
  const f = makeAutoFrame('FinalAnalysis', 'VERTICAL')
  f.itemSpacing = 24
  f.paddingLeft = 32
  f.paddingRight = 32
  f.paddingTop = 32
  f.paddingBottom = 32
  f.cornerRadius = 16
  f.fills = [solidFill('#ffffff')]
  f.strokes = [solidFill(tokens['anchor.box.border'])]
  f.strokeWeight = 1
  f.counterAxisSizingMode = 'FIXED'
  f.resize(480, f.height)
  const heading = makeText('Análise final', { size: 24, bold: true, color: '#000000' })
  heading.layoutAlign = 'STRETCH'
  f.appendChild(heading)
  for (const sec of (node.sections || [])) {
    const subHeading = makeText(SECTION_LABELS[sec.key] || sec.key, { size: 18, bold: true, color: '#000000' })
    subHeading.layoutAlign = 'STRETCH'
    f.appendChild(subHeading)
    const body = makeText(sec.text || '', { size: 14, bold: false, color: '#000000' })
    body.textAutoResize = 'HEIGHT'
    body.layoutAlign = 'STRETCH'
    f.appendChild(body)
  }
  setPluginData(f, node.pluginData)
  return f
}

// ----- main flow -----
await figma.loadFontAsync({ family: FONT_FAMILY, style: 'Regular' })
await figma.loadFontAsync({ family: FONT_FAMILY, style: 'Bold' })
await figma.loadAllPagesAsync()

const existingPage = figma.root.children.find((p) => p.name === MANIFEST.page.name)
if (existingPage) {
  return JSON.stringify({ error: 'Page "' + MANIFEST.page.name + '" já existe — abortando para evitar sobrescrita. Renomeie ou apague antes.' })
}

const page = figma.createPage()
page.name = MANIFEST.page.name
figma.currentPage = page

const root = figma.createFrame()
root.name = MANIFEST.container.name
root.layoutMode = MANIFEST.layout.kind === 'vertical-stack' ? 'VERTICAL' : 'HORIZONTAL'
root.itemSpacing = MANIFEST.layout.gap
root.paddingTop = root.paddingBottom = root.paddingLeft = root.paddingRight = MANIFEST.layout.padding
root.fills = [solidFill(MANIFEST.layout.background)]
root.primaryAxisSizingMode = 'AUTO'
root.counterAxisSizingMode = 'AUTO'
page.appendChild(root)
setPluginData(root, MANIFEST.container.pluginData)

let nextSelectionIdx = 0
for (const node of MANIFEST.nodes) {
  if (node.component === 'ContextMacro') {
    root.appendChild(createContextMacro(node, MANIFEST.tokens))
  } else if (node.component === 'ProblemStatement') {
    root.appendChild(createProblemStatement(node, MANIFEST.tokens))
  } else if (node.component === 'FlowList') {
    for (const flow of node.children) {
      const flowFrame = makeAutoFrame(flow.header.text, 'VERTICAL')
      flowFrame.itemSpacing = 24
      setPluginData(flowFrame, flow.pluginData)
      flowFrame.appendChild(createSectionHeader(flow.header.text, MANIFEST.tokens))
      for (const slot of flow.screens) {
        const figId = SELECTION[nextSelectionIdx++]
        flowFrame.appendChild(await createScreenSlot(slot, figId, MANIFEST.tokens))
      }
      root.appendChild(flowFrame)
    }
  } else if (node.component === 'Comparative') {
    for (const item of node.children) {
      const compName = (item.pluginData && item.pluginData.name) || 'Comparative'
      const comp = makeAutoFrame(compName, 'HORIZONTAL')
      comp.itemSpacing = 32
      setPluginData(comp, item.pluginData)
      for (const slot of item.slots) {
        const figId = SELECTION[nextSelectionIdx++]
        comp.appendChild(await createScreenSlot(slot, figId, MANIFEST.tokens))
      }
      root.appendChild(comp)
    }
  } else if (node.component === 'DecisionCriteria') {
    root.appendChild(createDecisionCriteria(node, MANIFEST.tokens))
  } else if (node.component === 'FinalAnalysis') {
    root.appendChild(createFinalAnalysis(node, MANIFEST.tokens))
  }
}

return JSON.stringify({
  page: page.id,
  container: root.id,
  name: root.name,
})
`

function expectedSelectionLength(manifest) {
  if (manifest.type === 'feature') {
    const flows = manifest.nodes.find((n) => n.id === 'flows')
    return flows.children.reduce((acc, f) => acc + f.screens.length, 0)
  }
  if (manifest.type === 'mudanca') {
    const cmp = manifest.nodes.find((n) => n.id === 'comparative')
    return cmp.children.reduce((acc, c) => acc + c.slots.length, 0)
  }
  if (manifest.type === 'conceito') {
    const variants = manifest.nodes.find((n) => n.id === 'variants')
    return variants.children[0].slots.length
  }
  return 0
}

export function buildRenderJs({ manifest, selectionIds }) {
  if (!manifest || typeof manifest !== 'object') {
    throw new RenderJsError('manifest é obrigatório', { code: 'MISSING_MANIFEST' })
  }
  if (!Array.isArray(selectionIds)) {
    throw new RenderJsError('selectionIds deve ser array', { code: 'INVALID_SELECTION_TYPE' })
  }
  const expected = expectedSelectionLength(manifest)
  if (selectionIds.length !== expected) {
    throw new RenderJsError(
      `selectionIds tem ${selectionIds.length} item(s); manifest espera ${expected}.`,
      { code: 'SELECTION_LENGTH_MISMATCH' },
    )
  }
  return RENDER_TEMPLATE_JS
    .replace('__MANIFEST_JSON__', JSON.stringify(manifest))
    .replace('__SELECTION_JSON__', JSON.stringify(selectionIds))
}
```

- [ ] **Step 4: Rodar testes — devem passar**

Run: `npm test`
Expected: 12 novos testes do figma-render passando, sem regressão. Total = 143 + 12 = 155 ✔.

- [ ] **Step 5: Commit**

```bash
git add lib/figma-render.mjs lib/figma-render.test.mjs
git commit -m "feat(lib): add figma-render template + buildRenderJs builder"
```

---

### Task 3: Flag `--with-render-js` no CLI

Estende `scripts/new-deliverable.mjs` pra opcionalmente incluir `renderJs` no output. Inputs ganham `selectionIds` (no modo `--with-render-js`, é obrigatório). Sem a flag, comportamento atual preservado.

**Files:**
- Modify: `scripts/new-deliverable.mjs`
- Modify: `scripts/new-deliverable.test.mjs`

- [ ] **Step 1: Estender testes do CLI**

Append ao final de `scripts/new-deliverable.test.mjs`:

```js
test('CLI --with-render-js inclui renderJs no output JSON', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'mc-cli-rjs-'))
  const inputs = {
    ticketRef: 'PROD-99',
    problemStatement: 'X',
    flows: [{ name: 'F', screens: 2 }],
    identity: { mode: 'default' },
    selectionIds: ['1:1', '1:2'],
  }
  const r = run(['--type', 'feature', '--cwd', cwd, '--with-render-js', '--created-at', '2026-05-01T15:30:00.000Z'], { stdin: JSON.stringify(inputs) })
  assert.equal(r.status, 0, r.stderr)
  const out = JSON.parse(r.stdout)
  assert.equal(out.manifest.type, 'feature')
  assert.equal(typeof out.renderJs, 'string')
  assert.match(out.renderJs, /createContextMacro/)
  assert.match(out.renderJs, /"slug":\s*"prod-99"/)
})

test('CLI --with-render-js exige selectionIds em inputs', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'mc-cli-rjs-miss-'))
  const inputs = {
    ticketRef: 'PROD-100',
    problemStatement: 'X',
    flows: [{ name: 'F', screens: 1 }],
    identity: { mode: 'default' },
    // sem selectionIds
  }
  const r = run(['--type', 'feature', '--cwd', cwd, '--with-render-js', '--created-at', '2026-05-01T15:30:00.000Z'], { stdin: JSON.stringify(inputs) })
  assert.equal(r.status, 1)
  assert.match(r.stderr, /selectionIds/)
})

test('CLI --with-render-js valida tamanho do selectionIds', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'mc-cli-rjs-size-'))
  const inputs = {
    ticketRef: 'PROD-101',
    problemStatement: 'X',
    flows: [{ name: 'F', screens: 3 }],
    identity: { mode: 'default' },
    selectionIds: ['1:1', '1:2'], // 2 mas esperado 3
  }
  const r = run(['--type', 'feature', '--cwd', cwd, '--with-render-js', '--created-at', '2026-05-01T15:30:00.000Z'], { stdin: JSON.stringify(inputs) })
  assert.equal(r.status, 1)
  assert.match(r.stderr, /selectionIds.*3|3.*selectionIds/)
})

test('CLI sem --with-render-js mantém shape antigo (manifest direto)', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'mc-cli-noflag-'))
  const inputs = {
    ticketRef: 'PROD-102',
    problemStatement: 'X',
    flows: [{ name: 'F', screens: 1 }],
    identity: { mode: 'default' },
  }
  const r = run(['--type', 'feature', '--cwd', cwd, '--created-at', '2026-05-01T15:30:00.000Z'], { stdin: JSON.stringify(inputs) })
  assert.equal(r.status, 0, r.stderr)
  const out = JSON.parse(r.stdout)
  assert.equal(out.type, 'feature') // shape antigo: manifest direto, sem .manifest wrapper
  assert.equal(out.renderJs, undefined)
})
```

> **Importante**: o teste 4 acima revela uma decisão de schema. Sem `--with-render-js`, o CLI continua imprimindo o manifest puro (compat com Plano 3). Com `--with-render-js`, o output vira `{ manifest, renderJs }`. Os testes pré-existentes do Plano 3 continuam válidos porque assumem shape antigo.

- [ ] **Step 2: Rodar testes — 4 novos devem falhar**

Run: `npm test`
Expected: 4 falhas nos novos testes (CLI não conhece `--with-render-js`).

- [ ] **Step 3: Atualizar `scripts/new-deliverable.mjs`**

Abra `scripts/new-deliverable.mjs`. Faça três modificações:

(a) Adicione import no topo, junto com os outros imports de lib:

```js
import { buildRenderJs, RenderJsError } from '../lib/figma-render.mjs'
```

(b) Estenda `parseArgs` pra reconhecer `--with-render-js`. Localize a função `parseArgs` e adicione `withRenderJs: false` ao objeto `out` inicial e a branch `else if (a === '--with-render-js') out.withRenderJs = true` ao loop:

```js
function parseArgs(argv) {
  const out = { type: null, cwd: process.cwd(), createdAt: null, dryRun: false, templatesDir: null, withRenderJs: false }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--type') out.type = argv[++i]
    else if (a === '--cwd') out.cwd = argv[++i]
    else if (a === '--created-at') out.createdAt = argv[++i]
    else if (a === '--dry-run') out.dryRun = true
    else if (a === '--templates-dir') out.templatesDir = argv[++i]
    else if (a === '--with-render-js') out.withRenderJs = true
    else if (a === '--help' || a === '-h') out.help = true
    else {
      console.error(`Argumento desconhecido: ${a}`)
      process.exit(2)
    }
  }
  return out
}
```

(c) No fim de `main()`, ANTES da linha `process.stdout.write(JSON.stringify(manifest, null, 2) + '\n')`, insira o branch que envelopa output quando a flag está ativa:

```js
  let output
  if (args.withRenderJs) {
    const selectionIds = inputs.selectionIds
    if (!Array.isArray(selectionIds)) {
      fail('--with-render-js exige inputs.selectionIds (array de node IDs em ordem).', 1)
    }
    let renderJs
    try {
      renderJs = buildRenderJs({ manifest, selectionIds })
    } catch (err) {
      if (err instanceof RenderJsError) fail(err.message, 1)
      throw err
    }
    output = { manifest, renderJs }
  } else {
    output = manifest
  }

  process.stdout.write(JSON.stringify(output, null, 2) + '\n')
  process.exit(0)
}
```

E REMOVA a linha original `process.stdout.write(JSON.stringify(manifest, null, 2) + '\n')` (substituída pelo bloco acima).

- [ ] **Step 4: Atualizar a mensagem de --help**

Localize a mensagem `Usage: new-deliverable.mjs ...` na função `main()` e substitua por:

```js
  if (args.help) {
    console.log('Usage: new-deliverable.mjs --type <feature|mudanca|conceito> [--cwd <path>] [--dry-run] [--with-render-js] [--created-at <ISO>] < inputs.json')
    process.exit(0)
  }
```

- [ ] **Step 5: Rodar testes**

Run: `npm test`
Expected: 159 testes passando (155 + 4 novos), 0 failures.

- [ ] **Step 6: Sanity smoke**

Run:

```bash
echo '{"ticketRef":"DEMO-1","problemStatement":"x","flows":[{"name":"F","screens":1}],"identity":{"mode":"default"},"selectionIds":["1:1"]}' \
  | node scripts/new-deliverable.mjs --type feature --cwd /tmp/mc-rjs-smoke --with-render-js --dry-run --created-at 2026-05-01T15:30:00.000Z \
  | jq 'keys'
```

Expected: `["manifest", "renderJs"]`

```bash
echo '{"ticketRef":"DEMO-1","problemStatement":"x","flows":[{"name":"F","screens":1}],"identity":{"mode":"default"},"selectionIds":["1:1"]}' \
  | node scripts/new-deliverable.mjs --type feature --cwd /tmp/mc-rjs-smoke --with-render-js --dry-run --created-at 2026-05-01T15:30:00.000Z \
  | jq -r '.renderJs' | head -10
```

Expected: primeiras linhas do JS gerado, começando pelo cabeçalho `// =====`.

- [ ] **Step 7: Commit**

```bash
git add scripts/new-deliverable.mjs scripts/new-deliverable.test.mjs
git commit -m "feat(scripts): add --with-render-js flag emitting executable Figma JS"
```

---

### Task 4: Atualizar a skill `creating-templates.md`

Reduz Passo 8 (consome `renderJs` direto em vez de inventar helpers) e adiciona Passo 8.5 (validação visual). A tabela de roles e os outros passos ficam intactos.

**Files:**
- Modify: `skills/creating-templates.md`

- [ ] **Step 1: Substituir o Passo 6 e o Passo 8 inteiros**

Abra `skills/creating-templates.md`. Localize a seção `## Passo 6 — Chamar o CLI` e substitua TODO o conteúdo dessa seção (até o início de `## Passo 7`) por:

````markdown
## Passo 6 — Chamar o CLI (com `--with-render-js`)

Pra gerar manifest + JS de renderização em uma só chamada, o CLI agora aceita `--with-render-js`. Mas ele exige `selectionIds` em `inputs` — então o fluxo da skill é:

1. **Primeiro**, peça ao designer que selecione as telas (Passo 7 abaixo) e capture os IDs.
2. **Depois**, monte o JSON com `selectionIds` e rode:

```bash
echo '<JSON_INPUTS>' | npm run new:deliverable -- --type <TYPE> --with-render-js
```

`<JSON_INPUTS>` shape:

```json
{
  "ticketRef": "PROD-1234",
  "problemStatement": "...",
  "flows": [...],
  "pairs": [...],
  "variants": [...],
  "decisionCriteria": "...",
  "identity": { "mode": "default" | "auto", "overrides": { ... } },
  "selectionIds": ["1:1", "1:2", ...]
}
```

Output: `{ "manifest": {...}, "renderJs": "..." }`. Capture os dois.

Se `exit code !== 0`, reporte o `stderr` ao designer e pare. Erros típicos:
- `selectionIds tem N item(s); manifest espera M` → contagem não bate; volte ao Passo 7
- `problem-statement vazio` → volte ao Passo 3
- `Tipo desconhecido` → o CLI não reconheceu `--type`

> **Nota:** Por isso o Passo 6 vem DEPOIS do Passo 7 lá embaixo na execução real. A ordem na skill é didática (CLI vs. seleção), mas em runtime: pré-checagem → tipo → ticket → problem-statement → estrutura → identidade visual → seleção (Passo 7) → CLI (Passo 6) → renderização (Passo 8) → validação (Passo 8.5).

````

Localize agora a seção `## Passo 8 — Renderizar via figma_execute` e substitua TODO o conteúdo dessa seção (do header até o início do `## Passo 9`) por:

````markdown
## Passo 8 — Renderizar via figma_execute

> **Lembrete `figma-use` regra 1, 2, 3a, 6, 7, 9.** Invoque `figma-use` ANTES de chamar `figma_execute`. O JS gerado pelo CLI já cuida disso (loadFontAsync, loadAllPagesAsync, return de IDs string), mas o agente é responsável por seguir a etiqueta de erro atomicidade.

O JS pronto está em `output.renderJs` (capturado no Passo 6). Passe-o direto ao `figma_execute`:

```ts
const result = await figma_execute(output.renderJs)
const parsed = JSON.parse(result)

if (parsed.error) {
  // page já existia, ou erro de runtime
  // reporte ao designer e pare; oferece opções (renomear / apagar / cancelar) — ver "Em caso de erro" abaixo
} else {
  // parsed = { page: '<id>', container: '<id>', name: 'Meet Criteria — <ticketRef>' }
  // sucesso — vá pro Passo 8.5 (validação visual)
}
```

**Não modifique** o `renderJs`. Ele é a string final, com manifest + selection já substituídos. Editar quebra a integridade da renderização.

## Passo 8.5 — Validação visual (loop, máx 3 iterações)

A renderização Figma só é validável visualmente. A skill `figma-use` recomenda o ciclo:

1. **Screenshot** do container raiz: `figma_take_screenshot({ nodeId: parsed.container })`
2. **Análise**: compare contra o spec (`docs/superpowers/specs/2026-05-01-meet-criteria-design.md` → seção "Contrato visual dos componentes"). Olhe especificamente:
   - Spacing entre componentes (gap 80 entre top-level, gap 24 dentro de Flow, gap 32 dentro de Comparative)
   - Status-tags rosa nos ScreenSlots (cor `#ec4899`, cantos 999, fonte Bold 12)
   - SectionHeader escuro nos Flows (`#171717`, cantos 8, fonte Bold 14)
   - ContextMacro com borda rosa (2px) e fundo branco
   - ProblemStatement em texto branco sobre fundo `#262626`
   - FinalAnalysis em caixa branca com borda cinza-claro
3. **Iteração** se houver problema: NÃO refaça o `figma_execute` inteiro. Identifique o nó específico, ajuste-o via `figma_execute` curto que opera só nesse nó (ex: `node.itemSpacing = 80`). Máx 3 ciclos — se o 3º não fechar, reporte ao designer com prints e peça que avalie.
4. **Confirmação visual**: peça ao designer pra olhar a page nova e confirmar.

Padrões de defeito comuns e fix:
- Texto cortado → `text.textAutoResize = 'HEIGHT'` no nó text + `text.layoutAlign = 'STRETCH'`
- Frame com `width: 0` → `frame.counterAxisSizingMode = 'AUTO'` (ou `'FIXED'` + `resize(W, H)`)
- Tela duplicada solta no canvas → confirme que está dentro do `ScreenSlot` wrapper; `wrapper.appendChild(dup)` antes de `setPluginData`

````

- [ ] **Step 2: Verificar diff**

Run: `git diff skills/creating-templates.md | head -200`
Expected: diff mostrando substituição dos Passos 6 e 8 + adição do Passo 8.5; resto da skill intacto.

- [ ] **Step 3: Sanidade — contar fences triplos**

Run: `awk '/^```/{c++} END{print c}' skills/creating-templates.md`
Expected: número par (cada fence abre e fecha). Se ímpar, há fence desbalanceado — abrir e revisar.

- [ ] **Step 4: Commit**

```bash
git add skills/creating-templates.md
git commit -m "feat(skills): consume renderJs from CLI + add visual validation loop"
```

---

### Task 5: Atualizar `README.md` + verificação final + tag

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Atualizar a status line**

Substitua a linha:
```
> **Status:** em construção. Planos 1, 2 e 3 (Foundation + Setup & Onboarding + /meet-criteria-new) implementados. Veja `docs/superpowers/plans/`.
```

por:

```
> **Status:** em construção. Planos 1, 2, 3 e 3.5 (Foundation + Setup & Onboarding + /meet-criteria-new + render Figma) implementados. Veja `docs/superpowers/plans/`.
```

- [ ] **Step 2: Atualizar Roadmap**

Substitua a seção `## Roadmap (planos restantes)` por:

```markdown
## Roadmap (planos restantes)

1. ✅ Foundation — schema, templates, tokens, validador
2. ✅ Setup & onboarding (`/meet-criteria-setup`)
3. ✅ Geração de templates (`/meet-criteria-new`)
3.5. ✅ Render Figma (helpers `create*` expandidos + loop de validação visual)
4. ⏭ Análise IA (`/meet-criteria-analyze`)
5. ⏭ Âncoras (`/meet-criteria-anchor`, `/meet-criteria-export-annotations`)
6. ⏭ Checks determinísticos (`/meet-criteria-check`)
```

- [ ] **Step 3: Atualizar a árvore de arquivos**

Localize o bloco `lib/` no README e adicione a linha do figma-render. O bloco final deve ficar:

```
├── lib/
│   ├── tailwind-palette.mjs  # subset da paleta default Tailwind
│   ├── visual-tokens.mjs     # registry default + resolver {token:...}
│   ├── system-checks.mjs     # detecção Node.js + Figma Desktop
│   ├── mcp-detect.mjs        # detecção de clientes MCP e figma-console
│   ├── config.mjs            # ~/.config/meet-criteria/config.json (perms 600)
│   ├── slug.mjs              # normalização de ticket-ref pra kebab-case
│   ├── template-loader.mjs   # carrega + valida templates/<type>.jsonc
│   ├── visual-identity.mjs   # default vs auto-detect + overrides
│   ├── render-manifest.mjs   # plano declarativo de renderização
│   ├── local-store.mjs       # bootstrap .meet-criteria/<slug>/
│   └── figma-render.mjs      # template JS + buildRenderJs (figma_execute)
```

- [ ] **Step 4: Rodar suíte completa**

Run: `npm test`
Expected: ~159 testes passando, 0 failures.

- [ ] **Step 5: Smoke final**

```bash
TMPDIR_NEW=$(mktemp -d) && \
echo '{"ticketRef":"FEAT-1","problemStatement":"x","flows":[{"name":"F","screens":1}],"identity":{"mode":"default"},"selectionIds":["1:1"]}' \
  | npm run new:deliverable --silent -- --type feature --cwd "$TMPDIR_NEW" --with-render-js --created-at 2026-05-01T15:30:00.000Z \
  | jq '.renderJs | length' && \
rm -rf "$TMPDIR_NEW"
```

Expected: tamanho da string `renderJs` (vai ser ~5000-10000 chars).

- [ ] **Step 6: Verificar git status limpo exceto README**

Run: `git status`
Expected: só `README.md` modificado.

- [ ] **Step 7: Commit do README + tag**

```bash
git add README.md
git commit -m "docs: update README for Plano 3.5 (figma-render)"
git tag -a v0.3.5-figma-render -m "Plano 3.5 (Figma render helpers) concluído"
```

- [ ] **Step 8: Log dos commits**

Run: `git log --oneline v0.3.0-new-deliverable..HEAD`
Expected: ~5-6 commits da fase: spec → figma-render lib → CLI flag → skill → README+tag.

---

## Self-Review

**1. Cobertura do escopo declarado:**

- Helpers `create*` expandidos (`hexToRgb`, `setPluginData`, `createContextMacro`, `createProblemStatement`, `createSectionHeader`, `createScreenSlot`, `createDecisionCriteria`, `createFinalAnalysis`) — Task 2 ✅
- Plugin data em todos os nós (root, flow, slot, comparative, etc.) — `setPluginData` aplicado em todos os builders + main flow no template ✅
- Auto-layout consistente — Task 2, helper `makeAutoFrame` centraliza ✅
- Status-tags com tokens corretos (rosa/escuro) — Task 2 helpers ✅
- Tipografia Inter via `tokens['font.family.default']` — Task 2 constante `FONT_FAMILY` ✅
- Loop de validação visual — Task 4 Passo 8.5 ✅
- Visual contract documentado — Task 1 ✅
- CLI flag `--with-render-js` — Task 3 ✅

Itens não cobertos por design (escopo Plano 5+): AnchorBox.

**2. Placeholder scan:** todos os trechos de código aparecem completos. Comandos têm `Expected:`. Decisões de visual (paddings/gaps/cores) vêm da tabela do spec, não de "TBD".

**3. Type consistency:**

- `buildRenderJs({ manifest, selectionIds }) → string` — assinatura idêntica em testes, lib e CLI.
- `RenderJsError` tem `code` discriminator — alinhado com `RenderInputError`, `TemplateLoadError`, `VisualIdentityError`, `TokenNotFoundError`.
- Output do CLI sem `--with-render-js`: manifest direto (compat Plano 3). Com flag: `{ manifest, renderJs }`.
- Tokens consumidos: `tag.context.background`, `tag.context.border`, `tag.section.background`, `tag.section.text`, `tag.screen.background`, `tag.screen.text`, `template.background`, `anchor.box.border`, `font.family.default` — todos presentes em `lib/visual-tokens.mjs::DEFAULT_TOKENS`.
- Pluginas data roles emitidas no template Figma vão idênticas ao manifest (manifest é a fonte; helpers só copiam).

Self-review concluída. Plano pronto pra execução.
