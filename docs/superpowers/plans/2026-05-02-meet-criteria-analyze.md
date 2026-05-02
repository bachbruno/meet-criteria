# Meet Criteria — `/meet-criteria-analyze` Implementation Plan (Plano 4 de 6)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar o slash command `/meet-criteria-analyze [<slug>]` que analisa um deliverable Meet Criteria (`feature`) existente: gera justificativa por tela renderizada no Figma, preenche as 4 sub-seções de Analysis Overview (`resolution`, `validation`, `attention`, `discussion`) e adiciona uma 5ª sub-seção `gap-check` comparando ticket vs entregue. Saída: designer roda o comando, confirma o custo, e o agente preenche todo o conteúdo de análise no Figma em uma única chamada `figma_execute`.

**Architecture:** Lib pura testável (`lib/analyze-helpers.mjs`) expõe builders de JS para `figma_execute` (detect, list-slots, migrate-layout, write-justifications, write-analysis, stamp-date), validators dos outputs da IA (`validateScreenJustification`, `validateFinalAnalysis`, `validateGapCheck`, `formatGapCheckForFigma`) e função pura `planMigration` para layout deltas. Skill `skills/analyzing-deliverables.md` orquestra o agente passo a passo, carregando prompts de `prompts/analyze-{screen,final,gap-check}.md`. O comando `commands/meet-criteria-analyze.md` é entry-point fino que aciona a skill. Toda escrita no Figma acontece em uma única chamada atômica no fim, depois de todos os outputs da IA terem sido gerados e validados.

**Tech Stack:** Node 20+, `node:test`, `node:vm` (parsing/syntax check do JS gerado). `figma-console-mcp` (figma_execute, figma_take_screenshot, figma_navigate). Sem dependências novas no `package.json`.

**Foco MVP:**
- ✅ 3 ações de IA: justificativa por tela, análise final (4 sub-seções), gap check vs ticket
- ✅ Suporte apenas ao tipo `feature` (`mudanca`/`conceito` continuam stubs do Plano 3.6)
- ✅ Escrita atômica no Figma em uma única chamada `figma_execute`
- ✅ Migração graceful de deliverables antigos (sem `screen-justification` reservado, sem 5ª sub-seção)
- ✅ Idempotência via `setSharedPluginData`/`getSharedPluginData`
- ✅ Disambiguação de roles `screen-tag` / `screen-slot` / `screen-justification`
- 📋 Fora do escopo: caching de outputs; sub-comandos (`screens|final|gap`); agrupamento automático de fluxos; sugestão de âncoras; suporte a `mudanca`/`conceito`

**Premissas (já entregues nos Planos 1–3.6):**
- `lib/render-manifest.mjs::buildRenderManifest` v2.0.0 produz manifest com `section.pluginData.role='root'`, `screen-slot` em cada tela, `analysis-overview` com 4 sub-seções
- `lib/figma-render.mjs::buildRenderJs` gera JS executável via `figma_execute`
- `lib/local-store.mjs` cria `.meet-criteria/<slug>/` com `problem-statement.md` e `metadata.json`
- `lib/visual-tokens.mjs` exporta firefly-based tokens
- Padrão `RenderInputError` + `code` discriminado consolidado
- Padrão "lib pura + skill conduzindo + prompts em arquivos separados" validado no Plano 3.5
- `setSharedPluginData('meetCriteria', key, value)` é a fonte da verdade para detecção de nodes; valores serializáveis via JSON

---

## File Structure

### Criados
- Create: `lib/analyze-helpers.mjs` — builders de JS, validators, formatador, `planMigration`, `AnalyzeError`
- Create: `lib/analyze-helpers.test.mjs` — testes de tudo acima
- Create: `prompts/analyze-screen.md` — template do prompt para justificativa por tela
- Create: `prompts/analyze-final.md` — template do prompt para 4 sub-seções principais
- Create: `prompts/analyze-gap-check.md` — template do prompt para 5ª sub-seção `gap-check`
- Create: `skills/analyzing-deliverables.md` — orquestrador da skill que conduz o agente
- Create: `commands/meet-criteria-analyze.md` — slash command entry-point

### Modificados
- Modify: `lib/layout-feature.mjs` — adiciona `JUSTIFICATION_HEIGHT`, `IPHONE_TO_JUSTIFICATION_GAP`; emite `justification` em cada `screens[]`; flow-row e section crescem
- Modify: `lib/layout-feature.test.mjs` — atualiza alturas esperadas + presença de `justification`
- Modify: `lib/render-manifest.mjs` — disambigua plugin-data roles em `buildFlowsNode`; adiciona `gap-check` em `ANALYSIS_SECTION_HEADINGS`/`ANALYSIS_SECTION_PLACEHOLDERS`; itera sub-seções com `pluginData = { role: 'analysis-section', key }`
- Modify: `lib/render-manifest.test.mjs` — testes de roles disambiguados, `justification` por slot, 5ª sub-seção
- Modify: `lib/figma-render.mjs` — `buildScreenNameTag` usa `tag.pluginData`; cria text node `screen-justification`; `buildAnalysisOverviewCard` aplica `pluginData` por sub-seção; main loop chama `cloneScreen` com `screen.slotPluginData`
- Modify: `lib/figma-render.test.mjs` — testes de presença das novas roles + estrutura de sub-seções
- Modify: `lib/local-store.mjs` — remove `buildScreenJustificationsMd` e `buildAnalysisMd`; remove geração de `screen-justifications.md` e `analysis.md`
- Modify: `lib/local-store.test.mjs` — confirma ausência dos dois arquivos
- Modify: `templates/feature.jsonc` — adiciona `"gap-check"` em `AnalysisOverview.sections`

### Não tocados
- `templates/mudanca.jsonc`, `templates/conceito.jsonc` (continuam stubs do Plano 3.6)
- `schemas/template.schema.json` (sem mudança — `sections` já é array de strings sem enum)
- `commands/meet-criteria-{anchor,check,export-annotations}.md` (Planos 5/6)
- `scripts/new-deliverable.mjs` (sem mudança — `--with-render-js` continua funcionando)

---

## Tasks

### Task 1: Disambiguar plugin-data roles (`screen-tag` / `screen-slot` / preparação para `screen-justification`)

Hoje `lib/render-manifest.mjs` emite `pluginData: { role: 'screen-slot', flowId, screenIndex }` em cada slot, e `lib/figma-render.mjs` reusa esse mesmo objeto para o tag node E para o screen clonado. Resultado: ambos os nós têm a mesma role, impossibilitando join determinístico. Esta task separa as roles **sem** ainda criar o text node `screen-justification` (esse vem na Task 3).

**Files:**
- Modify: `lib/render-manifest.mjs:99-126`
- Modify: `lib/render-manifest.test.mjs`
- Modify: `lib/figma-render.mjs:124-140` (`buildScreenNameTag`) e `:225-237` (main loop)
- Modify: `lib/figma-render.test.mjs`

- [ ] **Step 1: Atualizar testes de `render-manifest` primeiro**

Adicione um teste novo em `lib/render-manifest.test.mjs` que verifica que cada item de `screens` tem `tag.pluginData.role === 'screen-tag'` e `slotPluginData.role === 'screen-slot'`, ambos com `flowId` e `screenIndex`.

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildRenderManifest } from './render-manifest.mjs'
import { loadTemplate } from './template-loader.mjs'
import { resolveIdentity } from './visual-identity.mjs'

test('buildRenderManifest disambiguates screen-tag and screen-slot roles', () => {
  const template = loadTemplate('feature')
  const identity = resolveIdentity({ mode: 'default' })
  const manifest = buildRenderManifest({
    template, identity,
    slug: 'foo-1', ticketRef: 'FOO-1',
    createdAt: '2026-05-02T00:00:00Z',
    inputs: {
      problemStatement: 'Test problem',
      flows: [{ name: 'Flow A', screens: 2 }],
    },
  })
  const flows = manifest.nodes.find((n) => n.id === 'flows')
  const screen = flows.children[0].screens[0]
  assert.equal(screen.tag.pluginData.role, 'screen-tag')
  assert.equal(screen.tag.pluginData.flowId, 'flow-1')
  assert.equal(screen.tag.pluginData.screenIndex, 0)
  assert.equal(screen.slotPluginData.role, 'screen-slot')
  assert.equal(screen.slotPluginData.flowId, 'flow-1')
  assert.equal(screen.slotPluginData.screenIndex, 0)
})
```

Renomeie o que antes era `screen.pluginData` para `screen.slotPluginData` em qualquer outro teste que ainda use o nome antigo (busque com `grep "screen.pluginData" lib/render-manifest.test.mjs`).

- [ ] **Step 2: Rodar teste — deve falhar**

```bash
node --test lib/render-manifest.test.mjs
```

Esperado: FAIL com `screen.tag.pluginData is undefined` ou `screen.slotPluginData is undefined`.

- [ ] **Step 3: Atualizar `lib/render-manifest.mjs`**

No `buildFlowsNode`, dentro do `.map((s) => ...)` do loop de telas, substitua o objeto retornado:

```js
return {
  x: s.tag.x,
  y: s.tag.y,
  tag: {
    ...s.tag,
    text: tagText,
    pluginData: { role: 'screen-tag', flowId, screenIndex: s.screenIndex },
  },
  placeholder: { ...s.placeholder },
  slotPluginData: { role: 'screen-slot', flowId, screenIndex: s.screenIndex },
}
```

Remova o antigo campo `pluginData` no nível do screen (substituído por `tag.pluginData` e `slotPluginData`).

- [ ] **Step 4: Atualizar testes de `figma-render` para refletir nova assinatura**

Em `lib/figma-render.test.mjs`, qualquer asserção sobre o JS gerado que verifique `setSharedPluginData('meetCriteria', 'role', 'screen-slot')` em contexto de tag deve passar a verificar `'screen-tag'`. Asserções sobre o screen clonado continuam buscando `'screen-slot'`. Adicione (ou ajuste) duas asserções:

```js
assert.match(js, /setSharedPluginData\(['"]meetCriteria['"], ['"]role['"], ['"]screen-tag['"]\)/)
assert.match(js, /setSharedPluginData\(['"]meetCriteria['"], ['"]role['"], ['"]screen-slot['"]\)/)
```

- [ ] **Step 5: Rodar testes — devem falhar (figma-render ainda usa screen.pluginData)**

```bash
node --test lib/figma-render.test.mjs
```

Esperado: FAIL.

- [ ] **Step 6: Atualizar `lib/figma-render.mjs`**

Em `buildScreenNameTag`, mude a assinatura: o segundo argumento passa a ser `tagPluginData` (renomear). A linha `setPluginData(f, screenPluginData)` vira `setPluginData(f, tagPluginData)`.

No main loop (`for (const screen of flow.screens)`), troque:

```js
section.appendChild(buildScreenNameTag(screen.tag, screen.pluginData))
const figId = SELECTION[selectionIdx++]
const dup = await cloneScreen(screen.placeholder, figId, screen.pluginData)
```

por:

```js
section.appendChild(buildScreenNameTag(screen.tag, screen.tag.pluginData))
const figId = SELECTION[selectionIdx++]
const dup = await cloneScreen(screen.placeholder, figId, screen.slotPluginData)
```

- [ ] **Step 7: Rodar todos os testes**

```bash
node --test lib/render-manifest.test.mjs lib/figma-render.test.mjs
```

Esperado: PASS.

- [ ] **Step 8: Commit**

```bash
git add lib/render-manifest.mjs lib/render-manifest.test.mjs lib/figma-render.mjs lib/figma-render.test.mjs
git commit -m "refactor(lib): disambiguate screen-tag and screen-slot plugin-data roles"
```

---

### Task 2: Adicionar `JUSTIFICATION_HEIGHT` + `IPHONE_TO_JUSTIFICATION_GAP` ao layout

Cada `screen-slot` ganha espaço reservado para o text node de justificativa logo abaixo do iPhone. Flow-rows crescem; section cresce; side cards (`problemStatement`, `analysisOverview`) também ganham altura porque cobrem todas as flow rows.

**Files:**
- Modify: `lib/layout-feature.mjs:4-16` (LAYOUT_CONSTANTS), `:28-30` (`screenBlockHeight`), `:69-77` (loop de telas)
- Modify: `lib/layout-feature.test.mjs`

- [ ] **Step 1: Atualizar testes de `layout-feature`**

Em `lib/layout-feature.test.mjs`, atualize (ou adicione) testes que verifiquem:

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { computeFeatureLayout, LAYOUT_CONSTANTS } from './layout-feature.mjs'

const C = LAYOUT_CONSTANTS

test('LAYOUT_CONSTANTS exposes JUSTIFICATION_HEIGHT and IPHONE_TO_JUSTIFICATION_GAP', () => {
  assert.equal(typeof C.JUSTIFICATION_HEIGHT, 'number')
  assert.equal(typeof C.IPHONE_TO_JUSTIFICATION_GAP, 'number')
  assert.ok(C.JUSTIFICATION_HEIGHT > 0)
  assert.ok(C.IPHONE_TO_JUSTIFICATION_GAP > 0)
})

test('computeFeatureLayout includes justification rect per screen', () => {
  const layout = computeFeatureLayout({ flows: [{ name: 'A', screens: 2 }] })
  const screen = layout.flows[0].screens[0]
  assert.ok(screen.justification, 'justification rect missing')
  assert.equal(screen.justification.x, screen.placeholder.x)
  assert.equal(screen.justification.width, screen.placeholder.width)
  assert.equal(screen.justification.y, screen.placeholder.y + C.IPHONE_HEIGHT + C.IPHONE_TO_JUSTIFICATION_GAP)
  assert.equal(screen.justification.height, C.JUSTIFICATION_HEIGHT)
})

test('flow-row block height includes justification space', () => {
  const layout1 = computeFeatureLayout({ flows: [{ name: 'A', screens: 1 }] })
  const layout2 = computeFeatureLayout({ flows: [{ name: 'A', screens: 1 }, { name: 'B', screens: 1 }] })
  const delta = layout2.section.height - layout1.section.height
  // Adding one flow grows section by: blockHeight + BETWEEN_FLOWS_GAP
  // blockHeight = banner + gap + tag + gap + iPhone + gap + justification
  const expectedBlock = C.BANNER_HEIGHT + C.FLOW_BANNER_TO_TAG_GAP + C.TAG_HEIGHT + C.TAG_TO_IPHONE_GAP + C.IPHONE_HEIGHT + C.IPHONE_TO_JUSTIFICATION_GAP + C.JUSTIFICATION_HEIGHT
  assert.equal(delta, expectedBlock + C.BETWEEN_FLOWS_GAP)
})

test('side cards height matches rowsHeight including justifications', () => {
  const layout = computeFeatureLayout({ flows: [{ name: 'A', screens: 1 }, { name: 'B', screens: 1 }] })
  // rowsHeight = N * blockHeight + (N-1) * BETWEEN_FLOWS_GAP
  const blockHeight = C.BANNER_HEIGHT + C.FLOW_BANNER_TO_TAG_GAP + C.TAG_HEIGHT + C.TAG_TO_IPHONE_GAP + C.IPHONE_HEIGHT + C.IPHONE_TO_JUSTIFICATION_GAP + C.JUSTIFICATION_HEIGHT
  const expectedRows = 2 * blockHeight + 1 * C.BETWEEN_FLOWS_GAP
  assert.equal(layout.problemStatement.height, expectedRows)
  assert.equal(layout.analysisOverview.height, expectedRows)
})
```

- [ ] **Step 2: Rodar testes — devem falhar**

```bash
node --test lib/layout-feature.test.mjs
```

Esperado: FAIL com `JUSTIFICATION_HEIGHT undefined` / `screen.justification undefined`.

- [ ] **Step 3: Atualizar `lib/layout-feature.mjs`**

Adicione duas constantes no `LAYOUT_CONSTANTS`:

```js
export const LAYOUT_CONSTANTS = Object.freeze({
  // ... existing constants ...
  IPHONE_TO_JUSTIFICATION_GAP: 16,
  JUSTIFICATION_HEIGHT:        120,
})
```

Atualize `screenBlockHeight`:

```js
function screenBlockHeight() {
  return C.BANNER_HEIGHT
    + C.FLOW_BANNER_TO_TAG_GAP
    + C.TAG_HEIGHT
    + C.TAG_TO_IPHONE_GAP
    + C.IPHONE_HEIGHT
    + C.IPHONE_TO_JUSTIFICATION_GAP
    + C.JUSTIFICATION_HEIGHT
}
```

Dentro do loop de telas em `computeFeatureLayout`, adicione `justification` ao objeto retornado:

```js
const screens = Array.from({ length: f.screens }, (_, j) => {
  const x = screensX + j * (C.IPHONE_WIDTH + C.BETWEEN_SCREENS_GAP)
  const phY = tagY + C.TAG_HEIGHT + C.TAG_TO_IPHONE_GAP
  return {
    flowId: `flow-${i + 1}`,
    screenIndex: j,
    tag:           { x, y: tagY, width: C.IPHONE_WIDTH, height: C.TAG_HEIGHT },
    placeholder:   { x, y: phY, width: C.IPHONE_WIDTH, height: C.IPHONE_HEIGHT },
    justification: { x, y: phY + C.IPHONE_HEIGHT + C.IPHONE_TO_JUSTIFICATION_GAP, width: C.IPHONE_WIDTH, height: C.JUSTIFICATION_HEIGHT },
  }
})
```

- [ ] **Step 4: Rodar testes — devem passar**

```bash
node --test lib/layout-feature.test.mjs
```

Esperado: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/layout-feature.mjs lib/layout-feature.test.mjs
git commit -m "feat(lib): reserve layout space for screen justifications below iPhone"
```

---

### Task 3: Render manifest emite `justification` por slot, 5ª sub-seção `gap-check`, e `pluginData` por sub-seção

**Files:**
- Modify: `lib/render-manifest.mjs:31-45` (`ANALYSIS_SECTION_HEADINGS`/`ANALYSIS_SECTION_PLACEHOLDERS`), `:99-126` (loop de telas), `:136-153` (`buildAnalysisOverviewNode`)
- Modify: `lib/render-manifest.test.mjs`

- [ ] **Step 1: Atualizar testes**

Adicione em `lib/render-manifest.test.mjs`:

```js
test('each screen has a justification node with screen-justification role', () => {
  const template = loadTemplate('feature')
  const identity = resolveIdentity({ mode: 'default' })
  const manifest = buildRenderManifest({
    template, identity,
    slug: 'foo-1', ticketRef: 'FOO-1',
    createdAt: '2026-05-02T00:00:00Z',
    inputs: { problemStatement: 'X', flows: [{ name: 'A', screens: 2 }] },
  })
  const screens = manifest.nodes.find((n) => n.id === 'flows').children[0].screens
  for (const s of screens) {
    assert.ok(s.justification, `justification missing on screen ${s.screenIndex}`)
    assert.equal(s.justification.text, '')
    assert.equal(s.justification.pluginData.role, 'screen-justification')
    assert.equal(s.justification.pluginData.flowId, 'flow-1')
    assert.equal(typeof s.justification.pluginData.screenIndex, 'number')
    assert.equal(typeof s.justification.x, 'number')
    assert.equal(typeof s.justification.y, 'number')
    assert.equal(typeof s.justification.width, 'number')
    assert.equal(typeof s.justification.height, 'number')
  }
})

test('AnalysisOverview emits 5 sub-sections including gap-check', () => {
  const template = loadTemplate('feature')
  const identity = resolveIdentity({ mode: 'default' })
  const manifest = buildRenderManifest({
    template, identity,
    slug: 'foo-1', ticketRef: 'FOO-1',
    createdAt: '2026-05-02T00:00:00Z',
    inputs: { problemStatement: 'X', flows: [{ name: 'A', screens: 1 }] },
  })
  const ao = manifest.nodes.find((n) => n.component === 'AnalysisOverview')
  assert.equal(ao.sections.length, 5)
  const keys = ao.sections.map((s) => s.key)
  assert.deepEqual(keys, ['resolution', 'validation', 'attention', 'discussion', 'gap-check'])
  for (const sec of ao.sections) {
    assert.equal(sec.pluginData.role, 'analysis-section')
    assert.equal(sec.pluginData.key, sec.key)
    assert.ok(sec.heading.length > 0)
    assert.ok(sec.body.length > 0, `placeholder missing for ${sec.key}`)
  }
})
```

- [ ] **Step 2: Rodar testes — devem falhar**

```bash
node --test lib/render-manifest.test.mjs
```

Esperado: FAIL (justification ausente; sections.length === 4; sections[i].pluginData ausente).

- [ ] **Step 3: Atualizar `ANALYSIS_SECTION_HEADINGS` e `ANALYSIS_SECTION_PLACEHOLDERS`**

Em `lib/render-manifest.mjs`, adicione `gap-check`:

```js
const ANALYSIS_SECTION_HEADINGS = Object.freeze({
  resolution: 'Resolution',
  validation: 'What validates it',
  attention:  'Attention to',
  discussion: 'Topics for discussion',
  'gap-check': 'Gap check vs ticket',
})

const ANALYSIS_SECTION_PLACEHOLDERS = Object.freeze({
  resolution: 'Describe how this delivery solves the problem statement.',
  validation: 'List the criteria that confirm the resolution works.',
  attention:  'Flag risks, edge cases, or constraints the team should mind.',
  discussion: 'Open questions or trade-offs to align on during the review.',
  'gap-check': 'Run /meet-criteria-analyze to compare the ticket against the delivered screens.',
})
```

- [ ] **Step 4: Atualizar `buildFlowsNode` para emitir `justification`**

Dentro do `.map((s) => ...)`, complete o objeto retornado (já alterado na Task 1; agora adicione `justification`):

```js
return {
  x: s.tag.x,
  y: s.tag.y,
  tag: {
    ...s.tag,
    text: tagText,
    pluginData: { role: 'screen-tag', flowId, screenIndex: s.screenIndex },
  },
  placeholder: { ...s.placeholder },
  slotPluginData: { role: 'screen-slot', flowId, screenIndex: s.screenIndex },
  justification: {
    x: s.justification.x,
    y: s.justification.y,
    width: s.justification.width,
    height: s.justification.height,
    text: '',
    pluginData: { role: 'screen-justification', flowId, screenIndex: s.screenIndex },
  },
}
```

- [ ] **Step 5: Atualizar `buildAnalysisOverviewNode` para emitir `pluginData` por sub-seção**

Substitua o map de `sections`:

```js
function buildAnalysisOverviewNode(structureNode, inputs, layout) {
  const sectionKeys = structureNode.sections ?? ['resolution', 'validation', 'attention', 'discussion', 'gap-check']
  return {
    id: structureNode.id,
    component: 'AnalysisOverview',
    x: layout.analysisOverview.x,
    y: layout.analysisOverview.y,
    width: layout.analysisOverview.width,
    height: layout.analysisOverview.height,
    heading: 'Analysis Overview',
    sections: sectionKeys.map((key) => ({
      key,
      heading: ANALYSIS_SECTION_HEADINGS[key] ?? key,
      body: ANALYSIS_SECTION_PLACEHOLDERS[key] ?? '',
      pluginData: { role: 'analysis-section', key },
    })),
    pluginData: { role: 'analysis-overview' },
  }
}
```

- [ ] **Step 6: Rodar testes — devem passar**

```bash
node --test lib/render-manifest.test.mjs
```

Esperado: PASS.

- [ ] **Step 7: Commit**

```bash
git add lib/render-manifest.mjs lib/render-manifest.test.mjs
git commit -m "feat(lib): emit screen-justification per slot + gap-check sub-section"
```

---

### Task 4: `figma-render.mjs` — text node `screen-justification` + `pluginData` por sub-seção

**Files:**
- Modify: `lib/figma-render.mjs:157-192` (`buildAnalysisOverviewCard`), `:225-237` (main loop em FlowList)
- Modify: `lib/figma-render.test.mjs`

- [ ] **Step 1: Atualizar testes para verificar criação dos novos nós**

Em `lib/figma-render.test.mjs`, adicione asserções no JS gerado:

```js
test('render JS creates screen-justification text node per slot', () => {
  const manifest = /* build a feature manifest with 1 flow x 2 screens */
  const js = buildRenderJs({ manifest, selectionIds: [null, null] })
  // text node creation reference (figma.createText)
  assert.match(js, /screen-justification/)
  // setSharedPluginData with 'screen-justification' role
  assert.match(js, /setSharedPluginData\(['"]meetCriteria['"], ['"]role['"], ['"]screen-justification['"]\)/)
})

test('render JS applies analysis-section pluginData per sub-section', () => {
  const manifest = /* feature manifest */
  const js = buildRenderJs({ manifest, selectionIds: [null] })
  assert.match(js, /setSharedPluginData\(['"]meetCriteria['"], ['"]role['"], ['"]analysis-section['"]\)/)
  // contains all 5 keys
  for (const k of ['resolution', 'validation', 'attention', 'discussion', 'gap-check']) {
    assert.ok(js.includes(`"key":"${k}"`) || js.includes(`'key':'${k}'`) || js.includes(`key: "${k}"`),
      `missing key ${k} in pluginData`)
  }
})
```

(Para o helper de criação do manifest no test, reuse o que já existe em outros testes ou monte uma fixture inline.)

- [ ] **Step 2: Rodar testes — devem falhar**

```bash
node --test lib/figma-render.test.mjs
```

Esperado: FAIL.

- [ ] **Step 3: Atualizar `buildAnalysisOverviewCard` em `lib/figma-render.mjs`**

Dentro do `for (const sec of (node.sections || []))`, anexe `setPluginData(sub, sec.pluginData)` antes do `f.appendChild(sub)`:

```js
for (const sec of (node.sections || [])) {
  const sub = makeAutoFrame('Section — ' + sec.key, 'VERTICAL', { gap: 20 })

  const subHeading = makeText(sec.heading, { style: 'Semi Bold', size: 28, lineHeight: 100, color: TEXT_PRIMARY })
  subHeading.textAutoResize = 'HEIGHT'
  sub.appendChild(subHeading)
  subHeading.layoutSizingHorizontal = 'FILL'

  const subBody = makeText(sec.body || '', { style: 'Regular', size: 20, lineHeight: 120, color: TEXT_PRIMARY })
  subBody.textAutoResize = 'HEIGHT'
  sub.appendChild(subBody)
  subBody.layoutSizingHorizontal = 'FILL'

  setPluginData(sub, sec.pluginData)

  f.appendChild(sub)
  sub.layoutSizingHorizontal = 'FILL'
  sub.layoutSizingVertical = 'HUG'
}
```

- [ ] **Step 4: Adicionar helper `buildScreenJustificationText` no template**

Antes de `// ----- main flow -----` em `lib/figma-render.mjs`, adicione um novo helper:

```js
function buildScreenJustificationText(spec) {
  const t = makeText(spec.text || '', { style: 'Regular', size: 18, lineHeight: 130, color: TEXT_PRIMARY })
  t.name = 'Screen justification — ' + (spec.pluginData?.flowId ?? '') + ' / ' + (spec.pluginData?.screenIndex ?? '')
  t.x = spec.x
  t.y = spec.y
  t.resize(spec.width, spec.height)
  t.textAutoResize = 'HEIGHT'
  setPluginData(t, spec.pluginData)
  return t
}
```

E no main loop, dentro do `for (const screen of flow.screens)`, **após** o append do clone (ou após o tag se não houver clone), append a justification:

```js
for (const screen of flow.screens) {
  section.appendChild(buildScreenNameTag(screen.tag, screen.tag.pluginData))
  const figId = SELECTION[selectionIdx++]
  const dup = await cloneScreen(screen.placeholder, figId, screen.slotPluginData)
  if (dup) section.appendChild(dup)
  section.appendChild(buildScreenJustificationText(screen.justification))
}
```

- [ ] **Step 5: Rodar testes — devem passar**

```bash
node --test lib/figma-render.test.mjs
```

Esperado: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/figma-render.mjs lib/figma-render.test.mjs
git commit -m "feat(lib): render screen-justification text node + analysis-section pluginData"
```

---

### Task 5: `templates/feature.jsonc` — adicionar `gap-check`

**Files:**
- Modify: `templates/feature.jsonc:45`

- [ ] **Step 1: Editar o template**

Em `templates/feature.jsonc`, na entrada de `analysis-overview`:

```jsonc
{
  "id": "analysis-overview",
  "component": "AnalysisOverview",
  "required": true,
  "sections": ["resolution", "validation", "attention", "discussion", "gap-check"]
}
```

- [ ] **Step 2: Validar com `scripts/validate-templates.mjs`**

```bash
node scripts/validate-templates.mjs
```

Esperado: tudo OK (schema não tem enum em `sections`).

- [ ] **Step 3: Rodar todos os testes de manifesto + render**

```bash
node --test lib/render-manifest.test.mjs lib/figma-render.test.mjs lib/template-loader.test.mjs
```

Esperado: PASS.

- [ ] **Step 4: Commit**

```bash
git add templates/feature.jsonc
git commit -m "feat(templates): add gap-check sub-section to feature analysis overview"
```

---

### Task 6: Remover geração de `screen-justifications.md` e `analysis.md` do local-store

Spec: Figma é a fonte da verdade para análises. Designer que quiser referenciar tira screenshot do Figma.

**Files:**
- Modify: `lib/local-store.mjs:27-40` (remover `buildScreenJustificationsMd`), `:53-61` (remover `buildAnalysisMd`), `:84-85` (remover write)
- Modify: `lib/local-store.test.mjs`

- [ ] **Step 1: Atualizar testes — confirmar ausência dos arquivos**

Em `lib/local-store.test.mjs`, encontre testes que verificam `screen-justifications.md` ou `analysis.md` e troque para asserção negativa. Adicione:

```js
test('bootstrapLocalStore does NOT generate screen-justifications.md or analysis.md', async () => {
  const tmp = await fs.mkdtemp(join(tmpdir(), 'mc-test-'))
  // build a minimal manifest fixture (or reuse existing helper)
  const manifest = /* ... */
  bootstrapLocalStore({ cwd: tmp, manifest })
  const root = join(tmp, '.meet-criteria', manifest.slug)
  assert.equal(await exists(join(root, 'screen-justifications.md')), false)
  assert.equal(await exists(join(root, 'analysis.md')), false)
})
```

(Use os helpers já presentes no arquivo de teste para criar/limpar tmp.)

- [ ] **Step 2: Rodar testes — devem falhar**

```bash
node --test lib/local-store.test.mjs
```

Esperado: FAIL (arquivos ainda são gerados).

- [ ] **Step 3: Editar `lib/local-store.mjs`**

Remova as funções `buildScreenJustificationsMd` e `buildAnalysisMd`. No `bootstrapLocalStore`, remova as duas linhas:

```js
writeIfMissing(join(root, 'screen-justifications.md'), buildScreenJustificationsMd(manifest) + '\n')
writeIfMissing(join(root, 'analysis.md'), buildAnalysisMd(manifest) + '\n')
```

Mantenha intactos: `metadata.json`, `problem-statement.md`, `flows.md` (este permanece — descreve estrutura factual dos fluxos), `anchors.json`, pasta `references/`.

- [ ] **Step 4: Rodar testes — devem passar**

```bash
node --test lib/local-store.test.mjs
```

Esperado: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/local-store.mjs lib/local-store.test.mjs
git commit -m "refactor(lib): drop screen-justifications.md and analysis.md from local store"
```

---

### Task 7: `lib/analyze-helpers.mjs` — `AnalyzeError` + validators dos outputs da IA

Cria o esqueleto do módulo + os 3 validators (`validateScreenJustification`, `validateFinalAnalysis`, `validateGapCheck`).

**Files:**
- Create: `lib/analyze-helpers.mjs`
- Create: `lib/analyze-helpers.test.mjs`

- [ ] **Step 1: Escrever testes para `AnalyzeError` e validators**

Crie `lib/analyze-helpers.test.mjs`:

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  AnalyzeError,
  validateScreenJustification,
  validateFinalAnalysis,
  validateGapCheck,
} from './analyze-helpers.mjs'

test('AnalyzeError carries code and details', () => {
  const e = new AnalyzeError('boom', { code: 'TEST_CODE', details: { foo: 1 } })
  assert.equal(e.name, 'AnalyzeError')
  assert.equal(e.message, 'boom')
  assert.equal(e.code, 'TEST_CODE')
  assert.deepEqual(e.details, { foo: 1 })
})

test('validateScreenJustification trims and accepts ≤240 chars', () => {
  assert.equal(validateScreenJustification('  hello world  '), 'hello world')
})

test('validateScreenJustification truncates >240 chars with warning code', () => {
  const long = 'a'.repeat(300)
  const out = validateScreenJustification(long)
  assert.equal(out.length, 240)
})

test('validateScreenJustification throws on non-string or empty', () => {
  assert.throws(() => validateScreenJustification(''), (e) => e.code === 'JUSTIFICATION_EMPTY')
  assert.throws(() => validateScreenJustification(null), (e) => e.code === 'JUSTIFICATION_INVALID_TYPE')
  assert.throws(() => validateScreenJustification('   '), (e) => e.code === 'JUSTIFICATION_EMPTY')
})

test('validateFinalAnalysis accepts a well-formed object', () => {
  const ok = {
    resolution: 'A.', validation: 'B.', attention: 'C.', discussion: 'D.',
  }
  assert.deepEqual(validateFinalAnalysis(ok), ok)
})

test('validateFinalAnalysis throws on missing key', () => {
  assert.throws(() => validateFinalAnalysis({ resolution: 'A.', validation: 'B.', attention: 'C.' }),
    (e) => e.code === 'FINAL_ANALYSIS_MISSING_KEY')
})

test('validateFinalAnalysis throws on non-string value', () => {
  assert.throws(() => validateFinalAnalysis({ resolution: 1, validation: 'B', attention: 'C', discussion: 'D' }),
    (e) => e.code === 'FINAL_ANALYSIS_MISSING_KEY')
})

test('validateFinalAnalysis truncates each value to 600 chars', () => {
  const big = { resolution: 'a'.repeat(800), validation: 'b', attention: 'c', discussion: 'd' }
  const out = validateFinalAnalysis(big)
  assert.equal(out.resolution.length, 600)
  assert.equal(out.validation, 'b')
})

test('validateGapCheck accepts well-formed object', () => {
  const ok = {
    summary: 'No gaps.',
    gaps: [{ kind: 'missing', ticketAspect: 'X', evidence: 'Y' }],
  }
  assert.deepEqual(validateGapCheck(ok), ok)
})

test('validateGapCheck rejects invalid gap.kind', () => {
  assert.throws(() => validateGapCheck({
    summary: 'S', gaps: [{ kind: 'bogus', ticketAspect: 'X', evidence: 'Y' }],
  }), (e) => e.code === 'GAP_CHECK_INVALID_GAP')
})

test('validateGapCheck rejects gap with missing fields', () => {
  assert.throws(() => validateGapCheck({
    summary: 'S', gaps: [{ kind: 'missing', ticketAspect: 'X' }],
  }), (e) => e.code === 'GAP_CHECK_INVALID_GAP')
})

test('validateGapCheck rejects missing summary', () => {
  assert.throws(() => validateGapCheck({ gaps: [] }),
    (e) => e.code === 'GAP_CHECK_INVALID_JSON')
})

test('validateGapCheck accepts empty gaps array', () => {
  const ok = { summary: 'All good.', gaps: [] }
  assert.deepEqual(validateGapCheck(ok), ok)
})
```

- [ ] **Step 2: Rodar testes — devem falhar (módulo não existe)**

```bash
node --test lib/analyze-helpers.test.mjs
```

Esperado: FAIL com `Cannot find module './analyze-helpers.mjs'`.

- [ ] **Step 3: Implementar `lib/analyze-helpers.mjs` (esqueleto + validators)**

Crie `lib/analyze-helpers.mjs`:

```js
// Pure helpers for /meet-criteria-analyze. No I/O, no Figma runtime dependency
// — all builders return strings of JS to be passed to figma_execute by the
// orchestrating skill. Validators throw structured AnalyzeError on bad input.

export class AnalyzeError extends Error {
  constructor(message, { code = 'UNKNOWN', details = null } = {}) {
    super(message)
    this.name = 'AnalyzeError'
    this.code = code
    this.details = details
  }
}

const SCREEN_JUSTIFICATION_MAX = 240
const FINAL_SECTION_MAX = 600
const GAP_CHECK_FORMATTED_MAX = 800
const GAP_KINDS = new Set(['missing', 'ambiguous', 'extra'])

export function validateScreenJustification(text) {
  if (typeof text !== 'string') {
    throw new AnalyzeError('screen justification must be a string', { code: 'JUSTIFICATION_INVALID_TYPE' })
  }
  const trimmed = text.trim()
  if (trimmed === '') {
    throw new AnalyzeError('screen justification is empty', { code: 'JUSTIFICATION_EMPTY' })
  }
  return trimmed.length > SCREEN_JUSTIFICATION_MAX
    ? trimmed.slice(0, SCREEN_JUSTIFICATION_MAX)
    : trimmed
}

const FINAL_KEYS = ['resolution', 'validation', 'attention', 'discussion']

export function validateFinalAnalysis(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
    throw new AnalyzeError('final analysis must be an object', { code: 'FINAL_ANALYSIS_INVALID_JSON' })
  }
  const out = {}
  for (const key of FINAL_KEYS) {
    const v = obj[key]
    if (typeof v !== 'string' || v.trim() === '') {
      throw new AnalyzeError(`final analysis is missing key "${key}"`, {
        code: 'FINAL_ANALYSIS_MISSING_KEY', details: { key },
      })
    }
    const trimmed = v.trim()
    out[key] = trimmed.length > FINAL_SECTION_MAX ? trimmed.slice(0, FINAL_SECTION_MAX) : trimmed
  }
  return out
}

export function validateGapCheck(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
    throw new AnalyzeError('gap-check must be an object', { code: 'GAP_CHECK_INVALID_JSON' })
  }
  if (typeof obj.summary !== 'string' || obj.summary.trim() === '') {
    throw new AnalyzeError('gap-check.summary missing', { code: 'GAP_CHECK_INVALID_JSON' })
  }
  if (!Array.isArray(obj.gaps)) {
    throw new AnalyzeError('gap-check.gaps must be an array', { code: 'GAP_CHECK_INVALID_JSON' })
  }
  for (const [i, g] of obj.gaps.entries()) {
    if (!g || typeof g !== 'object' || !GAP_KINDS.has(g.kind)) {
      throw new AnalyzeError(`gap-check.gaps[${i}].kind invalid`, {
        code: 'GAP_CHECK_INVALID_GAP', details: { index: i, kind: g?.kind },
      })
    }
    if (typeof g.ticketAspect !== 'string' || g.ticketAspect.trim() === '' ||
        typeof g.evidence !== 'string' || g.evidence.trim() === '') {
      throw new AnalyzeError(`gap-check.gaps[${i}] missing ticketAspect or evidence`, {
        code: 'GAP_CHECK_INVALID_GAP', details: { index: i },
      })
    }
  }
  return {
    summary: obj.summary.trim(),
    gaps: obj.gaps.map((g) => ({
      kind: g.kind,
      ticketAspect: g.ticketAspect.trim(),
      evidence: g.evidence.trim(),
    })),
  }
}
```

- [ ] **Step 4: Rodar testes — devem passar**

```bash
node --test lib/analyze-helpers.test.mjs
```

Esperado: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/analyze-helpers.mjs lib/analyze-helpers.test.mjs
git commit -m "feat(lib): add AnalyzeError and AI output validators"
```

---

### Task 8: `formatGapCheckForFigma` — markdown compacto ≤800 chars

**Files:**
- Modify: `lib/analyze-helpers.mjs` (adicionar export)
- Modify: `lib/analyze-helpers.test.mjs`

- [ ] **Step 1: Adicionar testes**

Em `lib/analyze-helpers.test.mjs`:

```js
import { formatGapCheckForFigma } from './analyze-helpers.mjs'

test('formatGapCheckForFigma renders summary + bullet list', () => {
  const out = formatGapCheckForFigma({
    summary: 'Two gaps detected.',
    gaps: [
      { kind: 'missing', ticketAspect: '2FA confirmation', evidence: 'No screen shows it.' },
      { kind: 'ambiguous', ticketAspect: 'Granular permissions', evidence: 'Only a global toggle appears.' },
    ],
  })
  assert.match(out, /^Two gaps detected\./)
  assert.match(out, /\[MISSING\] 2FA confirmation/)
  assert.match(out, /\[AMBIGUOUS\] Granular permissions/)
})

test('formatGapCheckForFigma handles empty gaps', () => {
  const out = formatGapCheckForFigma({ summary: 'No gaps.', gaps: [] })
  assert.equal(out, 'No gaps.')
})

test('formatGapCheckForFigma truncates above 800 chars with ellipsis', () => {
  const big = {
    summary: 'A'.repeat(200),
    gaps: Array.from({ length: 30 }, (_, i) => ({
      kind: 'missing', ticketAspect: 'aspect ' + i, evidence: 'B'.repeat(50),
    })),
  }
  const out = formatGapCheckForFigma(big)
  assert.ok(out.length <= 800, `length ${out.length}`)
  assert.match(out, /…$/)
})
```

- [ ] **Step 2: Rodar testes — devem falhar (`formatGapCheckForFigma` não existe)**

```bash
node --test lib/analyze-helpers.test.mjs
```

Esperado: FAIL.

- [ ] **Step 3: Implementar `formatGapCheckForFigma`**

Adicione em `lib/analyze-helpers.mjs`:

```js
export function formatGapCheckForFigma(gapCheck) {
  // Caller is expected to have passed gapCheck through validateGapCheck.
  const header = gapCheck.summary
  if (gapCheck.gaps.length === 0) return header
  const lines = [header, '']
  for (const g of gapCheck.gaps) {
    lines.push(`• [${g.kind.toUpperCase()}] ${g.ticketAspect} — ${g.evidence}`)
  }
  const out = lines.join('\n')
  if (out.length <= GAP_CHECK_FORMATTED_MAX) return out
  // Hard truncate with ellipsis. Caller has been warned at validation step
  // that summary alone is fine; bullet overflow indicates too many gaps.
  return out.slice(0, GAP_CHECK_FORMATTED_MAX - 1) + '…'
}
```

- [ ] **Step 4: Rodar testes — devem passar**

```bash
node --test lib/analyze-helpers.test.mjs
```

Esperado: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/analyze-helpers.mjs lib/analyze-helpers.test.mjs
git commit -m "feat(lib): add formatGapCheckForFigma for compact markdown rendering"
```

---

### Task 9: `planMigration` — calcula layout delta para deliverables antigos

Função pura que recebe um relatório de slots (vindo da listagem em runtime) e a presença/ausência da sub-seção `gap-check`, e devolve o `layoutDelta` que será passado a `buildMigrateLayoutJs`. Retorna `null` quando nada a fazer.

**Files:**
- Modify: `lib/analyze-helpers.mjs`
- Modify: `lib/analyze-helpers.test.mjs`

- [ ] **Step 1: Adicionar testes**

```js
import { planMigration } from './analyze-helpers.mjs'

test('planMigration returns null when nothing to do', () => {
  const slotsReport = {
    sectionId: 'sec1',
    rowsHeight: 1000,
    flows: [
      { flowId: 'flow-1', y: 280, slots: [
        { flowId: 'flow-1', screenIndex: 0, tagId: 't1', slotId: 's1', justificationId: 'j1', justification: { x: 0, y: 0, width: 0, height: 0 } },
      ]},
    ],
    sideCardIds: { problemStatement: 'p1', analysisOverview: 'a1' },
  }
  const out = planMigration({ slotsReport, hasGapCheck: true })
  assert.equal(out, null)
})

test('planMigration adds justifications for slots that lack them', () => {
  const slotsReport = {
    sectionId: 'sec1',
    rowsHeight: 1000,
    flows: [
      { flowId: 'flow-1', y: 280, slots: [
        { flowId: 'flow-1', screenIndex: 0, tagId: 't1', slotId: 's1', justificationId: null,
          placeholderRect: { x: 100, y: 200, width: 390, height: 844 } },
      ]},
    ],
    sideCardIds: { problemStatement: 'p1', analysisOverview: 'a1' },
    analysisOverviewId: 'a1',
    flowRowYs: [280],
  }
  const delta = planMigration({ slotsReport, hasGapCheck: true })
  assert.ok(delta)
  assert.equal(delta.addJustifications.length, 1)
  assert.equal(delta.addJustifications[0].flowId, 'flow-1')
  assert.equal(delta.addJustifications[0].screenIndex, 0)
  assert.equal(delta.addJustifications[0].x, 100)
  assert.equal(delta.addJustifications[0].y, 200 + 844 + 16) // IPHONE_TO_JUSTIFICATION_GAP
  assert.equal(delta.addJustifications[0].width, 390)
  assert.equal(delta.addJustifications[0].height, 120) // JUSTIFICATION_HEIGHT
  assert.equal(delta.addGapCheckSubsection, null)
})

test('planMigration shifts subsequent flow rows and grows section', () => {
  const slotsReport = {
    sectionId: 'sec1',
    rowsHeight: 2000,
    sectionHeight: 2560,
    flows: [
      { flowId: 'flow-1', y: 280, slots: [
        { flowId: 'flow-1', screenIndex: 0, tagId: 't1', slotId: null, justificationId: null,
          placeholderRect: { x: 100, y: 200, width: 390, height: 844 } },
      ]},
      { flowId: 'flow-2', y: 1500, slots: [
        { flowId: 'flow-2', screenIndex: 0, tagId: 't2', slotId: null, justificationId: 'j2',
          placeholderRect: { x: 100, y: 1700, width: 390, height: 844 } },
      ]},
    ],
    sideCardIds: { problemStatement: 'p1', analysisOverview: 'a1' },
    analysisOverviewId: 'a1',
    flowRowYs: [280, 1500],
    flowChildIds: { 'flow-1': ['t1', 'b1'], 'flow-2': ['t2', 'b2', 'j2'] },
  }
  const delta = planMigration({ slotsReport, hasGapCheck: true })
  assert.equal(delta.addJustifications.length, 1) // only flow-1 needed
  assert.equal(delta.addJustifications[0].flowId, 'flow-1')
  // flow-2 must shift down by JUSTIFICATION_HEIGHT + IPHONE_TO_JUSTIFICATION_GAP = 136
  assert.deepEqual(delta.shiftBelow, [
    { childIds: ['t2', 'b2', 'j2'], deltaY: 136 },
  ])
  // section grows by 1 row * 136
  assert.equal(delta.growSection.newHeight, 2560 + 136)
  // side cards grow proportionally
  assert.equal(delta.resizeSideCards.problemStatement.height, 2000 + 136)
  assert.equal(delta.resizeSideCards.analysisOverview.height, 2000 + 136)
})

test('planMigration adds gap-check subsection when missing', () => {
  const slotsReport = {
    sectionId: 'sec1', rowsHeight: 1000, sectionHeight: 1560,
    flows: [{ flowId: 'flow-1', y: 280, slots: [
      { flowId: 'flow-1', screenIndex: 0, tagId: 't1', slotId: 's1', justificationId: 'j1' },
    ]}],
    sideCardIds: { problemStatement: 'p1', analysisOverview: 'a1' },
    analysisOverviewId: 'a1',
    flowRowYs: [280],
  }
  const delta = planMigration({ slotsReport, hasGapCheck: false })
  assert.ok(delta.addGapCheckSubsection)
  assert.equal(delta.addGapCheckSubsection.analysisOverviewId, 'a1')
  assert.equal(delta.addGapCheckSubsection.key, 'gap-check')
  assert.equal(delta.addGapCheckSubsection.heading, 'Gap check vs ticket')
})
```

- [ ] **Step 2: Rodar testes — devem falhar**

```bash
node --test lib/analyze-helpers.test.mjs
```

Esperado: FAIL.

- [ ] **Step 3: Implementar `planMigration`**

Adicione em `lib/analyze-helpers.mjs` (no topo, próximo às outras constantes):

```js
import { LAYOUT_CONSTANTS } from './layout-feature.mjs'

const ROW_DELTA = LAYOUT_CONSTANTS.JUSTIFICATION_HEIGHT + LAYOUT_CONSTANTS.IPHONE_TO_JUSTIFICATION_GAP

export function planMigration({ slotsReport, hasGapCheck }) {
  const addJustifications = []
  const shiftBelow = []

  // Track which flows lack at least one justification — they cause subsequent
  // flow rows to shift downward.
  const flowsNeedingGrow = new Set()

  for (const flow of slotsReport.flows) {
    let flowNeeds = false
    for (const slot of flow.slots) {
      if (slot.justificationId) continue
      const ph = slot.placeholderRect
      if (!ph) continue
      addJustifications.push({
        flowId: slot.flowId,
        screenIndex: slot.screenIndex,
        x: ph.x,
        y: ph.y + ph.height + LAYOUT_CONSTANTS.IPHONE_TO_JUSTIFICATION_GAP,
        width: ph.width,
        height: LAYOUT_CONSTANTS.JUSTIFICATION_HEIGHT,
      })
      flowNeeds = true
    }
    if (flowNeeds) flowsNeedingGrow.add(flow.flowId)
  }

  // For each flow that gained justifications, shift all flows BELOW it by ROW_DELTA.
  // Cumulative: if both flow-1 and flow-2 grow, flow-3 shifts by 2 * ROW_DELTA.
  let cumulativeShift = 0
  for (const flow of slotsReport.flows) {
    if (cumulativeShift > 0 && slotsReport.flowChildIds?.[flow.flowId]) {
      shiftBelow.push({ childIds: slotsReport.flowChildIds[flow.flowId], deltaY: cumulativeShift })
    }
    if (flowsNeedingGrow.has(flow.flowId)) cumulativeShift += ROW_DELTA
  }

  const totalGrowth = ROW_DELTA * flowsNeedingGrow.size

  const addGapCheckSubsection = hasGapCheck ? null : {
    analysisOverviewId: slotsReport.analysisOverviewId,
    key: 'gap-check',
    heading: 'Gap check vs ticket',
    body: 'Run /meet-criteria-analyze to compare the ticket against the delivered screens.',
  }

  if (addJustifications.length === 0 && !addGapCheckSubsection) {
    return null
  }

  return {
    addJustifications,
    shiftBelow,
    growSection: totalGrowth > 0
      ? { newHeight: (slotsReport.sectionHeight ?? 0) + totalGrowth }
      : null,
    resizeSideCards: totalGrowth > 0 ? {
      problemStatement: { id: slotsReport.sideCardIds.problemStatement, height: slotsReport.rowsHeight + totalGrowth },
      analysisOverview: { id: slotsReport.sideCardIds.analysisOverview, height: slotsReport.rowsHeight + totalGrowth },
    } : null,
    addGapCheckSubsection,
  }
}
```

- [ ] **Step 4: Rodar testes — devem passar**

```bash
node --test lib/analyze-helpers.test.mjs
```

Esperado: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/analyze-helpers.mjs lib/analyze-helpers.test.mjs
git commit -m "feat(lib): add planMigration for legacy deliverable layout deltas"
```

---

### Task 10: `buildDetectDeliverableJs` — JS para localizar o deliverable no Figma

Builder retorna string de JS que roda dentro de `figma_execute`. O JS retorna JSON com `{ found, ticketRef, slug, type, sectionId, pageId, ambiguous }`.

**Files:**
- Modify: `lib/analyze-helpers.mjs`
- Modify: `lib/analyze-helpers.test.mjs`

- [ ] **Step 1: Adicionar testes (presença + sintaxe via `node:vm`)**

```js
import vm from 'node:vm'
import { buildDetectDeliverableJs } from './analyze-helpers.mjs'

function assertParseable(js) {
  // Wrap as async function body so top-level `await` parses.
  const src = `(async () => { ${js} })`
  assert.doesNotThrow(() => new vm.Script(src), `JS must parse: ${js.slice(0, 200)}...`)
}

test('buildDetectDeliverableJs returns parseable JS', () => {
  const js = buildDetectDeliverableJs({ slug: null })
  assertParseable(js)
  assert.match(js, /loadAllPagesAsync/)
  assert.match(js, /getSharedPluginData\(['"]meetCriteria['"], ['"]role['"]\)/)
  assert.match(js, /'root'/)
})

test('buildDetectDeliverableJs includes slug filter when provided', () => {
  const js = buildDetectDeliverableJs({ slug: 'prod-1234' })
  assert.match(js, /prod-1234/)
})

test('buildDetectDeliverableJs without slug only scans current page', () => {
  const js = buildDetectDeliverableJs({ slug: null })
  assert.match(js, /figma\.currentPage/)
})
```

- [ ] **Step 2: Rodar testes — devem falhar**

```bash
node --test lib/analyze-helpers.test.mjs
```

Esperado: FAIL.

- [ ] **Step 3: Implementar `buildDetectDeliverableJs`**

Adicione em `lib/analyze-helpers.mjs`:

```js
function jsonStringify(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c')
}

export function buildDetectDeliverableJs({ slug = null } = {}) {
  const slugLiteral = jsonStringify(slug)
  return `
const TARGET_SLUG = ${slugLiteral}
await figma.loadAllPagesAsync()

function readMeta(node) {
  const role = node.getSharedPluginData('meetCriteria', 'role')
  if (role !== 'root') return null
  return {
    sectionId: node.id,
    pageId: node.parent && node.parent.id,
    ticketRef: node.getSharedPluginData('meetCriteria', 'ticketRef'),
    slug: (node.getSharedPluginData('meetCriteria', 'config') || '').includes('"slug"')
      ? (JSON.parse(node.getSharedPluginData('meetCriteria', 'config')).slug || '')
      : '',
    type: node.getSharedPluginData('meetCriteria', 'type'),
  }
}

const candidates = []
const scope = TARGET_SLUG
  ? figma.root.children.flatMap((p) => p.children)
  : figma.currentPage.children
for (const node of scope) {
  const meta = readMeta(node)
  if (!meta) continue
  if (TARGET_SLUG && meta.slug !== TARGET_SLUG && meta.ticketRef !== TARGET_SLUG) continue
  candidates.push(meta)
}

if (candidates.length === 0) {
  return JSON.stringify({ found: false })
}
if (candidates.length > 1) {
  return JSON.stringify({ found: true, ambiguous: true, candidates })
}
return JSON.stringify({ found: true, ambiguous: false, ...candidates[0] })
`
}
```

> Nota sobre `slug` no plugin data: a manifesto v2 guarda o slug dentro de `section.pluginData.config` como JSON. Se essa estrutura mudar, ajustar `readMeta`. Para evitar fragilidade, a Task 13 também escreve `slug` direto na chave `slug` quando rotular `lastAnalyzedAt`. (Veja Task 13.)

- [ ] **Step 4: Rodar testes — devem passar**

```bash
node --test lib/analyze-helpers.test.mjs
```

Esperado: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/analyze-helpers.mjs lib/analyze-helpers.test.mjs
git commit -m "feat(lib): add buildDetectDeliverableJs for Figma deliverable lookup"
```

---

### Task 11: `buildListSlotsJs` — JS para listar slots e detectar conteúdo

Retorna JSON com a estrutura consumida por `planMigration` + por `buildWriteJustificationsJs`.

**Files:**
- Modify: `lib/analyze-helpers.mjs`
- Modify: `lib/analyze-helpers.test.mjs`

- [ ] **Step 1: Adicionar testes**

```js
import { buildListSlotsJs } from './analyze-helpers.mjs'

test('buildListSlotsJs returns parseable JS that scans by role', () => {
  const js = buildListSlotsJs({ sectionId: 'abc:123' })
  assertParseable(js)
  assert.match(js, /abc:123/)
  assert.match(js, /'screen-tag'/)
  assert.match(js, /'screen-slot'/)
  assert.match(js, /'screen-justification'/)
  assert.match(js, /'analysis-overview'/)
  assert.match(js, /'analysis-section'/)
})

test('buildListSlotsJs throws on missing sectionId', () => {
  assert.throws(() => buildListSlotsJs({}),
    (e) => e.code === 'MISSING_SECTION_ID')
})
```

- [ ] **Step 2: Rodar — devem falhar**

```bash
node --test lib/analyze-helpers.test.mjs
```

- [ ] **Step 3: Implementar `buildListSlotsJs`**

```js
export function buildListSlotsJs({ sectionId } = {}) {
  if (!sectionId || typeof sectionId !== 'string') {
    throw new AnalyzeError('sectionId is required', { code: 'MISSING_SECTION_ID' })
  }
  const idLit = jsonStringify(sectionId)
  return `
await figma.loadAllPagesAsync()
const section = await figma.getNodeByIdAsync(${idLit})
if (!section) return JSON.stringify({ error: 'SECTION_NOT_FOUND' })

function meta(node, key) { return node.getSharedPluginData('meetCriteria', key) }
function role(node) { return meta(node, 'role') }
function intMeta(node, key) {
  const v = meta(node, key)
  return v === '' ? null : Number(v)
}

const tagsBySlot = new Map() // key = flowId|screenIndex
const slotsBySlot = new Map()
const justBySlot = new Map()
const slotKey = (f, i) => f + '|' + i

let analysisOverviewId = null
let analysisSubsectionKeys = []
const sideCardIds = { problemStatement: null, analysisOverview: null }

const flowMeta = new Map() // flowId -> { id, y, childIds: [] }

function visit(node) {
  const r = role(node)
  if (r === 'screen-tag') {
    const fid = meta(node, 'flowId')
    const idx = intMeta(node, 'screenIndex')
    tagsBySlot.set(slotKey(fid, idx), { id: node.id, flowId: fid, screenIndex: idx })
  } else if (r === 'screen-slot') {
    const fid = meta(node, 'flowId')
    const idx = intMeta(node, 'screenIndex')
    slotsBySlot.set(slotKey(fid, idx), { id: node.id, flowId: fid, screenIndex: idx,
      x: node.x, y: node.y, width: node.width, height: node.height })
  } else if (r === 'screen-justification') {
    const fid = meta(node, 'flowId')
    const idx = intMeta(node, 'screenIndex')
    justBySlot.set(slotKey(fid, idx), { id: node.id, flowId: fid, screenIndex: idx,
      x: node.x, y: node.y, width: node.width, height: node.height })
  } else if (r === 'analysis-overview') {
    analysisOverviewId = node.id
    sideCardIds.analysisOverview = node.id
    if (node.children) {
      for (const c of node.children) {
        if (role(c) === 'analysis-section') {
          analysisSubsectionKeys.push(meta(c, 'key'))
        }
      }
    }
  } else if (r === 'problem-statement') {
    sideCardIds.problemStatement = node.id
  } else if (r === 'flow') {
    const fid = meta(node, 'flowId')
    flowMeta.set(fid, { id: node.id, y: node.y, childIds: [] })
  }
  if (node.children) for (const c of node.children) visit(c)
}
visit(section)

// Build per-flow slot list, ordered by screenIndex.
const flowsOut = []
for (const [fid, fInfo] of flowMeta.entries()) {
  const slots = []
  const keys = [...new Set([...tagsBySlot.keys(), ...slotsBySlot.keys(), ...justBySlot.keys()])]
    .filter((k) => k.startsWith(fid + '|'))
    .sort((a, b) => Number(a.split('|')[1]) - Number(b.split('|')[1]))
  for (const k of keys) {
    const tag = tagsBySlot.get(k)
    const slot = slotsBySlot.get(k)
    const jus = justBySlot.get(k)
    if (!tag) continue
    slots.push({
      flowId: fid,
      screenIndex: tag.screenIndex,
      tagId: tag.id,
      slotId: slot ? slot.id : null,
      slotRect: slot ? { x: slot.x, y: slot.y, width: slot.width, height: slot.height } : null,
      justificationId: jus ? jus.id : null,
      placeholderRect: slot ? { x: slot.x, y: slot.y, width: slot.width, height: slot.height } : null,
    })
  }
  flowsOut.push({ flowId: fid, y: fInfo.y, slots })
}

return JSON.stringify({
  sectionId: section.id,
  sectionHeight: section.height,
  flows: flowsOut,
  analysisOverviewId,
  analysisSubsectionKeys,
  sideCardIds,
  rowsHeight: sideCardIds.problemStatement
    ? (await figma.getNodeByIdAsync(sideCardIds.problemStatement)).height
    : 0,
})
`
}
```

> A skill recebe esse JSON e tem responsabilidade de derivar `flowChildIds` e `flowRowYs` antes de chamar `planMigration`, ou pode pedir um JS adicional. Para este MVP, o JS já devolve o suficiente: a skill monta `flowChildIds` se necessário (raramente — só em deliverables onde `addJustifications.length > 0` E houver flow row abaixo da que cresceu).

> **Limitação aceita do MVP:** o JS atual não devolve `flowChildIds`. A Task 12 (`buildMigrateLayoutJs`) calcula essas associações em runtime no próprio JS (mais simples do que round-tripar).

- [ ] **Step 4: Rodar testes — devem passar**

```bash
node --test lib/analyze-helpers.test.mjs
```

- [ ] **Step 5: Commit**

```bash
git add lib/analyze-helpers.mjs lib/analyze-helpers.test.mjs
git commit -m "feat(lib): add buildListSlotsJs for slot inventory by plugin-data"
```

---

### Task 12: `buildMigrateLayoutJs` — aplica delta de layout em batch

Aplica `addJustifications`, `shiftBelow`, `growSection`, `resizeSideCards` e `addGapCheckSubsection` numa única chamada de `figma_execute`. Idempotente (skip se nó já existe).

**Files:**
- Modify: `lib/analyze-helpers.mjs`
- Modify: `lib/analyze-helpers.test.mjs`

- [ ] **Step 1: Adicionar testes**

```js
import { buildMigrateLayoutJs } from './analyze-helpers.mjs'

test('buildMigrateLayoutJs returns parseable JS', () => {
  const js = buildMigrateLayoutJs({
    sectionId: 'sec1',
    layoutDelta: {
      addJustifications: [{ flowId: 'flow-1', screenIndex: 0, x: 100, y: 200, width: 390, height: 120 }],
      shiftBelow: [{ childIds: ['c1', 'c2'], deltaY: 136 }],
      growSection: { newHeight: 2696 },
      resizeSideCards: {
        problemStatement: { id: 'p1', height: 2136 },
        analysisOverview: { id: 'a1', height: 2136 },
      },
      addGapCheckSubsection: { analysisOverviewId: 'a1', key: 'gap-check', heading: 'Gap check vs ticket', body: 'Run /meet-criteria-analyze ...' },
    },
  })
  assertParseable(js)
  assert.match(js, /createText/)
  assert.match(js, /screen-justification/)
  assert.match(js, /analysis-section/)
  assert.match(js, /loadFontAsync/)
})

test('buildMigrateLayoutJs throws on missing sectionId', () => {
  assert.throws(() => buildMigrateLayoutJs({ layoutDelta: { addJustifications: [] } }),
    (e) => e.code === 'MISSING_SECTION_ID')
})

test('buildMigrateLayoutJs throws on missing layoutDelta', () => {
  assert.throws(() => buildMigrateLayoutJs({ sectionId: 'sec1' }),
    (e) => e.code === 'MISSING_LAYOUT_DELTA')
})
```

- [ ] **Step 2: Rodar — devem falhar**

```bash
node --test lib/analyze-helpers.test.mjs
```

- [ ] **Step 3: Implementar `buildMigrateLayoutJs`**

Adicione em `lib/analyze-helpers.mjs`:

```js
export function buildMigrateLayoutJs({ sectionId, layoutDelta } = {}) {
  if (!sectionId) throw new AnalyzeError('sectionId required', { code: 'MISSING_SECTION_ID' })
  if (!layoutDelta) throw new AnalyzeError('layoutDelta required', { code: 'MISSING_LAYOUT_DELTA' })

  const deltaLit = jsonStringify(layoutDelta)
  const sectionLit = jsonStringify(sectionId)

  return `
await figma.loadAllPagesAsync()
await figma.loadFontAsync({ family: 'Inter', style: 'Regular' })
await figma.loadFontAsync({ family: 'Inter', style: 'Semi Bold' })

const SECTION_ID = ${sectionLit}
const DELTA = ${deltaLit}
const section = await figma.getNodeByIdAsync(SECTION_ID)
if (!section) return JSON.stringify({ error: 'SECTION_NOT_FOUND' })

function setPD(node, data) {
  for (const [k, v] of Object.entries(data || {})) {
    const value = (typeof v === 'object' && v !== null) ? JSON.stringify(v) : String(v)
    node.setSharedPluginData('meetCriteria', k, value)
  }
}

// 1) Add missing screen-justification text nodes (idempotent: skip if any
//    sibling already carries the same flowId/screenIndex with that role).
const existingJustifications = new Set()
function visit(node) {
  if (node.getSharedPluginData('meetCriteria', 'role') === 'screen-justification') {
    const k = node.getSharedPluginData('meetCriteria', 'flowId') + '|' +
              node.getSharedPluginData('meetCriteria', 'screenIndex')
    existingJustifications.add(k)
  }
  if (node.children) for (const c of node.children) visit(c)
}
visit(section)

const created = []
for (const j of (DELTA.addJustifications || [])) {
  const key = j.flowId + '|' + j.screenIndex
  if (existingJustifications.has(key)) continue
  const t = figma.createText()
  t.fontName = { family: 'Inter', style: 'Regular' }
  t.fontSize = 18
  t.lineHeight = { unit: 'PERCENT', value: 130 }
  t.characters = ''
  t.x = j.x
  t.y = j.y
  t.resize(j.width, j.height)
  t.textAutoResize = 'HEIGHT'
  t.name = 'Screen justification — ' + j.flowId + ' / ' + j.screenIndex
  setPD(t, { role: 'screen-justification', flowId: j.flowId, screenIndex: j.screenIndex })
  section.appendChild(t)
  created.push(t.id)
}

// 2) Shift specified children downward.
for (const op of (DELTA.shiftBelow || [])) {
  for (const id of op.childIds) {
    const node = await figma.getNodeByIdAsync(id)
    if (node && typeof node.y === 'number') node.y = node.y + op.deltaY
  }
}

// 3) Grow section.
if (DELTA.growSection) {
  section.resizeWithoutConstraints(section.width, DELTA.growSection.newHeight)
}

// 4) Resize side cards (height only).
if (DELTA.resizeSideCards) {
  for (const key of ['problemStatement', 'analysisOverview']) {
    const card = DELTA.resizeSideCards[key]
    if (!card) continue
    const node = await figma.getNodeByIdAsync(card.id)
    if (node) node.resize(node.width, card.height)
  }
}

// 5) Add gap-check sub-section if missing.
if (DELTA.addGapCheckSubsection) {
  const ao = await figma.getNodeByIdAsync(DELTA.addGapCheckSubsection.analysisOverviewId)
  if (ao && ao.children) {
    const exists = ao.children.find((c) =>
      c.getSharedPluginData('meetCriteria', 'role') === 'analysis-section' &&
      c.getSharedPluginData('meetCriteria', 'key') === DELTA.addGapCheckSubsection.key)
    if (!exists) {
      const sub = figma.createFrame()
      sub.name = 'Section — ' + DELTA.addGapCheckSubsection.key
      sub.layoutMode = 'VERTICAL'
      sub.itemSpacing = 20
      sub.fills = []
      const heading = figma.createText()
      heading.fontName = { family: 'Inter', style: 'Semi Bold' }
      heading.fontSize = 28
      heading.characters = DELTA.addGapCheckSubsection.heading
      heading.textAutoResize = 'HEIGHT'
      sub.appendChild(heading)
      heading.layoutSizingHorizontal = 'FILL'
      const body = figma.createText()
      body.fontName = { family: 'Inter', style: 'Regular' }
      body.fontSize = 20
      body.lineHeight = { unit: 'PERCENT', value: 120 }
      body.characters = DELTA.addGapCheckSubsection.body
      body.textAutoResize = 'HEIGHT'
      sub.appendChild(body)
      body.layoutSizingHorizontal = 'FILL'
      setPD(sub, { role: 'analysis-section', key: DELTA.addGapCheckSubsection.key })
      ao.appendChild(sub)
      sub.layoutSizingHorizontal = 'FILL'
      sub.layoutSizingVertical = 'HUG'
    }
  }
}

return JSON.stringify({ migrated: true, createdJustificationIds: created })
`
}
```

- [ ] **Step 4: Rodar testes — devem passar**

```bash
node --test lib/analyze-helpers.test.mjs
```

- [ ] **Step 5: Commit**

```bash
git add lib/analyze-helpers.mjs lib/analyze-helpers.test.mjs
git commit -m "feat(lib): add buildMigrateLayoutJs for legacy deliverable upgrades"
```

---

### Task 13: `buildWriteJustificationsJs` + `buildWriteAnalysisJs` + `buildStampAnalyzedAtJs`

Três builders de escrita. Designados para serem **concatenados** numa única chamada `figma_execute`.

**Files:**
- Modify: `lib/analyze-helpers.mjs`
- Modify: `lib/analyze-helpers.test.mjs`

- [ ] **Step 1: Adicionar testes**

```js
import {
  buildWriteJustificationsJs,
  buildWriteAnalysisJs,
  buildStampAnalyzedAtJs,
} from './analyze-helpers.mjs'

test('buildWriteJustificationsJs is parseable and references screen-justification', () => {
  const js = buildWriteJustificationsJs({ updates: [
    { flowId: 'flow-1', screenIndex: 0, text: 'Hello.' },
  ]})
  assertParseable(js)
  assert.match(js, /screen-justification/)
  assert.match(js, /Hello\./)
  assert.match(js, /loadFontAsync/)
})

test('buildWriteJustificationsJs throws on missing updates array', () => {
  assert.throws(() => buildWriteJustificationsJs({}),
    (e) => e.code === 'MISSING_UPDATES')
})

test('buildWriteAnalysisJs writes 5 sections', () => {
  const js = buildWriteAnalysisJs({
    analysisOverviewId: 'a1',
    sections: {
      resolution: 'A.', validation: 'B.', attention: 'C.', discussion: 'D.', gapCheck: 'No gaps.',
    },
  })
  assertParseable(js)
  for (const k of ['resolution', 'validation', 'attention', 'discussion', 'gap-check']) {
    assert.ok(js.includes(\`'\${k}'\`) || js.includes(\`"\${k}"\`), 'missing key ' + k)
  }
})

test('buildWriteAnalysisJs throws on missing required section', () => {
  assert.throws(() => buildWriteAnalysisJs({
    analysisOverviewId: 'a1',
    sections: { resolution: 'A.', validation: 'B.', attention: 'C.', discussion: 'D.' /* gapCheck missing */ },
  }), (e) => e.code === 'MISSING_SECTION_TEXT')
})

test('buildStampAnalyzedAtJs sets lastAnalyzedAt on root', () => {
  const js = buildStampAnalyzedAtJs({ sectionId: 's1', isoDate: '2026-05-02T00:00:00Z' })
  assertParseable(js)
  assert.match(js, /lastAnalyzedAt/)
  assert.match(js, /2026-05-02T00:00:00Z/)
})

test('buildStampAnalyzedAtJs throws on bad input', () => {
  assert.throws(() => buildStampAnalyzedAtJs({ sectionId: '', isoDate: '2026-05-02T00:00:00Z' }),
    (e) => e.code === 'MISSING_SECTION_ID')
  assert.throws(() => buildStampAnalyzedAtJs({ sectionId: 's1', isoDate: '' }),
    (e) => e.code === 'MISSING_ISO_DATE')
})
```

- [ ] **Step 2: Rodar — devem falhar**

```bash
node --test lib/analyze-helpers.test.mjs
```

- [ ] **Step 3: Implementar os 3 builders**

Adicione em `lib/analyze-helpers.mjs`:

```js
export function buildWriteJustificationsJs({ updates } = {}) {
  if (!Array.isArray(updates)) {
    throw new AnalyzeError('updates must be an array', { code: 'MISSING_UPDATES' })
  }
  for (const u of updates) {
    if (typeof u.flowId !== 'string' || typeof u.screenIndex !== 'number' || typeof u.text !== 'string') {
      throw new AnalyzeError('update entry malformed', { code: 'MALFORMED_UPDATE', details: u })
    }
  }
  const updatesLit = jsonStringify(updates)
  return `
await figma.loadAllPagesAsync()
await figma.loadFontAsync({ family: 'Inter', style: 'Regular' })

const UPDATES = ${updatesLit}
const byKey = new Map()
for (const u of UPDATES) byKey.set(u.flowId + '|' + u.screenIndex, u.text)

let written = 0
function visit(node) {
  if (node.getSharedPluginData('meetCriteria', 'role') === 'screen-justification') {
    const key = node.getSharedPluginData('meetCriteria', 'flowId') + '|' +
                node.getSharedPluginData('meetCriteria', 'screenIndex')
    if (byKey.has(key)) {
      node.characters = byKey.get(key)
      node.textAutoResize = 'HEIGHT'
      node.setSharedPluginData('meetCriteria', 'lastWrittenAt', new Date().toISOString())
      written++
    }
  }
  if (node.children) for (const c of node.children) visit(c)
}
for (const page of figma.root.children) visit(page)
return JSON.stringify({ writtenJustifications: written })
`
}

export function buildWriteAnalysisJs({ analysisOverviewId, sections } = {}) {
  if (!analysisOverviewId) {
    throw new AnalyzeError('analysisOverviewId required', { code: 'MISSING_AO_ID' })
  }
  const required = ['resolution', 'validation', 'attention', 'discussion', 'gapCheck']
  for (const k of required) {
    if (typeof sections?.[k] !== 'string') {
      throw new AnalyzeError(\`sections.\${k} missing\`, { code: 'MISSING_SECTION_TEXT', details: { key: k } })
    }
  }
  const aoLit = jsonStringify(analysisOverviewId)
  const mapLit = jsonStringify({
    resolution: sections.resolution,
    validation: sections.validation,
    attention: sections.attention,
    discussion: sections.discussion,
    'gap-check': sections.gapCheck,
  })
  return `
await figma.loadAllPagesAsync()
await figma.loadFontAsync({ family: 'Inter', style: 'Regular' })

const AO_ID = ${aoLit}
const TEXT_BY_KEY = ${mapLit}
const ao = await figma.getNodeByIdAsync(AO_ID)
if (!ao || !ao.children) return JSON.stringify({ error: 'AO_NOT_FOUND' })

let updated = 0
for (const sub of ao.children) {
  if (sub.getSharedPluginData('meetCriteria', 'role') !== 'analysis-section') continue
  const key = sub.getSharedPluginData('meetCriteria', 'key')
  if (!(key in TEXT_BY_KEY)) continue
  // Body is the second text node inside sub.
  const bodyTextNode = (sub.children || []).filter((n) => n.type === 'TEXT')[1]
  if (!bodyTextNode) continue
  bodyTextNode.characters = TEXT_BY_KEY[key]
  bodyTextNode.textAutoResize = 'HEIGHT'
  updated++
}
return JSON.stringify({ updatedSubsections: updated })
`
}

export function buildStampAnalyzedAtJs({ sectionId, isoDate } = {}) {
  if (!sectionId) throw new AnalyzeError('sectionId required', { code: 'MISSING_SECTION_ID' })
  if (!isoDate) throw new AnalyzeError('isoDate required', { code: 'MISSING_ISO_DATE' })
  const idLit = jsonStringify(sectionId)
  const dateLit = jsonStringify(isoDate)
  return `
await figma.loadAllPagesAsync()
const sec = await figma.getNodeByIdAsync(${idLit})
if (!sec) return JSON.stringify({ error: 'SECTION_NOT_FOUND' })
sec.setSharedPluginData('meetCriteria', 'lastAnalyzedAt', ${dateLit})
return JSON.stringify({ stamped: true })
`
}
```

- [ ] **Step 4: Rodar testes — devem passar**

```bash
node --test lib/analyze-helpers.test.mjs
```

- [ ] **Step 5: Commit**

```bash
git add lib/analyze-helpers.mjs lib/analyze-helpers.test.mjs
git commit -m "feat(lib): add write builders for justifications, analysis, and stamp"
```

---

### Task 14: Prompts — `prompts/analyze-{screen,final,gap-check}.md`

Templates carregados pela skill com placeholders `{{...}}` substituídos antes de cada chamada.

**Files:**
- Create: `prompts/analyze-screen.md`
- Create: `prompts/analyze-final.md`
- Create: `prompts/analyze-gap-check.md`

- [ ] **Step 1: Criar `prompts/analyze-screen.md`**

```markdown
# Analyze single screen

You are analyzing one screen from a design deliverable. Output a single English sentence (or two short sentences), max 240 characters, **no markdown, no prefix, no quotes**. Focus on what THIS specific screen does, not the entire flow.

## Ticket
**{{ticketRef}}**

{{ticketProblem}}

## Screen context
- Flow: {{flowName}}
- Screen #{{screenIndex}}
- Slot name: {{slotName}}
- Image: provided as the next message

## Your task
Explain how this specific screen contributes to solving the problem in the ticket. Be concrete: reference the visible UI (button, list, form, state) and link it to a ticket aspect.

Reply with ONLY the sentence(s).
```

- [ ] **Step 2: Criar `prompts/analyze-final.md`**

```markdown
# Final analysis (4 sections)

You are writing the closing analysis for a Meet Criteria deliverable. Output a **strict JSON object** with exactly these 4 keys: `resolution`, `validation`, `attention`, `discussion`. Each value is an English string (2–4 sentences, max 600 characters). **No markdown, no comments, no extra keys.**

## Ticket
**{{ticketRef}}**

{{ticketProblem}}

## Flows + screen justifications

{{flowsJustificationsAggregated}}

## Your task
Generate the JSON object:

- `resolution` — How the delivered set of screens resolves the ticket's problem.
- `validation` — Strong points / decisions that confirm the resolution works.
- `attention` — Risks, ambiguities, edge cases the team should be aware of.
- `discussion` — Open topics or trade-offs to align on during the review.

Reply with ONLY the JSON object, valid and parseable.
```

- [ ] **Step 3: Criar `prompts/analyze-gap-check.md`**

```markdown
# Gap check vs ticket

You are comparing what the ticket asks for against what the delivered screens actually show. Output a **strict JSON object** with these keys:

```json
{
  "summary": "<one English sentence introducing the result>",
  "gaps": [
    { "kind": "missing|ambiguous|extra", "ticketAspect": "<what the ticket asks>", "evidence": "<what the screens show or fail to show>" }
  ]
}
```

If no gaps, return `{ "summary": "All ticket aspects appear in the delivery.", "gaps": [] }`.

## Gap kinds
- `missing` — ticket asks for X, no screen shows it.
- `ambiguous` — ticket is vague about X; the screens commit to one interpretation but don't exhaust the alternatives.
- `extra` — screens show something outside the ticket scope (informational only, not a defect).

## Ticket
**{{ticketRef}}**

{{ticketProblem}}

## Flows + screen justifications

{{flowsJustificationsAggregated}}

Reply with ONLY the JSON object, valid and parseable. **No markdown, no extra keys.**
```

- [ ] **Step 4: Commit**

```bash
git add prompts/analyze-screen.md prompts/analyze-final.md prompts/analyze-gap-check.md
git commit -m "feat(prompts): add analyze-screen, analyze-final, analyze-gap-check templates"
```

---

### Task 15: `skills/analyzing-deliverables.md` — orquestrador

A skill conduz o agente passo a passo. Carrega prompts, chama `analyze-helpers` builders, executa via `figma_execute` / `figma_take_screenshot`, valida outputs, escreve em uma única chamada atômica no fim.

**Files:**
- Create: `skills/analyzing-deliverables.md`

- [ ] **Step 1: Criar a skill**

Crie `skills/analyzing-deliverables.md`:

```markdown
# analyzing-deliverables

Orquestra `/meet-criteria-analyze [<slug>]` em 11 passos. Use os helpers em `lib/analyze-helpers.mjs` para todo JS de Figma — não escreva JS solto na conversa.

## Passo 1 — Resolver o slug do deliverable

1. Se o usuário forneceu `<slug>` como argumento: pule para Passo 2.
2. Caso contrário, chame `node -e "console.log(require('./lib/analyze-helpers.mjs').buildDetectDeliverableJs({ slug: null }))"` (ou importe e gere via stdin) para obter o JS de detecção, e passe para `figma_execute` no plugin Bridge.
3. Se a resposta for `{ found: false }`: liste pastas em `.meet-criteria/` (`ls .meet-criteria/`) e use `AskUserQuestion` para o usuário escolher um slug. Se não houver pastas, abortar com erro claro.
4. Se a resposta for `{ found: true, ambiguous: true, candidates: [...] }`: use `AskUserQuestion` listando os `ticketRef`/`slug` candidatos.
5. Se a resposta for `{ found: true, ambiguous: false, ... }`: use diretamente.

## Passo 2 — Carregar `problem-statement.md`

Leia `.meet-criteria/<slug>/problem-statement.md` via Read. Se ausente ou vazio: aborte com mensagem orientando o usuário a (re)criar o deliverable via `/meet-criteria-new` ou colar manualmente o conteúdo.

## Passo 3 — Listar slots no Figma

Gere e execute `buildListSlotsJs({ sectionId })`. O resultado é o `slotsReport`.

## Passo 4 — Planejar migração

Compute `hasGapCheck = slotsReport.analysisSubsectionKeys.includes('gap-check')`. Chame `planMigration({ slotsReport, hasGapCheck })`. Se retornar `null`, pule para Passo 5. Se não:

1. Mostre via `AskUserQuestion` o que será migrado (X justificativas adicionadas, gap-check criado, section esticada por Yp). Opções: "Continuar" / "Cancelar" / "Pular migração e usar layout atual" (em modo skip a skill prossegue mas avisa que justificativas novas não serão escritas).
2. Se "Continuar": gere e execute `buildMigrateLayoutJs({ sectionId, layoutDelta })` via `figma_execute`. Após sucesso, re-execute `buildListSlotsJs` para obter o relatório atualizado (com IDs novos).

## Passo 5 — Detectar slots preenchidos vs vazios

Para cada slot em `slotsReport.flows[*].slots`: `slotId !== null` ⇒ preenchido. Caso contrário ⇒ vazio (justificativa permanecerá em branco).

Se nenhum slot tem `slotId`: aborte com `NO_FILLED_SLOTS` orientando o designer a colar telas via Paste-to-Replace.

## Passo 6 — Preview de custo + confirmação

Conte: N = slots preenchidos. Mostre via `AskUserQuestion`:
"Vou rodar N análises de tela + 1 análise final + 1 gap check. Continuar?"

Em auto mode (flag `--yes` no slash command, ou contexto de execução autônoma): pule confirmação e prossiga.

Se cancelar: aborte sem efeitos colaterais.

## Passo 7 — Loop de justificativa por slot

Para cada slot preenchido (em ordem `flowId, screenIndex`):

1. `figma_take_screenshot` no `slotId`.
2. Carregue `prompts/analyze-screen.md` via Read.
3. Substitua placeholders: `{{ticketRef}}`, `{{ticketProblem}}`, `{{flowName}}`, `{{screenIndex}}` (1-based para humanos), `{{slotName}}` (use `slotName` do tag se disponível, senão "Screen N").
4. Envie o prompt + a imagem para o agente (você mesmo).
5. Capture a resposta. Chame `validateScreenJustification(resposta)`. Se throw com `JUSTIFICATION_INVALID_TYPE` ou `JUSTIFICATION_EMPTY`, registre o slot como falho e siga (não aborte; a justificativa fica em branco).
6. Acumule em `justifications.push({ flowId, screenIndex, text })`.

## Passo 8 — Análise final

Monte `flowsJustificationsAggregated` como markdown:

```
### {{flowName}} (flow-id)
- Screen 1 — {{justification text}}
- Screen 2 — {{justification text or "(empty slot)"}}
```

Carregue `prompts/analyze-final.md`, substitua placeholders, envie ao agente, parse JSON, chame `validateFinalAnalysis(parsed)`. Se erro de parse/missing key: aborte com `FINAL_ANALYSIS_INVALID_JSON` ou `FINAL_ANALYSIS_MISSING_KEY` — não escreva nada parcial.

## Passo 9 — Gap check

Carregue `prompts/analyze-gap-check.md`, mesma substituição. Parse → `validateGapCheck` → `formatGapCheckForFigma`. Se erro: aborte sem escrever.

## Passo 10 — Escrita atômica no Figma

Gere os 3 JSs:
- `buildWriteJustificationsJs({ updates: justifications })`
- `buildWriteAnalysisJs({ analysisOverviewId, sections: { resolution, validation, attention, discussion, gapCheck: formattedGapCheck } })`
- `buildStampAnalyzedAtJs({ sectionId, isoDate: new Date().toISOString() })`

Concatene as três strings em uma única call `figma_execute` (envolva cada uma com try/catch se preferir, mas o builder já retorna IIFE-friendly). Capture o resultado e logue contagens.

## Passo 11 — Resumo + screenshot final

1. `figma_take_screenshot` no `sectionId` para confirmação visual.
2. Imprima no terminal: "✓ N flows × M telas analisadas, K gaps encontrados (kinds: ...)".
3. Recomende ao designer rever Manual e ajustar o que for necessário.

## Loop de validação visual (opcional, máx 1 iteração)

Após o screenshot final: se algo visualmente quebrado (text overflow, posições estranhas após migração), aplique fixes pontuais e re-screenshot. Não regenerar conteúdo da IA — só ajustes de layout.

## Erros conhecidos

| code | quando |
|---|---|
| `DELIVERABLE_NOT_FOUND` | Passo 1, sem candidatos |
| `DELIVERABLE_AMBIGUOUS` | Passo 1, múltiplos sem desambiguação |
| `MISSING_TICKET_PROBLEM` | Passo 2 |
| `NO_FILLED_SLOTS` | Passo 5 |
| `JUSTIFICATION_*` | Passo 7 (não fatal — slot fica em branco) |
| `FINAL_ANALYSIS_*` | Passo 8 (fatal) |
| `GAP_CHECK_*` | Passo 9 (fatal) |
| `MIGRATION_FAILED` | Passo 4 (fatal) |

## Idempotência

Re-rodar `/meet-criteria-analyze` regenera todo o conteúdo. Justificativas existentes são sobrescritas via lookup por `flowId+screenIndex`. Sub-seções são reescritas pela `key`. Sem cache.
```

- [ ] **Step 2: Verificar contagem de placeholders e fences**

```bash
grep -c '{{' skills/analyzing-deliverables.md
grep -c '```' skills/analyzing-deliverables.md
```

Esperado: `{{` aparece em referências aos prompts (~10+); fences fechados em pares (par).

- [ ] **Step 3: Commit**

```bash
git add skills/analyzing-deliverables.md
git commit -m "feat(skills): add analyzing-deliverables orchestration skill"
```

---

### Task 16: `commands/meet-criteria-analyze.md` — slash command entry-point

**Files:**
- Create: `commands/meet-criteria-analyze.md`

- [ ] **Step 1: Criar o comando**

Modelo seguindo o padrão de `commands/meet-criteria-new.md`:

```markdown
---
description: Analisa um deliverable Meet Criteria existente — gera justificativa por tela, análise final e gap check vs ticket.
argument-hint: "[<slug>] [--yes]"
---

# /meet-criteria-analyze

Analisa um deliverable Meet Criteria do tipo `feature` que já tenha sido criado via `/meet-criteria-new` e cujas telas tenham sido coladas nos slots via Paste-to-Replace.

## Argumentos
- `<slug>` (opcional) — slug do deliverable (ex.: `prod-1234`). Se omitido, a skill detecta via página atual no Figma ou pergunta ao usuário.
- `--yes` (opcional) — pula a confirmação de custo de tokens (modo não-interativo).

## Pré-requisitos
- Deliverable existe (criado via `/meet-criteria-new`)
- `.meet-criteria/<slug>/problem-statement.md` existe e tem conteúdo
- Pelo menos um `screen-slot` foi preenchido com Paste-to-Replace
- Figma Desktop com Bridge plugin conectado (use `/meet-criteria-setup` se não estiver)

## O que faz
1. Detecta o deliverable (arg / página atual / lista interativa)
2. Lista todos os slots e identifica preenchidos vs vazios
3. Migra layout se for um deliverable antigo (cria `screen-justification` faltantes + sub-seção `gap-check`)
4. Mostra preview do custo e pede confirmação (a menos que `--yes`)
5. Para cada slot preenchido: tira screenshot, gera justificativa via IA (≤240 chars)
6. Gera análise final: 4 sub-seções (`resolution`, `validation`, `attention`, `discussion`)
7. Gera `gap-check` comparando ticket vs entregue
8. Escreve tudo no Figma em uma única chamada atômica
9. Atualiza `lastAnalyzedAt` no plugin data root + screenshot final + resumo

## Skill associada
Use a skill `skills/analyzing-deliverables.md` para conduzir o fluxo passo a passo.

## Erros comuns
- `DELIVERABLE_NOT_FOUND` — slug não existe; verifique `ls .meet-criteria/`
- `MISSING_TICKET_PROBLEM` — `problem-statement.md` ausente; preencha manualmente ou recrie o deliverable
- `NO_FILLED_SLOTS` — nenhuma tela foi colada; use Paste-to-Replace nos slots antes de rodar
- `FINAL_ANALYSIS_INVALID_JSON` / `GAP_CHECK_INVALID_JSON` — modelo não retornou JSON parseável; rode novamente

## Re-execução
Idempotente: re-rodar reescreve toda a análise. Justificativas individuais são lookup por `flowId+screenIndex`; sub-seções por `key`.
```

- [ ] **Step 2: Commit**

```bash
git add commands/meet-criteria-analyze.md
git commit -m "feat(commands): add /meet-criteria-analyze slash command"
```

---

### Task 17: Smoke end-to-end + tag

- [ ] **Step 1: Rodar todo o test suite**

```bash
node --test lib/*.test.mjs
```

Esperado: PASS em todos.

- [ ] **Step 2: Validar templates**

```bash
node scripts/validate-templates.mjs
```

Esperado: 3 templates OK.

- [ ] **Step 3: Smoke local — criar deliverable + render JS, sem Figma**

```bash
echo '{"problemStatement":"Test","flows":[{"name":"Onboarding","screens":2}]}' | \
  node scripts/new-deliverable.mjs --type=feature --ticket=TEST-1 --with-render-js > /tmp/mc-smoke.json

# Verificar campos esperados
node -e "const d = JSON.parse(require('fs').readFileSync('/tmp/mc-smoke.json'));
  console.log('renderJs length:', d.renderJs.length);
  console.log('contains screen-justification:', d.renderJs.includes('screen-justification'));
  console.log('contains gap-check:', d.renderJs.includes('gap-check'));
  console.log('contains analysis-section:', d.renderJs.includes('analysis-section'));"
```

Esperado: todos `true`, `renderJs.length > 0`.

- [ ] **Step 4: Smoke local — analyze helpers gerando JS válido**

```bash
node -e "
const h = require('./lib/analyze-helpers.mjs');
const detect = h.buildDetectDeliverableJs({ slug: null });
const list = h.buildListSlotsJs({ sectionId: 'sec_test' });
const write = h.buildWriteJustificationsJs({ updates: [{ flowId: 'flow-1', screenIndex: 0, text: 'Hello.' }] });
console.log('detect bytes:', detect.length);
console.log('list bytes:', list.length);
console.log('write bytes:', write.length);
"
```

Esperado: todos > 0.

- [ ] **Step 5: Manual smoke no Figma (anotar resultado em PR)**

Documente no PR/commit message do tag final:
1. `/meet-criteria-new feature` em arquivo de teste com 1 fluxo × 2 telas (cole 2 telas via Paste-to-Replace).
2. `/meet-criteria-analyze` (sem args).
3. Confirme: justificativas em ambos os slots, 4 sub-seções de Analysis Overview preenchidas, gap-check preenchido, screenshot final OK.
4. Re-rode `/meet-criteria-analyze` para confirmar idempotência (textos sobrescritos sem erro).

> Este passo é manual; documente o que foi observado. Caso algo falhe, abrir bugfix branch antes do tag.

- [ ] **Step 6: Confirmar git status limpo**

```bash
git status
```

Esperado: nothing to commit, working tree clean.

- [ ] **Step 7: Tag**

```bash
git tag -a v0.4.0 -m "Plano 4: /meet-criteria-analyze — AI-driven justifications, final analysis, gap check"
git log --oneline v0.3.6..HEAD || git log --oneline -25
```

(Se `v0.3.6` não existir, use o commit do merge do PR #6 como referência: `git log --oneline 90aca85..HEAD`.)

- [ ] **Step 8: Atualizar README**

Em `README.md`, adicione na seção de comandos:

```markdown
| `/meet-criteria-analyze [<slug>] [--yes]` | Analisa um deliverable existente: justificativa por tela + análise final (4 seções) + gap check vs ticket |
```

E nas seções de "Status" / "Roadmap": marque Plano 4 como ✅ done.

- [ ] **Step 9: Commit final**

```bash
git add README.md
git commit -m "docs: mark Plan 4 as complete in README"
```

---

## Self-Review

(Já realizado pelo autor antes da publicação. Resultado abaixo.)

**1. Cobertura do spec:**
- ✅ 3 ações de IA (justificativa por tela, análise final, gap check) — Tasks 7, 8, 9, 13, 14, 15
- ✅ Detecção do deliverable (arg/auto/lista) — Task 10 + 15
- ✅ Migração de deliverables antigos — Tasks 9 + 12 + 15
- ✅ Plugin data disambiguada — Task 1
- ✅ Reserva de espaço para justificativa — Task 2 + 3
- ✅ 5ª sub-seção `gap-check` — Task 3 + 5
- ✅ Render do text node `screen-justification` — Task 4
- ✅ Local store deixa de gerar `screen-justifications.md` / `analysis.md` — Task 6
- ✅ Builders + validators + planMigration + formatGapCheckForFigma — Tasks 7-13
- ✅ Prompts em arquivos separados — Task 14
- ✅ Skill orquestradora — Task 15
- ✅ Comando entry-point — Task 16
- ✅ Smoke + tag + README — Task 17
- ✅ Idempotência via `setSharedPluginData` — bake into builders + skill (Task 12, 13, 15)
- ✅ Auto mode bypass de confirmação — Task 16 (`--yes`) + Task 15 (Passo 6)

**2. Placeholder scan:**
- Sem TBD/TODO/etc. Steps com código têm código completo. Comandos `bash` têm parâmetros literais.

**3. Type consistency:**
- `slotPluginData` (Task 1) é referenciado consistentemente em Tasks 3 e 4.
- `screen.justification` (Task 2) consumido em Task 3 (manifest) e Task 4 (render).
- `layoutDelta.shiftBelow[].childIds` (Task 9 testes) consumido em Task 12 (`buildMigrateLayoutJs`).
- `sections.gapCheck` (camelCase no parâmetro do builder) é mapeado para `'gap-check'` (kebab) no JS gerado, via `mapLit` em Task 13. Consistente.
- `analysisOverviewId` consumido em Tasks 9, 12, 13, 15.

**4. Ambiguity check:**
- `flowChildIds` no `slotsReport`: a Task 11 NÃO devolve esse campo, mas a Task 9 (`planMigration`) usa quando presente. A Task 12 (`buildMigrateLayoutJs`) lida com `shiftBelow` recebido — se a skill quiser implementar shift de flows, precisa derivar os children IDs ela mesma. Para o MVP de deliverables criados a partir do Plano 4, não há legacy migration acontecendo, então `shiftBelow` virá vazio. Para deliverables pré-Plano-4, a skill pode pedir um JS adicional para coletar children por flow — documentado como limitação no comentário acima da Task 11.

OK para implementação.

---

## Execução

Este plano segue o mesmo padrão validado nos Planos 3, 3.5 e 3.6. Sugestão: **subagent-driven** para Tasks 7–13 (puras, com TDD claro e baixo risco) e **inline** para Tasks 14–17 (criação de prompts + skill + smoke manual).
