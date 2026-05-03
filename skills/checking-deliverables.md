# checking-deliverables

Orquestra `/meet-criteria-check [<slug>] [--yes]` em 6 passos. Use os helpers em
`lib/check-helpers.mjs` para todo JS de Figma — não escreva JS solto na conversa.

## Passo 1 — Resolver o slug do deliverable

Mesma regra do `/meet-criteria-analyze`:

1. Se o usuário forneceu `<slug>` como argumento → use direto.
2. Caso contrário, importe `buildDetectDeliverableJs` de `lib/analyze-helpers.mjs` e execute via `figma_execute`.
3. `{ found: false }` → liste pastas em `.meet-criteria/` (`ls .meet-criteria/`) e use `AskUserQuestion`. Sem pastas → aborte com `DELIVERABLE_NOT_FOUND`.
4. `{ found: true, ambiguous: true, candidates }` → `AskUserQuestion` com os `ticketRef`/`slug`.
5. `{ found: true, ambiguous: false, sectionId, ticketRef, slug, type }` → use direto.

## Passo 2 — Montar `knownPlaceholders`

```js
import { ANALYSIS_SECTION_PLACEHOLDERS } from '../lib/render-manifest.mjs'
const knownPlaceholders = Object.fromEntries(
  Object.entries(ANALYSIS_SECTION_PLACEHOLDERS).map(([k, v]) => [`analysis.${k}`, v])
)
```

## Passo 3 — Snapshot

Gere `buildCheckSnapshotJs({ sectionId, knownPlaceholders })` e execute via `figma_execute`.

Validação imediata da resposta:
- Se `JSON.parse` falhar ou faltar `sectionId` → throw `CheckError('snapshot inválido', { code: 'MALFORMED_SNAPSHOT' })`.
- Se vier `{ error: 'SECTION_NOT_FOUND' }` → throw `CheckError(..., { code: 'SECTION_NOT_FOUND' })`.

## Passo 4 — Aplicar regras

```js
const findings = runRules(snapshot)
```

Mensagens já vêm prontas em pt-BR (cada regra usa `flow.flowName` + `screenIndex + 1`).

## Passo 5 — Imprimir relatório

```js
const report = formatReport(findings, snapshot)
console.log(report)
```

Exemplo de saída esperada:

```
📋 Meet Criteria — PROD-1234 (feature)

Resumo: 2 erros, 3 avisos

❌  Problem Statement está vazio.
❌  Tela 2 do flow "Onboarding" não recebeu Paste-to-Replace.
⚠️  Tela 3 do flow "Onboarding" sem justificativa — rode /meet-criteria-analyze.
⚠️  Sub-seção "discussion" ainda contém o texto placeholder canônico.
⚠️  Análise nunca foi rodada neste deliverable (lastAnalyzedAt ausente).
```

## Passo 6 — Loop de navegação

Em **auto mode** (flag `--yes` ou contexto autônomo) ou se `findings.length === 0`: encerre após o relatório.

Caso contrário, loop:

1. `options = buildNavigationOptions(findings)` + `{ label: 'Sair sem navegar', nodeId: null }`.
2. `AskUserQuestion` com `options`.
3. Se escolha for `null` → break.
4. Senão: gere `buildNavigateToNodeJs({ nodeId })` e execute via `figma_execute`.
   - Se resposta tiver `error: 'NODE_NOT_FOUND'`: imprima aviso, **filtre o finding correspondente da lista** (por `nodeId`), e reapresente as opções.
   - Caso contrário: imprima "→ Navegado para `<label>`. Quer ver outra pendência?" e continue o loop.

## Idempotência

`/meet-criteria-check` é puramente read-only. Pode rodar quantas vezes quiser sem efeitos colaterais. Re-rodar reflete o estado atual do Figma (sem cache).

## Erros conhecidos

| code | quando |
|---|---|
| `DELIVERABLE_NOT_FOUND` | Passo 1, sem candidatos |
| `DELIVERABLE_AMBIGUOUS` | Passo 1, múltiplos sem desambiguação possível |
| `MISSING_SECTION_ID` | builder chamado sem `sectionId` (bug interno) |
| `SECTION_NOT_FOUND` | Passo 3, `sectionId` stale |
| `MALFORMED_SNAPSHOT` | Passo 3, JSON inválido ou sem `sectionId` |
| `NODE_NOT_FOUND` | Passo 6, node deletado entre snapshot e navegação (não fatal) |
