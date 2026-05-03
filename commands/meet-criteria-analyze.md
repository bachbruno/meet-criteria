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

Pré-requisito: `~/.config/meet-criteria/config.json::setup_complete === true`. Se faltar, instrua `/meet-criteria-setup` antes e pare.

Linguagem: pt-BR. Tom: direto, sem floreio.
