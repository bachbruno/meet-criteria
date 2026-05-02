# Meet Criteria — `/meet-criteria-analyze` Design Spec

**Data:** 2026-05-02
**Status:** Final draft (resultado do brainstorming — pronto para plano de implementação)
**Owner:** Bruno Bach
**Plano correspondente:** Plano 4 de 6
**Spec-mãe:** [`2026-05-01-meet-criteria-design.md`](./2026-05-01-meet-criteria-design.md)

---

## Problema

O Plano 3.6 entregou o template `feature` renderizado no Figma com placeholders em todas as seções de análise (Problem statement preenchido pelo designer; Analysis Overview com 4 sub-seções vazias; flow-rows com tags + iPhone placeholders prontos para Paste-to-Replace). O entregável visual é correto mas **vazio de análise** — o designer ainda precisa preencher manualmente toda a justificativa de cada tela e a análise final.

`/meet-criteria-analyze` automatiza esse preenchimento usando IA com visão, lendo as telas que o designer colou nos slots e cruzando com o ticket de design.

## Solução em uma frase

`/meet-criteria-analyze [<slug>]` analisa um deliverable Meet Criteria existente, gerando: (a) justificativa por tela renderizada no Figma, (b) Analysis Overview com 4 sub-seções preenchidas, (c) sub-seção nova `gap-check` comparando o que o ticket pede vs o que aparece nas telas.

## Escopo MVP (3 ações de IA)

Das 5 ações da spec-mãe, este plano cobre **3**:

1. **Justificativa por tela** — para cada `screen-slot` preenchido, gera 1–2 frases (≤240 chars) sobre como aquela tela específica resolve um aspecto do problema do ticket. Renderizada como text node visível abaixo do iPhone placeholder.
2. **Análise final** — preenche `resolution`, `validation`, `attention`, `discussion` no card Analysis Overview (4 strings ≤600 chars cada).
3. **Comparar ticket vs entregue (gap-check)** — nova 5ª sub-seção em Analysis Overview, com summary + lista de gaps tipados (`missing`/`ambiguous`/`extra`).

**Fora do escopo (deferidos):**
- Sugerir agrupamento de fluxos (Plano 4.5+, depende de uso real)
- Sugerir âncoras (Plano 5)
- Suporte a tipos `mudanca` e `conceito` (templates ainda são stubs do Plano 3.6)

## Quem usa

Designer de produto que já criou um deliverable via `/meet-criteria-new`, colou as telas finais nos `screen-slot` (via Paste-to-Replace, conforme PR #9), e quer que o agente faça uma primeira passada de análise antes da revisão humana.

## Validação no mundo real

- Designer roda `/meet-criteria-analyze` em um deliverable feature de 3 fluxos × 4 telas = 12 análises de tela + 1 análise final + 1 gap check.
- Skill mostra preview do custo, designer confirma.
- Em <2 minutos, todas as text boxes do Figma estão preenchidas com texto coerente em inglês.
- Designer revisa, ajusta o que precisar manualmente. Re-rodar `/analyze` regenera tudo (sem cache).

## Fluxo do designer

1. Designer (em qualquer terminal/IDE com Claude Code) roda `/meet-criteria-analyze` ou `/meet-criteria-analyze prod-1234`.
2. Skill resolve o slug (regra C: arg explícito > auto-detect via current page no Figma > AskUserQuestion com lista de `.meet-criteria/`).
3. Skill carrega `.meet-criteria/<slug>/problem-statement.md`.
4. Skill executa JS no Figma para listar `screen-slot` e detectar quais têm conteúdo colado vs placeholder pristine.
5. Skill executa migração de layout se necessário (deliverable antigo sem `screen-justification` ou sem 5ª sub-seção).
6. Skill mostra preview de custo via `AskUserQuestion`: "vou rodar 12 análises de tela + 1 análise final + 1 gap check, ok?". Em auto mode, prossegue.
7. Loop por slot preenchido: `figma_take_screenshot` → agente carrega `prompts/analyze-screen.md` → gera string → valida.
8. Agente carrega `prompts/analyze-final.md` com o agregado de justificativas + ticket → gera JSON → valida.
9. Agente carrega `prompts/analyze-gap-check.md` → gera JSON → valida → formata para texto.
10. Em uma única chamada `figma_execute`: escreve todas as justificativas + 5 sub-seções + atualiza `lastAnalyzedAt` no plugin data root.
11. Screenshot final + resumo no terminal ("3 fluxos × 4 telas analisadas, 2 gaps encontrados").

## Arquitetura

Mesmo padrão consolidado nos Planos 3/3.5/3.6: **lib pura testável + skill conduzindo o agente + prompts em arquivos separados**.

### Camadas

- **`lib/analyze-helpers.mjs`** — funções puras: builders de JS para `figma_execute` (detect, list slots, migrate layout, write justifications, write analysis, stamp date), validators dos outputs da IA, formatador de gap check para Figma. Testáveis com `node:test` + `node:vm` (sintaxe).
- **`skills/analyzing-deliverables.md`** — orquestra o agente passo a passo (mesmo padrão de `creating-templates.md`). Define quando chamar cada helper, como validar entre passos, como tratar erros.
- **`prompts/analyze-screen.md`**, **`prompts/analyze-final.md`**, **`prompts/analyze-gap-check.md`** — templates com placeholders preenchidos pela skill antes de cada chamada. Geram saída em inglês (regra de i18n da spec-mãe).
- **`commands/meet-criteria-analyze.md`** — entry-point fino do slash command (declarações + invoca a skill).

### Decisões de arquitetura registradas

- **Idempotência via plugin data**: detecção de nodes existentes (`role: 'screen-justification'`, sub-seções por `key`) usa `getSharedPluginData`, não nome ou índice. Sobrevive a renomeação e duplicação. Re-rodar `/analyze` reescreve in-place.
- **Atomicidade de escrita**: as 3 ações geram texto na conversa, validam **antes** de tocar no Figma, e enviam tudo em **uma única** chamada `figma_execute` no final. Reduz roundtrips e evita estado parcial.
- **Sem cache**: cada execução regenera tudo. Custo aceitável (deliverables médios = ~12 imagens + 2 calls de texto). Decisão revisitável em fase posterior.
- **Figma é fonte da verdade para análises**: o local store deixa de gerar `screen-justifications.md` e `analysis.md`. Designer que quiser referenciar trabalho passado tira screenshot do Figma.

## Mudanças no template e layout

### `templates/feature.jsonc`

`AnalysisOverview.sections` ganha um 5º item, `gap-check` (label "Gap check vs ticket"). Demais campos inalterados.

### `schemas/template.schema.json`

Enum `sections` aceita `gap-check` (em adição a `resolution`, `validation`, `attention`, `discussion`). Sem novo componente raiz — `ScreenJustification` é detalhe interno do builder.

### `lib/feature-layout.mjs`

Novas constantes:
- `JUSTIFICATION_HEIGHT = 120`
- `IPHONE_TO_JUSTIFICATION_GAP = 16`

`computeFeatureLayout` adiciona, abaixo de cada placeholder iPhone, um retângulo de justificativa (mesma `x` e `width` do placeholder, `y = placeholder.y + IPHONE_HEIGHT + IPHONE_TO_JUSTIFICATION_GAP`). Cada flow-row cresce em `JUSTIFICATION_HEIGHT + IPHONE_TO_JUSTIFICATION_GAP`. Section total cresce proporcionalmente.

Tradeoff: ~136px extra por flow-row (~544px para 4 fluxos). Aceitável dado que o card cresce linearmente com o número de fluxos e a justificativa é conteúdo principal.

### `lib/render-manifest.mjs`

- `buildFlowsNode`: cada `screen-slot` ganha um campo `justification: { x, y, width, height, text: '', pluginData: { role: 'screen-justification', flowId, screenIndex } }`.
- `buildAnalysisOverviewNode`: itera sobre 5 sub-seções; `ANALYSIS_SECTION_HEADINGS['gap-check'] = 'Gap check'`; `ANALYSIS_SECTION_PLACEHOLDERS['gap-check']` define texto orientativo (ex.: "Run /meet-criteria-analyze to check ticket coverage.").

### `lib/figma-render.mjs`

- Helper de `screen-slot` cria adicionalmente um text node `screen-justification` em branco, com `TEXT_AUTO_RESIZE = HEIGHT`, largura travada, plugin data setada.
- Helper de `analysis-overview` itera 5 sub-seções (loop existente — só um placeholder a mais).
- Cada sub-seção carrega `pluginData.role = 'analysis-section'` + `pluginData.key` (`resolution` / `validation` / `attention` / `discussion` / `gap-check`).

### Migração de deliverables antigos

Para deliverables criados antes do Plano 4 (sem `screen-justification` reservado, sem 5ª sub-seção), a skill detecta na varredura inicial e aplica `buildMigrateLayoutJs` antes de iniciar a análise. Operação:
- Para cada `screen-slot` sem filho `role: 'screen-justification'`: cria text node abaixo do iPhone com plugin data + texto vazio.
- Cada flow-row cresce em `JUSTIFICATION_HEIGHT + IPHONE_TO_JUSTIFICATION_GAP`. Flow-rows subsequentes (lookup por `pluginData.role='flow'` ordenado por `y`) são deslocadas para baixo no mesmo `delta × (índice da flow-row)`.
- Section total cresce em `delta × N flows`. Side cards (`role='problem-statement'`, `role='analysis-overview'`) têm `height` recalculada para a nova altura interna (mesma fórmula do `computeFeatureLayout`).
- Para `analysis-overview` sem sub-seção `key='gap-check'`: cria a 5ª sub-seção dentro do card (sem mexer em altura — sub-seções já são auto-layout vertical hug content; o card já vai ter espaço suficiente após o crescimento acima).

Operação idempotente — verifica plugin data antes de criar/mover. Tudo aplicado em **uma única** chamada `figma_execute` para evitar estado parcial.

Limitação conhecida: se o designer já alterou manualmente o `y` de algum nó, a migração pode produzir resultado inesperado. A skill avisa antes de migrar e oferece skip (designer pode preferir migrar manualmente).

## Contratos dos prompts

Saída em **inglês** (regra de i18n da spec-mãe — conteúdo renderizado no Figma fica em inglês). Prompts em si podem ser pt-BR (instruções para a IA).

### `prompts/analyze-screen.md`

**Input** (montado pela skill por slot):
- `ticketRef`, `ticketProblem` (texto de `.meet-criteria/<slug>/problem-statement.md`)
- `flowName`, `screenIndex`, `slotName` (do `selectionNames` original)
- 1 imagem do screenshot do slot

**Tarefa:** "Em 1–2 frases (máx 240 caracteres), explique como esta tela específica resolve um aspecto do problema descrito no ticket. Foque no que ESTA tela faz, não no fluxo inteiro."

**Output:** string de até 240 chars, sem markdown, sem prefixo. Validação: trim + limite.

### `prompts/analyze-final.md`

**Input:**
- `ticketRef`, `ticketProblem`
- Lista compacta de fluxos com nomes de telas e justificativas geradas
- (Sem screenshots no MVP — justificativas individuais já condensam o visual.)

**Tarefa:** preencher 4 sub-seções:
- `resolution` — 2–4 frases sobre como o conjunto resolve o problema.
- `validation` — 2–4 frases sobre pontos fortes / decisões boas.
- `attention` — 2–4 frases sobre riscos, ambiguidades, telas frágeis.
- `discussion` — 2–4 frases sobre tópicos abertos para stakeholders.

**Output (JSON estrito):**
```json
{
  "resolution": "...",
  "validation": "...",
  "attention": "...",
  "discussion": "..."
}
```

Validação: 4 chaves obrigatórias, cada string ≤600 chars. Falha de parsing → erro fatal, não escreve no Figma.

### `prompts/analyze-gap-check.md`

**Input:** `ticketProblem` + lista agregada de telas + justificativas (mesmo do prompt final).

**Tarefa:** comparar critérios/expectativas do ticket vs o que aparece nas telas.

**Output:**
```json
{
  "summary": "1 frase introduzindo o resultado",
  "gaps": [
    { "kind": "missing|ambiguous|extra", "ticketAspect": "...", "evidence": "..." }
  ]
}
```

Renderização: `formatGapCheckForFigma` produz markdown compacto (summary + bullet list `[KIND] aspect — evidence`) ≤800 chars. JSON cru não vai pro Figma.

Tipos:
- `missing` — ticket pede algo que não aparece nas telas
- `ambiguous` — ticket vago, telas mostram uma interpretação possível mas não esgotam
- `extra` — telas mostram algo fora do escopo do ticket (informacional)

## API de `lib/analyze-helpers.mjs`

```js
export class AnalyzeError extends Error { code, details }

// Detecção
export function buildDetectDeliverableJs({ slug = null }): string

// Listagem de slots
export function buildListSlotsJs({ sectionId }): string

// Migração de layout (deliverables antigos)
export function planMigration({ slotsReport, hasGapCheck }): layoutDelta | null
export function buildMigrateLayoutJs({ sectionId, layoutDelta }): string

// Escrita
export function buildWriteJustificationsJs({ updates }): string  // updates = [{ slotId, text }]
export function buildWriteAnalysisJs({ analysisOverviewId, sections }): string
//   sections = { resolution, validation, attention, discussion, gapCheck }
export function buildStampAnalyzedAtJs({ sectionId, isoDate }): string

// Validação dos outputs da IA
export function validateScreenJustification(text): string
export function validateFinalAnalysis(obj): object
export function validateGapCheck(obj): { summary, gaps }
export function formatGapCheckForFigma(gapCheckObj): string
```

Builders retornam strings de JS para `figma_execute` (mesmo padrão de `lib/figma-render.mjs`). Validators throw `AnalyzeError` com `code` discriminado.

## Códigos de erro (`AnalyzeError`)

- `DELIVERABLE_NOT_FOUND` — slug não existe no Figma nem em `.meet-criteria/`.
- `DELIVERABLE_AMBIGUOUS` — múltiplos `role=root` na page atual sem desambiguação.
- `MISSING_TICKET_PROBLEM` — `.meet-criteria/<slug>/problem-statement.md` ausente ou vazio.
- `NO_FILLED_SLOTS` — todos os slots ainda têm placeholder pristine; aborta com instrução para o designer colar telas via Paste-to-Replace.
- `JUSTIFICATION_TOO_LONG` — texto da IA acima de 240 chars; aviso (trim) ou erro se irrecuperável.
- `FINAL_ANALYSIS_INVALID_JSON` — IA não devolveu JSON parseável.
- `FINAL_ANALYSIS_MISSING_KEY` — JSON faltando uma das 4 chaves obrigatórias.
- `GAP_CHECK_INVALID_JSON` — IA não devolveu JSON parseável.
- `GAP_CHECK_INVALID_GAP` — item de `gaps` com `kind` fora do enum ou faltando `ticketAspect`/`evidence`.
- `MIGRATION_FAILED` — `figma_execute` da migração de layout retornou erro estruturado.

Cada mensagem inclui sugestão de ação (mesmo padrão de `RenderInputError`).

## Edge cases tratados

1. **Deliverable antigo sem `screen-justification` reservado** → migração na primeira execução, idempotente.
2. **Slot vazio** (designer não colou tela) → pulado com aviso; justificativa fica em branco no Figma.
3. **Section renomeada pelo designer** → lookup por `pluginData.role=root`, não por nome.
4. **Re-rodar `/analyze` no meio do trabalho** → reescreve apenas slots preenchidos no momento. Slots novos em runs futuras são analisados.
5. **Modelo da IA gerou texto acima do limite** → trim com aviso (não fatal); só erra se for irrecuperável (JSON quebrado).
6. **Múltiplos containers Meet Criteria na page atual** (auto-detect) → cai em `AskUserQuestion` listando todos.
7. **`.meet-criteria/<slug>/` não existe** → erro `MISSING_TICKET_PROBLEM` com instrução para criar via `/meet-criteria-new` ou colar manualmente.
8. **Gap-check sub-seção ausente** (template antigo) → migração cria antes de escrever.

## Estrutura de arquivos

### Criados
- `commands/meet-criteria-analyze.md`
- `skills/analyzing-deliverables.md`
- `prompts/analyze-screen.md`
- `prompts/analyze-final.md`
- `prompts/analyze-gap-check.md`
- `lib/analyze-helpers.mjs`
- `lib/analyze-helpers.test.mjs`

### Modificados
- `templates/feature.jsonc` — adiciona `gap-check` em `AnalysisOverview.sections`.
- `schemas/template.schema.json` — enum `sections` aceita `gap-check`.
- `lib/render-manifest.mjs` — emite `justification` em cada `screen-slot`; emite 5ª sub-seção `gap-check`; `ANALYSIS_SECTION_HEADINGS`/`ANALYSIS_SECTION_PLACEHOLDERS` ganham `gap-check`.
- `lib/feature-layout.mjs` — novas constantes `JUSTIFICATION_HEIGHT` e `IPHONE_TO_JUSTIFICATION_GAP`; flow-row e section crescem.
- `lib/figma-render.mjs` — cria text node `screen-justification` por slot; renderiza 5ª sub-seção; sub-seções carregam `pluginData.role='analysis-section'` + `pluginData.key`.
- `lib/render-manifest.test.mjs`, `lib/figma-render.test.mjs`, `lib/feature-layout.test.mjs` — atualizados.
- `lib/local-store.mjs` — **remove** geração de `screen-justifications.md` e `analysis.md`; ajustar testes correspondentes.

### Não tocados
- `templates/mudanca.jsonc`, `templates/conceito.jsonc` (continuam stubs do Plano 3.6).
- `commands/meet-criteria-{anchor,check,export-annotations}.md` (Planos 5/6).

## Estratégia de testes

- **`lib/analyze-helpers.test.mjs`**: validators (happy + edge: truncamento, JSON malformado, tamanhos máximos, `kind` inválido); `planMigration` (deliverable novo = null; antigo sem justificativas = cria todos; parcial = só faltantes; com/sem gap-check); `formatGapCheckForFigma` (bullets, truncamento, summary vazio); `build*Js` (assertions de presença, sintaxe parseável via `node:vm`).
- **`lib/render-manifest.test.mjs`**: `screen-justification` reservado em cada slot; 5ª sub-seção `gap-check` em Analysis Overview com headings/placeholders corretos.
- **`lib/figma-render.test.mjs`**: render JS cria text node `screen-justification` por slot com plugin data; itera 5 sub-seções com `pluginData.key`.
- **`lib/feature-layout.test.mjs`**: alturas atualizadas (flow-row, section); posição relativa da justificativa em relação ao iPhone.
- **`lib/local-store.test.mjs`**: confirma que `screen-justifications.md` e `analysis.md` deixam de ser gerados.
- **Sem testes runtime Figma** — smoke manual (mesma regra do Plano 3.5). Skill documenta o checklist de validação visual.

## Premissas confirmadas

- ✅ Plano 3.6 merged (PR #6 + follow-ups #7, #8, #9): template `feature` rendado com Section root, firefly palette, multi-flow, iPhone placeholders, screen tags com nomes do `selectionNames`.
- ✅ `setSharedPluginData` plenamente suportado e idempotente via `getSharedPluginData`.
- ✅ Padrão `RenderInputError` + `code` discriminado consolidado.
- ✅ `figma_take_screenshot` disponível e validado em uso anterior (Plano 3.5).
- ✅ Padrão "lib pura + skill conduzindo + prompts separados" validado.
- ✅ Decisão de UX: `AskUserQuestion` para inputs de múltipla escolha (memória do projeto).

## Pontos abertos (deferidos)

- **Caching de outputs** — não fazemos no MVP. Revisitar se custo se mostrar problemático em uso real.
- **Modo "só uma seção"** (`/meet-criteria-analyze --only=screens`) — não no MVP. Se virar dor, criar como follow-up.
- **Suporte a `mudanca` e `conceito`** — fica para quando esses templates forem rebuildados (planos próprios após Plano 6, conforme Plano 3.6).
- **Sugerir agrupamento de fluxos** — Plano 4.5+, depende de uso real do MVP.
- **Sugerir âncoras** — Plano 5 (depende de o componente AnchorBox existir).
