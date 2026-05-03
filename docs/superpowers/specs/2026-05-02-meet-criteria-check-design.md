# Meet Criteria — `/meet-criteria-check` Design Spec

**Data:** 2026-05-02
**Status:** Final draft (resultado do brainstorming — pronto para plano de implementação)
**Owner:** Bruno Bach
**Plano correspondente:** Plano 6 de 6
**Spec-mãe:** [`2026-05-01-meet-criteria-design.md`](./2026-05-01-meet-criteria-design.md)
**Specs relacionadas:** [`2026-05-02-meet-criteria-analyze-design.md`](./2026-05-02-meet-criteria-analyze-design.md)

---

## Problema

Após `/meet-criteria-new` montar a estrutura e o designer rodar `/meet-criteria-analyze`, o entregável Meet Criteria pode ainda conter pendências silenciosas:

- Problem Statement vazio (nada colado).
- Telas com iPhone placeholder pristine (Paste-to-Replace não foi feito).
- Justificativas em branco (slot foi colado mas `/analyze` não rodou ou falhou nele).
- Sub-seções de Analysis Overview com placeholder canônico ainda visível.
- Análise nunca executada no deliverable.

Hoje só dá pra detectar essas pendências olhando manualmente o canvas. Em deliverables grandes (5+ flows × 4+ telas) o erro escapa fácil — designer apresenta sem perceber e perde credibilidade.

`/meet-criteria-check` automatiza essa varredura, sem rodar IA, sem escrever no Figma, e oferece navegação direta ao node problemático.

## Solução em uma frase

`/meet-criteria-check [<slug>]` percorre um deliverable Meet Criteria existente, aplica regras determinísticas em cima de um snapshot, e devolve relatório pt-BR no terminal + lista navegável via `AskUserQuestion` que leva o cursor do Figma direto ao node pendente.

## Escopo MVP (6 regras)

| ID | Severidade | Detecta |
|---|---|---|
| `empty-problem-statement` | error | Problem Statement vazio ou só whitespace |
| `empty-screen-slot` | error | iPhone placeholder pristine — Paste-to-Replace não feito |
| `empty-justification` | warn  | Slot com conteúdo mas justification em branco (analyze não rodou nesse slot) |
| `empty-analysis-section` | error | Sub-seção do Analysis Overview com texto vazio |
| `placeholder-text-not-replaced` | warn  | Sub-seção ainda contém o texto placeholder canônico (cópia idêntica) |
| `analyze-never-run` | warn  | `lastAnalyzedAt` ausente no plugin data root |

**Fora do escopo (deferidos):**
- `screens-without-anchor` em `mudanca` — depende do Plano 5 (Âncoras).
- Auto-fix / aplicar correções — `/check` é estritamente read-only no MVP.
- Modo CI / exit code não-zero — saída textual apenas (revisitável).

## Quem usa

Designer de produto que já usa `/meet-criteria-new` e `/meet-criteria-analyze` e quer um sanity check antes de uma reunião de apresentação ou de fechar o ticket. Também consumido **internamente** por `/meet-criteria-analyze` como pré-flight informacional (não bloqueante).

## Validação no mundo real

- Designer roda `/meet-criteria-check` em um deliverable feature de 3 flows × 4 telas momentos antes da reunião. Skill imprime "✓ tudo verde" → designer apresenta com confiança.
- Em outro deliverable, skill imprime "2 errors, 3 warns" e oferece lista navegável. Designer escolhe "Tela 2 do Onboarding sem Paste-to-Replace" → Figma centraliza a tela. Designer cola e re-roda.
- Em pré-flight de `/analyze`, skill detecta Problem Statement vazio e dá opção "Cancelar e rodar /meet-criteria-check" antes de queimar tokens de IA.

## Fluxo do designer

1. Designer roda `/meet-criteria-check` ou `/meet-criteria-check prod-1234`.
2. Skill resolve o slug (regra do `/analyze`: arg explícito > auto-detect via current page > `AskUserQuestion`).
3. Skill carrega `ANALYSIS_SECTION_PLACEHOLDERS` de `lib/render-manifest.mjs` para montar `knownPlaceholders`.
4. Skill executa `buildCheckSnapshotJs` em uma única chamada `figma_execute`. Snapshot tem todos os textos + IDs + plugin data root.
5. Skill chama `runRules(snapshot)` em memória — produz `Finding[]` ordenado.
6. Skill imprime relatório pt-BR no terminal.
7. Se houver findings e não estiver em auto mode: `AskUserQuestion` lista os findings com label resumida + opção "Sair sem navegar". Designer escolhe um → skill chama `figma_execute` com JS curto para `scrollAndZoomIntoView` + `currentPage.selection`. Loop até "Sair".
8. Em auto mode (`--yes`): pula navegação após o relatório.

## Arquitetura

Mesmo padrão consolidado nos Planos 3/3.5/3.6/4: **lib pura testável + skill conduzindo o agente**. Sem prompts (zero IA).

### Camadas

- **`lib/check-helpers.mjs`** — builder de JS (`buildCheckSnapshotJs`), registry de regras puras, formatador pt-BR de relatório, builder de opções de navegação. Tudo testável com `node:test` + `node:vm`.
- **`skills/checking-deliverables.md`** — orquestra o agente passo a passo (mesmo padrão de `analyzing-deliverables.md`). Define quando chamar cada helper, como apresentar findings, como conduzir loop de navegação.
- **`commands/meet-criteria-check.md`** — entry-point fino do slash command (declarações + invoca a skill).

### Decisões de arquitetura registradas

- **Read-only**: `/check` nunca escreve no Figma. Navegação usa `figma_execute` mas só para `scrollAndZoomIntoView` + atribuir `currentPage.selection` (nenhuma mutação persistente).
- **Snapshot único, regras puras**: 1 `figma_execute` coleta tudo; regras rodam em memória contra o snapshot. Determinístico, testável, fácil estender.
- **Detecção de "pristine iPhone"**: heurística `slotChildCount === 0`. iPhone placeholder criado pelo render (Plano 3.6) é frame vazio; após Paste-to-Replace ele ganha filhos. Sem necessidade de marker plugin data.
- **Lookup por `pluginData.role`**: nunca por nome ou índice. Sobrevive a rename, duplicação, mover de page.
- **`flowName` no snapshot**: extraído do banner text node filho da flow row durante o walk. Permite mensagens humanizadas sem extra roundtrip.
- **`knownPlaceholders` injetado da lib JS**: skill importa `ANALYSIS_SECTION_PLACEHOLDERS` de `render-manifest.mjs` e passa como input ao snapshot — assim "placeholder canônico" não é hardcoded na string JS do Figma; muda em um lugar só.
- **Severidade puramente cosmética**: errors vs warns afeta apenas formatação e ordenação. Nada bloqueia. Designer decide o que fazer.

## Snapshot shape

```js
{
  sectionId: 'NODE_ID',
  ticketRef: 'PROD-1234',
  type: 'feature',
  lastAnalyzedAt: '2026-05-02T15:00:00Z' | null,

  problemStatement: {
    nodeId: 'TEXT_NODE_ID',
    text: 'string completa',
  } | null,

  flows: [
    {
      flowId: 'flow-1',
      flowNodeId: 'NODE_ID',
      flowName: 'Onboarding',          // lido do banner text node filho do flow
      slots: [
        {
          flowId: 'flow-1',
          screenIndex: 0,
          tagId: 'NODE_ID',
          slotId: 'NODE_ID' | null,
          slotChildCount: 3,
          justificationId: 'NODE_ID' | null,
          justificationText: 'string ou ""',
        },
      ],
    },
  ],

  analysisOverview: {
    nodeId: 'NODE_ID',
    sections: [
      {
        key: 'resolution',
        nodeId: 'FRAME_ID',
        bodyTextNodeId: 'TEXT_ID' | null,
        text: 'string completa',
      },
    ],
  } | null,

  knownPlaceholders: {
    'analysis.resolution': 'Describe how this delivery solves...',
    'analysis.gap-check': 'Run /meet-criteria-analyze to compare...',
  },
}
```

## Finding shape

```js
{
  rule: 'empty-problem-statement',
  severity: 'error' | 'warn',
  nodeId: 'NODE_ID',
  message: 'Problem Statement está vazio',
  context: { flowId?, screenIndex?, key? },
}
```

## API de `lib/check-helpers.mjs`

```js
export class CheckError extends Error { code, details }

export function buildCheckSnapshotJs({ sectionId, knownPlaceholders }): string

export function runRules(snapshot): Finding[]
//   Aplica todas as regras na ordem do registry. Resultado ordenado por:
//   severity ('error' antes de 'warn') → flowId natural → screenIndex → rule.

export function formatReport(findings, snapshot): string
//   Relatório pt-BR pro terminal. Inclui header com ticketRef + tipo,
//   resumo (X errors, Y warns), e lista com ícones (❌/⚠️). Se findings
//   está vazio: "✓ Tudo verde — nenhuma pendência detectada."

export function buildNavigationOptions(findings): Array<{ label, nodeId }>
//   Cada item vira opção do AskUserQuestion. Label truncada em 80 chars.
//   Inclui prefixo de severidade pra contexto rápido.

export function buildNavigateToNodeJs({ nodeId }): string
//   Gera JS curto pro figma_execute: getNodeByIdAsync + scrollAndZoomIntoView
//   + atribui currentPage.selection. Erro estruturado se node não existir.
```

## Regras (registry)

Cada regra é função pura `(snapshot) => Finding[]`. Ordem do array é estável e influencia ordenação final só como tie-breaker.

| Função | ID | Severity | Lógica |
|---|---|---|---|
| `ruleEmptyProblemStatement` | `empty-problem-statement` | error | `snapshot.problemStatement?.text.trim() === ''` ⇒ 1 finding com `nodeId = problemStatement.nodeId` |
| `ruleEmptyScreenSlot` | `empty-screen-slot` | error | Para cada slot com `slotId !== null`: se `slotChildCount === 0` ⇒ finding com `nodeId = slotId`, `context = { flowId, screenIndex }`. Pula slots sem `slotId`. |
| `ruleEmptyJustification` | `empty-justification` | warn | Para cada slot com `slotChildCount > 0` e `justificationId !== null`: se `justificationText.trim() === ''` ⇒ finding com `nodeId = justificationId`. |
| `ruleEmptyAnalysisSection` | `empty-analysis-section` | error | Para cada section em `analysisOverview.sections`: se `text.trim() === ''` ⇒ finding com `nodeId = bodyTextNodeId ?? section.nodeId`, `context = { key }`. |
| `rulePlaceholderTextNotReplaced` | `placeholder-text-not-replaced` | warn | Para cada section: se `text.trim() === knownPlaceholders['analysis.<key>'].trim()` ⇒ finding. **Mutuamente exclusivo com `empty-analysis-section`** (texto vazio nunca é igual a placeholder não-vazio). |
| `ruleAnalyzeNeverRun` | `analyze-never-run` | warn | `snapshot.lastAnalyzedAt === null` ⇒ 1 finding com `nodeId = sectionId`. |

**Mensagens (pt-BR):**
- `empty-problem-statement`: "Problem Statement está vazio."
- `empty-screen-slot`: `Tela ${screenIndex + 1} do flow "${flowName}" não recebeu Paste-to-Replace.` (skill tem o `flowName` via flow-banner; passa pra `formatReport`).
- `empty-justification`: `Tela ${screenIndex + 1} do flow "${flowName}" sem justificativa — rode /meet-criteria-analyze.`
- `empty-analysis-section`: `Sub-seção "${key}" do Analysis Overview está vazia.`
- `placeholder-text-not-replaced`: `Sub-seção "${key}" ainda contém o texto placeholder canônico.`
- `analyze-never-run`: "Análise nunca foi rodada neste deliverable (lastAnalyzedAt ausente)."

## Skill `checking-deliverables.md` — passos

1. **Resolver slug** — reutiliza `buildDetectDeliverableJs` exportado de `analyze-helpers.mjs`. Mesmo fluxo: arg > auto-detect > `AskUserQuestion` > erro.
2. **Carregar placeholders canônicos** — `import { ANALYSIS_SECTION_PLACEHOLDERS } from '../lib/render-manifest.mjs'`. Skill monta `knownPlaceholders = { 'analysis.<key>': value }`.
3. **Snapshot** — gera `buildCheckSnapshotJs`, executa via `figma_execute`. Parse e validação básica do shape (campo `sectionId` presente; senão throw `MALFORMED_SNAPSHOT`).
4. **Aplicar regras** — `runRules(snapshot)`. Mensagens já são montadas em finding-time usando `snapshot.flows[i].flowName`; nenhum enriquecimento posterior.
5. **Imprimir relatório** — `formatReport(findings, snapshot)` em pt-BR.
6. **Navegação interativa** (não auto mode):
   - Se `findings.length === 0`: encerra.
   - Senão: loop `AskUserQuestion` com `buildNavigationOptions(findings)` + "Sair sem navegar". Designer escolhe um → skill executa `buildNavigateToNodeJs({ nodeId })`. Se JS retorna erro `NODE_NOT_FOUND`: skill remove o item da lista e reapresenta. Loop até "Sair".
7. **Auto mode** (`--yes`): após relatório, retorna sem oferecer navegação.

## Integração com `/meet-criteria-analyze`

Adiciona um **Passo 0.5** em `skills/analyzing-deliverables.md`, executado após o Passo 1 (resolver slug) e antes do Passo 6 (preview de custo):

```
0.5. Pré-flight check (informacional)
  - Importa runRules + buildCheckSnapshotJs de check-helpers.mjs.
  - Roda 1 figma_execute pra coletar snapshot.
  - Aplica regras.
  - Se há finding com severity='error':
      AskUserQuestion: "Detectados N erros antes da análise.
        Continuar mesmo assim ou cancelar pra rodar /meet-criteria-check?"
        opções: ["Continuar", "Cancelar"]
      Em auto mode: imprime contagem e segue.
  - Se só warns: imprime "ℹ️ N warns detectados (rode /meet-criteria-check pra
    detalhes)" e segue.
  - Se 0 findings: silencia.
```

Tradeoff: 1 `figma_execute` extra antes do `/analyze`. Aceitável pelo valor de gating tokens contra deliverable manifestamente quebrado.

`/analyze` continua sendo o único command que escreve.

## Mudanças em outros arquivos

### `lib/render-manifest.mjs`

Tornar `ANALYSIS_SECTION_PLACEHOLDERS` exportado (atualmente é `const` interna). Mudança trivial: trocar `const` por `export const`. Sem impacto em `/new` ou `/analyze` (consumidores internos seguem funcionando).

### `lib/analyze-helpers.mjs`

Sem mudança de API. `buildDetectDeliverableJs` já é exportado.

### `skills/analyzing-deliverables.md`

Adiciona Passo 0.5 conforme descrito acima. Atualiza tabela de erros conhecidos (sem novos códigos — pré-flight só lê findings).

### `templates/feature.jsonc`

Sem mudança no MVP. A lista `checks.deterministic` no template (`problem-statement-not-empty`, `no-empty-screen-slots`, `no-placeholder-text`, `final-analysis-not-empty`) é meramente declarativa e não afeta o runtime atual. Pode ser sincronizada com IDs reais (`empty-problem-statement`, `empty-screen-slot`, `placeholder-text-not-replaced`, `empty-analysis-section`) num passo cosmético do Plano 6, mas não é blocker.

### `README.md`

- Marca Plano 6 como ✅ na seção Roadmap.
- Adiciona seção "Verificando um entregável" no fluxo principal.
- Adiciona `meet-criteria-check.md` na árvore de `commands/` e `checking-deliverables.md` em `skills/`.
- Adiciona `lib/check-helpers.mjs` na árvore de `lib/`.

## Códigos de erro (`CheckError`)

| Code | Quando |
|---|---|
| `DELIVERABLE_NOT_FOUND` | Resolução de slug, sem candidatos. |
| `DELIVERABLE_AMBIGUOUS` | Múltiplos roots na page sem desambiguação interativa possível (auto mode). |
| `MISSING_SECTION_ID` | `buildCheckSnapshotJs` chamado sem `sectionId`. |
| `SECTION_NOT_FOUND` | `figma_execute` retornou `{ error: 'SECTION_NOT_FOUND' }` (sectionId stale). |
| `MALFORMED_SNAPSHOT` | Resposta do `figma_execute` não é JSON parseável ou não tem `sectionId`. |
| `NODE_NOT_FOUND` | `buildNavigateToNodeJs` em node deletado entre snapshot e navegação. Não fatal — skill remove da lista. |

Cada mensagem inclui sugestão de ação (mesmo padrão de `RenderInputError` / `AnalyzeError`).

## Edge cases tratados

1. **Section sem flows** (template stub `mudanca`/`conceito`) → snapshot tem `flows: []`; nenhuma regra de slot dispara. Reporte só Problem Statement + Analysis Overview + `analyze-never-run`.
2. **Slot sem `slotId`** (estrutura faltando, deliverable corrompido) → `empty-screen-slot` é pulada. Sem warn dedicado no MVP.
3. **Sub-seção sem `bodyTextNodeId`** → `empty-analysis-section` dispara com `nodeId = section.nodeId` como fallback.
4. **Designer renomeou a Section** → irrelevante; lookup por `pluginData.role`.
5. **Designer apagou um node** → snapshot reporta `null`; regra correspondente pula com graça.
6. **Múltiplas pages com deliverables homônimos** → resolução cai em `AskUserQuestion` (regra herdada do `/analyze`).
7. **`lastAnalyzedAt` em formato inválido ou string vazia** → tratado como `null` na coleta; `analyze-never-run` dispara warn.
8. **`figma_navigate` em node deletado entre relatório e navegação** → JS retorna erro estruturado; skill filtra finding e reapresenta a lista. Loop continua.
9. **Snapshot pesado** (deliverable de 10 flows × 8 telas = 80 slots + 5 sub-seções) → snapshot é leve (texto cru + IDs); zero risco de payload exceder limite. Validado em deliverable de 5 flows × 4 telas como referência (Plano 4).
10. **Designer editou o Problem Statement durante a interação** → snapshot é point-in-time. Re-rodar `/check` reflete o estado atual. Sem cache.

## Estrutura de arquivos

### Criados
- `commands/meet-criteria-check.md`
- `skills/checking-deliverables.md`
- `lib/check-helpers.mjs`
- `lib/check-helpers.test.mjs`

### Modificados
- `lib/render-manifest.mjs` — `ANALYSIS_SECTION_PLACEHOLDERS` torna-se `export const`.
- `skills/analyzing-deliverables.md` — adiciona Passo 0.5 (pré-flight informacional).
- `README.md` — atualiza Roadmap, comandos, árvore de arquivos, adiciona seção "Verificando um entregável".

### Não tocados
- `lib/analyze-helpers.mjs` — API estável; reuso por import.
- `lib/figma-render.mjs`, `lib/render-manifest.mjs` (além do export), `lib/layout-feature.mjs` — zero mudança comportamental.
- `templates/*.jsonc` — `checks.deterministic` declarativo segue como está; sync de nomes é cosmético e fora do MVP.
- `commands/meet-criteria-{new,setup,analyze}.md` — inalterados.

## Estratégia de testes

**`lib/check-helpers.test.mjs`:**

- **`buildCheckSnapshotJs`**:
  - Aceita `sectionId` válido + `knownPlaceholders` → string parseável via `node:vm`.
  - Sem `sectionId` → throw `CheckError({ code: 'MISSING_SECTION_ID' })`.
  - JS gerado contém referência aos roles esperados (`screen-slot`, `screen-justification`, `problem-statement`, `analysis-section`, `analysis-overview`).
- **`runRules`** com snapshot fixtures:
  - Snapshot tudo verde → `[]`.
  - Cada regra isolada: snapshot com 1 violação → 1 finding com shape correto (rule, severity, nodeId, message-key, context).
  - Combinação de violações → ordenação determinística (errors antes; depois flowId natural; depois screenIndex; depois rule).
  - `placeholder-text-not-replaced` vs `empty-analysis-section` mutuamente exclusivos.
  - `empty-justification` não dispara em slot pristine (`slotChildCount === 0`).
  - `analyze-never-run` quando `lastAnalyzedAt: null`; não dispara quando string ISO presente; trata string inválida como `null`.
- **`formatReport`**:
  - 0 findings → contém "Tudo verde".
  - Mistura de severities → ordem visual (errors first), contagem correta no resumo.
  - Caracteres acentuados pt-BR preservados.
- **`buildNavigationOptions`**:
  - Cada finding vira `{ label, nodeId }` com label ≤80 chars (truncamento + ellipsis).
  - Nenhum finding → array vazio.
  - Prefixo de severidade presente no label.
- **`buildNavigateToNodeJs`**:
  - Sem `nodeId` → throw `MISSING_NODE_ID`.
  - Com `nodeId` → string parseável; contém `getNodeByIdAsync` e `scrollAndZoomIntoView`.

**Sem testes runtime Figma** — smoke manual (mesma regra do Plano 3.5/4). Skill documenta checklist visual:

- Rodar `/check` em deliverable verde → "✓ tudo verde".
- Rodar em deliverable com Problem Statement vazio → finding com navegação correta.
- Rodar em deliverable com 1 slot pristine + 1 slot sem justification → 2 findings com mensagens apropriadas.
- Rodar pré-flight em `/analyze` com erro detectado → `AskUserQuestion` com opção de cancelar.

## Premissas confirmadas

- ✅ Plano 4 mergeado (PR #10): `analyze-helpers.mjs` exporta `buildDetectDeliverableJs`, plugin data roles disambiguados (`screen-tag`, `screen-slot`, `screen-justification`, `analysis-section`).
- ✅ `lastAnalyzedAt` é gravado por `buildStampAnalyzedAtJs` no plugin data root da Section.
- ✅ `ANALYSIS_SECTION_PLACEHOLDERS` é a fonte canônica das strings de placeholder e está em `render-manifest.mjs`.
- ✅ Padrão `RenderInputError` / `AnalyzeError` consolidado para erros estruturados.
- ✅ Padrão "lib pura + skill conduzindo + zero IA" validado para comandos determinísticos.
- ✅ `AskUserQuestion` para inputs de múltipla escolha (memória do projeto).
- ✅ Idioma do output em pt-BR (CLAUDE.md).

## Pontos abertos (deferidos)

- **`screens-without-anchor` em `mudanca`** — depende do Plano 5 (Âncoras).
- **Auto-fix** — `/check` é read-only no MVP. Eventualmente `/check --fix-placeholders` poderia limpar sub-seções com placeholder canônico para forçar designer a preencher manualmente. Sem demanda concreta agora.
- **Modo CI / exit code não-zero** — saída textual no MVP; integração com pipelines fica fora.
- **Sync de `checks.deterministic` no template** com IDs reais — cosmético; não bloqueia.
- **Cache do snapshot entre `/check` e `/analyze` consecutivos** — desnecessário no MVP (snapshot é barato); revisitável se virar gargalo.
