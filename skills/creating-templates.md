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

## Passo 6 — Chamar o CLI (com `--with-render-js`)

Pra gerar manifest + JS de renderização em uma só chamada, o CLI agora aceita `--with-render-js`. Mas ele exige `selectionIds` em `inputs` — então o fluxo da skill é:

1. **Primeiro**, peça ao designer que crie o frame container e cole o link (Passo 7 abaixo) e extraia os IDs em ordem.
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
  "selection": [{ "id": "1:1", "name": "Login" }, { "id": "1:2", "name": "Home" }]
}
```

> **Compatibilidade:** o CLI ainda aceita `selectionIds: ["1:1", ...]` (array flat) sem `selection`. Nesse caso as tags acima das telas ficam com o placeholder genérico "Screen name". Use `selection` sempre que possível.

Output: `{ "manifest": {...}, "renderJs": "..." }`. Capture os dois.

Se `exit code !== 0`, reporte o `stderr` ao designer e pare. Erros típicos:
- `selectionIds tem N item(s); manifest espera M` → contagem não bate; volte ao Passo 7
- `problem-statement vazio` → volte ao Passo 3
- `Tipo desconhecido` → o CLI não reconheceu `--type`

> **Nota:** Por isso o Passo 6 vem DEPOIS do Passo 7 lá embaixo na execução real. A ordem na skill é didática (CLI vs. container), mas em runtime: pré-checagem → tipo → ticket → problem-statement → estrutura → identidade visual → container (Passo 7) → CLI (Passo 6) → renderização (Passo 8) → validação (Passo 8.5).

## Passo 7 — Frame container com auto layout

**Antes** de renderizar o template, peça ao designer:

> Crie um **frame** (não section) no Figma chamado, por exemplo, `MC Source — <ticketRef>`, ative **auto layout** (`Shift+A`) com direção horizontal ou vertical, arraste pra dentro dele as telas **na ordem desejada**, e cole aqui o link desse frame.

> **Por que frame com auto layout (e não section)?** Section só agrupa visualmente — o `children[]` no painel de camadas pode não bater com a ordem visual no canvas, e isso entra silenciosamente errado no manifest. Frame com auto layout força `children[]` a refletir a ordem visual: arrastar reordena ambos juntos, e quem renderiza tem garantia da ordem certa.

Aguarde a URL. Extraia o `node-id` do query string. O Figma usa duas codificações intercambiáveis (`3-14266` e `3:14266`) — normalize trocando `-` por `:`.

```js
// link recebido: https://www.figma.com/design/<key>/<file>?node-id=12-345&...
const url = new URL(linkRecebido)
const nodeIdRaw = url.searchParams.get('node-id')
if (!nodeIdRaw) throw new Error('Link sem ?node-id=. Peça pro designer copiar via "Copy link to selection".')
const containerId = nodeIdRaw.replace(/-/g, ':')
```

Depois rode `figma_execute` curto pra ler o container, validar que é frame com auto layout, e capturar `id` + `name` de cada filho em ordem:

```js
await figma.loadAllPagesAsync()
const container = await figma.getNodeByIdAsync(containerId)
if (!container) return { error: 'Container não encontrado: ' + containerId }
if (!('children' in container)) return { error: 'Nó não tem children (precisa ser FRAME ou SECTION).' }
return {
  containerName: container.name,
  containerType: container.type,
  layoutMode: 'layoutMode' in container ? container.layoutMode : null, // 'HORIZONTAL' | 'VERTICAL' | 'NONE'
  selection: container.children.map(c => ({ id: c.id, name: c.name })),
}
```

**Validações em ordem (pare na primeira falha):**

1. **Tipo:** se `containerType !== 'FRAME'`, peça pro designer trocar pra frame: "Section/Group não preserva a ordem visual no `children[]`. Converta em frame (Right-click → Frame selection) e me mande o link de novo."
2. **Auto layout:** se `layoutMode === 'NONE'` ou `null`, peça: "Frame está sem auto layout — `children[]` pode não bater com a ordem visual. Selecione o frame e aperte `Shift+A` (horizontal) ou `Shift+A` duas vezes (vertical), e me confirme."
3. **Ordem visual (rede de segurança):** mesmo com frame+auto-layout, tire um screenshot do container pra confirmar visualmente. Use `figma_take_screenshot({ nodeId: containerId })` ou `figma_capture_screenshot`. Olhe a imagem e confirme que a ordem do array `selection` corresponde à ordem que o designer pretendia (esq→dir pra horizontal, cima→baixo pra vertical). Se houver discrepância (raríssimo com auto layout, comum em section/group), reporte ao designer com os nomes em ordem detectada e peça correção.

Use `selection` direto como `inputs.selection` no Passo 6 — o CLI extrai `selectionIds` e `selectionNames` automaticamente. Os nomes vão aparecer nas tags acima de cada tela.

Valide a contagem:
- `feature`: `selection.length === sum(flows[].screens)` (ordem importa: primeiras N telas vão pro Fluxo 1, próximas M pro Fluxo 2, etc).
- `mudanca`: `selection.length === pairs.length * 2` (ordem: par1.antes, par1.depois, par2.antes, par2.depois, ...).
- `conceito`: `selection.length === variants.length`.

Se a contagem não bate, reporte exatamente o gap e peça pro designer adicionar/remover telas do frame e mandar o link de novo (a URL não muda, mas o `children[]` sim).

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
