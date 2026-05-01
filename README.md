# Meet Criteria

Skills + figma-console MCP que ajudam designers de produto a conectar tickets de design a entregáveis no Figma — estruturando entregáveis, ancorando decisões e gerando narrativa pra apresentação.

> **Status:** em construção. Planos 1, 2 e 3 (Foundation + Setup & Onboarding + /meet-criteria-new) implementados. Veja `docs/superpowers/plans/`.

## Arquitetura em 1 parágrafo

Não construímos plugin Figma. O agente Claude (no Claude Code, Cursor, ou Claude Desktop) executa skills documentadas em `skills/`, dispara comandos em `commands/`, lê templates `JSONC` em `templates/`, e renderiza no Figma via [figma-console MCP](https://github.com/southleft/figma-console-mcp). Tokens visuais default ficam em `lib/visual-tokens.mjs` (derivados da paleta default do Tailwind CSS — ver `lib/tailwind-palette.mjs`). Spec completo: [`docs/superpowers/specs/2026-05-01-meet-criteria-design.md`](docs/superpowers/specs/2026-05-01-meet-criteria-design.md).

## Estrutura do repositório

```
meet-criteria/
├── README.md
├── package.json
├── docs/
│   ├── superpowers/specs/    # spec do produto
│   ├── superpowers/plans/    # planos de implementação
│   └── research/             # screenshots + notas de validação
├── schemas/
│   └── template.schema.json  # contrato canônico dos templates
├── templates/
│   ├── feature.jsonc
│   ├── mudanca.jsonc
│   └── conceito.jsonc
├── lib/
│   ├── tailwind-palette.mjs  # subset da paleta default Tailwind
│   ├── visual-tokens.mjs     # registry default + resolver {token:...}
│   ├── system-checks.mjs     # detecção Node.js + Figma Desktop
│   ├── mcp-detect.mjs        # detecção de clientes MCP e figma-console
│   ├── config.mjs            # ~/.config/meet-criteria/config.json (perms 600)
│   ├── slug.mjs              # normalização de ticket-ref pra kebab-case
│   ├── template-loader.mjs   # carrega + valida templates/<type>.jsonc
│   ├── visual-identity.mjs   # default vs auto-detect + overrides
│   ├── render-manifest.mjs   # plano declarativo de renderização
│   └── local-store.mjs       # bootstrap .meet-criteria/<slug>/
├── scripts/
│   ├── validate-templates.mjs
│   ├── check-environment.mjs # diagnóstico de setup
│   ├── init-config.mjs       # materializa config.json
│   └── new-deliverable.mjs   # gera manifest + bootstrap local store
├── skills/
│   ├── setup-helper.md       # orquestra os 6 passos do onboarding
│   └── creating-templates.md # orquestra os 9 passos do /meet-criteria-new
├── commands/
│   ├── meet-criteria-setup.md
│   └── meet-criteria-new.md
└── prompts/                  # (próximos planos)
```

## Pré-requisitos

- Node.js 20+ (`nvm use` respeita `.nvmrc`)
- npm

## Comandos

```bash
npm install                  # instala deps (ajv, ajv-formats, jsonc-parser)
npm test                     # roda suíte node:test (validador + tokens + setup + new)
npm run validate:templates   # valida templates/*.jsonc contra o schema
npm run check:environment    # diagnostica Node, Figma Desktop e clientes MCP
npm run setup:write-config   # escreve ~/.config/meet-criteria/config.json
npm run new:deliverable      # CLI: gera manifest + bootstrap .meet-criteria/<slug>/
```

## Setup

Se você já tem Claude Code (ou Cursor / Windsurf / Claude Desktop) rodando, basta invocar `/meet-criteria-setup` no agente. O fluxo guiará 6 passos: Node 18+, Figma Desktop, `figma-console MCP`, Personal Access Token, Bridge plugin no Figma Desktop, validação final.

Detalhes em [`skills/setup-helper.md`](skills/setup-helper.md).

## Criando um entregável

Com `setup_complete=true`, invoque no agente: `/meet-criteria-new feature` (ou `mudanca` / `conceito`). A skill `creating-templates` conduz o fluxo (9 passos): coleta tipo, ticket-ref, problem statement, estrutura específica do tipo, identidade visual, chama o CLI `new:deliverable`, recebe o manifest, pede seleção das telas no Figma, e renderiza tudo na page nova `MC — <slug>` com container `Meet Criteria — <ticketRef>`. Estado fica em duas camadas: shared plugin data nos nós Figma + `.meet-criteria/<slug>/` no working directory.

Detalhes: [`skills/creating-templates.md`](skills/creating-templates.md).

## Roadmap (planos restantes)

1. ✅ Foundation — schema, templates, tokens, validador
2. ✅ Setup & onboarding (`/meet-criteria-setup`)
3. ✅ Geração de templates (`/meet-criteria-new`)
4. ⏭ Análise IA (`/meet-criteria-analyze`)
5. ⏭ Âncoras (`/meet-criteria-anchor`, `/meet-criteria-export-annotations`)
6. ⏭ Checks determinísticos (`/meet-criteria-check`)

## Licença

A definir.
