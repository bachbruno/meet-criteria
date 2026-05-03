# analyzing-deliverables

Orquestra `/meet-criteria-analyze [<slug>]` em 11 passos. Use os helpers em `lib/analyze-helpers.mjs` para todo JS de Figma — não escreva JS solto na conversa.

## Passo 1 — Resolver o slug do deliverable

1. Se o usuário forneceu `<slug>` como argumento: pule para Passo 2.
2. Caso contrário, chame `node -e "console.log(require('./lib/analyze-helpers.mjs').buildDetectDeliverableJs({ slug: null }))"` (ou importe e gere via stdin) para obter o JS de detecção, e passe para `figma_execute` no plugin Bridge.
3. Se a resposta for `{ found: false }`: liste pastas em `.meet-criteria/` (`ls .meet-criteria/`) e use `AskUserQuestion` para o usuário escolher um slug. Se não houver pastas, abortar com erro claro.
4. Se a resposta for `{ found: true, ambiguous: true, candidates: [...] }`: use `AskUserQuestion` listando os `ticketRef`/`slug` candidatos.
5. Se a resposta for `{ found: true, ambiguous: false, ... }`: use diretamente.

## Passo 0.5 — Pré-flight check (informacional)

Antes de gastar tokens, rode os checks determinísticos como pré-flight:

1. `import { ANALYSIS_SECTION_PLACEHOLDERS } from '../lib/render-manifest.mjs'`
2. `import { buildCheckSnapshotJs, runRules } from '../lib/check-helpers.mjs'`
3. Monte `knownPlaceholders` (mesma regra da skill `checking-deliverables`).
4. Gere e execute `buildCheckSnapshotJs({ sectionId, knownPlaceholders })`.
5. `findings = runRules(snapshot)`.
6. Comportamento por severidade:
   - `0 findings` → silencie, prossiga.
   - Só `warn` → imprima `ℹ️ N avisos detectados (rode /meet-criteria-check pra detalhes)` e prossiga.
   - 1+ `error` → use `AskUserQuestion`:
     - "Detectados N erros antes da análise. Continuar mesmo assim ou cancelar pra rodar /meet-criteria-check?"
     - Opções: `["Continuar", "Cancelar"]`
     - Em auto mode (`--yes`): imprima "⚠️ N erros detectados — prosseguindo em auto mode" e prossiga.

Pré-flight é informacional. `/analyze` continua sendo o único command que escreve no Figma.

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

## Passo 10 — Escrita no Figma (3 chamadas sequenciais)

Após validar todos os outputs da IA (passos 7, 8, 9 — nenhum write até aqui),
execute em sequência via `figma_execute`:

1. `buildWriteJustificationsJs({ updates: justifications })` — preenche os text
   nodes `screen-justification` por `flowId+screenIndex`. Capture
   `writtenJustifications` no resultado.
2. `buildWriteAnalysisJs({ analysisOverviewId, sections: { resolution, validation, attention, discussion, gapCheck: formattedGapCheck } })` — preenche as 5 sub-seções de Analysis Overview por `key`. Capture `updatedSubsections`.
3. `buildStampAnalyzedAtJs({ sectionId, isoDate: new Date().toISOString() })` — atualiza `lastAnalyzedAt` no plugin data root.

Não há concatenação: cada builder gera um body de função async com `return` próprio,
então cada um precisa ser uma chamada `figma_execute` distinta. Se qualquer um falhar
mid-sequência, os anteriores já estão persistidos (e serão sobrescritos no próximo
`/meet-criteria-analyze` — operação idempotente).

Garantia: nenhum write começa antes de TODA a IA ter validado seus outputs (passos
7-9 ocorrem inteiramente em memória). Isso preserva o invariante "fail-fast at
validation" da spec.

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
| `MALFORMED_SNAPSHOT` | Passo 0.5 (pré-flight, fatal — sectionId provavelmente stale) |
| `SECTION_NOT_FOUND` | Passo 0.5 (pré-flight, fatal) |

## Idempotência

Re-rodar `/meet-criteria-analyze` regenera todo o conteúdo. Justificativas existentes são sobrescritas via lookup por `flowId+screenIndex`. Sub-seções são reescritas pela `key`. Sem cache.
