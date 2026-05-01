# Meet Criteria

Skills + figma-console MCP que ajudam designers de produto a conectar tickets de design a entregáveis no Figma — estruturando entregáveis, ancorando decisões e gerando narrativa pra apresentação.

> **Status:** em construção. Planos 1 e 2 (Foundation + Setup & Onboarding) implementados. Veja `docs/superpowers/plans/`.

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
│   └── config.mjs            # ~/.config/meet-criteria/config.json (perms 600)
├── scripts/
│   ├── validate-templates.mjs
│   ├── check-environment.mjs # diagnóstico de setup
│   └── init-config.mjs       # materializa config.json
├── skills/
│   └── setup-helper.md       # orquestra os 6 passos do onboarding
├── commands/
│   └── meet-criteria-setup.md
└── prompts/                  # (próximos planos)
```

## Pré-requisitos

- Node.js 20+ (`nvm use` respeita `.nvmrc`)
- npm

## Comandos

```bash
npm install                  # instala deps (ajv, ajv-formats, jsonc-parser)
npm test                     # roda suíte node:test (validador + tokens + setup)
npm run validate:templates   # valida templates/*.jsonc contra o schema
npm run check:environment    # diagnostica Node, Figma Desktop e clientes MCP
npm run setup:write-config   # escreve ~/.config/meet-criteria/config.json
```

## Setup

Se você já tem Claude Code (ou Cursor / Windsurf / Claude Desktop) rodando, basta invocar `/meet-criteria-setup` no agente. O fluxo guiará 6 passos: Node 18+, Figma Desktop, `figma-console MCP`, Personal Access Token, Bridge plugin no Figma Desktop, validação final.

Detalhes em [`skills/setup-helper.md`](skills/setup-helper.md).

## Roadmap (planos restantes)

1. ✅ Foundation — schema, templates, tokens, validador
2. ✅ Setup & onboarding (`/meet-criteria-setup`)
3. ⏭ Geração de templates (`/meet-criteria-new`)
4. ⏭ Análise IA (`/meet-criteria-analyze`)
5. ⏭ Âncoras (`/meet-criteria-anchor`, `/meet-criteria-export-annotations`)
6. ⏭ Checks determinísticos (`/meet-criteria-check`)

## Licença

A definir.
