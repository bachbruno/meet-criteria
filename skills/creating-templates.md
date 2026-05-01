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
