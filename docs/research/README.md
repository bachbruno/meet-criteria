# Research — Padrões reais observados

Este diretório documenta padrões visuais e estruturais coletados de uso real em campo. Serve como referência permanente para implementadores e revisores da skill.

## Origem

- Autor: Bruno Bach
- Biblioteca pública relacionada: [status-tags na Figma Community](https://www.figma.com/community/file/1156964537370007670/status-tags) — adotada por múltiplos times
- Capturas reais de uso: ver arquivos de imagem nesta pasta (a serem adicionados manualmente em `screenshots/`)

## Padrões observados

### 1. Hierarquia textual lado a lado das telas

Designers escrevem dois grandes blocos textuais ao lado das telas:

- **Bloco 1 — Problem statement detalhado**: descrição estruturada do que precisa existir, com bullets hierárquicos
  - Exemplo de tópicos: "What/Where are Admin/Moderator Controls and Rights in this UI?"
  - Sub-bullets representam decomposição funcional
- **Bloco 2 — Main Actions/Info ordered by EMBEDDED priority**: lista hierárquica de fluxos, telas, ações, tudo organizado por prioridade implícita pela ordem

**Mapeamento na skill:** componente `Problem Statement` deve suportar texto rico hierárquico (não só parágrafo único). Aceita estrutura de bullets/sub-bullets.

### 2. Status-tags como rótulo de cada tela

Cada tela mobile mostrada (em sequência) tem uma **tag pequena** acima do mockup:

- Forma: rounded rectangle (border-radius alto)
- Cor: rosa/magenta vibrante
- Conteúdo: ícone de plataforma (mobile, web, etc.) + texto curto
- Exemplos vistos: "Only 1 Video", "With Videos", "Mic Queue", "With Chat/Voice", "Only Chat", "More Options", "Swipe to Hide", "Members List", "Leave Queue", "Empty State", "Chat", "Queue", "Empty Queue", "Welcome", "Discover", "Shop", "Messages", "Profile"

**Mapeamento na skill:** componente `Tela` recebe um status-tag por instância. Tag é gerada programaticamente, com texto vindo do nome da tela ou da variante.

### 3. Section headers para agrupamento

Acima de grupos de telas, há **headers maiores** rotulando o agrupamento:

- Forma: rounded rectangle escuro (preto/cinza escuro)
- Cor: fundo escuro, texto branco
- Conteúdo: ícone (mobile, monitor, estrela) + texto descritivo longo
- Exemplos: "Option 1 - Flexible Chat Component", "Option 2 - Similar to 1 but Main actions close to finger", "Option 3 - Text over video + swipe to hide chat UI", "Mobile App", "Onboarding - 30 Days (OG)"

**Mapeamento na skill:** componente `Fluxo / Seção` usa esse formato. Tipos especiais (ex: "Onboarding - 30 Days (OG)" com estrela) viram `Contexto macro`.

### 4. Annotation callout (anchor)

Anotações específicas em telas seguem o padrão observado em "First-Time Login":

- Caixa branca arredondada com borda fina
- Título em bold (ex: "First-Time Login")
- Parágrafo descritivo com contexto/justificativa da decisão
- **Ponto vermelho** ancorado em um ponto da tela
- **Linha vertical** conectando o ponto à caixa de texto

**Mapeamento na skill:** componente `Âncora customizada`. Skill gera ponto + linha + caixa programaticamente. Conversão pra Annotation nativa do Figma mantém o ponto âncora.

### 5. Nesting hierárquico de 3 níveis

Estrutura observada nos arquivos:

1. **Contexto macro** (ex: "Mobile App")
2. **Fluxo / Seção** (ex: "Room Members - Option 1", "Mic Queue - Option 1")
3. **Tela / Variante / Estado** (ex: "Members List", "Leave Queue", "Empty State")

**Mapeamento na skill:** templates respeitam essa hierarquia, com section headers marcando cada nível.

### 6. Múltiplas variantes lado a lado

Para tipo "novo conceito", designers organizam:

- Cada **Option** (Option 1, Option 2, Option 3) vira uma **section**
- Dentro de cada section, todas as telas/estados que compõem aquela direção
- Comparação visual lado a lado das opções inteiras

**Mapeamento na skill:** template do tipo `conceito` gera N sections em paralelo, cada uma com seu conjunto de telas. Critérios de decisão ficam abaixo ou ao lado.

## Como adicionar screenshots reais

1. Crie a pasta `screenshots/` aqui
2. Arraste os PNGs originais com nomes descritivos:
   - `01-flexible-chat-component-options.png`
   - `02-mobile-app-room-members-mic-queue.png`
   - `03-overall-look-and-feel.png`
   - `04-onboarding-taking-the-tour.png`
3. Referencie nos arquivos de skill conforme necessário

## Diretrizes derivadas para a skill

A partir destes padrões, ficou definido (ver spec):

- Status-tags **inspira** mas não é dependência: estilo codificado na skill (ver decisão na spec, seção "Identidade visual")
- Hierarquia de 3 níveis é nativa do template
- Anchor format é fixo (caixa + ponto + linha)
- 2 caminhos de identidade visual: auto-detect do arquivo OU padrão Meet Criteria
