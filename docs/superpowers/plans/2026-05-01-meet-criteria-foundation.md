# Meet Criteria — Foundation Implementation Plan (Plano 1 de 6)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir a fundação do repositório Meet Criteria — scaffold do repo, JSON Schema canônico para templates, três templates JSONC (`feature`, `mudanca`, `conceito`), módulo de tokens visuais default, e validador automatizado. Saída desta fase: contratos de dados validados e testados, prontos pra serem consumidos pelas skills/commands nos planos seguintes.

**Architecture:** Tudo é conteúdo estático (JSON Schema, JSONC, JS data) + um validador Node.js que roda em CI. Nenhuma integração com Figma/MCP nesta fase — isso entra nos planos 3+. O validador usa `ajv` contra o schema canônico em `schemas/template.schema.json`. O módulo de tokens é JS puro (sem deps), retornando defaults Meet Criteria com função de resolução `{token:nome.do.token}`.

**Tech Stack:** Node.js 20+, ajv 8.x + ajv-formats, jsonc-parser (parsing JSONC com comments), `node:test` (test runner built-in, sem dependência), JSON Schema Draft 2020-12.

**Escopo (planos seguintes — não cobertos aqui):**
- Plano 2 — Setup & onboarding (`/meet-criteria-setup` + skill `setup-helper`)
- Plano 3 — Geração de templates (`/meet-criteria-new` + skill `creating-templates` + renderer Figma + persistência)
- Plano 4 — Análise IA (`/meet-criteria-analyze` + skill `analyzing-deliverables` + 5 prompts)
- Plano 5 — Âncoras (`/meet-criteria-anchor` + `/meet-criteria-export-annotations` + skill `managing-anchors`)
- Plano 6 — Checks determinísticos (`/meet-criteria-check` + skill `checking-deliverables`)

---

## File Structure

Novo nesta fase:

- Create: `package.json` — manifesto Node, scripts, deps `ajv`, `ajv-formats`, `jsonc-parser`
- Create: `.nvmrc` — versão do Node (20)
- Create: `.editorconfig` — consistência de formatação
- Create: `.gitignore` — já existe (não modificar regras existentes)
- Create: `schemas/template.schema.json` — JSON Schema canônico Draft 2020-12
- Create: `schemas/__fixtures__/valid-minimal.jsonc` — fixture mínimo válido
- Create: `schemas/__fixtures__/invalid-missing-type.jsonc` — fixture sem `type`
- Create: `schemas/__fixtures__/invalid-bad-component.jsonc` — fixture com componente inexistente
- Create: `templates/feature.jsonc` — template `feature` completo
- Create: `templates/mudanca.jsonc` — template `mudanca` completo
- Create: `templates/conceito.jsonc` — template `conceito` completo
- Create: `lib/visual-tokens.mjs` — registry default + resolver `{token:...}`
- Create: `lib/visual-tokens.test.mjs` — testes do resolver
- Create: `scripts/validate-templates.mjs` — CLI de validação (consome schema + templates)
- Create: `scripts/validate-templates.test.mjs` — testes do validador
- Create: `README.md` — overview + roadmap + comandos

Diretórios deixados vazios com `.gitkeep` (preenchidos em planos seguintes):

- `skills/.gitkeep`
- `commands/.gitkeep`
- `prompts/.gitkeep`

Cada arquivo tem responsabilidade única:
- Schema: contrato dos templates (one source of truth).
- Templates: instâncias do schema (3 tipos).
- Tokens: registry default + resolver puro (zero deps).
- Validator: ferramenta CI que casa schema × templates.
- README: navegação humana.

---

## Tasks

### Task 1: Inicializar manifesto Node e diretórios

**Files:**
- Create: `package.json`
- Create: `.nvmrc`
- Create: `.editorconfig`
- Create: `skills/.gitkeep`
- Create: `commands/.gitkeep`
- Create: `prompts/.gitkeep`
- Create: `schemas/.gitkeep` (será removido na Task 3)
- Create: `templates/.gitkeep` (será removido na Task 5)
- Create: `lib/.gitkeep` (será removido na Task 7)
- Create: `scripts/.gitkeep` (será removido na Task 4)

- [ ] **Step 1: Criar `package.json`**

```json
{
  "name": "meet-criteria",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "description": "Skills + figma-console MCP para conectar tickets de design a entregáveis no Figma",
  "engines": {
    "node": ">=20"
  },
  "scripts": {
    "test": "node --test --test-reporter=spec",
    "validate:templates": "node scripts/validate-templates.mjs templates/*.jsonc"
  },
  "dependencies": {
    "ajv": "^8.17.1",
    "ajv-formats": "^3.0.1",
    "jsonc-parser": "^3.3.1"
  }
}
```

- [ ] **Step 2: Criar `.nvmrc`**

```
20
```

- [ ] **Step 3: Criar `.editorconfig`**

```ini
root = true

[*]
indent_style = space
indent_size = 2
end_of_line = lf
charset = utf-8
trim_trailing_whitespace = true
insert_final_newline = true

[*.md]
trim_trailing_whitespace = false
```

- [ ] **Step 4: Criar `.gitkeep` em diretórios vazios**

Comandos (rode um por um):

```bash
mkdir -p skills commands prompts schemas templates lib scripts
touch skills/.gitkeep commands/.gitkeep prompts/.gitkeep schemas/.gitkeep templates/.gitkeep lib/.gitkeep scripts/.gitkeep
```

- [ ] **Step 5: Instalar dependências**

Run: `npm install`
Expected: cria `node_modules/` e `package-lock.json` sem erros. `node_modules/ajv/package.json` deve existir.

- [ ] **Step 6: Adicionar `node_modules/` ao `.gitignore`**

Verifique se já está em `.gitignore`. Se não estiver, adicione no final:

```
node_modules/
```

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json .nvmrc .editorconfig .gitignore \
  skills/.gitkeep commands/.gitkeep prompts/.gitkeep \
  schemas/.gitkeep templates/.gitkeep lib/.gitkeep scripts/.gitkeep
git commit -m "chore: bootstrap node project + repo scaffold"
```

---

### Task 2: Criar fixtures do JSON Schema (TDD — fixtures antes do schema)

**Files:**
- Create: `schemas/__fixtures__/valid-minimal.jsonc`
- Create: `schemas/__fixtures__/invalid-missing-type.jsonc`
- Create: `schemas/__fixtures__/invalid-bad-component.jsonc`

Os fixtures definem o contrato esperado antes de escrevermos o schema, dirigindo o design.

- [ ] **Step 1: Criar `schemas/__fixtures__/valid-minimal.jsonc`**

```jsonc
// Fixture: instância mínima válida do template.
// Existe um único nó obrigatório (ProblemStatement) — qualquer template real terá mais.
{
  "$schema": "../template.schema.json",
  "type": "feature",
  "version": "1.0.0",
  "label": "Mínimo válido",
  "description": "Usado em testes do validador",
  "layout": {
    "kind": "horizontal-columns",
    "gap": 80,
    "padding": 64,
    "background": "{token:template.background}"
  },
  "structure": [
    {
      "id": "problem-statement",
      "component": "ProblemStatement",
      "required": true
    }
  ]
}
```

- [ ] **Step 2: Criar `schemas/__fixtures__/invalid-missing-type.jsonc`**

```jsonc
// Fixture: inválido — falta o campo `type` (que é required).
{
  "version": "1.0.0",
  "label": "Sem type",
  "layout": { "kind": "horizontal-columns" },
  "structure": [
    {
      "id": "problem-statement",
      "component": "ProblemStatement",
      "required": true
    }
  ]
}
```

- [ ] **Step 3: Criar `schemas/__fixtures__/invalid-bad-component.jsonc`**

```jsonc
// Fixture: inválido — componente "WhateverNotInEnum" não existe no enum oficial.
{
  "type": "feature",
  "version": "1.0.0",
  "label": "Componente inexistente",
  "layout": { "kind": "horizontal-columns" },
  "structure": [
    {
      "id": "x",
      "component": "WhateverNotInEnum",
      "required": true
    }
  ]
}
```

- [ ] **Step 4: Commit**

```bash
git add schemas/__fixtures__/
git commit -m "test: add JSON schema fixtures (valid + 2 invalid cases)"
```

---

### Task 3: Escrever JSON Schema canônico

**Files:**
- Delete: `schemas/.gitkeep`
- Create: `schemas/template.schema.json`

- [ ] **Step 1: Remover `.gitkeep`**

```bash
rm schemas/.gitkeep
```

- [ ] **Step 2: Criar `schemas/template.schema.json`**

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://meet-criteria.dev/schemas/template.schema.json",
  "title": "Meet Criteria Template",
  "description": "Estrutura canônica de um template de entregável (feature, mudanca, conceito).",
  "type": "object",
  "additionalProperties": false,
  "required": ["type", "version", "label", "layout", "structure"],
  "properties": {
    "$schema": { "type": "string" },
    "type": {
      "description": "Tipo de tarefa que o template descreve.",
      "enum": ["feature", "mudanca", "conceito"]
    },
    "version": {
      "type": "string",
      "pattern": "^\\d+\\.\\d+\\.\\d+$",
      "description": "SemVer do template."
    },
    "label": { "type": "string", "minLength": 1 },
    "description": { "type": "string" },
    "layout": { "$ref": "#/$defs/layout" },
    "structure": {
      "type": "array",
      "minItems": 1,
      "items": { "$ref": "#/$defs/structureNode" }
    },
    "checks": { "$ref": "#/$defs/checks" }
  },
  "$defs": {
    "layout": {
      "type": "object",
      "additionalProperties": false,
      "required": ["kind"],
      "properties": {
        "kind": { "enum": ["horizontal-columns", "vertical-stack", "grid"] },
        "gap": { "type": "number", "minimum": 0 },
        "padding": { "type": "number", "minimum": 0 },
        "background": { "type": "string" }
      }
    },
    "componentName": {
      "enum": [
        "ContextMacro",
        "ProblemStatement",
        "FlowList",
        "Flow",
        "SectionHeader",
        "ScreenSlot",
        "Comparative",
        "DecisionCriteria",
        "AnchorBox",
        "FinalAnalysis"
      ]
    },
    "structureNode": {
      "type": "object",
      "additionalProperties": false,
      "required": ["id", "component"],
      "properties": {
        "id": {
          "type": "string",
          "pattern": "^[a-z][a-z0-9-]*$",
          "description": "Slug kebab-case único dentro do template."
        },
        "component": { "$ref": "#/$defs/componentName" },
        "required": { "type": "boolean" },
        "props": { "type": "object" },
        "supportsRichText": { "type": "boolean" },
        "supportsHierarchy": { "type": "boolean" },
        "minCount": { "type": "integer", "minimum": 0 },
        "maxCount": { "type": "integer", "minimum": 1 },
        "minScreens": { "type": "integer", "minimum": 0 },
        "maxScreens": { "type": "integer", "minimum": 1 },
        "sections": {
          "type": "array",
          "items": { "type": "string", "minLength": 1 },
          "uniqueItems": true
        },
        "itemTemplate": { "$ref": "#/$defs/itemTemplate" }
      }
    },
    "itemTemplate": {
      "type": "object",
      "additionalProperties": false,
      "required": ["component"],
      "properties": {
        "component": { "$ref": "#/$defs/componentName" },
        "props": { "type": "object" }
      }
    },
    "checks": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "deterministic": {
          "type": "array",
          "items": { "type": "string", "minLength": 1 },
          "uniqueItems": true
        }
      }
    }
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add schemas/template.schema.json
git rm schemas/.gitkeep 2>/dev/null || true
git commit -m "feat(schema): add canonical template JSON Schema (Draft 2020-12)"
```

---

### Task 4: Escrever validador com testes (TDD)

**Files:**
- Delete: `scripts/.gitkeep`
- Create: `scripts/validate-templates.mjs`
- Create: `scripts/validate-templates.test.mjs`

- [ ] **Step 1: Remover `.gitkeep`**

```bash
rm scripts/.gitkeep
```

- [ ] **Step 2: Escrever teste do validador (vai falhar — script ainda não existe)**

Crie `scripts/validate-templates.test.mjs`:

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { validateTemplate } from './validate-templates.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const fixtures = join(here, '..', 'schemas', '__fixtures__')

test('valid-minimal.jsonc passa', () => {
  const result = validateTemplate(join(fixtures, 'valid-minimal.jsonc'))
  assert.equal(result.valid, true, JSON.stringify(result.errors))
  assert.deepEqual(result.errors, [])
})

test('invalid-missing-type.jsonc falha com erro mencionando "type"', () => {
  const result = validateTemplate(join(fixtures, 'invalid-missing-type.jsonc'))
  assert.equal(result.valid, false)
  const message = result.errors.map((e) => e.message + ' ' + (e.params?.missingProperty ?? '')).join(' | ')
  assert.match(message, /type/)
})

test('invalid-bad-component.jsonc falha com erro de enum', () => {
  const result = validateTemplate(join(fixtures, 'invalid-bad-component.jsonc'))
  assert.equal(result.valid, false)
  const hasEnumError = result.errors.some((e) => e.keyword === 'enum')
  assert.equal(hasEnumError, true)
})

test('arquivo inexistente devolve erro de IO', () => {
  const result = validateTemplate(join(fixtures, '__missing__.jsonc'))
  assert.equal(result.valid, false)
  assert.match(result.errors[0].message, /ENOENT|not found|no such file/i)
})
```

- [ ] **Step 3: Rodar testes — devem falhar com "Cannot find module"**

Run: `npm test`
Expected: erro `ERR_MODULE_NOT_FOUND` apontando pra `validate-templates.mjs`.

- [ ] **Step 4: Implementar `scripts/validate-templates.mjs`**

```js
#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import Ajv from 'ajv/dist/2020.js'
import addFormats from 'ajv-formats'
import { parse as parseJsonc } from 'jsonc-parser'

const here = dirname(fileURLToPath(import.meta.url))
const SCHEMA_PATH = resolve(here, '..', 'schemas', 'template.schema.json')

let cachedValidator = null

function getValidator() {
  if (cachedValidator) return cachedValidator
  const schema = JSON.parse(readFileSync(SCHEMA_PATH, 'utf8'))
  const ajv = new Ajv({ allErrors: true, strict: true })
  addFormats(ajv)
  cachedValidator = ajv.compile(schema)
  return cachedValidator
}

export function validateTemplate(filePath) {
  let raw
  try {
    raw = readFileSync(filePath, 'utf8')
  } catch (err) {
    return { valid: false, errors: [{ message: err.message, keyword: 'io' }] }
  }
  const parseErrors = []
  const data = parseJsonc(raw, parseErrors, { allowTrailingComma: true })
  if (parseErrors.length > 0) {
    return {
      valid: false,
      errors: parseErrors.map((e) => ({
        message: `JSONC parse error code ${e.error} at offset ${e.offset}`,
        keyword: 'parse',
      })),
    }
  }
  const validate = getValidator()
  const valid = validate(data)
  return { valid, errors: valid ? [] : (validate.errors ?? []) }
}

async function main() {
  const args = process.argv.slice(2)
  if (args.length === 0) {
    console.error('Usage: validate-templates.mjs <file.jsonc> [more.jsonc ...]')
    process.exit(2)
  }
  let allValid = true
  for (const file of args) {
    const abs = resolve(file)
    const { valid, errors } = validateTemplate(abs)
    if (valid) {
      console.log(`OK  ${file}`)
    } else {
      allValid = false
      console.error(`ERR ${file}`)
      for (const e of errors) {
        const where = e.instancePath || '(root)'
        console.error(`     ${where} ${e.keyword ?? ''}: ${e.message}`)
        if (e.params) console.error(`       params: ${JSON.stringify(e.params)}`)
      }
    }
  }
  process.exit(allValid ? 0 : 1)
}

const isMain = import.meta.url === `file://${process.argv[1]}`
if (isMain) main()
```

- [ ] **Step 5: Rodar testes — devem passar**

Run: `npm test`
Expected: 4 tests pass. Output mostra cada teste com ✔.

- [ ] **Step 6: Sanity-check rodando o CLI manualmente**

Run: `node scripts/validate-templates.mjs schemas/__fixtures__/valid-minimal.jsonc`
Expected: `OK  schemas/__fixtures__/valid-minimal.jsonc` e exit 0.

Run: `node scripts/validate-templates.mjs schemas/__fixtures__/invalid-missing-type.jsonc`
Expected: `ERR ...` com detalhes do erro e exit 1.

- [ ] **Step 7: Commit**

```bash
git add scripts/validate-templates.mjs scripts/validate-templates.test.mjs
git rm scripts/.gitkeep 2>/dev/null || true
git commit -m "feat(scripts): add ajv-based template validator with tests"
```

---

### Task 5: Escrever `templates/feature.jsonc`

**Files:**
- Delete: `templates/.gitkeep` (depois da última task que cria template)
- Create: `templates/feature.jsonc`

- [ ] **Step 1: Criar `templates/feature.jsonc`**

```jsonc
// Template para apresentação de feature nova (greenfield).
// Estrutura: Contexto + Problem Statement + N fluxos × M telas + Análise final.
{
  "$schema": "../schemas/template.schema.json",
  "type": "feature",
  "version": "1.0.0",
  "label": "Feature nova",
  "description": "Estrutura para apresentar uma feature do zero, com fluxos e telas justificadas.",

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
      "props": {
        "icon": "star",
        "tokenBackground": "{token:tag.context.background}"
      }
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

- [ ] **Step 2: Validar via CLI**

Run: `node scripts/validate-templates.mjs templates/feature.jsonc`
Expected: `OK  templates/feature.jsonc` e exit 0.

- [ ] **Step 3: Commit**

```bash
git add templates/feature.jsonc
git commit -m "feat(templates): add feature.jsonc template"
```

---

### Task 6: Escrever `templates/mudanca.jsonc`

**Files:**
- Create: `templates/mudanca.jsonc`

- [ ] **Step 1: Criar `templates/mudanca.jsonc`**

```jsonc
// Template para correção UX ou iteração de tela existente.
// Estrutura: Contexto + Problem Statement + Comparativo (antes/depois × tela) + Análise final.
// "Correção UX" e "iteração" foram fundidas — estruturalmente idênticas.
{
  "$schema": "../schemas/template.schema.json",
  "type": "mudanca",
  "version": "1.0.0",
  "label": "Mudança (correção UX / iteração)",
  "description": "Estrutura para apresentar uma correção ou iteração comparando antes e depois.",

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
      "props": {
        "icon": "refresh",
        "tokenBackground": "{token:tag.context.background}"
      }
    },
    {
      "id": "problem-statement",
      "component": "ProblemStatement",
      "required": true,
      "supportsRichText": true,
      "supportsHierarchy": true
    },
    {
      "id": "comparative",
      "component": "Comparative",
      "required": true,
      "minCount": 1,
      "maxCount": 20,
      "props": {
        "kind": "before-after",
        "labels": ["Antes", "Depois"],
        "screenComponent": "ScreenSlot",
        "anchorRecommended": true
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
      "anchors-required-for-mudanca",
      "final-analysis-not-empty"
    ]
  }
}
```

- [ ] **Step 2: Validar**

Run: `node scripts/validate-templates.mjs templates/mudanca.jsonc`
Expected: `OK  templates/mudanca.jsonc` e exit 0.

- [ ] **Step 3: Commit**

```bash
git add templates/mudanca.jsonc
git commit -m "feat(templates): add mudanca.jsonc template"
```

---

### Task 7: Escrever `templates/conceito.jsonc`

**Files:**
- Create: `templates/conceito.jsonc`
- Delete: `templates/.gitkeep`

- [ ] **Step 1: Criar `templates/conceito.jsonc`**

```jsonc
// Template para explorar variantes A/B/C de tela existente.
// Estrutura: Contexto + Problem Statement + Variantes lado a lado + Critérios de decisão + Análise.
{
  "$schema": "../schemas/template.schema.json",
  "type": "conceito",
  "version": "1.0.0",
  "label": "Conceito (variantes A/B/C)",
  "description": "Estrutura para explorar variantes de uma tela com critérios de decisão explícitos.",

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
      "props": {
        "icon": "compass",
        "tokenBackground": "{token:tag.context.background}"
      }
    },
    {
      "id": "problem-statement",
      "component": "ProblemStatement",
      "required": true,
      "supportsRichText": true,
      "supportsHierarchy": true
    },
    {
      "id": "variants",
      "component": "Comparative",
      "required": true,
      "minCount": 2,
      "maxCount": 5,
      "props": {
        "kind": "variants",
        "labels": ["Variante A", "Variante B", "Variante C", "Variante D", "Variante E"],
        "screenComponent": "ScreenSlot"
      }
    },
    {
      "id": "decision-criteria",
      "component": "DecisionCriteria",
      "required": true,
      "supportsRichText": true,
      "supportsHierarchy": true
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

- [ ] **Step 2: Validar todos os templates de uma vez**

Run: `npm run validate:templates`
Expected:
```
OK  templates/feature.jsonc
OK  templates/mudanca.jsonc
OK  templates/conceito.jsonc
```
Exit 0.

- [ ] **Step 3: Remover `.gitkeep` de templates**

```bash
rm templates/.gitkeep
```

- [ ] **Step 4: Commit**

```bash
git add templates/conceito.jsonc
git rm templates/.gitkeep 2>/dev/null || true
git commit -m "feat(templates): add conceito.jsonc template"
```

---

### Task 8: Adicionar fixtures no schema test (cobertura dos 3 tipos)

**Files:**
- Modify: `scripts/validate-templates.test.mjs:1-end` (adiciona suite cobrindo templates reais)

- [ ] **Step 1: Adicionar testes que validam os 3 templates de produção**

Adicione no final de `scripts/validate-templates.test.mjs`:

```js
const templatesDir = join(here, '..', 'templates')

for (const name of ['feature', 'mudanca', 'conceito']) {
  test(`templates/${name}.jsonc é válido contra o schema`, () => {
    const result = validateTemplate(join(templatesDir, `${name}.jsonc`))
    assert.equal(result.valid, true, JSON.stringify(result.errors, null, 2))
  })
}
```

- [ ] **Step 2: Rodar testes — devem passar**

Run: `npm test`
Expected: 7 tests pass (4 originais + 3 novos).

- [ ] **Step 3: Commit**

```bash
git add scripts/validate-templates.test.mjs
git commit -m "test: cover all 3 production templates in validator suite"
```

---

### Task 9: Módulo de tokens visuais — testes primeiro

Os tokens vêm da **paleta default do Tailwind CSS** (decisão registrada no spec). Sem dep de `tailwindcss`: inline os valores referenciando o nome Tailwind como documentação.

**Files:**
- Delete: `lib/.gitkeep`
- Create: `lib/tailwind-palette.mjs` (subset da paleta default Tailwind usada por Meet Criteria)
- Create: `lib/visual-tokens.mjs`
- Create: `lib/visual-tokens.test.mjs`

- [ ] **Step 1: Escrever testes (módulos ainda não existem)**

Crie `lib/visual-tokens.test.mjs`:

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { TAILWIND } from './tailwind-palette.mjs'
import {
  DEFAULT_TOKENS,
  TOKEN_TAILWIND_REF,
  resolveToken,
  resolveTokenRefs,
  TokenNotFoundError,
} from './visual-tokens.mjs'

test('TAILWIND expõe subset da paleta default Tailwind', () => {
  assert.equal(TAILWIND.white, '#ffffff')
  assert.equal(TAILWIND['neutral-200'], '#e5e5e5')
  assert.equal(TAILWIND['neutral-800'], '#262626')
  assert.equal(TAILWIND['neutral-900'], '#171717')
  assert.equal(TAILWIND['pink-500'], '#ec4899')
  assert.equal(TAILWIND['rose-600'], '#e11d48')
})

test('TOKEN_TAILWIND_REF mapeia cada token semântico ao nome Tailwind', () => {
  assert.equal(TOKEN_TAILWIND_REF['tag.screen.background'], 'pink-500')
  assert.equal(TOKEN_TAILWIND_REF['tag.screen.text'], 'white')
  assert.equal(TOKEN_TAILWIND_REF['tag.section.background'], 'neutral-900')
  assert.equal(TOKEN_TAILWIND_REF['tag.section.text'], 'white')
  assert.equal(TOKEN_TAILWIND_REF['tag.context.background'], 'white')
  assert.equal(TOKEN_TAILWIND_REF['tag.context.border'], 'pink-500')
  assert.equal(TOKEN_TAILWIND_REF['anchor.box.background'], 'white')
  assert.equal(TOKEN_TAILWIND_REF['anchor.box.border'], 'neutral-200')
  assert.equal(TOKEN_TAILWIND_REF['anchor.dot.color'], 'rose-600')
  assert.equal(TOKEN_TAILWIND_REF['anchor.line.color'], 'rose-600')
  assert.equal(TOKEN_TAILWIND_REF['template.background'], 'neutral-800')
})

test('DEFAULT_TOKENS resolve cada referência Tailwind para hex', () => {
  assert.equal(DEFAULT_TOKENS['tag.screen.background'], '#ec4899')
  assert.equal(DEFAULT_TOKENS['tag.screen.text'], '#ffffff')
  assert.equal(DEFAULT_TOKENS['tag.section.background'], '#171717')
  assert.equal(DEFAULT_TOKENS['tag.section.text'], '#ffffff')
  assert.equal(DEFAULT_TOKENS['tag.context.background'], '#ffffff')
  assert.equal(DEFAULT_TOKENS['tag.context.border'], '#ec4899')
  assert.equal(DEFAULT_TOKENS['anchor.box.background'], '#ffffff')
  assert.equal(DEFAULT_TOKENS['anchor.box.border'], '#e5e5e5')
  assert.equal(DEFAULT_TOKENS['anchor.dot.color'], '#e11d48')
  assert.equal(DEFAULT_TOKENS['anchor.line.color'], '#e11d48')
  assert.equal(DEFAULT_TOKENS['template.background'], '#262626')
  assert.equal(DEFAULT_TOKENS['font.family.default'], 'Inter')
})

test('resolveToken devolve valor default quando não há override', () => {
  assert.equal(resolveToken('tag.screen.background'), '#ec4899')
})

test('resolveToken aplica override quando fornecido', () => {
  const overrides = { 'tag.screen.background': '#000000' }
  assert.equal(resolveToken('tag.screen.background', overrides), '#000000')
})

test('resolveToken lança TokenNotFoundError em token desconhecido', () => {
  assert.throws(() => resolveToken('nonexistent.token'), TokenNotFoundError)
})

test('resolveTokenRefs substitui {token:nome} em strings', () => {
  assert.equal(
    resolveTokenRefs('bg={token:template.background};fg={token:tag.screen.text}'),
    'bg=#262626;fg=#ffffff'
  )
})

test('resolveTokenRefs deixa strings sem ref intactas', () => {
  assert.equal(resolveTokenRefs('plain string'), 'plain string')
})

test('resolveTokenRefs com overrides usa overrides', () => {
  const overrides = { 'template.background': '#ffffff' }
  assert.equal(resolveTokenRefs('{token:template.background}', overrides), '#ffffff')
})

test('resolveTokenRefs em objeto recursivamente', () => {
  const input = {
    fill: '{token:tag.screen.background}',
    nested: { line: '{token:anchor.line.color}', literal: 'no-ref' },
    items: ['{token:tag.screen.text}', 'plain'],
  }
  const out = resolveTokenRefs(input)
  assert.deepEqual(out, {
    fill: '#ec4899',
    nested: { line: '#e11d48', literal: 'no-ref' },
    items: ['#ffffff', 'plain'],
  })
})

test('resolveTokenRefs lança em token desconhecido', () => {
  assert.throws(() => resolveTokenRefs('{token:does.not.exist}'), TokenNotFoundError)
})
```

- [ ] **Step 2: Rodar — devem falhar com módulo não encontrado**

Run: `npm test`
Expected: erros `ERR_MODULE_NOT_FOUND` referindo `tailwind-palette.mjs` ou `visual-tokens.mjs`.

- [ ] **Step 3: Implementar `lib/tailwind-palette.mjs`**

```bash
rm lib/.gitkeep
```

Criar `lib/tailwind-palette.mjs`:

```js
// Subset da paleta default do Tailwind CSS (v3+) usada como fonte canônica
// dos tokens visuais do Meet Criteria. Inline para evitar dep de `tailwindcss`
// (não compilamos CSS — apenas consumimos os valores hex).
//
// Referência: https://tailwindcss.com/docs/customizing-colors
//
// Adicione novas cores apenas conforme um token semântico passar a referenciá-las.

export const TAILWIND = Object.freeze({
  white: '#ffffff',
  black: '#000000',
  'neutral-200': '#e5e5e5',
  'neutral-800': '#262626',
  'neutral-900': '#171717',
  'pink-500': '#ec4899',
  'rose-600': '#e11d48',
})

// Família tipográfica default do Tailwind (font-sans).
// Tailwind define `Inter var, ui-sans-serif, system-ui, ...`. Figma exige um
// nome de família registrado, então usamos o primeiro membro concreto do stack.
export const TAILWIND_FONT_SANS_DEFAULT = 'Inter'
```

- [ ] **Step 4: Implementar `lib/visual-tokens.mjs`**

Criar `lib/visual-tokens.mjs`:

```js
// Registry default + resolver para tokens visuais Meet Criteria.
// Tokens são derivados da paleta default do Tailwind CSS — ver
// `lib/tailwind-palette.mjs` e a tabela em
// `docs/superpowers/specs/2026-05-01-meet-criteria-design.md`.

import { TAILWIND, TAILWIND_FONT_SANS_DEFAULT } from './tailwind-palette.mjs'

// Mapeamento token semântico → nome Tailwind (documentação executável).
export const TOKEN_TAILWIND_REF = Object.freeze({
  'tag.screen.background': 'pink-500',
  'tag.screen.text': 'white',
  'tag.section.background': 'neutral-900',
  'tag.section.text': 'white',
  'tag.context.background': 'white',
  'tag.context.border': 'pink-500',
  'anchor.box.background': 'white',
  'anchor.box.border': 'neutral-200',
  'anchor.dot.color': 'rose-600',
  'anchor.line.color': 'rose-600',
  'template.background': 'neutral-800',
})

// Resolução estática de cada token → hex (ou família, no caso da fonte).
function buildDefaultTokens() {
  const tokens = {}
  for (const [name, ref] of Object.entries(TOKEN_TAILWIND_REF)) {
    const hex = TAILWIND[ref]
    if (!hex) {
      throw new Error(`Tailwind reference "${ref}" not present in TAILWIND palette`)
    }
    tokens[name] = hex
  }
  tokens['font.family.default'] = TAILWIND_FONT_SANS_DEFAULT
  return Object.freeze(tokens)
}

export const DEFAULT_TOKENS = buildDefaultTokens()

export class TokenNotFoundError extends Error {
  constructor(name) {
    super(`Unknown visual token: "${name}"`)
    this.name = 'TokenNotFoundError'
    this.tokenName = name
  }
}

export function resolveToken(name, overrides = {}) {
  if (Object.prototype.hasOwnProperty.call(overrides, name)) return overrides[name]
  if (Object.prototype.hasOwnProperty.call(DEFAULT_TOKENS, name)) return DEFAULT_TOKENS[name]
  throw new TokenNotFoundError(name)
}

const TOKEN_REF = /\{token:([a-z0-9.-]+)\}/gi

export function resolveTokenRefs(value, overrides = {}) {
  if (typeof value === 'string') {
    return value.replace(TOKEN_REF, (_, tokenName) => resolveToken(tokenName, overrides))
  }
  if (Array.isArray(value)) {
    return value.map((v) => resolveTokenRefs(v, overrides))
  }
  if (value && typeof value === 'object') {
    const out = {}
    for (const [k, v] of Object.entries(value)) out[k] = resolveTokenRefs(v, overrides)
    return out
  }
  return value
}
```

- [ ] **Step 4: Rodar — devem passar**

Run: `npm test`
Expected: 18 tests pass (7 anteriores + 11 novos).

- [ ] **Step 6: Commit**

```bash
git add lib/tailwind-palette.mjs lib/visual-tokens.mjs lib/visual-tokens.test.mjs
git rm lib/.gitkeep 2>/dev/null || true
git commit -m "feat(lib): add Tailwind-derived visual tokens + {token:...} resolver"
```

---

### Task 10: Escrever `README.md`

**Files:**
- Create: `README.md`

- [ ] **Step 1: Criar `README.md`**

```markdown
# Meet Criteria

Skills + figma-console MCP que ajudam designers de produto a conectar tickets de design a entregáveis no Figma — estruturando entregáveis, ancorando decisões e gerando narrativa pra apresentação.

> **Status:** em construção. Plano 1 de 6 (Foundation) implementado. Veja `docs/superpowers/plans/`.

## Arquitetura em 1 parágrafo

Não construímos plugin Figma. O agente Claude (no Claude Code, Cursor, ou Claude Desktop) executa skills documentadas em `skills/`, dispara comandos em `commands/`, lê templates `JSONC` em `templates/`, e renderiza no Figma via [figma-console MCP](https://github.com/southleft/figma-console-mcp). Tokens visuais default ficam em `lib/visual-tokens.mjs`. Spec completo: [`docs/superpowers/specs/2026-05-01-meet-criteria-design.md`](docs/superpowers/specs/2026-05-01-meet-criteria-design.md).

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
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: add README with architecture overview, scripts, roadmap"
```

---

### Task 11: Verificação final + tag de checkpoint

**Files:** nenhum criado/modificado; é um gate de qualidade antes de fechar a fase.

- [ ] **Step 1: Rodar suíte completa**

Run: `npm test`
Expected: 18 tests pass, 0 failures.

- [ ] **Step 2: Validar todos os templates**

Run: `npm run validate:templates`
Expected:
```
OK  templates/feature.jsonc
OK  templates/mudanca.jsonc
OK  templates/conceito.jsonc
```
Exit 0.

- [ ] **Step 3: Verificar git limpo**

Run: `git status`
Expected: `nothing to commit, working tree clean`.

- [ ] **Step 4: Tag de checkpoint (opcional)**

```bash
git tag -a v0.1.0-foundation -m "Plano 1 (Foundation) concluído: schema + 3 templates + tokens + validador"
```

- [ ] **Step 5: Exibir log dos commits da fase**

Run: `git log --oneline -20`
Expected: ver os ~10 commits descritivos da fase, do bootstrap ao README.

---

## Self-Review

**1. Cobertura do spec (Foundation):**
- Schema canônico (`schemas/template.schema.json`) — Task 3 ✅
- 3 templates JSONC (`feature`, `mudanca`, `conceito`) — Tasks 5/6/7 ✅
- Tokens default Meet Criteria derivados da paleta Tailwind (12 tokens da tabela do spec) — Task 9 ✅
- Resolver `{token:nome}` — Task 9 ✅
- Estrutura de pastas (skills/, commands/, prompts/, etc) — Task 1 ✅ (placeholders pra preencher nos próximos planos)
- Validador automatizado — Task 4 ✅
- README com roadmap — Task 10 ✅

Itens fora do escopo desta fase (próximos planos): renderização Figma, MCP, skills, slash commands, prompts IA, checks determinísticos. Estão registrados no Roadmap do README e no header deste plano.

**2. Placeholders:** Nenhum step diz "TBD" ou "implement later". Todo trecho de código + arquivo é exibido na íntegra. Comandos exatos com expected output em todos os steps de execução.

**3. Consistência de tipos:**
- `validateTemplate(path) → { valid: boolean, errors: Array }` — assinatura usada de forma consistente em script e tests.
- `resolveToken(name, overrides?)` e `resolveTokenRefs(value, overrides?)` — mesmas assinaturas em testes e implementação.
- `DEFAULT_TOKENS` chaves usadas em testes (`tag.screen.background`, `template.background`, etc.) batem 1:1 com o objeto exportado em `visual-tokens.mjs`.
- `TokenNotFoundError` referenciado idêntico em testes e implementação.
- Componentes em `componentName` enum batem com a tabela "Componentes (kit reutilizável)" do spec: ContextMacro, ProblemStatement, FlowList, Flow, SectionHeader, ScreenSlot, Comparative, DecisionCriteria, AnchorBox, FinalAnalysis (10 componentes).

Self-review concluída. Plano pronto pra execução.
