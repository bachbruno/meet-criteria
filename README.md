# Meet Criteria

Skills + figma-console MCP que ajudam designers de produto a conectar tickets de design a entregáveis no Figma — estruturando entregáveis, ancorando decisões e gerando narrativa pra apresentação.

> **Status:** em construção. Plano 1 de 6 (Foundation) implementado. Veja `docs/superpowers/plans/`.

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
│   └── visual-tokens.mjs     # registry default + resolver {token:...}
├── scripts/
│   └── validate-templates.mjs
├── skills/                   # (próximos planos)
├── commands/                 # (próximos planos)
└── prompts/                  # (próximos planos)
```

## Pré-requisitos

- Node.js 20+ (`nvm use` respeita `.nvmrc`)
- npm

## Comandos

```bash
npm install                  # instala deps (ajv, ajv-formats, jsonc-parser)
npm test                     # roda suíte node:test (validador + tokens)
npm run validate:templates   # valida templates/*.jsonc contra o schema
```

## Roadmap (planos restantes)

1. ✅ Foundation — schema, templates, tokens, validador
2. ⏭ Setup & onboarding (`/meet-criteria-setup`)
3. ⏭ Geração de templates (`/meet-criteria-new`)
4. ⏭ Análise IA (`/meet-criteria-analyze`)
5. ⏭ Âncoras (`/meet-criteria-anchor`, `/meet-criteria-export-annotations`)
6. ⏭ Checks determinísticos (`/meet-criteria-check`)

## Licença

A definir.
