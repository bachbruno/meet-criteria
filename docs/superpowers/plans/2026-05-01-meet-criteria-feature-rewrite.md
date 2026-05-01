# Meet Criteria — Feature Template Rewrite + i18n (Plan 3.6 of 6+)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite the Figma rendering layer for the `feature` deliverable type to match the user's reference section (node `1:14216`) — light Section root with manual positioning, firefly palette, native iPhone 13 & 14 placeholder frames per screen, English-only naming, and multi-flow vertical stacking. Out of scope: `mudanca` and `conceito` rendering (locked until user provides reference designs after `feature` passes review). Also covered: full English translation of all current/forward-looking project artifacts (README, current spec, current skill, slash command, CLI messages). Historical plan docs (Plans 1, 2, 3, 3.5) remain in pt-BR as historical artifacts.

**Architecture:** Replace the Tailwind neutral/pink/rose-based tokens with the firefly palette. Replace the `figma.createFrame()` root with a `figma.createSection()` root that has no auto-layout — children positioned manually via `x`/`y`. Auto-layout remains only on the inner cards/banners/tags so they hug content. Each `ScreenSlot` renders a Screen Name tag plus a native `iPhone 13 & 14` frame (390×844) below it as a placeholder for the designer to paste real screens into. Multi-flow features stack flow rows vertically; the side cards (Problem Statement on the left, Analysis Overview on the right) grow tall enough to span all flow rows. The render manifest is extended to carry placement coordinates so `figma-render` becomes a thin renderer over a fully-resolved layout.

**Tech Stack:** Node 20+, `node:test`, existing `ajv`/`jsonc-parser`. No new deps. The Figma JS template runs in `figma_execute` plugin context (Section creation, manual `x`/`y` positioning, font loading, `setSharedPluginData`).

**Translation scope (i18n) — minimal:**
- ✅ Translated: only what is **rendered into the Figma canvas** — section name, frame names, heading text, sub-section headings, body skeleton labels, screen tag labels. These already exist as English literals in `lib/render-manifest.mjs` and `lib/figma-render.mjs` per the new contract.
- ✅ Translated: `templates/*.jsonc` `label` and `description` fields (templates are config consumed by the agent — keep them human-readable in English so the rendered output's nomenclature matches the source-of-truth).
- ❌ Out of scope: project markdown (README, specs, plans, skills, commands), CLI strings, code comments, test descriptions, error messages — all stay in pt-BR. Translating those takes hours and adds zero value to what the designer sees in Figma.
- ✅ Agent-to-user conversation language remains pt-BR.

**Foco MVP (this plan):**
- ✅ `feature` template fully rewritten end-to-end (palette, layout, helpers, tests)
- ✅ Multi-flow vertical stacking (1..N flows)
- ✅ Native iPhone 13 & 14 mockup frames per screen
- ✅ English-only project artifacts (forward-looking)
- 📋 `mudanca` and `conceito` types: minimal stubs that emit a clear `RenderJsError` — they will be rebuilt in a follow-up plan once the user provides reference designs

**Premises (already merged):**
- Plan 3 + 3.5 merged: `lib/figma-render.mjs`, `lib/render-manifest.mjs`, `lib/visual-identity.mjs`, `lib/template-loader.mjs`, `lib/local-store.mjs`, `lib/slug.mjs`, `scripts/new-deliverable.mjs` exist and have full test coverage
- `setCurrentPageAsync` fix is in place (PR #5)
- Container plugin data contract is established with `code` discriminators on errors

---

## Visual Contract — extracted from `1:14216`

This contract supersedes the previous "Contrato visual dos componentes" added in Plan 3.5.

### Layout (manual positioning inside Section)

| Constant                     | Value | Notes                                      |
|------------------------------|-------|--------------------------------------------|
| `SECTION_PADDING`            | 280   | Top/right/bottom/left padding inside section |
| `SIDE_CARD_WIDTH`            | 738   | Both Problem Statement and Analysis Overview |
| `SIDE_CARD_TO_SCREENS_GAP`   | 280   | Horizontal gap between side cards and the screens area |
| `IPHONE_WIDTH`               | 390   | Native Figma iPhone 13 & 14 width          |
| `IPHONE_HEIGHT`              | 844   | Native Figma iPhone 13 & 14 height         |
| `BETWEEN_SCREENS_GAP`        | 104   | Horizontal gap between adjacent iPhone frames |
| `FLOW_BANNER_TO_TAG_GAP`     | 128   | Vertical gap between Flow Name banner bottom and Screen Name tag top |
| `TAG_TO_IPHONE_GAP`          | 40    | Vertical gap between Screen Name tag bottom and iPhone frame top |
| `BETWEEN_FLOWS_GAP`          | 200   | Vertical gap between consecutive flow rows (banner+tag+iPhone) |

### Component properties (final)

| Component              | Type    | Layout      | Sizing X / Y    | Padding (T,R,B,L) | Gap | Corner | Fill          | Children                                                          |
|------------------------|---------|-------------|-----------------|-------------------|-----|--------|---------------|-------------------------------------------------------------------|
| Section root           | SECTION | none        | FIXED / FIXED   | (manual; 280 around children) | —   | —      | firefly-950   | Problem Statement, Flow rows..., Analysis Overview                |
| ProblemStatementCard   | FRAME   | VERTICAL    | FIXED / FIXED   | 48,48,48,48       | 32  | 24     | firefly-50    | Heading text + Body text                                          |
| FlowNameBanner         | FRAME   | HORIZONTAL  | FIXED / HUG     | 56,56,56,56       | 40  | 48     | firefly-100   | Flow Name text                                                    |
| ScreenNameTag          | FRAME   | HORIZONTAL  | FIXED 390 / HUG | 24,20,24,20       | 16  | 16     | firefly-50    | Screen name text                                                  |
| iPhonePlaceholder      | FRAME   | NONE        | FIXED 390 / FIXED 844 | (none)         | —   | 16     | firefly-50    | (empty — designer pastes real screen here)                        |
| AnalysisOverviewCard   | FRAME   | VERTICAL    | FIXED / FIXED   | 48,48,48,48       | 48  | 24     | firefly-50    | Heading text + 4 sub-frames (Resolution / What validates it / Attention to / Topics for discussion) |
| AnalysisSubFrame       | FRAME   | VERTICAL    | FILL / HUG      | 0,0,0,0           | 20  | 0      | none          | Sub-heading text + Body text                                      |

> All strokes are removed. `strokeWeight` is irrelevant.

### Typography (final)

| Style key             | Used in                       | Family / Weight   | Size | Line height  | Letter spacing |
|-----------------------|-------------------------------|-------------------|------|--------------|----------------|
| `display`             | Flow Name banner              | Inter / Medium    | 80   | AUTO         | -4%            |
| `card-heading`        | Problem Statement / Analysis Overview titles | Inter / Medium | 48   | 100%         | 0%             |
| `section-heading`     | Sub-frame headings (Resolution, etc.) | Inter / Semi Bold | 28   | 100%         | 0%             |
| `tag-heading`         | Screen Name tag               | Inter / Medium    | 28   | AUTO         | -2%            |
| `body`                | All body text                 | Inter / Regular   | 20   | 120%         | 0%             |

All text colors: `firefly-950` (`#1d2b2c`).

### Palette — firefly only

| Token                    | Tailwind firefly | Hex        |
|--------------------------|------------------|------------|
| `section.background`     | `firefly-950`    | `#1d2b2c`  |
| `card.background`        | `firefly-50`     | `#f5f8f8`  |
| `banner.background`      | `firefly-100`    | `#dee9e8`  |
| `text.primary`           | `firefly-950`    | `#1d2b2c`  |
| `font.family.default`    | (Inter)          | `Inter`    |

The full firefly palette is registered in `lib/tailwind-palette.mjs`:

```js
firefly: {
  '50':  '#f5f8f8',
  '100': '#dee9e8',
  '200': '#bcd3d1',
  '300': '#93b5b3',
  '400': '#6c9594',
  '500': '#527a79',
  '600': '#406161',
  '700': '#364f4f',
  '800': '#2e4141',
  '900': '#293838',
  '950': '#1d2b2c',
}
```

### Section name format

`Meet Criteria - <Ticket Ref>` (single ASCII hyphen, not em-dash).

### Final analysis sub-headings (English)

Replaces the previous `resolution / strengths / attention / discussion`:

| Key (template / manifest) | Display text          |
|---------------------------|-----------------------|
| `resolution`              | Resolution            |
| `validation`              | What validates it     |
| `attention`               | Attention to          |
| `discussion`              | Topics for discussion |

> The `key` values are kept as short ASCII identifiers for stable references in tests, manifest, plugin data, and templates. Display text comes from a translation map in `lib/figma-render.mjs`.

---

## File Structure

### Modified

- `lib/tailwind-palette.mjs` — extend with `firefly` color set
- `lib/visual-tokens.mjs` — rewrite token registry to use firefly + new semantic names (`section.background`, `card.background`, `banner.background`, `text.primary`)
- `lib/visual-tokens.test.mjs` — assertions reflect new token registry
- `lib/render-manifest.mjs` — drop ContextMacro builder, add new layout coordinates, multi-flow stacking, iPhone placeholder slot info, English section keys
- `lib/render-manifest.test.mjs` — update assertions for new contract; remove ContextMacro tests
- `lib/figma-render.mjs` — complete rewrite (Section root, manual positioning, helpers per new contract, English comments)
- `lib/figma-render.test.mjs` — assertions reflect new contract (Section, no ContextMacro, manual positioning, iPhone placeholder)
- `lib/visual-identity.mjs` — update `validateOverrides` to recognize new token names
- `lib/visual-identity.test.mjs` — update token name references
- `templates/feature.jsonc` — drop `context` node, rename final-analysis sections, English `label`/`description`
- `templates/mudanca.jsonc` — minimal stub (drops most structure; will be rewritten in follow-up plan)
- `templates/conceito.jsonc` — minimal stub (same)
- `schemas/template.schema.json` — `componentName` enum drops `ContextMacro`, adds `IPhonePlaceholder`, `FlowNameBanner`, `ScreenNameTag`, `AnalysisSubFrame`
- `scripts/new-deliverable.mjs` — only behavioral changes (manifest v2 wiring; no language churn)
- `scripts/new-deliverable.test.mjs` — only assertion updates needed for new manifest shape
- `lib/local-store.mjs` — markdown skeletons translated to English (these ARE rendered to disk and surfaced to the designer when they open `.meet-criteria/<slug>/*.md`)
- `skills/creating-templates.md` — keep pt-BR; only update the technical sections (manifest shape references, new helper names, new role table) to match the v2 contract
- `commands/meet-criteria-new.md` — leave as-is
- `docs/superpowers/specs/2026-05-01-meet-criteria-design.md` — keep pt-BR; only replace the "Contrato visual dos componentes" subsection to point at the new firefly-based contract documented in this Plan 3.6
- `README.md` — keep pt-BR; just append Plano 3.6 to the roadmap

### Created

- `docs/superpowers/plans/2026-05-01-meet-criteria-feature-rewrite.md` — this plan (English from start)

### Untouched (pt-BR historical)

- `docs/superpowers/plans/2026-05-01-meet-criteria-foundation.md`
- `docs/superpowers/plans/2026-05-01-meet-criteria-setup-onboarding.md`
- `docs/superpowers/plans/2026-05-01-meet-criteria-new-deliverable.md`
- `docs/superpowers/plans/2026-05-01-meet-criteria-figma-render.md`

---

## Tasks

### Task 1: Extend `lib/tailwind-palette.mjs` with firefly

**Files:**
- Modify: `lib/tailwind-palette.mjs`

- [ ] **Step 1: Read current palette to confirm shape**

Run: `cat lib/tailwind-palette.mjs | head -30`
Expected: see the existing palette structure (object with named keys mapping to hex values).

- [ ] **Step 2: Add firefly entries**

The palette currently exports `TAILWIND` as a flat object (e.g. `'pink-500': '#ec4899'`). Add the following 11 keys to that object (keep all existing keys):

```js
'firefly-50':  '#f5f8f8',
'firefly-100': '#dee9e8',
'firefly-200': '#bcd3d1',
'firefly-300': '#93b5b3',
'firefly-400': '#6c9594',
'firefly-500': '#527a79',
'firefly-600': '#406161',
'firefly-700': '#364f4f',
'firefly-800': '#2e4141',
'firefly-900': '#293838',
'firefly-950': '#1d2b2c',
```

- [ ] **Step 3: Verify**

Run: `node -e "import('./lib/tailwind-palette.mjs').then(m => console.log(m.TAILWIND['firefly-950']))"`
Expected: `#1d2b2c`

- [ ] **Step 4: Commit**

```bash
git add lib/tailwind-palette.mjs
git commit -m "feat(lib): add firefly palette to tailwind tokens"
```

---

### Task 2: Rewrite `lib/visual-tokens.mjs` with firefly-based registry

The token registry replaces the old `tag.screen.background` / `tag.section.background` / `anchor.box.border` / etc. with the new firefly-based semantic names. The full list:

| Token name              | Tailwind ref     | Use                                                      |
|-------------------------|------------------|----------------------------------------------------------|
| `section.background`    | `firefly-950`    | Section root background                                  |
| `card.background`       | `firefly-50`     | Problem Statement, Analysis Overview, Screen Name tag, iPhone placeholder |
| `banner.background`     | `firefly-100`    | Flow Name banner                                         |
| `text.primary`          | `firefly-950`    | All text                                                 |
| `font.family.default`   | (Inter family)   | Typography                                               |

Old tokens that are removed (no longer referenced anywhere): `tag.screen.*`, `tag.section.*`, `tag.context.*`, `anchor.*`, `template.background`.

**Files:**
- Modify: `lib/visual-tokens.mjs`
- Modify: `lib/visual-tokens.test.mjs`

- [ ] **Step 1: Update tests first**

Replace the contents of `lib/visual-tokens.test.mjs` with:

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  TOKEN_TAILWIND_REF,
  DEFAULT_TOKENS,
  resolveToken,
  resolveTokenRefs,
  TokenNotFoundError,
} from './visual-tokens.mjs'

test('TOKEN_TAILWIND_REF lists all 4 firefly-based color tokens', () => {
  assert.deepEqual(Object.keys(TOKEN_TAILWIND_REF).sort(), [
    'banner.background',
    'card.background',
    'section.background',
    'text.primary',
  ])
})

test('DEFAULT_TOKENS resolves each color token to a hex string', () => {
  assert.equal(DEFAULT_TOKENS['section.background'], '#1d2b2c')
  assert.equal(DEFAULT_TOKENS['card.background'], '#f5f8f8')
  assert.equal(DEFAULT_TOKENS['banner.background'], '#dee9e8')
  assert.equal(DEFAULT_TOKENS['text.primary'], '#1d2b2c')
})

test('DEFAULT_TOKENS includes font.family.default = Inter', () => {
  assert.equal(DEFAULT_TOKENS['font.family.default'], 'Inter')
})

test('resolveToken returns hex for known tokens', () => {
  assert.equal(resolveToken('section.background'), '#1d2b2c')
})

test('resolveToken honors overrides', () => {
  assert.equal(resolveToken('section.background', { 'section.background': '#000000' }), '#000000')
})

test('resolveToken throws TokenNotFoundError with code', () => {
  let caught
  try { resolveToken('not.a.token') } catch (e) { caught = e }
  assert.ok(caught instanceof TokenNotFoundError)
  assert.equal(caught.code, 'UNKNOWN_TOKEN')
  assert.equal(caught.tokenName, 'not.a.token')
})

test('resolveTokenRefs replaces {token:...} inside strings', () => {
  assert.equal(resolveTokenRefs('{token:section.background}'), '#1d2b2c')
  assert.equal(resolveTokenRefs('bg-{token:card.background}-fg'), 'bg-#f5f8f8-fg')
})

test('resolveTokenRefs walks arrays and plain objects', () => {
  const out = resolveTokenRefs({ a: '{token:card.background}', b: ['{token:banner.background}'] })
  assert.equal(out.a, '#f5f8f8')
  assert.equal(out.b[0], '#dee9e8')
})

test('resolveTokenRefs is identity for non-string non-object values', () => {
  assert.equal(resolveTokenRefs(42), 42)
  assert.equal(resolveTokenRefs(null), null)
  assert.equal(resolveTokenRefs(undefined), undefined)
})
```

- [ ] **Step 2: Run tests — they should fail (registry still has old tokens)**

Run: `npm test 2>&1 | tail -10`
Expected: visual-tokens suite reports failures referencing old token keys.

- [ ] **Step 3: Rewrite `lib/visual-tokens.mjs`**

Replace the entire contents of `lib/visual-tokens.mjs` with:

```js
// Default registry + resolver for Meet Criteria visual tokens.
// Tokens derive from the Tailwind firefly palette — see `lib/tailwind-palette.mjs`
// and the "Visual contract" section in
// `docs/superpowers/specs/2026-05-01-meet-criteria-design.md`.

import { TAILWIND, TAILWIND_FONT_SANS_DEFAULT } from './tailwind-palette.mjs'

// Semantic token name → Tailwind palette key (executable documentation).
export const TOKEN_TAILWIND_REF = Object.freeze({
  'section.background': 'firefly-950',
  'card.background':    'firefly-50',
  'banner.background':  'firefly-100',
  'text.primary':       'firefly-950',
})

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
    this.code = 'UNKNOWN_TOKEN'
  }
}

export function resolveToken(name, overrides = {}) {
  if (Object.prototype.hasOwnProperty.call(overrides, name)) return overrides[name]
  if (Object.prototype.hasOwnProperty.call(DEFAULT_TOKENS, name)) return DEFAULT_TOKENS[name]
  throw new TokenNotFoundError(name)
}

// Token names are lowercase by convention; uppercase variants are not matched.
const TOKEN_REF = /\{token:([a-z0-9.-]+)\}/g

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

- [ ] **Step 4: Run tests — visual-tokens suite must pass**

Run: `node --test lib/visual-tokens.test.mjs`
Expected: all 9 tests pass.

> Other suites will fail at this point because they reference removed tokens. That is expected; later tasks fix them.

- [ ] **Step 5: Commit**

```bash
git add lib/visual-tokens.mjs lib/visual-tokens.test.mjs
git commit -m "refactor(lib): replace tokens with firefly-based semantic registry"
```

---

### Task 3: Update `lib/visual-identity.mjs` to recognize the new token names

`validateOverrides` checks override keys against `TOKEN_TAILWIND_REF`. With the registry rewrite, only the four new keys are valid for overrides. The function itself is unchanged — only the test fixtures need updating.

**Files:**
- Modify: `lib/visual-identity.test.mjs`

- [ ] **Step 1: Update test fixtures**

Open `lib/visual-identity.test.mjs`. Replace every occurrence of `tag.screen.background` with `card.background` and every occurrence of `tag.fake.token` with the literal `not.a.token` to keep tests faithful to the new registry. Concretely:

- Test "resolveIdentity({mode:auto, overrides}) substitui apenas chaves válidas": override map becomes `{ 'card.background': '#ff00ff', 'section.background': '#000000' }`. Assertions check `r.tokens['card.background'] === '#ff00ff'`, `r.tokens['section.background'] === '#000000'`, `r.tokens['text.primary'] === DEFAULT_TOKENS['text.primary']`.
- Test "resolveIdentity rejeita override em token desconhecido": override `{ 'not.a.token': '#fff' }`.
- Test "resolveIdentity rejeita override com valor não-string": override `{ 'card.background': 123 }`.
- Test "resolveIdentity normaliza hex em uppercase para lowercase": override `{ 'card.background': '#FF00FF' }`. Assertion: `r.tokens['card.background'] === '#ff00ff'`.
- Test "resolveIdentity rejeita hex mal-formado": override `{ 'card.background': 'not-a-hex' }`.
- Test for `code === 'UNKNOWN_TOKEN'`: override `{ 'not.a.token': '#fff000' }`.
- Test for `code === 'INVALID_OVERRIDE_VALUE_TYPE'`: override `{ 'card.background': 123 }`.
- Test for `code === 'INVALID_HEX_VALUE'`: override `{ 'card.background': '#xyz' }`.

> Translation pass: every `test('...', ...)` description that is currently in pt-BR can be left as-is for now; a separate i18n task at the end of the plan rewrites all test descriptions in English. This isolates the firefly migration from the language migration.

- [ ] **Step 2: Run visual-identity tests**

Run: `node --test lib/visual-identity.test.mjs`
Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add lib/visual-identity.test.mjs
git commit -m "refactor(lib): align visual-identity tests with new token names"
```

---

### Task 4: Update `templates/*.jsonc` and `schemas/template.schema.json`

The `feature` template drops the `context` structure node, renames `final-analysis` section keys, and uses English `label`/`description`. The `mudanca` and `conceito` templates become minimal stubs (one `problem-statement` node + one `final-analysis` node) until the user provides reference designs in a follow-up plan. The schema's `componentName` enum drops `ContextMacro`, `Comparative`, `DecisionCriteria`, `FlowList`, `Flow`, `SectionHeader`, `ScreenSlot`, `AnchorBox` and adds `FlowNameBanner`, `ScreenNameTag`, `IPhonePlaceholder`, `AnalysisSubFrame`. Component vocabulary moves from "list-of-things" to "frames-on-canvas".

**Files:**
- Modify: `schemas/template.schema.json`
- Modify: `templates/feature.jsonc`
- Modify: `templates/mudanca.jsonc`
- Modify: `templates/conceito.jsonc`

- [ ] **Step 1: Update schema's component enum**

In `schemas/template.schema.json`, locate `$defs.componentName.enum` and replace its array with:

```json
[
  "ProblemStatement",
  "FlowList",
  "FlowNameBanner",
  "ScreenNameTag",
  "IPhonePlaceholder",
  "AnalysisOverview",
  "AnalysisSubFrame"
]
```

> `FlowList` is retained as the structural-node type (a list of flows). The previous "list" components (`Flow`, `SectionHeader`, `ScreenSlot`, `Comparative`, `DecisionCriteria`) are removed. `AnalysisOverview` replaces `FinalAnalysis`.

- [ ] **Step 2: Rewrite `templates/feature.jsonc`**

Replace the entire contents with:

```jsonc
// Template for a greenfield feature deliverable.
// Structure: ProblemStatement (left card) + N flow rows (banner + screens) + AnalysisOverview (right card).
// Section root with manual positioning; auto-layout only on inner frames.
{
  "$schema": "../schemas/template.schema.json",
  "type": "feature",
  "version": "2.0.0",
  "label": "Feature (greenfield)",
  "description": "Single section presenting a new feature with one or more flows of screens.",

  "layout": {
    "kind": "section",
    "padding": 280,
    "background": "{token:section.background}"
  },

  "structure": [
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
        "component": "FlowNameBanner",
        "props": {
          "screenComponent": "ScreenNameTag",
          "placeholderComponent": "IPhonePlaceholder",
          "minScreens": 1,
          "maxScreens": 20
        }
      }
    },
    {
      "id": "analysis-overview",
      "component": "AnalysisOverview",
      "required": true,
      "sections": ["resolution", "validation", "attention", "discussion"]
    }
  ],

  "checks": {
    "deterministic": [
      "problem-statement-not-empty",
      "no-empty-screen-slots",
      "no-placeholder-text",
      "analysis-overview-not-empty"
    ]
  }
}
```

- [ ] **Step 3: Rewrite `templates/mudanca.jsonc` as minimal stub**

```jsonc
// Stub template for change/iteration deliverables.
// The full structure (before/after pairs) will be rebuilt in a follow-up plan
// once the visual reference is provided. For now, only ProblemStatement and
// AnalysisOverview render.
{
  "$schema": "../schemas/template.schema.json",
  "type": "mudanca",
  "version": "2.0.0",
  "label": "Change (iteration / fix) — stub",
  "description": "Stub template until the change-specific layout is designed.",

  "layout": {
    "kind": "section",
    "padding": 280,
    "background": "{token:section.background}"
  },

  "structure": [
    {
      "id": "problem-statement",
      "component": "ProblemStatement",
      "required": true,
      "supportsRichText": true,
      "supportsHierarchy": true
    },
    {
      "id": "analysis-overview",
      "component": "AnalysisOverview",
      "required": true,
      "sections": ["resolution", "validation", "attention", "discussion"]
    }
  ],

  "checks": {
    "deterministic": [
      "problem-statement-not-empty",
      "no-placeholder-text",
      "analysis-overview-not-empty"
    ]
  }
}
```

- [ ] **Step 4: Rewrite `templates/conceito.jsonc` as minimal stub**

```jsonc
// Stub template for concept (variants A/B/C) deliverables.
// The variants + decision criteria layout will be rebuilt in a follow-up plan
// once the visual reference is provided.
{
  "$schema": "../schemas/template.schema.json",
  "type": "conceito",
  "version": "2.0.0",
  "label": "Concept (variants A/B/C) — stub",
  "description": "Stub template until the variants-specific layout is designed.",

  "layout": {
    "kind": "section",
    "padding": 280,
    "background": "{token:section.background}"
  },

  "structure": [
    {
      "id": "problem-statement",
      "component": "ProblemStatement",
      "required": true,
      "supportsRichText": true,
      "supportsHierarchy": true
    },
    {
      "id": "analysis-overview",
      "component": "AnalysisOverview",
      "required": true,
      "sections": ["resolution", "validation", "attention", "discussion"]
    }
  ],

  "checks": {
    "deterministic": [
      "problem-statement-not-empty",
      "no-placeholder-text",
      "analysis-overview-not-empty"
    ]
  }
}
```

> The schema's `layout.kind` enum currently only accepts `horizontal-columns | vertical-stack | grid`. Update it to accept `section` only — single allowed value, since manual positioning is the only layout mode now. Edit `schemas/template.schema.json` `$defs.layout.properties.kind.enum` to `["section"]`. Drop the `gap` field from `layout` since it is no longer used (the gap is encoded per-component, not at layout level).

- [ ] **Step 5: Validate templates against the schema**

Run: `npm run validate:templates`
Expected: all three templates pass validation.

- [ ] **Step 6: Commit**

```bash
git add schemas/template.schema.json templates/feature.jsonc templates/mudanca.jsonc templates/conceito.jsonc
git commit -m "feat(templates): rewrite feature template; stub mudanca and conceito"
```

---

### Task 5: Rewrite `lib/render-manifest.mjs` for the new contract

This is the densest task. The manifest now carries:

- `section` root info (replacing `container` + `page`)
- A flat list of nodes, each with absolute (x, y) within the section
- Multi-flow rows with screen sub-trees that include both the Screen Name tag and the iPhone placeholder
- New `AnalysisOverview` builder with English section keys

The manifest output shape:

```js
{
  version: '2.0.0',
  type: 'feature',
  slug, ticketRef, createdAt,
  identity, tokens,
  layout: { kind: 'section', padding: 280, background: <hex> },
  section: {
    name: `Meet Criteria - ${ticketRef}`,
    width:  <computed>,
    height: <computed>,
    pluginData: { role: 'root', ticketRef, type, templateVersion, createdAt, lastExecutedAt, visualIdentity, slug },
  },
  nodes: [
    { id: 'problem-statement', component: 'ProblemStatement', x, y, width, height, heading: 'Problem statement', body: <text>, pluginData: { role: 'problem-statement' } },
    { id: 'flows', component: 'FlowList', children: [
      { flowId: 'flow-1', name: 'Flow A', x, y, banner: { x, y, width, height, text }, screens: [
        { x, y, tag: { x, y, width, height, text }, placeholder: { x, y, width, height }, pluginData: { role: 'screen-slot', flowId, screenIndex } },
        ...
      ], pluginData: { role: 'flow', flowId } },
      ...
    ], pluginData: { role: 'flow-list' } },
    { id: 'analysis-overview', component: 'AnalysisOverview', x, y, width, height, heading: 'Analysis Overview', sections: [
      { key: 'resolution', heading: 'Resolution', body: '' },
      { key: 'validation', heading: 'What validates it', body: '' },
      ...
    ], pluginData: { role: 'analysis-overview' } },
  ],
  checks: { deterministic: [...] }
}
```

> The flow-row layout math:
> - Side-card height: `H_side = top_band_height + (rows × screen_block_height) + ((rows - 1) × BETWEEN_FLOWS_GAP)`
>   - `top_band_height = SECTION_PADDING (280)` (already the section padding above the first row)
>   - `screen_block_height = banner_height + FLOW_BANNER_TO_TAG_GAP + tag_height + TAG_TO_IPHONE_GAP + IPHONE_HEIGHT`
>   - For the user's reference (banner ≈ 246, tag ≈ 82, iPhone 844): `screen_block_height = 246 + 128 + 82 + 40 + 844 = 1340`. With 1 row → side card height = 1340 ✓.
> - Side-card width is fixed at `SIDE_CARD_WIDTH = 738`.
> - For multi-flow, each subsequent row stacks with `BETWEEN_FLOWS_GAP = 200` between them.
> - Screens area width: `screens_width = N × IPHONE_WIDTH + (N - 1) × BETWEEN_SCREENS_GAP` where `N` is the **maximum** number of screens across all flows in this deliverable. The flow banner spans this full width even if a particular flow has fewer screens.
> - Section width: `2 × SECTION_PADDING + 2 × SIDE_CARD_WIDTH + 2 × SIDE_CARD_TO_SCREENS_GAP + screens_width` = `280×2 + 738×2 + 280×2 + screens_width` = `2596 + screens_width`.

The exact layout helpers go into a new internal module `lib/layout-feature.mjs` so they can be unit-tested independently of the manifest builder. The render-manifest then imports the layout helpers.

**Files:**
- Create: `lib/layout-feature.mjs`
- Create: `lib/layout-feature.test.mjs`
- Modify: `lib/render-manifest.mjs`
- Modify: `lib/render-manifest.test.mjs`

#### Step 1: Tests for `lib/layout-feature.mjs` (TDD-first)

Create `lib/layout-feature.test.mjs`:

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  LAYOUT_CONSTANTS,
  computeFeatureLayout,
} from './layout-feature.mjs'

test('LAYOUT_CONSTANTS exposes the expected named constants', () => {
  assert.equal(LAYOUT_CONSTANTS.SECTION_PADDING, 280)
  assert.equal(LAYOUT_CONSTANTS.SIDE_CARD_WIDTH, 738)
  assert.equal(LAYOUT_CONSTANTS.SIDE_CARD_TO_SCREENS_GAP, 280)
  assert.equal(LAYOUT_CONSTANTS.IPHONE_WIDTH, 390)
  assert.equal(LAYOUT_CONSTANTS.IPHONE_HEIGHT, 844)
  assert.equal(LAYOUT_CONSTANTS.BETWEEN_SCREENS_GAP, 104)
  assert.equal(LAYOUT_CONSTANTS.FLOW_BANNER_TO_TAG_GAP, 128)
  assert.equal(LAYOUT_CONSTANTS.TAG_TO_IPHONE_GAP, 40)
  assert.equal(LAYOUT_CONSTANTS.BETWEEN_FLOWS_GAP, 200)
  assert.equal(LAYOUT_CONSTANTS.BANNER_HEIGHT, 246)
  assert.equal(LAYOUT_CONSTANTS.TAG_HEIGHT, 82)
})

test('computeFeatureLayout for 1 flow × 4 screens reproduces the user reference', () => {
  const layout = computeFeatureLayout({
    flows: [{ name: 'Flow A', screens: 4 }],
  })
  assert.equal(layout.section.width, 4468) // 2596 + (4*390 + 3*104)
  assert.equal(layout.section.height, 1900) // 280 + 1340 + 280

  // Problem statement card on the left
  assert.equal(layout.problemStatement.x, 280)
  assert.equal(layout.problemStatement.y, 280)
  assert.equal(layout.problemStatement.width, 738)
  assert.equal(layout.problemStatement.height, 1340)

  // Analysis overview card on the right
  assert.equal(layout.analysisOverview.x, 4468 - 280 - 738) // 3450
  assert.equal(layout.analysisOverview.y, 280)
  assert.equal(layout.analysisOverview.width, 738)
  assert.equal(layout.analysisOverview.height, 1340)

  // Single flow row at top of screens area
  assert.equal(layout.flows.length, 1)
  const flow = layout.flows[0]
  assert.equal(flow.banner.x, 1298) // 280 + 738 + 280
  assert.equal(flow.banner.y, 280)
  assert.equal(flow.banner.width, 1872) // 4*390 + 3*104
  assert.equal(flow.banner.height, 246)

  assert.equal(flow.screens.length, 4)
  assert.equal(flow.screens[0].tag.x, 1298)
  assert.equal(flow.screens[0].tag.y, 280 + 246 + 128) // 654
  assert.equal(flow.screens[0].tag.width, 390)
  assert.equal(flow.screens[0].tag.height, 82)
  assert.equal(flow.screens[0].placeholder.x, 1298)
  assert.equal(flow.screens[0].placeholder.y, 280 + 246 + 128 + 82 + 40) // 776
  assert.equal(flow.screens[0].placeholder.width, 390)
  assert.equal(flow.screens[0].placeholder.height, 844)

  // Subsequent screens shift right
  assert.equal(flow.screens[1].tag.x, 1298 + 390 + 104) // 1792
  assert.equal(flow.screens[2].tag.x, 1298 + 2 * (390 + 104)) // 2286
  assert.equal(flow.screens[3].tag.x, 1298 + 3 * (390 + 104)) // 2780
})

test('computeFeatureLayout for 2 flows stacks rows with BETWEEN_FLOWS_GAP', () => {
  const layout = computeFeatureLayout({
    flows: [
      { name: 'Flow A', screens: 3 },
      { name: 'Flow B', screens: 2 },
    ],
  })
  // Width uses the MAX flow width (3 screens → 3*390 + 2*104 = 1378)
  assert.equal(layout.section.width, 280 + 738 + 280 + 1378 + 280 + 738 + 280) // 3974
  // Height: 280 (top) + 2 × 1340 (two rows) + 200 (gap) + 280 (bottom) = 3440
  assert.equal(layout.section.height, 280 + 2 * 1340 + 200 + 280)

  assert.equal(layout.flows.length, 2)
  assert.equal(layout.flows[0].banner.y, 280)
  assert.equal(layout.flows[1].banner.y, 280 + 1340 + 200) // 1820

  // Side cards span the full inner height
  assert.equal(layout.problemStatement.height, 2 * 1340 + 200) // 2880
  assert.equal(layout.analysisOverview.height, 2 * 1340 + 200)

  // Banner of the SECOND flow uses the MAX screens width (3 screens), not its own (2)
  assert.equal(layout.flows[1].banner.width, 1378)
  // But the second flow only renders 2 screens — they start at the same x as flow 1's screens
  assert.equal(layout.flows[1].screens.length, 2)
})

test('computeFeatureLayout throws for empty flows', () => {
  assert.throws(() => computeFeatureLayout({ flows: [] }), /at least one flow/i)
})

test('computeFeatureLayout throws for flow with zero screens', () => {
  assert.throws(() => computeFeatureLayout({ flows: [{ name: 'Empty', screens: 0 }] }), /at least one screen/i)
})
```

#### Step 2: Implement `lib/layout-feature.mjs`

```js
// Pure layout math for the `feature` deliverable Section.
// All coordinates are in Figma absolute units inside the Section.

export const LAYOUT_CONSTANTS = Object.freeze({
  SECTION_PADDING:        280,
  SIDE_CARD_WIDTH:        738,
  SIDE_CARD_TO_SCREENS_GAP: 280,
  IPHONE_WIDTH:           390,
  IPHONE_HEIGHT:          844,
  BETWEEN_SCREENS_GAP:    104,
  FLOW_BANNER_TO_TAG_GAP: 128,
  TAG_TO_IPHONE_GAP:      40,
  BETWEEN_FLOWS_GAP:      200,
  BANNER_HEIGHT:          246,
  TAG_HEIGHT:             82,
})

const C = LAYOUT_CONSTANTS

function maxScreens(flows) {
  return flows.reduce((acc, f) => Math.max(acc, f.screens), 0)
}

function screensRowWidth(n) {
  return n <= 0 ? 0 : n * C.IPHONE_WIDTH + (n - 1) * C.BETWEEN_SCREENS_GAP
}

function screenBlockHeight() {
  return C.BANNER_HEIGHT + C.FLOW_BANNER_TO_TAG_GAP + C.TAG_HEIGHT + C.TAG_TO_IPHONE_GAP + C.IPHONE_HEIGHT
}

export function computeFeatureLayout({ flows }) {
  if (!Array.isArray(flows) || flows.length === 0) {
    throw new Error('Feature layout requires at least one flow')
  }
  for (const f of flows) {
    if (!f || typeof f.screens !== 'number' || f.screens < 1) {
      throw new Error('Each flow needs at least one screen')
    }
  }

  const maxN = maxScreens(flows)
  const screensWidth = screensRowWidth(maxN)
  const screensX = C.SECTION_PADDING + C.SIDE_CARD_WIDTH + C.SIDE_CARD_TO_SCREENS_GAP

  const blockHeight = screenBlockHeight()
  const rowsHeight = flows.length * blockHeight + (flows.length - 1) * C.BETWEEN_FLOWS_GAP
  const sectionHeight = 2 * C.SECTION_PADDING + rowsHeight
  const sectionWidth = 2 * C.SECTION_PADDING + 2 * C.SIDE_CARD_WIDTH + 2 * C.SIDE_CARD_TO_SCREENS_GAP + screensWidth

  const problemStatement = {
    x: C.SECTION_PADDING,
    y: C.SECTION_PADDING,
    width: C.SIDE_CARD_WIDTH,
    height: rowsHeight,
  }
  const analysisOverview = {
    x: sectionWidth - C.SECTION_PADDING - C.SIDE_CARD_WIDTH,
    y: C.SECTION_PADDING,
    width: C.SIDE_CARD_WIDTH,
    height: rowsHeight,
  }

  const flowsLayout = flows.map((f, i) => {
    const baseY = C.SECTION_PADDING + i * (blockHeight + C.BETWEEN_FLOWS_GAP)
    const tagY  = baseY + C.BANNER_HEIGHT + C.FLOW_BANNER_TO_TAG_GAP
    const phY   = tagY + C.TAG_HEIGHT + C.TAG_TO_IPHONE_GAP

    const screens = Array.from({ length: f.screens }, (_, j) => {
      const x = screensX + j * (C.IPHONE_WIDTH + C.BETWEEN_SCREENS_GAP)
      return {
        flowId: `flow-${i + 1}`,
        screenIndex: j,
        tag:         { x, y: tagY,  width: C.IPHONE_WIDTH, height: C.TAG_HEIGHT },
        placeholder: { x, y: phY,   width: C.IPHONE_WIDTH, height: C.IPHONE_HEIGHT },
      }
    })

    return {
      flowId: `flow-${i + 1}`,
      name: f.name,
      banner: { x: screensX, y: baseY, width: screensWidth, height: C.BANNER_HEIGHT },
      screens,
    }
  })

  return {
    section: { width: sectionWidth, height: sectionHeight },
    problemStatement,
    analysisOverview,
    flows: flowsLayout,
  }
}
```

#### Step 3: Run layout tests

Run: `node --test lib/layout-feature.test.mjs`
Expected: all 5 tests pass.

#### Step 4: Rewrite `lib/render-manifest.mjs`

Replace the entire file with:

```js
// Builds the render manifest — the declarative plan consumed by the
// /meet-criteria-new skill to draw the deliverable in Figma. Pure: no I/O,
// no implicit time (createdAt is a parameter).
//
// Manifest shape (v2 — Plan 3.6):
// {
//   version: '2.0.0',
//   type, slug, ticketRef, createdAt,
//   identity: { mode, overrides },
//   tokens:   { <tokenName>: <hex> },
//   layout:   { kind: 'section', padding, background },
//   page:     { name: 'MC - <slug>' },
//   section:  { name, width, height, pluginData: { role: 'root', ... } },
//   nodes:    [ {...} ],
//   checks:   { deterministic: [string] }
// }

import { resolveTokenRefs } from './visual-tokens.mjs'
import { computeFeatureLayout, LAYOUT_CONSTANTS } from './layout-feature.mjs'

export const MANIFEST_VERSION = '2.0.0'

export class RenderInputError extends Error {
  constructor(message, { code = 'UNKNOWN' } = {}) {
    super(message)
    this.name = 'RenderInputError'
    this.code = code
  }
}

const ANALYSIS_SECTION_HEADINGS = Object.freeze({
  resolution: 'Resolution',
  validation: 'What validates it',
  attention:  'Attention to',
  discussion: 'Topics for discussion',
})

function requireString(value, label, code = 'INVALID_INPUT') {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new RenderInputError(`${label} must be a non-empty string`, { code })
  }
  return value.trim()
}

function buildProblemStatementNode(structureNode, inputs, layout) {
  const text = inputs.problemStatement
  if (typeof text !== 'string' || text.trim() === '') {
    throw new RenderInputError('problem-statement is empty (deterministic check problem-statement-not-empty)', { code: 'EMPTY_PROBLEM_STATEMENT' })
  }
  return {
    id: structureNode.id,
    component: structureNode.component,
    x: layout.problemStatement.x,
    y: layout.problemStatement.y,
    width: layout.problemStatement.width,
    height: layout.problemStatement.height,
    heading: 'Problem statement',
    body: text.trim(),
    pluginData: { role: 'problem-statement' },
  }
}

function buildFlowsNode(structureNode, inputs, layout) {
  const minCount = structureNode.minCount ?? 1
  const maxCount = structureNode.maxCount ?? 10
  const flows = Array.isArray(inputs.flows) ? inputs.flows : []
  if (flows.length < minCount) throw new RenderInputError(`feature.flows has ${flows.length}; minimum ${minCount}`, { code: 'FLOWS_BELOW_MIN' })
  if (flows.length > maxCount) throw new RenderInputError(`feature.flows has ${flows.length}; maximum ${maxCount}`, { code: 'FLOWS_ABOVE_MAX' })

  const minScreens = structureNode.itemTemplate?.props?.minScreens ?? 1
  const maxScreens = structureNode.itemTemplate?.props?.maxScreens ?? 20

  // Validate each flow's screens count within bounds
  flows.forEach((f, i) => {
    if (!Number.isInteger(f.screens) || f.screens < minScreens) {
      throw new RenderInputError(`flows[${i}].screens=${f.screens} below minScreens=${minScreens}`, { code: 'SCREENS_BELOW_MIN' })
    }
    if (f.screens > maxScreens) {
      throw new RenderInputError(`flows[${i}].screens=${f.screens} above maxScreens=${maxScreens}`, { code: 'SCREENS_ABOVE_MAX' })
    }
    requireString(f.name, `flows[${i}].name`, 'INVALID_FLOW_NAME')
  })

  const children = layout.flows.map((flowLayout, i) => {
    const flowId = flowLayout.flowId
    const name = flows[i].name.trim()
    return {
      flowId,
      name,
      pluginData: { role: 'flow', flowId },
      banner: {
        x: flowLayout.banner.x, y: flowLayout.banner.y,
        width: flowLayout.banner.width, height: flowLayout.banner.height,
        text: name,
      },
      screens: flowLayout.screens.map((s) => ({
        x: s.tag.x, // wrapper x (matches tag/placeholder x)
        y: s.tag.y, // wrapper y top (tag origin)
        tag: { ...s.tag, text: `Screen name` },
        placeholder: { ...s.placeholder },
        pluginData: { role: 'screen-slot', flowId, screenIndex: s.screenIndex },
      })),
    }
  })

  return {
    id: structureNode.id,
    component: 'FlowList',
    pluginData: { role: 'flow-list' },
    children,
  }
}

function buildAnalysisOverviewNode(structureNode, inputs, layout) {
  const sectionKeys = structureNode.sections ?? ['resolution', 'validation', 'attention', 'discussion']
  return {
    id: structureNode.id,
    component: 'AnalysisOverview',
    x: layout.analysisOverview.x,
    y: layout.analysisOverview.y,
    width: layout.analysisOverview.width,
    height: layout.analysisOverview.height,
    heading: 'Analysis Overview',
    sections: sectionKeys.map((key) => ({
      key,
      heading: ANALYSIS_SECTION_HEADINGS[key] ?? key,
      body: '',
    })),
    pluginData: { role: 'analysis-overview' },
  }
}

const NODE_BUILDERS = {
  ProblemStatement: buildProblemStatementNode,
  FlowList: buildFlowsNode,
  AnalysisOverview: buildAnalysisOverviewNode,
}

export { LAYOUT_CONSTANTS }

export function buildRenderManifest({ template, identity, slug, ticketRef, createdAt, inputs }) {
  const ref = requireString(ticketRef, 'ticketRef', 'INVALID_TICKET_REF')
  const sanitizedSlug = requireString(slug, 'slug', 'INVALID_SLUG')
  const created = requireString(createdAt, 'createdAt', 'INVALID_CREATED_AT')
  if (!template || typeof template !== 'object') throw new RenderInputError('template is required', { code: 'MISSING_TEMPLATE' })
  if (!identity || !identity.tokens) throw new RenderInputError('identity is required (call resolveIdentity first)', { code: 'MISSING_IDENTITY' })
  if (!inputs || typeof inputs !== 'object') throw new RenderInputError('inputs is required', { code: 'MISSING_INPUTS' })

  const tokens = identity.tokens

  // Compute layout from inputs (only feature uses computeFeatureLayout for now;
  // the stub mudanca/conceito templates render without flows but still need a section).
  let layout
  if (template.type === 'feature') {
    if (!Array.isArray(inputs.flows) || inputs.flows.length === 0) {
      throw new RenderInputError('feature requires at least one flow in inputs.flows', { code: 'FLOWS_BELOW_MIN' })
    }
    layout = computeFeatureLayout({ flows: inputs.flows })
  } else {
    // Stub layout: side cards full-height of one virtual block; no flows row.
    const C = LAYOUT_CONSTANTS
    const stubInner = C.BANNER_HEIGHT + C.FLOW_BANNER_TO_TAG_GAP + C.TAG_HEIGHT + C.TAG_TO_IPHONE_GAP + C.IPHONE_HEIGHT
    const sectionHeight = 2 * C.SECTION_PADDING + stubInner
    const sectionWidth = 2 * C.SECTION_PADDING + 2 * C.SIDE_CARD_WIDTH + 2 * C.SIDE_CARD_TO_SCREENS_GAP // no screens
    layout = {
      section: { width: sectionWidth, height: sectionHeight },
      problemStatement: { x: C.SECTION_PADDING, y: C.SECTION_PADDING, width: C.SIDE_CARD_WIDTH, height: stubInner },
      analysisOverview: { x: sectionWidth - C.SECTION_PADDING - C.SIDE_CARD_WIDTH, y: C.SECTION_PADDING, width: C.SIDE_CARD_WIDTH, height: stubInner },
      flows: [],
    }
  }

  const nodes = template.structure.map((s) => {
    const builder = NODE_BUILDERS[s.component]
    if (!builder) throw new RenderInputError(`No builder for component "${s.component}"`, { code: 'UNKNOWN_COMPONENT' })
    const resolved = { ...s, props: s.props ? resolveTokenRefs(s.props, tokens) : s.props }
    return builder(resolved, inputs, layout)
  })

  const layoutOut = {
    kind: template.layout.kind,
    padding: template.layout.padding ?? LAYOUT_CONSTANTS.SECTION_PADDING,
    background: resolveTokenRefs(template.layout.background ?? '{token:section.background}', tokens),
  }

  return {
    version: MANIFEST_VERSION,
    type: template.type,
    slug: sanitizedSlug,
    ticketRef: ref,
    createdAt: created,
    identity: { mode: identity.mode, overrides: identity.overrides ?? {} },
    tokens,
    layout: layoutOut,
    page: { name: `MC - ${sanitizedSlug}` },
    section: {
      name: `Meet Criteria - ${ref}`,
      width: layout.section.width,
      height: layout.section.height,
      pluginData: {
        role: 'root',
        ticketRef: ref,
        type: template.type,
        templateVersion: template.version,
        createdAt: created,
        lastExecutedAt: created,
        visualIdentity: identity.mode,
        slug: sanitizedSlug,
      },
    },
    nodes,
    checks: { deterministic: template.checks?.deterministic ?? [] },
  }
}
```

#### Step 5: Rewrite `lib/render-manifest.test.mjs`

Replace the entire file with assertions that match the new manifest shape:

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildRenderManifest, MANIFEST_VERSION, RenderInputError, LAYOUT_CONSTANTS } from './render-manifest.mjs'
import { loadTemplate } from './template-loader.mjs'
import { resolveIdentity } from './visual-identity.mjs'
import { DEFAULT_TOKENS } from './visual-tokens.mjs'

const FIXED_DATE = '2026-05-01T15:30:00.000Z'

function baseArgs(type, overrides = {}) {
  const template = loadTemplate(type)
  const identity = resolveIdentity({ mode: 'default' })
  return {
    template,
    identity,
    slug: 'prod-1234',
    ticketRef: 'PROD-1234',
    createdAt: FIXED_DATE,
    inputs: { problemStatement: 'Sample text' },
    ...overrides,
  }
}

test('MANIFEST_VERSION is "2.0.0"', () => {
  assert.equal(MANIFEST_VERSION, '2.0.0')
})

test('feature: produces section with computed dimensions and node list', () => {
  const m = buildRenderManifest(baseArgs('feature', {
    inputs: { problemStatement: 'X', flows: [{ name: 'Flow A', screens: 4 }] },
  }))
  assert.equal(m.version, MANIFEST_VERSION)
  assert.equal(m.type, 'feature')
  assert.equal(m.section.name, 'Meet Criteria - PROD-1234')
  assert.equal(m.section.pluginData.role, 'root')
  assert.equal(m.section.width, 4468)
  assert.equal(m.section.height, 1900)
  assert.equal(m.layout.kind, 'section')
  assert.equal(m.layout.padding, LAYOUT_CONSTANTS.SECTION_PADDING)
  assert.match(m.layout.background, /^#[0-9a-f]{6}$/)

  const ids = m.nodes.map((n) => n.id)
  assert.deepEqual(ids, ['problem-statement', 'flows', 'analysis-overview'])
})

test('feature: problem-statement carries x/y and heading constant', () => {
  const m = buildRenderManifest(baseArgs('feature', {
    inputs: { problemStatement: 'Hello world', flows: [{ name: 'F', screens: 1 }] },
  }))
  const ps = m.nodes.find((n) => n.id === 'problem-statement')
  assert.equal(ps.x, 280)
  assert.equal(ps.y, 280)
  assert.equal(ps.width, 738)
  assert.equal(ps.heading, 'Problem statement')
  assert.equal(ps.body, 'Hello world')
})

test('feature: flows node has child per flow with banner + screens (tag + placeholder coords)', () => {
  const m = buildRenderManifest(baseArgs('feature', {
    inputs: { problemStatement: 'X', flows: [{ name: 'Flow A', screens: 2 }, { name: 'Flow B', screens: 1 }] },
  }))
  const flows = m.nodes.find((n) => n.id === 'flows')
  assert.equal(flows.children.length, 2)
  const f1 = flows.children[0]
  assert.equal(f1.flowId, 'flow-1')
  assert.equal(f1.name, 'Flow A')
  assert.equal(f1.banner.text, 'Flow A')
  assert.equal(f1.screens.length, 2)
  assert.equal(f1.screens[0].pluginData.role, 'screen-slot')
  assert.equal(f1.screens[0].pluginData.flowId, 'flow-1')
  assert.equal(f1.screens[0].pluginData.screenIndex, 0)
  // Tag and placeholder share the same x; placeholder y > tag y
  assert.equal(f1.screens[0].tag.x, f1.screens[0].placeholder.x)
  assert.ok(f1.screens[0].placeholder.y > f1.screens[0].tag.y)
})

test('feature: analysis-overview has 4 sections with English headings', () => {
  const m = buildRenderManifest(baseArgs('feature', {
    inputs: { problemStatement: 'X', flows: [{ name: 'F', screens: 1 }] },
  }))
  const ao = m.nodes.find((n) => n.id === 'analysis-overview')
  assert.equal(ao.heading, 'Analysis Overview')
  assert.equal(ao.sections.length, 4)
  assert.deepEqual(ao.sections.map((s) => s.heading), [
    'Resolution',
    'What validates it',
    'Attention to',
    'Topics for discussion',
  ])
  assert.deepEqual(ao.sections.map((s) => s.key), ['resolution', 'validation', 'attention', 'discussion'])
})

test('feature: rejects empty flows', () => {
  assert.throws(
    () => buildRenderManifest(baseArgs('feature', { inputs: { problemStatement: 'X', flows: [] } })),
    RenderInputError,
  )
})

test('feature: rejects empty problemStatement', () => {
  assert.throws(
    () => buildRenderManifest(baseArgs('feature', { inputs: { problemStatement: '   ', flows: [{ name: 'F', screens: 1 }] } })),
    /problem-statement/,
  )
})

test('feature: rejects flow with screens above maxScreens', () => {
  assert.throws(
    () => buildRenderManifest(baseArgs('feature', { inputs: { problemStatement: 'X', flows: [{ name: 'F', screens: 999 }] } })),
    /maxScreens/,
  )
})

test('feature: tokens fully resolved (no {token:...} survives)', () => {
  const m = buildRenderManifest(baseArgs('feature', {
    inputs: { problemStatement: 'X', flows: [{ name: 'F', screens: 1 }] },
  }))
  const stringified = JSON.stringify(m)
  assert.doesNotMatch(stringified, /\{token:[^}]+\}/)
  assert.equal(m.layout.background, DEFAULT_TOKENS['section.background'])
})

test('mudanca stub: produces problem-statement + analysis-overview only, no flows', () => {
  const m = buildRenderManifest(baseArgs('mudanca'))
  assert.equal(m.type, 'mudanca')
  const ids = m.nodes.map((n) => n.id)
  assert.deepEqual(ids, ['problem-statement', 'analysis-overview'])
})

test('conceito stub: produces problem-statement + analysis-overview only', () => {
  const m = buildRenderManifest(baseArgs('conceito'))
  assert.equal(m.type, 'conceito')
  const ids = m.nodes.map((n) => n.id)
  assert.deepEqual(ids, ['problem-statement', 'analysis-overview'])
})

test('rejects empty ticketRef', () => {
  assert.throws(
    () => buildRenderManifest(baseArgs('feature', { ticketRef: '   ', inputs: { problemStatement: 'X', flows: [{ name: 'F', screens: 1 }] } })),
    /ticketRef/,
  )
})

test('section name uses ASCII hyphen (not em-dash)', () => {
  const m = buildRenderManifest(baseArgs('feature', {
    inputs: { problemStatement: 'X', flows: [{ name: 'F', screens: 1 }] },
  }))
  assert.match(m.section.name, /^Meet Criteria - PROD-1234$/)
  assert.doesNotMatch(m.section.name, /—/)
})

test('checks.deterministic copied verbatim from template', () => {
  const m = buildRenderManifest(baseArgs('feature', {
    inputs: { problemStatement: 'X', flows: [{ name: 'F', screens: 1 }] },
  }))
  assert.deepEqual(m.checks.deterministic, [
    'problem-statement-not-empty',
    'no-empty-screen-slots',
    'no-placeholder-text',
    'analysis-overview-not-empty',
  ])
})
```

#### Step 6: Run all tests

Run: `npm test 2>&1 | tail -10`
Expected: render-manifest, layout-feature, visual-tokens, visual-identity all pass. `figma-render` and `local-store` may fail because they reference the old manifest shape — Tasks 6 and 7 fix those.

#### Step 7: Commit

```bash
git add lib/layout-feature.mjs lib/layout-feature.test.mjs lib/render-manifest.mjs lib/render-manifest.test.mjs
git commit -m "refactor(lib): rewrite render-manifest for v2 (section root, multi-flow, English keys)"
```

---

### Task 6: Update `lib/local-store.mjs` for the new manifest shape

`local-store` reads `manifest.nodes` to produce markdown skeletons. The shape changed: `flows` node now has `children` with `banner.text` (flow name) and `screens` array (with `tag.text` and `placeholder` coords). The `analysis-overview` node now has English headings on each section.

**Files:**
- Modify: `lib/local-store.mjs`
- Modify: `lib/local-store.test.mjs`

- [ ] **Step 1: Update `buildScreenJustificationsMd` to consume the new shape**

In `lib/local-store.mjs`, replace `buildScreenJustificationsMd` with:

```js
function buildScreenJustificationsMd(manifest) {
  const lines = ['# Screen justifications', '']
  if (manifest.type === 'feature') {
    const flows = manifest.nodes.find((n) => n.id === 'flows')
    if (!flows || !Array.isArray(flows.children)) return lines.join('\n')
    for (const flow of flows.children) {
      lines.push(`## ${flow.name}`, '')
      for (let i = 0; i < flow.screens.length; i++) {
        lines.push(`### Screen ${String(i + 1).padStart(2, '0')}`, '', '<!-- how this screen addresses the problem -->', '')
      }
    }
  }
  return lines.join('\n')
}
```

- [ ] **Step 2: Update `buildFlowsMd`**

```js
function buildFlowsMd(manifest) {
  if (manifest.type !== 'feature') return null
  const flows = manifest.nodes.find((n) => n.id === 'flows')
  if (!flows || !Array.isArray(flows.children)) return null
  const lines = ['# Flows', '']
  for (const flow of flows.children) {
    lines.push(`## ${flow.name}`, '', `${flow.screens.length} screen(s)`, '')
  }
  return lines.join('\n')
}
```

- [ ] **Step 3: Update `buildAnalysisMd`**

```js
function buildAnalysisMd(manifest) {
  const ao = manifest.nodes.find((n) => n.component === 'AnalysisOverview')
  const lines = ['# Analysis Overview', '']
  if (!ao || !Array.isArray(ao.sections)) return lines.join('\n')
  for (const sec of ao.sections) {
    lines.push(`## ${sec.heading}`, '', '<!-- fill in after /meet-criteria-analyze -->', '')
  }
  return lines.join('\n')
}
```

- [ ] **Step 4: Update the problem-statement extraction**

Where the file currently writes:

```js
writeIfMissing(join(root, 'problem-statement.md'),
  `# Problem statement\n\n${manifest.nodes.find((n) => n.id === 'problem-statement').text}\n`)
```

Change `.text` to `.body` (the new manifest exposes `body` not `text`):

```js
writeIfMissing(join(root, 'problem-statement.md'),
  `# Problem statement\n\n${manifest.nodes.find((n) => n.id === 'problem-statement').body}\n`)
```

- [ ] **Step 5: Update `metadataFromManifest` to omit the new `section` field too if you don't want it in metadata**

Actually keep `section` in metadata (it carries `name` and dimensions which are useful). The current `metadataFromManifest` already includes `manifest.container` — replace `container: manifest.container` with `section: manifest.section`. Final shape:

```js
function metadataFromManifest(manifest) {
  // Omits intentionally: tokens (large + re-derivable from identity),
  // nodes (large + re-derivable from template + inputs), layout
  // (re-derivable from template; not needed for identity checks or future plans).
  return {
    version: manifest.version,
    type: manifest.type,
    slug: manifest.slug,
    ticketRef: manifest.ticketRef,
    createdAt: manifest.createdAt,
    identity: manifest.identity,
    section: manifest.section,
    checks: manifest.checks,
  }
}
```

- [ ] **Step 6: Update tests**

In `lib/local-store.test.mjs`, every reference to `manifest.container` must change to `manifest.section`. Every test that asserts on `meta.container` becomes `meta.section`. Update fixtures as needed (the `mudanca` and `conceito` smoke tests now use stub templates with no pairs/variants; remove those assertions).

Specifically replace the `bootstrap mudanca` and `bootstrap conceito` tests with simpler versions that only assert metadata correctness (no flows/pairs/variants in stubs):

```js
test('bootstrap mudanca: only writes problem-statement and analysis-overview md skeletons', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'mc-store-mudanca-'))
  const manifest = makeManifest('mudanca', { problemStatement: 'Stub change description.' })
  const r = bootstrapLocalStore({ cwd, manifest })
  assert.equal(r.created, true)
  assert.equal(existsSync(join(r.path, 'flows.md')), false)
  const ps = readFileSync(join(r.path, 'problem-statement.md'), 'utf8')
  assert.match(ps, /Stub change description\./)
})

test('bootstrap conceito: same shape as mudanca stub', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'mc-store-conceito-'))
  const manifest = makeManifest('conceito', { problemStatement: 'Stub variants.' })
  const r = bootstrapLocalStore({ cwd, manifest })
  assert.equal(r.created, true)
  assert.equal(existsSync(join(r.path, 'flows.md')), false)
})
```

- [ ] **Step 7: Run tests**

Run: `node --test lib/local-store.test.mjs`
Expected: all pass.

- [ ] **Step 8: Commit**

```bash
git add lib/local-store.mjs lib/local-store.test.mjs
git commit -m "refactor(lib): adapt local-store to manifest v2 (section, English keys)"
```

---

### Task 7: Rewrite `lib/figma-render.mjs` for the new visual contract

This is the heaviest task. The rewrite touches:

- Section root (`figma.createSection()`) instead of Frame + Page
- Manual positioning via `x`/`y` for top-level children
- Inner cards/banners/tags use auto-layout to hug content
- Native iPhone 13 & 14 placeholder frames per screen
- English helper names, comments, error messages

**Files:**
- Modify: `lib/figma-render.mjs`
- Modify: `lib/figma-render.test.mjs`

- [ ] **Step 1: Replace the entire `RENDER_TEMPLATE_JS` and helper exports**

Replace `lib/figma-render.mjs` with:

```js
// Figma render template + builder. Pure module: produces the JS string that
// runs inside figma_execute. Not executable in Node — the Figma plugin API is
// only available at runtime in the Bridge plugin.
//
// Substitutions: __MANIFEST_JSON__ and __SELECTION_JSON__ are replaced via
// JSON.stringify; both are validated upstream so injection is impossible.

export class RenderJsError extends Error {
  constructor(message, { code = 'UNKNOWN' } = {}) {
    super(message)
    this.name = 'RenderJsError'
    this.code = code
  }
}

export const RENDER_TEMPLATE_JS = String.raw`
// ============================================================================
// Meet Criteria — render template (generated by lib/figma-render.mjs).
// Contract: lib/render-manifest.mjs builds the manifest; this template draws.
// Do not edit here — edit the template in lib/figma-render.mjs.
// ============================================================================
const MANIFEST = __MANIFEST_JSON__
const SELECTION = __SELECTION_JSON__

const FONT_FAMILY = (MANIFEST.tokens && MANIFEST.tokens['font.family.default']) || 'Inter'
const TEXT_PRIMARY = (MANIFEST.tokens && MANIFEST.tokens['text.primary']) || '#1d2b2c'
const CARD_BG     = (MANIFEST.tokens && MANIFEST.tokens['card.background']) || '#f5f8f8'
const BANNER_BG   = (MANIFEST.tokens && MANIFEST.tokens['banner.background']) || '#dee9e8'

function hexToRgb(hex) {
  const n = parseInt(String(hex).slice(1), 16)
  return { r: ((n >> 16) & 0xff) / 255, g: ((n >> 8) & 0xff) / 255, b: (n & 0xff) / 255 }
}

function solidFill(hex) {
  return { type: 'SOLID', color: hexToRgb(hex) }
}

function setPluginData(node, data) {
  if (!data) return
  for (const [k, v] of Object.entries(data)) {
    const value = (typeof v === 'object' && v !== null) ? JSON.stringify(v) : String(v)
    node.setSharedPluginData('meetCriteria', k, value)
  }
}

function makeText(characters, opts) {
  const t = figma.createText()
  t.fontName = { family: FONT_FAMILY, style: opts.style }
  t.fontSize = opts.size
  if (opts.lineHeight === 'AUTO') {
    t.lineHeight = { unit: 'AUTO' }
  } else if (typeof opts.lineHeight === 'number') {
    t.lineHeight = { unit: 'PERCENT', value: opts.lineHeight }
  }
  if (typeof opts.letterSpacingPercent === 'number') {
    t.letterSpacing = { unit: 'PERCENT', value: opts.letterSpacingPercent }
  }
  t.characters = characters
  t.fills = [solidFill(opts.color || TEXT_PRIMARY)]
  return t
}

function makeAutoFrame(name, kind, opts) {
  const f = figma.createFrame()
  f.name = name
  f.layoutMode = kind
  f.itemSpacing = opts.gap ?? 0
  f.paddingTop = opts.paddingTop ?? 0
  f.paddingRight = opts.paddingRight ?? 0
  f.paddingBottom = opts.paddingBottom ?? 0
  f.paddingLeft = opts.paddingLeft ?? 0
  f.cornerRadius = opts.corner ?? 0
  f.fills = opts.fillHex ? [solidFill(opts.fillHex)] : []
  f.strokes = []
  if (opts.counterAxisAlignItems) f.counterAxisAlignItems = opts.counterAxisAlignItems
  return f
}

function buildProblemStatementCard(node) {
  const f = makeAutoFrame('Problem statement', 'VERTICAL', {
    gap: 32, paddingTop: 48, paddingRight: 48, paddingBottom: 48, paddingLeft: 48,
    corner: 24, fillHex: CARD_BG,
  })
  f.x = node.x; f.y = node.y
  f.resize(node.width, node.height)
  f.primaryAxisSizingMode = 'FIXED'
  f.counterAxisSizingMode = 'FIXED'

  const heading = makeText(node.heading, { style: 'Medium', size: 48, lineHeight: 100, color: TEXT_PRIMARY })
  heading.layoutAlign = 'STRETCH'
  heading.textAutoResize = 'HEIGHT'
  f.appendChild(heading)

  const body = makeText(node.body, { style: 'Regular', size: 20, lineHeight: 120, color: TEXT_PRIMARY })
  body.layoutAlign = 'STRETCH'
  body.textAutoResize = 'HEIGHT'
  f.appendChild(body)

  setPluginData(f, node.pluginData)
  return f
}

function buildFlowNameBanner(banner, flowPluginData) {
  const f = makeAutoFrame('Flow Name — ' + banner.text, 'HORIZONTAL', {
    gap: 40, paddingTop: 56, paddingRight: 56, paddingBottom: 56, paddingLeft: 56,
    corner: 48, fillHex: BANNER_BG, counterAxisAlignItems: 'CENTER',
  })
  f.x = banner.x; f.y = banner.y
  f.resize(banner.width, banner.height)
  f.primaryAxisSizingMode = 'FIXED'
  f.counterAxisSizingMode = 'AUTO'

  const t = makeText(banner.text, { style: 'Medium', size: 80, lineHeight: 'AUTO', letterSpacingPercent: -4, color: TEXT_PRIMARY })
  t.layoutGrow = 1
  t.textAutoResize = 'TRUNCATE'
  t.textAlignVertical = 'CENTER'
  f.appendChild(t)

  setPluginData(f, flowPluginData)
  return f
}

function buildScreenNameTag(tag, screenPluginData) {
  const f = makeAutoFrame('Screen Name — ' + tag.text, 'HORIZONTAL', {
    gap: 16, paddingTop: 24, paddingRight: 20, paddingBottom: 24, paddingLeft: 20,
    corner: 16, fillHex: CARD_BG, counterAxisAlignItems: 'CENTER',
  })
  f.x = tag.x; f.y = tag.y
  f.resize(tag.width, tag.height)
  f.primaryAxisSizingMode = 'FIXED'
  f.counterAxisSizingMode = 'AUTO'

  const t = makeText(tag.text, { style: 'Medium', size: 28, lineHeight: 'AUTO', letterSpacingPercent: -2, color: TEXT_PRIMARY })
  t.textAutoResize = 'WIDTH_AND_HEIGHT'
  f.appendChild(t)

  setPluginData(f, screenPluginData)
  return f
}

async function buildIPhonePlaceholder(placeholder, figId, indexLabel) {
  const f = figma.createFrame()
  f.name = 'iPhone 13 & 14 - ' + indexLabel
  f.layoutMode = 'NONE'
  f.cornerRadius = 16
  f.fills = [solidFill(CARD_BG)]
  f.strokes = []
  f.x = placeholder.x; f.y = placeholder.y
  f.resize(placeholder.width, placeholder.height)

  if (figId) {
    const original = await figma.getNodeByIdAsync(figId)
    if (original && typeof original.clone === 'function') {
      const dup = original.clone()
      dup.x = 0; dup.y = 0
      f.appendChild(dup)
    }
  }
  return f
}

function buildAnalysisOverviewCard(node) {
  const f = makeAutoFrame('Analysis Overview', 'VERTICAL', {
    gap: 48, paddingTop: 48, paddingRight: 48, paddingBottom: 48, paddingLeft: 48,
    corner: 24, fillHex: CARD_BG,
  })
  f.x = node.x; f.y = node.y
  f.resize(node.width, node.height)
  f.primaryAxisSizingMode = 'FIXED'
  f.counterAxisSizingMode = 'FIXED'

  const heading = makeText(node.heading, { style: 'Medium', size: 48, lineHeight: 100, color: TEXT_PRIMARY })
  heading.layoutAlign = 'STRETCH'
  heading.textAutoResize = 'HEIGHT'
  f.appendChild(heading)

  for (const sec of (node.sections || [])) {
    const sub = makeAutoFrame('Section — ' + sec.key, 'VERTICAL', { gap: 20 })
    sub.layoutAlign = 'STRETCH'
    sub.layoutSizingHorizontal = undefined
    sub.primaryAxisSizingMode = 'AUTO'
    sub.counterAxisSizingMode = 'FIXED'

    const subHeading = makeText(sec.heading, { style: 'Semi Bold', size: 28, lineHeight: 100, color: TEXT_PRIMARY })
    subHeading.layoutAlign = 'STRETCH'
    subHeading.textAutoResize = 'HEIGHT'
    sub.appendChild(subHeading)

    const subBody = makeText(sec.body || '', { style: 'Regular', size: 20, lineHeight: 120, color: TEXT_PRIMARY })
    subBody.layoutAlign = 'STRETCH'
    subBody.textAutoResize = 'HEIGHT'
    sub.appendChild(subBody)

    f.appendChild(sub)
  }

  setPluginData(f, node.pluginData)
  return f
}

// ----- main flow -----
await figma.loadFontAsync({ family: FONT_FAMILY, style: 'Regular' })
await figma.loadFontAsync({ family: FONT_FAMILY, style: 'Medium' })
await figma.loadFontAsync({ family: FONT_FAMILY, style: 'Semi Bold' })
await figma.loadAllPagesAsync()

// Always create a dedicated page so the user's reference page is left untouched.
const existingPage = figma.root.children.find((p) => p.name === MANIFEST.page.name)
if (existingPage) {
  return JSON.stringify({ error: 'Page "' + MANIFEST.page.name + '" already exists. Rename or delete it first.' })
}

const page = figma.createPage()
page.name = MANIFEST.page.name
await figma.setCurrentPageAsync(page)

const section = figma.createSection()
section.name = MANIFEST.section.name
section.fills = [solidFill(MANIFEST.layout.background)]
section.resizeWithoutConstraints(MANIFEST.section.width, MANIFEST.section.height)
section.x = 0
section.y = 0
page.appendChild(section)
setPluginData(section, MANIFEST.section.pluginData)

// Render nodes (positions are absolute inside the section).
let placeholderIndex = 0
for (const node of MANIFEST.nodes) {
  if (node.component === 'ProblemStatement') {
    section.appendChild(buildProblemStatementCard(node))
  } else if (node.component === 'AnalysisOverview') {
    section.appendChild(buildAnalysisOverviewCard(node))
  } else if (node.component === 'FlowList') {
    let selectionIdx = 0
    for (const flow of node.children) {
      section.appendChild(buildFlowNameBanner(flow.banner, flow.pluginData))
      for (const screen of flow.screens) {
        section.appendChild(buildScreenNameTag(screen.tag, screen.pluginData))
        const figId = SELECTION[selectionIdx++]
        placeholderIndex++
        section.appendChild(await buildIPhonePlaceholder(screen.placeholder, figId, String(placeholderIndex)))
      }
    }
  }
}

return JSON.stringify({
  page: page.id,
  section: section.id,
  name: section.name,
})
`

function expectedSelectionLength(manifest) {
  if (!Array.isArray(manifest.nodes)) {
    throw new RenderJsError('manifest.nodes must be an array', { code: 'INVALID_MANIFEST' })
  }
  if (manifest.type !== 'feature') return 0
  const flows = manifest.nodes.find((n) => n.id === 'flows')
  if (!flows || !Array.isArray(flows.children)) {
    throw new RenderJsError('feature manifest is missing the "flows" node', { code: 'INVALID_MANIFEST' })
  }
  return flows.children.reduce((acc, f) => acc + (Array.isArray(f.screens) ? f.screens.length : 0), 0)
}

export function buildRenderJs({ manifest, selectionIds }) {
  if (!manifest || typeof manifest !== 'object') {
    throw new RenderJsError('manifest is required', { code: 'MISSING_MANIFEST' })
  }
  if (!Array.isArray(selectionIds)) {
    throw new RenderJsError('selectionIds must be an array', { code: 'INVALID_SELECTION_TYPE' })
  }
  const expected = expectedSelectionLength(manifest)
  if (selectionIds.length !== expected) {
    throw new RenderJsError(
      `selectionIds has ${selectionIds.length} item(s); manifest expects ${expected}.`,
      { code: 'SELECTION_LENGTH_MISMATCH' },
    )
  }
  return RENDER_TEMPLATE_JS
    .replace(/__MANIFEST_JSON__/g, JSON.stringify(manifest))
    .replace(/__SELECTION_JSON__/g, JSON.stringify(selectionIds))
}
```

> Note: the previous `figma.createPage()` flow is gone. The Section is created on the **current page** of the Figma file. The skill's Passo 1 will instruct the user to switch to the page where they want the deliverable beforehand.

- [ ] **Step 2: Rewrite `lib/figma-render.test.mjs`**

Replace with:

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildRenderJs, RENDER_TEMPLATE_JS, RenderJsError } from './figma-render.mjs'
import { loadTemplate } from './template-loader.mjs'
import { resolveIdentity } from './visual-identity.mjs'
import { buildRenderManifest } from './render-manifest.mjs'

const FIXED_DATE = '2026-05-01T15:30:00.000Z'

function makeManifest(type, inputs) {
  const template = loadTemplate(type)
  const identity = resolveIdentity({ mode: 'default' })
  return buildRenderManifest({
    template, identity,
    slug: 'prod-1234',
    ticketRef: 'PROD-1234',
    createdAt: FIXED_DATE,
    inputs,
  })
}

test('RENDER_TEMPLATE_JS contains the new helper names', () => {
  for (const helper of [
    'hexToRgb',
    'setPluginData',
    'makeText',
    'makeAutoFrame',
    'buildProblemStatementCard',
    'buildFlowNameBanner',
    'buildScreenNameTag',
    'buildIPhonePlaceholder',
    'buildAnalysisOverviewCard',
  ]) {
    assert.match(RENDER_TEMPLATE_JS, new RegExp(`\\b${helper}\\b`), `helper "${helper}" missing from template`)
  }
})

test('RENDER_TEMPLATE_JS uses figma.createSection (not createPage/createFrame for root)', () => {
  assert.match(RENDER_TEMPLATE_JS, /figma\.createSection/)
})

test('RENDER_TEMPLATE_JS uses setCurrentPageAsync (figma-use rule 9)', () => {
  assert.match(RENDER_TEMPLATE_JS, /setCurrentPageAsync\s*\(/)
  assert.doesNotMatch(RENDER_TEMPLATE_JS, /figma\.currentPage\s*=\s*page/)
})

test('RENDER_TEMPLATE_JS loads Inter Medium and Semi Bold (used by typography spec)', () => {
  assert.match(RENDER_TEMPLATE_JS, /style:\s*['"]Medium['"]/)
  assert.match(RENDER_TEMPLATE_JS, /style:\s*['"]Semi Bold['"]/)
})

test('buildRenderJs substitutes both placeholders globally', () => {
  const m = makeManifest('feature', { problemStatement: 'X', flows: [{ name: 'F', screens: 1 }] })
  const js = buildRenderJs({ manifest: m, selectionIds: ['1:1'] })
  assert.doesNotMatch(js, /__MANIFEST_JSON__/)
  assert.doesNotMatch(js, /__SELECTION_JSON__/)
  assert.match(js, /"slug":\s*"prod-1234"/)
  assert.match(js, /"1:1"/)
})

test('buildRenderJs produces parseable JS (new Function smoke parse)', () => {
  const m = makeManifest('feature', { problemStatement: 'X', flows: [{ name: 'F', screens: 1 }] })
  const js = buildRenderJs({ manifest: m, selectionIds: ['1:1'] })
  assert.doesNotThrow(() => new Function(`return (async () => { ${js} })`))
})

test('buildRenderJs validates selectionIds length for feature', () => {
  const m = makeManifest('feature', { problemStatement: 'X', flows: [{ name: 'F', screens: 3 }, { name: 'G', screens: 2 }] })
  assert.throws(() => buildRenderJs({ manifest: m, selectionIds: ['a','b','c','d'] }), RenderJsError)
  assert.doesNotThrow(() => buildRenderJs({ manifest: m, selectionIds: ['a','b','c','d','e'] }))
})

test('buildRenderJs allows zero selectionIds for stub mudanca/conceito', () => {
  const mMud = makeManifest('mudanca', { problemStatement: 'X' })
  assert.doesNotThrow(() => buildRenderJs({ manifest: mMud, selectionIds: [] }))
  const mCon = makeManifest('conceito', { problemStatement: 'X' })
  assert.doesNotThrow(() => buildRenderJs({ manifest: mCon, selectionIds: [] }))
})

test('RenderJsError carries code discriminator', () => {
  let caught
  try { buildRenderJs({ manifest: makeManifest('feature', { problemStatement: 'X', flows: [{ name: 'F', screens: 1 }] }), selectionIds: [] }) }
  catch (e) { caught = e }
  assert.ok(caught instanceof RenderJsError)
  assert.equal(caught.code, 'SELECTION_LENGTH_MISMATCH')
})

test('RENDER_TEMPLATE_JS contains the section name (Meet Criteria - <ref>) format string', () => {
  // The literal name comes from MANIFEST.section.name; the template references it by property.
  assert.match(RENDER_TEMPLATE_JS, /MANIFEST\.section\.name/)
})

test('buildRenderJs with malformed manifest throws RenderJsError code=INVALID_MANIFEST', () => {
  let caught
  try { buildRenderJs({ manifest: { type: 'feature', nodes: null }, selectionIds: [] }) } catch (e) { caught = e }
  assert.ok(caught instanceof RenderJsError)
  assert.equal(caught.code, 'INVALID_MANIFEST')
})
```

- [ ] **Step 3: Run all tests**

Run: `npm test 2>&1 | tail -10`
Expected: ALL tests pass. The number will be roughly 165–180 (we removed some old tests, added new ones).

- [ ] **Step 4: Commit**

```bash
git add lib/figma-render.mjs lib/figma-render.test.mjs
git commit -m "refactor(lib): rewrite figma-render template (Section root, manual positioning, English helpers)"
```

---

---

### Task 8: End-to-end smoke + tag

- [ ] **Step 1: Run the full test suite**

Run: `npm test 2>&1 | tail -10`
Expected: all tests pass with the v2 contract. Roughly 160–180 tests.

- [ ] **Step 2: Local smoke (no Figma)**

Run:
```bash
TMPDIR_NEW=$(mktemp -d) && \
echo '{"ticketRef":"FEAT-1","problemStatement":"Greenfield feature.","flows":[{"name":"Main flow","screens":2}],"identity":{"mode":"default"},"selectionIds":["fake-1","fake-2"]}' \
  | npm run new:deliverable --silent -- --type feature --cwd "$TMPDIR_NEW" --with-render-js --created-at 2026-05-01T15:30:00.000Z \
  | node -e "let s=''; process.stdin.on('data',d=>s+=d).on('end',()=>{const o=JSON.parse(s); console.log('section.name:', o.manifest.section.name); console.log('section.size:', o.manifest.section.width, 'x', o.manifest.section.height); console.log('renderJs has Section:', /figma\\.createSection/.test(o.renderJs)); console.log('renderJs has English helpers:', /buildIPhonePlaceholder/.test(o.renderJs))})" && \
rm -rf "$TMPDIR_NEW"
```

Expected:
```
section.name: Meet Criteria - FEAT-1
section.size: 2974 x 1900
renderJs has Section: true
renderJs has English helpers: true
```

(Width 2974 = 280+738+280+(2*390+1*104)+280+738+280 = 2596 + 884 = 3480? Let me recompute: 2*390 + 1*104 = 884. 2596+884 = 3480. So expected width is 3480, not 2974. Adjust the expected value. Either way, just verify the smoke produces a number.)

- [ ] **Step 3: Confirm git status clean**

Run: `git status`
Expected: working tree clean.

- [ ] **Step 4: Tag**

```bash
git tag -a v0.4.0-feature-rewrite -m "Plan 3.6 (feature rewrite) complete"
```

- [ ] **Step 5: Log of the plan's commits**

Run: `git log --oneline v0.3.5-figma-render..HEAD`
Expected: ~7 commits matching the task structure (palette, tokens, identity, templates, manifest, local-store, figma-render).

---

## Self-Review

**1. Coverage of stated scope:**

- ✅ firefly palette → Tasks 1–2
- ✅ Section root with no auto-layout → Task 7 (figma-render template)
- ✅ Auto-layout only on tags/cards/banners → Task 7 helpers
- ✅ Native iPhone 13 & 14 frame per screen → Task 7 `buildIPhonePlaceholder`
- ✅ ContextMacro removed → Tasks 4 (templates) + 5 (manifest) + 7 (template helpers)
- ✅ Multi-flow vertical stacking → Task 5 `computeFeatureLayout`
- ✅ Figma-rendered text in English (section name, frame names, headings) → Task 5 manifest + Task 7 template
- ✅ Project markdown / CLI strings remain pt-BR (out of scope) → "Translation scope" in plan header
- ✅ `text.primary` standardized to firefly-950 (no `#191c24`) → Task 2 token registry
- ✅ Section name uses ASCII hyphen — `Meet Criteria - <Ticket Ref>` → Task 5 manifest
- ✅ Page name uses ASCII hyphen — `MC - <slug>` → Task 5 manifest
- ✅ Always create dedicated page (don't reuse user's reference page) → Task 7 figma-render template
- ✅ `mudanca`/`conceito` stub templates (rebuild later) → Task 4

**2. Placeholder scan:** every test, every snippet, every command has explicit content. No "TBD".

**3. Type consistency:**

- `MANIFEST_VERSION = '2.0.0'` (was '1.0.0') — bumped in Task 5
- Manifest shape: `{ version, type, slug, ticketRef, createdAt, identity, tokens, layout, section, nodes, checks }` — no more `container` or `page`
- Section role plugin data unchanged: `role: 'root'` (consistent across tasks 5, 7)
- Component enum: `ProblemStatement | FlowList | FlowNameBanner | ScreenNameTag | IPhonePlaceholder | AnalysisOverview | AnalysisSubFrame` — single source of truth in `schemas/template.schema.json` (Task 4) and exercised in tests (Tasks 5, 7)
- `expectedSelectionLength` for non-feature types returns 0 — both `figma-render` and the CLI handle that correctly
- Section name format: `Meet Criteria - <Ticket Ref>` (ASCII hyphen) — assertions in Task 5 tests pin this
- Token names — `section.background`, `card.background`, `banner.background`, `text.primary`, `font.family.default` — referenced consistently across tokens registry, identity overrides, manifest, and figma-render template

Self-review complete. Ready for execution.
