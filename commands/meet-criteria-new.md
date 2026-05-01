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
