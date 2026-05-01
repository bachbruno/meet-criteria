# Meet Criteria — Design Spec

**Data:** 2026-05-01
**Status:** Final draft (resultado do brainstorming inicial — pronto para plano de implementação)
**Owner:** Bruno Bach

---

## Problema

Designers de produto frequentemente:

- Esquecem do que o ticket de design estabelecia como entregável durante reuniões de apresentação
- Esquecem pontos importantes que precisam ser comunicados ao time
- Pecam na organização do arquivo Figma, dificultando navegação e apresentação
- Apresentam suas decisões sem âncoras visuais claras (decisões sem justificativa explícita)

Resultado: reuniões mal aproveitadas, retrabalho, perda de credibilidade do entregável.

## Solução em uma frase

Uma ferramenta baseada em **skills + figma-console MCP** que ajuda designers a:

1. Estruturar entregáveis logo no início do ticket (template estruturado dentro do Figma)
2. Conectar telas a critérios do ticket via âncoras visuais
3. Gerar uma narrativa de apresentação (justificativas, análise final, comparação ticket vs. entregue)
4. Verificar gaps antes de apresentar

## Quem usa

- **Audiência primária:** designers de produto que **já usam Claude conectado ao Figma** (têm Claude Code, Claude Desktop ou Cursor instalado e familiaridade básica com `figma-console MCP`).
- **Audiência secundária:** designers tech-forward dispostos a passar pelo onboarding (a ferramenta os guia).
- **Fora de escopo no MVP:** designers totalmente não-técnicos sem nenhuma exposição a IA conversacional.

## Validação no mundo real

O autor (Bruno Bach) já publicou em 2023 a biblioteca [status-tags](https://www.figma.com/community/file/1156964537370007670/status-tags) na Figma Community, adotada por múltiplos times. Capturas reais (em `docs/research/screenshots/`) mostram designers usando manualmente os mesmos padrões que Meet Criteria automatiza:

- Hierarquia textual lado a lado das telas (Problem Statement detalhado em bullets com prioridade)
- Status-tags como rótulo de cada tela e seção
- Section headers para agrupamento de variantes/opções
- Anchor callouts com ponto + linha + caixa explicativa
- Nesting hierárquico de 3 níveis: contexto macro → fluxo/seção → telas/variantes

Esses padrões observados informam decisões de identidade visual e estrutura do template.

## Arquitetura

### Decisão central: NÃO construímos plugin Figma próprio

Foi avaliado e descartado. O produto é um **repositório de skills** que roda em qualquer cliente MCP-aware (Claude Code, Cursor, Claude Desktop), usando como infraestrutura:

- **`figma-console MCP` da southleft** ([github.com/southleft/figma-console-mcp](https://github.com/southleft/figma-console-mcp)): ponte entre o agente e o Figma desktop
- **Plugin Figma Bridge** (parte do figma-console MCP): roda no Figma desktop pra expor a Plugin API ao MCP
- **Personal Access Token do Figma** (`figd_*`): autenticação do MCP com a API REST do Figma

O agente (Claude) é o "cérebro". A skill é a "receita". O MCP é a "mão" que mexe no Figma. **O output sempre vive no Figma.**

### Por que essa escolha

- **Velocidade de validação**: 1-2 semanas vs. 6-10 semanas de plugin completo
- **Custo zero pra construtor**: nenhum servidor, nenhuma submissão a Figma Community, nenhum suporte de plataforma
- **Iteração rápida de prompts**: editar arquivo `.md` e o efeito é imediato
- **Reuso de infra existente**: figma-console MCP já cobre operações necessárias (export PNG, ler vars/styles, criar/clonar nodes, navegar)
- **Output idêntico ao plugin**: trabalho final renderizado no canvas Figma, presentation-ready

### Modelo de IA

- IA = o próprio agente Claude que o usuário já está usando
- **Nenhuma chamada extra de API externa** — o agente faz análise inline com seu próprio contexto
- Custo recai sobre o plano/saldo do usuário (Pro, Team, ou pay-per-use API). Zero custo pra construtor
- Fallback "sem IA" não se aplica — quem usa a ferramenta já tem agente

## Tipos de tarefa suportados (3)

| Tipo | Quando usar | Estrutura do template |
|------|-------------|-----------------------|
| **`feature`** | Feature nova (greenfield) | Contexto + Problem Statement + Fluxos × Telas + Análise |
| **`mudanca`** | Correção UX ou iteração de tela existente | Contexto + Problem Statement + Comparativo (antes/depois × tela) + Análise |
| **`conceito`** | Explorar variantes A/B/C de tela existente | Contexto + Problem Statement + Variantes lado a lado + Critérios de decisão + Análise |

Nota: "correção UX" e "iteração" foram fundidas — estruturalmente idênticas (tela referência + tela ajustada + justificativa). Diferença é só de narrativa.

## Estrutura do template — kit de componentes

A skill conhece um **kit de componentes reutilizáveis**. Cada tipo de tarefa é uma **receita JSONC** que combina componentes. A hierarquia visual segue 3 níveis (contexto → fluxo/seção → tela) inspirada em padrões reais de uso.

### Componentes (kit reutilizável)

| Componente | Função |
|------------|--------|
| `ContextMacro` | Header do entregável com título + ícone (status-tag de destaque) |
| `ProblemStatement` | Texto rico hierárquico (suporta bullets/sub-bullets para critérios) |
| `FlowList`, `Flow` | Agrupador de telas com section header escuro |
| `SectionHeader` | Header de fluxo/seção/variante |
| `ScreenSlot` | Slot pra imagem da tela + status-tag + ponto de inserção de âncoras |
| `Comparative` | Par/N-tupla lado a lado (antes/depois, A/B/C, v1/v2) |
| `DecisionCriteria` | Lista de critérios (tipo `conceito`) |
| `AnchorBox` | Caixa branca + ponto vermelho ancorado + linha conectora |
| `FinalAnalysis` | Bloco narrativo (resolução + pontos fortes + atenção + discussão) |

### Receita por tipo

| Componente | `feature` | `mudanca` | `conceito` |
|------------|-----------|-----------|------------|
| ContextMacro | ✓ | ✓ | ✓ |
| ProblemStatement | ✓ | ✓ | ✓ |
| FlowList / Flow | ✓ | — | — |
| ScreenSlot | ✓ | — | — |
| Comparative | — | ✓ (antes/depois) | ✓ (variantes A/B/C) |
| DecisionCriteria | — | — | ✓ |
| AnchorBox | ✓ (opcional) | ✓ (recomendado) | ✓ (opcional) |
| FinalAnalysis | ✓ | ✓ | ✓ (= decisão) |

## Schema canônico de templates

Cada tipo de tarefa é descrito por um arquivo JSONC validado por **JSON Schema** oficial em `schemas/template.schema.json`.

### Estrutura mínima do JSONC de template

```jsonc
// templates/feature.jsonc
{
  "$schema": "../schemas/template.schema.json",
  "type": "feature",
  "version": "1.0.0",
  "label": "Feature nova",
  "description": "Estrutura para apresentar uma feature do zero",

  "layout": {
    "kind": "horizontal-columns",
    "gap": 80,
    "padding": 64,
    "background": "{token:template.background}"
  },

  "structure": [
    {
      "id": "context",
      "component": "ContextMacro",
      "required": true,
      "props": { "icon": "star", "tokenBackground": "{token:tag.context.background}" }
    },
    {
      "id": "problem-statement",
      "component": "ProblemStatement",
      "required": true,
      "supportsRichText": true,
      "supportsHierarchy": true
    },
    {
      "id": "flows",
      "component": "FlowList",
      "required": true,
      "minCount": 1,
      "maxCount": 10,
      "itemTemplate": {
        "component": "Flow",
        "props": {
          "headerComponent": "SectionHeader",
          "screenComponent": "ScreenSlot",
          "minScreens": 1,
          "maxScreens": 20
        }
      }
    },
    {
      "id": "final-analysis",
      "component": "FinalAnalysis",
      "required": true,
      "sections": ["resolution", "strengths", "attention", "discussion"]
    }
  ],

  "checks": {
    "deterministic": [
      "problem-statement-not-empty",
      "no-empty-screen-slots",
      "no-placeholder-text",
      "final-analysis-not-empty"
    ]
  }
}
```

### Por que schema canônico

- **Validação automática** via `ajv` (ou similar) antes da execução; erros pegos cedo
- **Auto-complete em IDE** (VSCode/Cursor) ao editar JSONC
- **Documentação viva** — schema é a especificação dos templates
- **Renderização programática estável** — skill itera sobre `template.structure` em vez de if/else por tipo
- **Extensibilidade** — comunidade pode adicionar novos templates seguindo o schema

Tokens visuais referenciados via sintaxe `{token:nome.do.token}` resolvem em runtime conforme escolha de identidade visual.

## Conexão das telas com o template

- Antes de gerar, designer declara no comando: **número de fluxos × telas por fluxo**
- Skill cria nova page no Figma chamada `MC — <ticketRef>`
- Skill **duplica** as telas selecionadas pra essa nova page (originais ficam intocadas no canvas atual)
- Skill organiza as telas duplicadas dentro do template
- Pós-geração, designer pode adicionar/remover telas e fluxos manualmente, conversando com o agente

## Identidade visual

Designer escolhe explicitamente em `/meet-criteria-new` entre **2 caminhos**:

1. **Padrão Meet Criteria** (default) — estilo codificado na skill, **inspirado em [status-tags](https://www.figma.com/community/file/1156964537370007670/status-tags)** mas sem dependência externa. Componentes desenhados programaticamente via `use_figma`. Self-contained, versionado com a skill.
2. **Auto-detectar do arquivo do designer** — skill lê variáveis e styles via `figma_get_variables` + `figma_get_styles` e usa esses tokens (cores, fonte, espaçamentos) sobre a estrutura padrão. Útil quando o arquivo já tem DS robusto.

Sem detecção silenciosa. Default sugerido: opção 1.

### Por que codificar o estilo em vez de depender de library externa Figma

Avaliado e descartado: depender da library publicada no Community ou de um arquivo Figma externo. Razões:

- **Dependência externa frágil**: arquivo deletado/privado quebra a skill
- **Library "viral"**: mudanças no fonte alteram trabalhos antigos do designer sem aviso
- **Restrições enterprise**: muitos times bloqueiam libraries externas
- **Versionamento problemático**: Community Figma não tem semver
- **Onboarding extra**: ativar library no workspace é fricção
- **Conflito com auto-detect**: difícil reconciliar "library externa" + "DS do arquivo"

Codificar o estilo na skill resolve tudo isso: self-contained, git-versionado, estável, configurável e pronto pra enterprise. Status-tags fica como **inspiração registrada** em `docs/research/`, não como dependência runtime.

### Tokens do padrão Meet Criteria

| Token | Valor default | Uso |
|-------|--------------|-----|
| `tag.screen.background` | `#FF1F8F` (magenta) | Status-tag de tela |
| `tag.screen.text` | `#FFFFFF` | Texto do status-tag de tela |
| `tag.section.background` | `#1F1F1F` (preto) | Section header de fluxo |
| `tag.section.text` | `#FFFFFF` | Texto do section header |
| `tag.context.background` | `#FFFFFF` com borda magenta | Contexto macro |
| `anchor.box.background` | `#FFFFFF` | Caixa da âncora |
| `anchor.box.border` | `#E0E0E0` | Borda da âncora |
| `anchor.dot.color` | `#E5004C` | Ponto vermelho ancorado |
| `anchor.line.color` | `#E5004C` | Linha conectora |
| `font.family.default` | `Inter` | Tipografia padrão |
| `template.background` | `#262626` (cinza escuro) | Fundo do canvas do template |

No modo **auto-detect**, esses tokens são substituídos pelos equivalentes encontrados nas variáveis do arquivo do designer.

## Âncoras de anotação

### Formato customizado (default da skill)

Inspirado no padrão real "First-Time Login" observado em uso em campo:

- Caixa branca arredondada com borda fina
- Título em bold (resumo da decisão)
- Parágrafo descritivo (justificativa/contexto)
- Ponto vermelho na tela ancorado, com linha conectora até a caixa

### Comportamento

- Skill cria âncoras automaticamente quando a IA identifica pontos críticos durante `/meet-criteria-analyze` (ações 5)
- Designer cria manualmente via `/meet-criteria-anchor <texto>` na tela selecionada
- Designer edita conversando com o agente em linguagem natural ("muda o texto da âncora 2 da Tela 03")
- Só telas com algo a comunicar recebem âncoras — telas inalteradas ficam sem
- `/meet-criteria-export-annotations` faz **bulk conversion** das âncoras customizadas em Annotation nativa do Figma (útil para hand-off pra dev)

## Verificações determinísticas (4 enxutas no MVP)

Executadas como parte da skill, sem chamada extra de IA:

1. **Slots vazios** — Problem Statement, telas, análise final
2. **Texto placeholder não substituído** — ex: "Como essa tela resolve..."
3. **Telas sem âncora em tipos `mudanca`** — designer pode ter esquecido de explicar mudança
4. **Lista navegável de pendências** — agente reporta no terminal e oferece "ir para" via `figma_navigate`

## Ações da IA (5 no MVP)

Disparadas via `/meet-criteria-analyze` (controle de uso):

1. **Sugerir agrupamento de fluxos** — lê telas + ticket, propõe estrutura inicial
2. **Justificativa por tela** — gera "como essa tela resolve aspecto X do problema"
3. **Análise final** — gera bloco de resolução + pontos fortes + atenção + discussão
4. **Comparar ticket vs entregue** — detecta gaps entre critérios do ticket e o que aparece nas telas
5. **Sugerir âncoras de anotação** — identifica pontos críticos por tela; acionada implicitamente quando o agente julgar pertinente

Vision: agente "vê" telas via `figma_take_screenshot`. Imagens fluem no contexto do próprio agente — sem chamada externa.

## Slash commands (6)

| Comando | Função |
|---------|--------|
| `/meet-criteria-setup` | Onboarding em 6 passos (detecta Node, Figma Desktop, MCP, configura token, importa Bridge plugin, valida) |
| `/meet-criteria-new <tipo>` | Cria template novo. `<tipo>` = `feature` / `mudanca` / `conceito`. Pede ticket-ref, paste do ticket, fluxos×telas, escolha de identidade visual |
| `/meet-criteria-analyze` | Roda as 5 ações da IA (justificativas, análise final, comparação ticket, sugestão de âncoras quando aplicável) |
| `/meet-criteria-anchor <texto>` | Cria âncora de anotação na tela selecionada |
| `/meet-criteria-check` | Roda 4 verificações determinísticas |
| `/meet-criteria-export-annotations` | Converte âncoras customizadas em Annotation nativa (bulk) |

Operações pontuais (editar âncora, mover tela, etc.) ficam na conversa natural com o agente — sem comando dedicado.

## Onboarding (`/meet-criteria-setup`)

Baseado em [southleft/figma-console-mcp NPX Setup](https://github.com/southleft/figma-console-mcp#-npx-setup-recommended). Executado em primeira instalação (ou re-rodado se algo quebrar):

1. **Detectar Node.js 18+** — pré-requisito do MCP. `node --version`. Se faltar, orienta install
2. **Detectar Figma Desktop** — bridge plugin só roda no app desktop (não funciona com Figma web)
3. **Detectar `figma-console MCP` no cliente atual** — verifica se já está configurado em `.claude.json` / `mcp.json` / etc. Se ausente, oferece adicionar via comando direto:
   ```
   claude mcp add figma-console -s user \
     -e FIGMA_ACCESS_TOKEN=figd_<TOKEN> \
     -e ENABLE_MCP_APPS=true \
     -- npx -y figma-console-mcp@latest
   ```
   Para Cursor / Windsurf / Claude Desktop, a skill edita o config JSON correspondente.
4. **Pedir Personal Access Token (Fig ID)** — guia geração em [Manage personal access tokens](https://help.figma.com/hc/en-us/articles/8085703771159-Manage-personal-access-tokens). Escopos exigidos: **File content (Read)**, **Variables (Read)**, **Comments (Read+Write)**. Token começa com `figd_`. Salva via env var no MCP config (não em arquivo da skill)
5. **Importar Bridge plugin no Figma Desktop** — caminho estável: `~/.figma-console-mcp/plugin/manifest.json` (auto-criado pelo MCP server na primeira execução). Skill instrui: "Plugins → Development → Import plugin from manifest..." e aguarda confirmação. Bootloader carrega UI dinamicamente; não precisa re-importar em updates futuros
6. **Validação final** — `figma_list_open_files` + `figma_get_variables` em arquivo aberto. Se passar, marca `setup_complete: true` em `~/.config/meet-criteria/config.json`

### Estado da skill (apenas preferences)

```jsonc
// ~/.config/meet-criteria/config.json (permissões 600)
{
  "setup_complete": true,
  "setup_version": "1.0.0",
  "mcp_client": "claude-code", // "cursor" | "windsurf" | "claude-desktop"
  "preferences": {
    "language": "pt-BR",
    "default_visual_identity": "ask" // "ask" | "auto" | "default"
  }
}
```

**Token `figd_` nunca vive aqui.** Fica como variável de ambiente no config do MCP do cliente (`~/.claude.json`, `~/.cursor/mcp.json`, etc).

## Persistência de estado

Estado vive em **dois lugares complementares**:

### 1. Dentro do arquivo Figma (sempre)

Padrão **Tokens Studio**: metadata estruturada como JSON serializado em `setSharedPluginData('meetCriteria', <key>, <value>)`. Suportado pelo `use_figma` (per skill `figma-use`, regra 3a).

Chaves principais armazenadas no container raiz (`Meet Criteria — <ticketRef>`):

```js
node.setSharedPluginData('meetCriteria', 'role', 'root')
node.setSharedPluginData('meetCriteria', 'ticketRef', 'PROD-1234')
node.setSharedPluginData('meetCriteria', 'type', 'feature')
node.setSharedPluginData('meetCriteria', 'templateVersion', '1.0.0')
node.setSharedPluginData('meetCriteria', 'createdAt', '2026-05-01T15:30:00Z')
node.setSharedPluginData('meetCriteria', 'lastExecutedAt', '2026-05-02T10:00:00Z')
node.setSharedPluginData('meetCriteria', 'visualIdentity', 'meet-criteria')
node.setSharedPluginData('meetCriteria', 'config', JSON.stringify({...}))
```

Cada nó interno também carrega plugin data com seu papel (`screen-slot`, `flow-header`, `anchor-box`, etc.) e contexto (`flowId`, `screenIndex`, `variantId`).

### 2. Pasta local `.meet-criteria/<ticket-slug>/` (sempre, com fallback gracioso)

Skill cria essa pasta no diretório de trabalho do designer (current working directory do agente). Se filesystem é read-only ou skill não tem permissão, faz fallback para Figma-only com aviso.

**Por que existe** — o usuário pode querer **referenciar trabalho anterior em uso futuro da skill**:

- Continuar uma task no mesmo fluxo (segunda iteração não precisa re-analisar tudo)
- Alimentar o agente com referências iniciais (PNGs/Markdown de telas existentes pra dar contexto ao Claude)
- Reduzir tokens — em vez de a IA re-ler todas as telas, lê o resumo já gerado anteriormente
- Auditoria humana fora do Figma

**Conteúdo:**

```
.meet-criteria/
└── prod-1234/
    ├── metadata.json              # ticketRef, type, datas, links figma, paths
    ├── problem-statement.md       # texto colado do ticket
    ├── flows.md                   # descrição textual dos fluxos
    ├── screen-justifications.md   # uma seção por tela com a justificativa
    ├── analysis.md                # análise final em texto
    ├── anchors.json               # lista de âncoras com posições e textos
    └── references/                # imagens/textos que o designer adicionou pra dar contexto
        ├── existing-flow-v1.png
        └── notes.md
```

### Slug do ticket

Designer fornece **nome ou ID** ao iniciar `/meet-criteria-new`, conforme a convenção que ele já usa. Skill normaliza pra kebab-case:

- `PROD-1234` → `prod-1234`
- `Onboarding flow update` → `onboarding-flow-update`
- `[PROD-1234] Onboarding update` → `prod-1234-onboarding-update`

Slug aparece no nome do container Figma, na page nova (`MC — prod-1234`), na pasta local (`.meet-criteria/prod-1234/`), e nas chaves de plugin data.

## Distinção skill frames vs. designer frames

Estratégia híbrida: **container nomeado + shared plugin data** (padrão validado por Tokens Studio em produção).

### Container raiz visível

- Top-level frame nomeado `Meet Criteria — <ticketRef>`
- Carrega `setSharedPluginData('meetCriteria', 'role', 'root')` e demais metadados

### Nós internos com plugin data

- Cada nó criado pela skill recebe `setSharedPluginData('meetCriteria', 'role', '<role>')` + chaves contextuais
- Roles possíveis: `root`, `context-macro`, `problem-statement`, `flow`, `flow-header`, `screen-slot`, `screen-tag`, `comparative`, `anchor-box`, `anchor-dot`, `anchor-line`, `decision-criteria`, `final-analysis`

### Lógica de detecção

1. Skill busca containers `Meet Criteria — *` no arquivo (lista todos os tickets ativos)
2. Para operações em nó específico: verifica `meetCriteria.role` via `getSharedPluginData`
3. Se nó tem role mas está fora do container raiz: warning ("nó parece ter sido movido"), opera mesmo assim
4. Se nó sem role dentro do container: skill ignora (designer adicionou frame manual ali)

### Vantagens

- Designer enxerga "Meet Criteria — PROD-1234" no layers panel — sabe o que é da ferramenta
- Plugin data permite identificação programática precisa, mesmo se renomear container
- Sobrevive a duplicação (plugin data segue o nó)
- Nomes internos podem ser amigáveis ao designer ("Tela 02 - Pagamento"), sem prefixos artificiais

### Custo

`setSharedPluginData` em escala tem custo de bytes no arquivo. Templates típicos (5-15 nós) são negligíveis. Em arquivos com 100+ tickets ativos, vale revisitar.

## Estrutura do repositório

```
meet-criteria/
├── README.md
├── docs/
│   ├── superpowers/specs/2026-05-01-meet-criteria-design.md
│   └── research/
│       ├── README.md
│       └── screenshots/
├── skills/
│   ├── using-meet-criteria.md
│   ├── creating-templates.md
│   ├── analyzing-deliverables.md
│   ├── managing-anchors.md
│   ├── checking-deliverables.md
│   ├── adapting-visual-identity.md
│   └── setup-helper.md
├── commands/
│   ├── meet-criteria-setup.md
│   ├── meet-criteria-new.md
│   ├── meet-criteria-analyze.md
│   ├── meet-criteria-anchor.md
│   ├── meet-criteria-check.md
│   └── meet-criteria-export-annotations.md
├── templates/
│   ├── feature.jsonc
│   ├── mudanca.jsonc
│   └── conceito.jsonc
├── prompts/
│   ├── analyze-screen.md
│   ├── analyze-final.md
│   ├── compare-ticket.md
│   ├── suggest-anchors.md
│   └── suggest-flows.md
└── schemas/
    └── template.schema.json
```

## Skills de referência e composição

A skill **não é monolítica**. Compõe com skills oficiais do ecossistema:

### Dependência obrigatória — `figma/mcp-server-guide@figma-use`

Skill oficial do Figma (2K installs). Manual técnico canônico para o tool `use_figma` (executar JS dentro do Figma via figma-console MCP).

Inclui 17 regras críticas (return de IDs, font loading async, page switching, escopos de variáveis, atomicidade de erros, sintaxe `node.query()` CSS-like) e referências em `references/` (api-reference, gotchas, variable-patterns, working-with-design-systems, etc).

**Uso:** as skills do Meet Criteria que executam operações de escrita devem invocar `figma-use` antes. Ganha de graça toda a robustez de padrões e evita bugs comuns.

### Skill de referência — `julianoczkowski/designer-skills@design-review`

992 installs. Foca em revisar UI implementada em código (Playwright + screenshots em browser). Não é Figma-first, não compete diretamente. Padrão útil que adotamos: convenção de pasta `.<tool>/<feature-slug>/` com metadata + screenshots.

### Não usaremos

- `arvindrk/extract-design-system` — figma-console MCP já expõe vars/styles diretamente via `figma_get_variables` / `figma_get_styles`
- Library Figma externa publicada — descartado pelos motivos da seção "Identidade visual"
- Plugin Figma próprio — descartado pela arquitetura skills + MCP

## Premissas confirmadas

- ✅ Arquitetura: skills + figma-console MCP (sem plugin Figma próprio)
- ✅ IA = agente Claude do usuário (sem chamada externa, sem custo pro construtor)
- ✅ 3 tipos de tarefa: `feature`, `mudanca` (correção+iteração), `conceito`
- ✅ 6 slash commands (setup, new, analyze, anchor, check, export-annotations)
- ✅ Onboarding em 6 passos baseado no NPX Setup do southleft
- ✅ Token `figd_` em env var do MCP config; skill só guarda preferences em `~/.config/meet-criteria/config.json`
- ✅ Templates como JSONC com schema canônico em `schemas/template.schema.json`
- ✅ Hierarquia de 3 níveis (contexto → fluxo/seção → tela)
- ✅ Identidade visual: 2 caminhos (padrão Meet Criteria codificado / auto-detect do arquivo)
- ✅ Status-tags como inspiração em `docs/research/`, não dependência runtime
- ✅ 4 verificações determinísticas + 5 ações de IA no MVP
- ✅ Anchor format: caixa branca + ponto vermelho + linha conectora; bulk conversion pra Annotation nativa
- ✅ Persistência dual: shared plugin data no Figma + pasta `.meet-criteria/<slug>/`
- ✅ Distinção skill vs designer: container nomeado + plugin data (padrão Tokens Studio)
- ✅ Slug do ticket gerado de nome ou ID fornecido pelo designer
- ✅ Idioma pt-BR no MVP

## Pontos abertos para o plano de implementação

Não bloqueiam o spec, mas precisam ser decididos durante implementação:

- Comportamento exato em arquivos com múltiplas pages (foca na atual? processa todas?)
- Recuperação de erro: token expirado, MCP fora do ar, Figma fechou
- Como lidar quando o arquivo já tem template Meet Criteria gerado anteriormente para o mesmo ticket (sobrescreve, cria nova versão, atualiza in-place)
- Internacionalização futura (idiomas além de pt-BR)
- Aproveitar accessibility scanning do figma-console MCP v1.22+ (13 regras lint design + axe-core) como feature futura nas verificações
