---
description: Roda checks determinísticos no deliverable Meet Criteria atual e oferece navegação até cada pendência
argument-hint: "[<slug>] [--yes]"
---

# /meet-criteria-check

Sintaxe: `/meet-criteria-check [<slug>] [--yes]`

- `<slug>` — opcional. Se omitido, a skill resolve via auto-detect (current page) ou `AskUserQuestion` listando `.meet-criteria/`.
- `--yes` — pula a navegação interativa após o relatório (útil em uso autônomo / CI conceitual).

Comando read-only. Nunca escreve no Figma. Aplica 6 regras determinísticas e mostra um relatório pt-BR no terminal com lista navegável.

Invoque a skill `checking-deliverables` para executar.
