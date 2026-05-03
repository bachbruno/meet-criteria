# /meet-criteria-check Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `/meet-criteria-check [<slug>]` — a deterministic, read-only command that audits a Meet Criteria deliverable in Figma and reports pendências in pt-BR with clickable navigation, plus a non-blocking pre-flight inside `/meet-criteria-analyze`.

**Architecture:** One single `figma_execute` snapshot reader collects every text + plugin data + child count needed to evaluate 6 pure rules. Rules live in `lib/check-helpers.mjs` as `(snapshot) => Finding[]` functions and are unit-tested with hand-crafted snapshot fixtures. The skill `checking-deliverables.md` orchestrates: snapshot → rules → terminal report → `AskUserQuestion`-driven navigation loop.

**Tech Stack:** Node 20+ ESM, `node:test`, `node:vm`, `figma-console MCP`, JSON-only IO. No new npm dependencies.

**Spec:** [`docs/superpowers/specs/2026-05-02-meet-criteria-check-design.md`](../specs/2026-05-02-meet-criteria-check-design.md)

---

## Setup (before Task 1)

Create a dedicated worktree so the implementation is isolated from `main`:

```bash
git fetch origin
git worktree add .worktrees/meet-criteria-check -b feat/meet-criteria-check origin/main
cd .worktrees/meet-criteria-check
npm install
npm test         # baseline: should be all green (Plan 4 merged)
```

All subsequent task commands assume `cwd = .worktrees/meet-criteria-check`. Final integration via PR + merge to `main`, then `git worktree remove .worktrees/meet-criteria-check` (post-merge cleanup mirrors Plano 4 / memory S976).

## File map

| File | Status | Responsibility |
|---|---|---|
| `lib/check-helpers.mjs` | Create | Pure helpers: `CheckError`, `buildCheckSnapshotJs`, 6 rule functions, `runRules`, `formatReport`, `buildNavigationOptions`, `buildNavigateToNodeJs` |
| `lib/check-helpers.test.mjs` | Create | Unit tests: builder parseability + injection-safety, each rule isolated, ordering, formatter output, navigation options |
| `commands/meet-criteria-check.md` | Create | Entry-point of the slash command — declarations + invokes the skill |
| `skills/checking-deliverables.md` | Create | Step-by-step orchestration (resolve slug → snapshot → rules → report → nav loop) |
| `lib/render-manifest.mjs` | Modify | Promote `ANALYSIS_SECTION_PLACEHOLDERS` to `export const` |
| `skills/analyzing-deliverables.md` | Modify | Add Step 0.5 pre-flight (informacional, não bloqueia) |
| `README.md` | Modify | Mark Plano 6 as ✅, add "Verificando um entregável" section, update file tree |

---

## Task 1: Export `ANALYSIS_SECTION_PLACEHOLDERS`

**Files:**
- Modify: `lib/render-manifest.mjs` (line 41)

- [ ] **Step 1: Add the `export` keyword**

```js
// Before:
const ANALYSIS_SECTION_PLACEHOLDERS = Object.freeze({
// After:
export const ANALYSIS_SECTION_PLACEHOLDERS = Object.freeze({
```

- [ ] **Step 2: Run full test suite to confirm no regression**

Run: `npm test`
Expected: PASS — all existing tests stay green (the constant was already used internally; making it exported is purely additive).

- [ ] **Step 3: Commit**

```bash
git add lib/render-manifest.mjs
git commit -m "refactor(render-manifest): export ANALYSIS_SECTION_PLACEHOLDERS for /check reuse"
```

---

## Task 2: Bootstrap `check-helpers.mjs` + `CheckError`

**Files:**
- Create: `lib/check-helpers.mjs`
- Create: `lib/check-helpers.test.mjs`

- [ ] **Step 1: Write the failing test**

Create `lib/check-helpers.test.mjs`:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { CheckError } from './check-helpers.mjs'

test('CheckError carries name, code, and details', () => {
  const err = new CheckError('boom', { code: 'X', details: { foo: 1 } })
  assert.equal(err.name, 'CheckError')
  assert.equal(err.message, 'boom')
  assert.equal(err.code, 'X')
  assert.deepEqual(err.details, { foo: 1 })
})

test('CheckError defaults code to UNKNOWN and details to null', () => {
  const err = new CheckError('boom')
  assert.equal(err.code, 'UNKNOWN')
  assert.equal(err.details, null)
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test lib/check-helpers.test.mjs`
Expected: FAIL with "Cannot find module './check-helpers.mjs'".

- [ ] **Step 3: Create the minimal implementation**

Create `lib/check-helpers.mjs`:

```js
// Pure helpers for /meet-criteria-check. No I/O, no Figma runtime dependency
// — builders return JS strings to be passed to figma_execute by the
// orchestrating skill. Rules are pure (snapshot) => Finding[] functions.

export class CheckError extends Error {
  constructor(message, { code = 'UNKNOWN', details = null } = {}) {
    super(message)
    this.name = 'CheckError'
    this.code = code
    this.details = details
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test lib/check-helpers.test.mjs`
Expected: PASS — both `CheckError` cases.

- [ ] **Step 5: Commit**

```bash
git add lib/check-helpers.mjs lib/check-helpers.test.mjs
git commit -m "feat(check-helpers): bootstrap module with CheckError class"
```

---

## Task 3: `buildCheckSnapshotJs`

**Files:**
- Modify: `lib/check-helpers.mjs`
- Modify: `lib/check-helpers.test.mjs`

- [ ] **Step 1: Write the failing tests**

Append to `lib/check-helpers.test.mjs`:

```js
import vm from 'node:vm'
import { buildCheckSnapshotJs } from './check-helpers.mjs'

function assertParseable(js) {
  const src = `(async () => { ${js} })`
  assert.doesNotThrow(() => new vm.Script(src), `JS must parse: ${js.slice(0, 200)}...`)
}

test('buildCheckSnapshotJs throws on missing sectionId', () => {
  assert.throws(() => buildCheckSnapshotJs({ knownPlaceholders: {} }),
    (err) => err.code === 'MISSING_SECTION_ID')
})

test('buildCheckSnapshotJs returns parseable JS that loads pages and reads roles', () => {
  const js = buildCheckSnapshotJs({ sectionId: 'sec-1', knownPlaceholders: {} })
  assertParseable(js)
  assert.match(js, /loadAllPagesAsync/)
  assert.match(js, /getNodeByIdAsync/)
  assert.match(js, /'role'/)
  assert.match(js, /'screen-slot'/)
  assert.match(js, /'screen-justification'/)
  assert.match(js, /'screen-tag'/)
  assert.match(js, /'problem-statement'/)
  assert.match(js, /'analysis-overview'/)
  assert.match(js, /'analysis-section'/)
  assert.match(js, /'flow'/)
  assert.match(js, /lastAnalyzedAt/)
})

test('buildCheckSnapshotJs embeds knownPlaceholders as JSON literal', () => {
  const js = buildCheckSnapshotJs({
    sectionId: 'sec-1',
    knownPlaceholders: { 'analysis.resolution': 'Run /analyze.' },
  })
  assert.match(js, /"analysis\.resolution":"Run \/analyze\."/)
})

test('buildCheckSnapshotJs escapes injection-prone sectionId', () => {
  const js = buildCheckSnapshotJs({
    sectionId: '</script><x>"\'\n',
    knownPlaceholders: {},
  })
  assert.doesNotMatch(js, /<\/script>/)
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test lib/check-helpers.test.mjs`
Expected: FAIL — `buildCheckSnapshotJs is not a function`.

- [ ] **Step 3: Implement `buildCheckSnapshotJs`**

Append to `lib/check-helpers.mjs`:

```js
function jsonStringify(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c')
}

export function buildCheckSnapshotJs({ sectionId, knownPlaceholders = {} } = {}) {
  if (!sectionId || typeof sectionId !== 'string') {
    throw new CheckError('sectionId is required', { code: 'MISSING_SECTION_ID' })
  }
  const idLit = jsonStringify(sectionId)
  const knownLit = jsonStringify(knownPlaceholders)
  return `
await figma.loadAllPagesAsync()
const section = await figma.getNodeByIdAsync(${idLit})
if (!section) return JSON.stringify({ error: 'SECTION_NOT_FOUND' })

const KNOWN_PLACEHOLDERS = ${knownLit}

function meta(node, key) { return node.getSharedPluginData('meetCriteria', key) }
function role(node) { return meta(node, 'role') }
function intMeta(node, key) { const v = meta(node, key); return v === '' ? null : Number(v) }
function textOf(node) { return (node && node.type === 'TEXT') ? (node.characters || '') : '' }
function firstTextChild(node) {
  if (!node || !node.children) return null
  return node.children.find((c) => c.type === 'TEXT') || null
}
function nthTextChild(node, n) {
  if (!node || !node.children) return null
  const texts = node.children.filter((c) => c.type === 'TEXT')
  return texts[n] || null
}

let problemStatement = null
let analysisOverview = null
const flowMap = new Map()

function ensureFlow(flowId) {
  if (!flowMap.has(flowId)) {
    flowMap.set(flowId, { flowId, flowNodeId: null, flowName: '', slots: new Map() })
  }
  return flowMap.get(flowId)
}
function ensureSlot(flowId, idx) {
  const f = ensureFlow(flowId)
  if (!f.slots.has(idx)) {
    f.slots.set(idx, {
      flowId, screenIndex: idx,
      tagId: null, slotId: null, slotChildCount: 0,
      justificationId: null, justificationText: '',
    })
  }
  return f.slots.get(idx)
}

function visit(node) {
  const r = role(node)
  if (r === 'problem-statement') {
    const body = nthTextChild(node, 1) || firstTextChild(node)
    problemStatement = body
      ? { nodeId: body.id, text: textOf(body) }
      : { nodeId: node.id, text: '' }
  } else if (r === 'flow') {
    const flowId = meta(node, 'flowId')
    const f = ensureFlow(flowId)
    f.flowNodeId = node.id
    const banner = firstTextChild(node)
    f.flowName = banner ? textOf(banner) : ''
  } else if (r === 'screen-tag') {
    const flowId = meta(node, 'flowId')
    const idx = intMeta(node, 'screenIndex')
    const slot = ensureSlot(flowId, idx)
    slot.tagId = node.id
  } else if (r === 'screen-slot') {
    const flowId = meta(node, 'flowId')
    const idx = intMeta(node, 'screenIndex')
    const slot = ensureSlot(flowId, idx)
    slot.slotId = node.id
    slot.slotChildCount = (node.children || []).length
  } else if (r === 'screen-justification') {
    const flowId = meta(node, 'flowId')
    const idx = intMeta(node, 'screenIndex')
    const slot = ensureSlot(flowId, idx)
    slot.justificationId = node.id
    slot.justificationText = textOf(node)
  } else if (r === 'analysis-overview') {
    const sections = []
    if (node.children) {
      for (const sub of node.children) {
        if (role(sub) !== 'analysis-section') continue
        const key = meta(sub, 'key')
        const body = nthTextChild(sub, 1)
        sections.push({
          key,
          nodeId: sub.id,
          bodyTextNodeId: body ? body.id : null,
          text: body ? textOf(body) : '',
        })
      }
    }
    analysisOverview = { nodeId: node.id, sections }
  }
  if (node.children) for (const c of node.children) visit(c)
}
visit(section)

const flowsArr = [...flowMap.values()].map((f) => ({
  flowId: f.flowId,
  flowNodeId: f.flowNodeId,
  flowName: f.flowName,
  slots: [...f.slots.values()].sort((a, b) => a.screenIndex - b.screenIndex),
}))

let lastAnalyzedAt = null
const lar = section.getSharedPluginData('meetCriteria', 'lastAnalyzedAt')
if (lar && typeof lar === 'string' && lar.trim() !== '' && !Number.isNaN(Date.parse(lar))) {
  lastAnalyzedAt = lar
}

return JSON.stringify({
  sectionId: section.id,
  ticketRef: section.getSharedPluginData('meetCriteria', 'ticketRef') || '',
  type: section.getSharedPluginData('meetCriteria', 'type') || '',
  lastAnalyzedAt,
  problemStatement,
  flows: flowsArr,
  analysisOverview,
  knownPlaceholders: KNOWN_PLACEHOLDERS,
})
`
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test lib/check-helpers.test.mjs`
Expected: PASS — 4 new cases (plus the 2 from Task 2) all green.

- [ ] **Step 5: Commit**

```bash
git add lib/check-helpers.mjs lib/check-helpers.test.mjs
git commit -m "feat(check-helpers): add buildCheckSnapshotJs builder with parseability tests"
```

---

## Task 4: Snapshot fixture builder for tests

**Files:**
- Modify: `lib/check-helpers.test.mjs`

- [ ] **Step 1: Append the fixture helper at the bottom of the test file**

```js
// ----- snapshot fixture builder -----
// Builds a minimal but valid snapshot. Tests pass partial overrides for the
// fields they care about; everything else defaults to "all green".
function makeSnapshot(overrides = {}) {
  const base = {
    sectionId: 'sec-1',
    ticketRef: 'PROD-1234',
    type: 'feature',
    lastAnalyzedAt: '2026-05-02T15:00:00.000Z',
    problemStatement: { nodeId: 'ps-text-1', text: 'A real problem statement.' },
    flows: [
      {
        flowId: 'flow-1',
        flowNodeId: 'flow-node-1',
        flowName: 'Onboarding',
        slots: [
          { flowId: 'flow-1', screenIndex: 0, tagId: 'tag-0', slotId: 'slot-0',
            slotChildCount: 2, justificationId: 'just-0', justificationText: 'How this screen helps.' },
          { flowId: 'flow-1', screenIndex: 1, tagId: 'tag-1', slotId: 'slot-1',
            slotChildCount: 3, justificationId: 'just-1', justificationText: 'Another justification.' },
        ],
      },
    ],
    analysisOverview: {
      nodeId: 'ao-1',
      sections: [
        { key: 'resolution', nodeId: 'sub-res', bodyTextNodeId: 'res-body', text: 'Resolution body.' },
        { key: 'validation', nodeId: 'sub-val', bodyTextNodeId: 'val-body', text: 'Validation body.' },
        { key: 'attention',  nodeId: 'sub-att', bodyTextNodeId: 'att-body', text: 'Attention body.' },
        { key: 'discussion', nodeId: 'sub-dis', bodyTextNodeId: 'dis-body', text: 'Discussion body.' },
        { key: 'gap-check',  nodeId: 'sub-gap', bodyTextNodeId: 'gap-body', text: 'Gap check body.' },
      ],
    },
    knownPlaceholders: {
      'analysis.resolution': 'Describe how this delivery solves the problem statement.',
      'analysis.validation': 'List the criteria that confirm the resolution works.',
      'analysis.attention':  'Flag risks, edge cases, or constraints the team should mind.',
      'analysis.discussion': 'Open questions or trade-offs to align on during the review.',
      'analysis.gap-check':  'Run /meet-criteria-analyze to compare the ticket against the delivered screens.',
    },
  }
  return { ...base, ...overrides }
}

test('makeSnapshot fixture is well-formed (sanity)', () => {
  const s = makeSnapshot()
  assert.equal(s.sectionId, 'sec-1')
  assert.equal(s.flows[0].slots.length, 2)
  assert.equal(s.analysisOverview.sections.length, 5)
})
```

- [ ] **Step 2: Run tests**

Run: `node --test lib/check-helpers.test.mjs`
Expected: PASS — sanity test green; all previous tests still green.

- [ ] **Step 3: Commit**

```bash
git add lib/check-helpers.test.mjs
git commit -m "test(check-helpers): add makeSnapshot fixture builder"
```

---

## Task 5: Rule `empty-problem-statement`

**Files:**
- Modify: `lib/check-helpers.mjs`
- Modify: `lib/check-helpers.test.mjs`

- [ ] **Step 1: Write failing tests**

Append to `lib/check-helpers.test.mjs`:

```js
import { ruleEmptyProblemStatement } from './check-helpers.mjs'

test('ruleEmptyProblemStatement returns [] when text is non-empty', () => {
  const findings = ruleEmptyProblemStatement(makeSnapshot())
  assert.deepEqual(findings, [])
})

test('ruleEmptyProblemStatement flags whitespace-only text', () => {
  const findings = ruleEmptyProblemStatement(makeSnapshot({
    problemStatement: { nodeId: 'ps-text-1', text: '   \n  ' },
  }))
  assert.equal(findings.length, 1)
  assert.equal(findings[0].rule, 'empty-problem-statement')
  assert.equal(findings[0].severity, 'error')
  assert.equal(findings[0].nodeId, 'ps-text-1')
  assert.match(findings[0].message, /Problem Statement está vazio/)
})

test('ruleEmptyProblemStatement flags missing problemStatement (null)', () => {
  const findings = ruleEmptyProblemStatement(makeSnapshot({ problemStatement: null }))
  assert.equal(findings.length, 1)
  assert.equal(findings[0].nodeId, 'sec-1')
})
```

- [ ] **Step 2: Run tests, verify failure**

Run: `node --test lib/check-helpers.test.mjs`
Expected: FAIL — `ruleEmptyProblemStatement is not a function`.

- [ ] **Step 3: Implement**

Append to `lib/check-helpers.mjs`:

```js
export function ruleEmptyProblemStatement(snapshot) {
  const ps = snapshot.problemStatement
  if (ps && typeof ps.text === 'string' && ps.text.trim() !== '') return []
  return [{
    rule: 'empty-problem-statement',
    severity: 'error',
    nodeId: ps?.nodeId ?? snapshot.sectionId,
    message: 'Problem Statement está vazio.',
    context: {},
  }]
}
```

- [ ] **Step 4: Verify tests pass**

Run: `node --test lib/check-helpers.test.mjs`
Expected: PASS — 3 new tests green.

- [ ] **Step 5: Commit**

```bash
git add lib/check-helpers.mjs lib/check-helpers.test.mjs
git commit -m "feat(check-helpers): add ruleEmptyProblemStatement"
```

---

## Task 6: Rule `empty-screen-slot`

**Files:**
- Modify: `lib/check-helpers.mjs`
- Modify: `lib/check-helpers.test.mjs`

- [ ] **Step 1: Write failing tests**

Append to `lib/check-helpers.test.mjs`:

```js
import { ruleEmptyScreenSlot } from './check-helpers.mjs'

test('ruleEmptyScreenSlot returns [] when all slots have content', () => {
  assert.deepEqual(ruleEmptyScreenSlot(makeSnapshot()), [])
})

test('ruleEmptyScreenSlot flags slot with slotId=null (slot never created)', () => {
  const s = makeSnapshot()
  s.flows[0].slots[0].slotId = null
  s.flows[0].slots[0].slotChildCount = 0
  const findings = ruleEmptyScreenSlot(s)
  assert.equal(findings.length, 1)
  assert.equal(findings[0].rule, 'empty-screen-slot')
  assert.equal(findings[0].severity, 'error')
  assert.equal(findings[0].nodeId, 'tag-0') // falls back to tagId when slotId is null
  assert.match(findings[0].message, /Tela 1 do flow "Onboarding"/)
  assert.deepEqual(findings[0].context, { flowId: 'flow-1', screenIndex: 0 })
})

test('ruleEmptyScreenSlot flags slot with 0 children (designer cleared the clone)', () => {
  const s = makeSnapshot()
  s.flows[0].slots[1].slotChildCount = 0
  const findings = ruleEmptyScreenSlot(s)
  assert.equal(findings.length, 1)
  assert.equal(findings[0].nodeId, 'slot-1')
  assert.match(findings[0].message, /Tela 2 do flow "Onboarding"/)
})

test('ruleEmptyScreenSlot reports one finding per affected slot', () => {
  const s = makeSnapshot()
  s.flows[0].slots[0].slotChildCount = 0
  s.flows[0].slots[1].slotId = null
  s.flows[0].slots[1].slotChildCount = 0
  assert.equal(ruleEmptyScreenSlot(s).length, 2)
})
```

- [ ] **Step 2: Run tests, verify failure**

Run: `node --test lib/check-helpers.test.mjs`
Expected: FAIL — function not exported.

- [ ] **Step 3: Implement**

Append to `lib/check-helpers.mjs`:

```js
export function ruleEmptyScreenSlot(snapshot) {
  const findings = []
  for (const flow of snapshot.flows ?? []) {
    for (const slot of flow.slots ?? []) {
      if (slot.slotId !== null && slot.slotChildCount > 0) continue
      findings.push({
        rule: 'empty-screen-slot',
        severity: 'error',
        nodeId: slot.slotId ?? slot.tagId ?? snapshot.sectionId,
        message: `Tela ${slot.screenIndex + 1} do flow "${flow.flowName}" não recebeu Paste-to-Replace.`,
        context: { flowId: slot.flowId, screenIndex: slot.screenIndex },
      })
    }
  }
  return findings
}
```

- [ ] **Step 4: Verify**

Run: `node --test lib/check-helpers.test.mjs`
Expected: PASS — 4 new tests green.

- [ ] **Step 5: Commit**

```bash
git add lib/check-helpers.mjs lib/check-helpers.test.mjs
git commit -m "feat(check-helpers): add ruleEmptyScreenSlot"
```

---

## Task 7: Rule `empty-justification`

**Files:**
- Modify: `lib/check-helpers.mjs`
- Modify: `lib/check-helpers.test.mjs`

- [ ] **Step 1: Write failing tests**

Append to `lib/check-helpers.test.mjs`:

```js
import { ruleEmptyJustification } from './check-helpers.mjs'

test('ruleEmptyJustification returns [] when all justifications are filled', () => {
  assert.deepEqual(ruleEmptyJustification(makeSnapshot()), [])
})

test('ruleEmptyJustification flags filled slots with empty justification', () => {
  const s = makeSnapshot()
  s.flows[0].slots[0].justificationText = '   '
  const findings = ruleEmptyJustification(s)
  assert.equal(findings.length, 1)
  assert.equal(findings[0].rule, 'empty-justification')
  assert.equal(findings[0].severity, 'warn')
  assert.equal(findings[0].nodeId, 'just-0')
  assert.match(findings[0].message, /Tela 1 do flow "Onboarding" sem justificativa/)
})

test('ruleEmptyJustification skips pristine slots (slotChildCount=0)', () => {
  const s = makeSnapshot()
  s.flows[0].slots[0].slotChildCount = 0
  s.flows[0].slots[0].justificationText = ''
  assert.deepEqual(ruleEmptyJustification(s), []) // covered by empty-screen-slot
})

test('ruleEmptyJustification skips slots without justificationId', () => {
  const s = makeSnapshot()
  s.flows[0].slots[0].justificationId = null
  s.flows[0].slots[0].justificationText = ''
  assert.deepEqual(ruleEmptyJustification(s), [])
})
```

- [ ] **Step 2: Run tests, verify failure**

Run: `node --test lib/check-helpers.test.mjs`
Expected: FAIL — function missing.

- [ ] **Step 3: Implement**

Append to `lib/check-helpers.mjs`:

```js
export function ruleEmptyJustification(snapshot) {
  const findings = []
  for (const flow of snapshot.flows ?? []) {
    for (const slot of flow.slots ?? []) {
      if (slot.slotChildCount === 0) continue           // pristine — caught by empty-screen-slot
      if (slot.justificationId === null) continue       // no node to point at
      if ((slot.justificationText ?? '').trim() !== '') continue
      findings.push({
        rule: 'empty-justification',
        severity: 'warn',
        nodeId: slot.justificationId,
        message: `Tela ${slot.screenIndex + 1} do flow "${flow.flowName}" sem justificativa — rode /meet-criteria-analyze.`,
        context: { flowId: slot.flowId, screenIndex: slot.screenIndex },
      })
    }
  }
  return findings
}
```

- [ ] **Step 4: Verify**

Run: `node --test lib/check-helpers.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/check-helpers.mjs lib/check-helpers.test.mjs
git commit -m "feat(check-helpers): add ruleEmptyJustification"
```

---

## Task 8: Rule `empty-analysis-section`

**Files:**
- Modify: `lib/check-helpers.mjs`
- Modify: `lib/check-helpers.test.mjs`

- [ ] **Step 1: Write failing tests**

Append:

```js
import { ruleEmptyAnalysisSection } from './check-helpers.mjs'

test('ruleEmptyAnalysisSection returns [] when all sections have content', () => {
  assert.deepEqual(ruleEmptyAnalysisSection(makeSnapshot()), [])
})

test('ruleEmptyAnalysisSection flags whitespace-only sections', () => {
  const s = makeSnapshot()
  s.analysisOverview.sections[2].text = '  \n  '
  const findings = ruleEmptyAnalysisSection(s)
  assert.equal(findings.length, 1)
  assert.equal(findings[0].rule, 'empty-analysis-section')
  assert.equal(findings[0].severity, 'error')
  assert.equal(findings[0].nodeId, 'att-body')
  assert.match(findings[0].message, /sub-seção "attention"/i)
  assert.deepEqual(findings[0].context, { key: 'attention' })
})

test('ruleEmptyAnalysisSection falls back to section.nodeId when bodyTextNodeId is null', () => {
  const s = makeSnapshot()
  s.analysisOverview.sections[0] = { key: 'resolution', nodeId: 'sub-res', bodyTextNodeId: null, text: '' }
  const findings = ruleEmptyAnalysisSection(s)
  assert.equal(findings[0].nodeId, 'sub-res')
})

test('ruleEmptyAnalysisSection returns [] when analysisOverview is null', () => {
  assert.deepEqual(ruleEmptyAnalysisSection(makeSnapshot({ analysisOverview: null })), [])
})
```

- [ ] **Step 2: Run, verify failure**

Run: `node --test lib/check-helpers.test.mjs`
Expected: FAIL.

- [ ] **Step 3: Implement**

Append to `lib/check-helpers.mjs`:

```js
export function ruleEmptyAnalysisSection(snapshot) {
  const findings = []
  const ao = snapshot.analysisOverview
  if (!ao) return findings
  for (const section of ao.sections ?? []) {
    if ((section.text ?? '').trim() !== '') continue
    findings.push({
      rule: 'empty-analysis-section',
      severity: 'error',
      nodeId: section.bodyTextNodeId ?? section.nodeId,
      message: `Sub-seção "${section.key}" do Analysis Overview está vazia.`,
      context: { key: section.key },
    })
  }
  return findings
}
```

- [ ] **Step 4: Verify**

Run: `node --test lib/check-helpers.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/check-helpers.mjs lib/check-helpers.test.mjs
git commit -m "feat(check-helpers): add ruleEmptyAnalysisSection"
```

---

## Task 9: Rule `placeholder-text-not-replaced`

**Files:**
- Modify: `lib/check-helpers.mjs`
- Modify: `lib/check-helpers.test.mjs`

- [ ] **Step 1: Write failing tests**

Append:

```js
import { rulePlaceholderTextNotReplaced } from './check-helpers.mjs'

test('rulePlaceholderTextNotReplaced returns [] when bodies differ from placeholder', () => {
  assert.deepEqual(rulePlaceholderTextNotReplaced(makeSnapshot()), [])
})

test('rulePlaceholderTextNotReplaced flags exact placeholder match (trim-aware)', () => {
  const s = makeSnapshot()
  s.analysisOverview.sections[0].text = '  Describe how this delivery solves the problem statement.  '
  const findings = rulePlaceholderTextNotReplaced(s)
  assert.equal(findings.length, 1)
  assert.equal(findings[0].rule, 'placeholder-text-not-replaced')
  assert.equal(findings[0].severity, 'warn')
  assert.equal(findings[0].nodeId, 'res-body')
  assert.match(findings[0].message, /sub-seção "resolution".+placeholder/i)
})

test('rulePlaceholderTextNotReplaced is mutually exclusive with empty-analysis-section', () => {
  // empty text matches "" trim, never equals a non-empty placeholder
  const s = makeSnapshot()
  s.analysisOverview.sections[0].text = ''
  assert.deepEqual(rulePlaceholderTextNotReplaced(s), [])
})

test('rulePlaceholderTextNotReplaced ignores sections without a known placeholder', () => {
  const s = makeSnapshot()
  s.analysisOverview.sections.push({
    key: 'unknown', nodeId: 'sub-x', bodyTextNodeId: 'x-body', text: 'whatever',
  })
  assert.deepEqual(rulePlaceholderTextNotReplaced(s), [])
})
```

- [ ] **Step 2: Run, verify failure**

Run: `node --test lib/check-helpers.test.mjs`
Expected: FAIL.

- [ ] **Step 3: Implement**

Append to `lib/check-helpers.mjs`:

```js
export function rulePlaceholderTextNotReplaced(snapshot) {
  const findings = []
  const ao = snapshot.analysisOverview
  if (!ao) return findings
  const known = snapshot.knownPlaceholders ?? {}
  for (const section of ao.sections ?? []) {
    const expected = known[`analysis.${section.key}`]
    if (typeof expected !== 'string' || expected.trim() === '') continue
    if ((section.text ?? '').trim() !== expected.trim()) continue
    findings.push({
      rule: 'placeholder-text-not-replaced',
      severity: 'warn',
      nodeId: section.bodyTextNodeId ?? section.nodeId,
      message: `Sub-seção "${section.key}" ainda contém o texto placeholder canônico.`,
      context: { key: section.key },
    })
  }
  return findings
}
```

- [ ] **Step 4: Verify**

Run: `node --test lib/check-helpers.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/check-helpers.mjs lib/check-helpers.test.mjs
git commit -m "feat(check-helpers): add rulePlaceholderTextNotReplaced"
```

---

## Task 10: Rule `analyze-never-run`

**Files:**
- Modify: `lib/check-helpers.mjs`
- Modify: `lib/check-helpers.test.mjs`

- [ ] **Step 1: Write failing tests**

Append:

```js
import { ruleAnalyzeNeverRun } from './check-helpers.mjs'

test('ruleAnalyzeNeverRun returns [] when lastAnalyzedAt is set', () => {
  assert.deepEqual(ruleAnalyzeNeverRun(makeSnapshot()), [])
})

test('ruleAnalyzeNeverRun flags missing lastAnalyzedAt', () => {
  const findings = ruleAnalyzeNeverRun(makeSnapshot({ lastAnalyzedAt: null }))
  assert.equal(findings.length, 1)
  assert.equal(findings[0].rule, 'analyze-never-run')
  assert.equal(findings[0].severity, 'warn')
  assert.equal(findings[0].nodeId, 'sec-1')
  assert.match(findings[0].message, /lastAnalyzedAt/)
})
```

- [ ] **Step 2: Run, verify failure**

Run: `node --test lib/check-helpers.test.mjs`
Expected: FAIL.

- [ ] **Step 3: Implement**

Append to `lib/check-helpers.mjs`:

```js
export function ruleAnalyzeNeverRun(snapshot) {
  if (snapshot.lastAnalyzedAt) return []
  return [{
    rule: 'analyze-never-run',
    severity: 'warn',
    nodeId: snapshot.sectionId,
    message: 'Análise nunca foi rodada neste deliverable (lastAnalyzedAt ausente).',
    context: {},
  }]
}
```

- [ ] **Step 4: Verify**

Run: `node --test lib/check-helpers.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/check-helpers.mjs lib/check-helpers.test.mjs
git commit -m "feat(check-helpers): add ruleAnalyzeNeverRun"
```

---

## Task 11: `runRules` orchestrator + ordering

**Files:**
- Modify: `lib/check-helpers.mjs`
- Modify: `lib/check-helpers.test.mjs`

- [ ] **Step 1: Write failing tests**

Append:

```js
import { runRules } from './check-helpers.mjs'

test('runRules returns [] for an all-green snapshot', () => {
  assert.deepEqual(runRules(makeSnapshot()), [])
})

test('runRules orders findings: errors before warns', () => {
  const s = makeSnapshot({ lastAnalyzedAt: null }) // warn
  s.problemStatement.text = ''                      // error
  const findings = runRules(s)
  assert.equal(findings.length, 2)
  assert.equal(findings[0].severity, 'error')
  assert.equal(findings[1].severity, 'warn')
})

test('runRules orders within same severity by flowId then screenIndex', () => {
  const s = makeSnapshot()
  s.flows.push({
    flowId: 'flow-2',
    flowNodeId: 'flow-node-2',
    flowName: 'Checkout',
    slots: [
      { flowId: 'flow-2', screenIndex: 0, tagId: 't20', slotId: null,
        slotChildCount: 0, justificationId: null, justificationText: '' },
    ],
  })
  s.flows[0].slots[1].slotId = null
  s.flows[0].slots[1].slotChildCount = 0
  const findings = runRules(s).filter((f) => f.rule === 'empty-screen-slot')
  assert.equal(findings.length, 2)
  assert.equal(findings[0].context.flowId, 'flow-1')
  assert.equal(findings[0].context.screenIndex, 1)
  assert.equal(findings[1].context.flowId, 'flow-2')
})

test('runRules: placeholder match does not duplicate empty-analysis-section', () => {
  const s = makeSnapshot()
  s.analysisOverview.sections[0].text = ''
  const findings = runRules(s)
  const keys = findings.map((f) => f.rule)
  assert.ok(keys.includes('empty-analysis-section'))
  assert.ok(!keys.includes('placeholder-text-not-replaced'))
})
```

- [ ] **Step 2: Run, verify failure**

Run: `node --test lib/check-helpers.test.mjs`
Expected: FAIL — `runRules is not a function`.

- [ ] **Step 3: Implement**

Append to `lib/check-helpers.mjs`:

```js
const RULES = [
  ruleEmptyProblemStatement,
  ruleEmptyScreenSlot,
  ruleEmptyJustification,
  ruleEmptyAnalysisSection,
  rulePlaceholderTextNotReplaced,
  ruleAnalyzeNeverRun,
]

const SEVERITY_ORDER = { error: 0, warn: 1 }

function compareFindings(a, b) {
  const sev = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]
  if (sev !== 0) return sev
  const flowA = a.context?.flowId ?? ''
  const flowB = b.context?.flowId ?? ''
  if (flowA !== flowB) return flowA.localeCompare(flowB, 'en', { numeric: true })
  const idxA = a.context?.screenIndex ?? -1
  const idxB = b.context?.screenIndex ?? -1
  if (idxA !== idxB) return idxA - idxB
  return a.rule.localeCompare(b.rule)
}

export function runRules(snapshot) {
  const all = []
  for (const rule of RULES) all.push(...rule(snapshot))
  return all.sort(compareFindings)
}
```

- [ ] **Step 4: Verify**

Run: `node --test lib/check-helpers.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/check-helpers.mjs lib/check-helpers.test.mjs
git commit -m "feat(check-helpers): add runRules with deterministic ordering"
```

---

## Task 12: `formatReport`

**Files:**
- Modify: `lib/check-helpers.mjs`
- Modify: `lib/check-helpers.test.mjs`

- [ ] **Step 1: Write failing tests**

Append:

```js
import { formatReport } from './check-helpers.mjs'

test('formatReport returns "tudo verde" for empty findings', () => {
  const out = formatReport([], makeSnapshot())
  assert.match(out, /Tudo verde/)
  assert.match(out, /PROD-1234/)
})

test('formatReport prints summary counts and ordered list', () => {
  const findings = [
    { rule: 'empty-problem-statement', severity: 'error', nodeId: 'x',
      message: 'Problem Statement está vazio.', context: {} },
    { rule: 'analyze-never-run', severity: 'warn', nodeId: 'sec-1',
      message: 'Análise nunca foi rodada.', context: {} },
  ]
  const out = formatReport(findings, makeSnapshot())
  assert.match(out, /1 erro/)
  assert.match(out, /1 aviso/)
  assert.match(out, /Problem Statement está vazio/)
  assert.match(out, /Análise nunca foi rodada/)
  // errors precede warns in the rendered list
  assert.ok(out.indexOf('Problem Statement') < out.indexOf('Análise nunca'))
})

test('formatReport preserves pt-BR diacritics', () => {
  const out = formatReport([
    { rule: 'empty-problem-statement', severity: 'error', nodeId: 'x',
      message: 'Aspectos críticos não foram avaliados.', context: {} },
  ], makeSnapshot())
  assert.match(out, /críticos não foram avaliados/)
})
```

- [ ] **Step 2: Run, verify failure**

Run: `node --test lib/check-helpers.test.mjs`
Expected: FAIL.

- [ ] **Step 3: Implement**

Append to `lib/check-helpers.mjs`:

```js
const ICON = { error: '❌', warn: '⚠️' }

function pluralize(n, singular, plural) {
  return `${n} ${n === 1 ? singular : plural}`
}

export function formatReport(findings, snapshot) {
  const ref = snapshot.ticketRef ? ` — ${snapshot.ticketRef}` : ''
  const type = snapshot.type ? ` (${snapshot.type})` : ''
  const header = `📋 Meet Criteria${ref}${type}`
  if (findings.length === 0) {
    return `${header}\n\n✓ Tudo verde — nenhuma pendência detectada.`
  }
  const errors = findings.filter((f) => f.severity === 'error').length
  const warns  = findings.filter((f) => f.severity === 'warn').length
  const summary = `Resumo: ${pluralize(errors, 'erro', 'erros')}, ${pluralize(warns, 'aviso', 'avisos')}`
  const list = findings.map((f) => `${ICON[f.severity] ?? '•'}  ${f.message}`).join('\n')
  return `${header}\n\n${summary}\n\n${list}`
}
```

- [ ] **Step 4: Verify**

Run: `node --test lib/check-helpers.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/check-helpers.mjs lib/check-helpers.test.mjs
git commit -m "feat(check-helpers): add formatReport (pt-BR terminal output)"
```

---

## Task 13: `buildNavigationOptions`

**Files:**
- Modify: `lib/check-helpers.mjs`
- Modify: `lib/check-helpers.test.mjs`

- [ ] **Step 1: Write failing tests**

Append:

```js
import { buildNavigationOptions } from './check-helpers.mjs'

test('buildNavigationOptions returns empty array for no findings', () => {
  assert.deepEqual(buildNavigationOptions([]), [])
})

test('buildNavigationOptions builds {label, nodeId} entries with severity prefix', () => {
  const out = buildNavigationOptions([
    { rule: 'empty-problem-statement', severity: 'error', nodeId: 'x',
      message: 'Problem Statement está vazio.', context: {} },
    { rule: 'analyze-never-run', severity: 'warn', nodeId: 'sec-1',
      message: 'Análise nunca foi rodada.', context: {} },
  ])
  assert.equal(out.length, 2)
  assert.equal(out[0].nodeId, 'x')
  assert.match(out[0].label, /^❌/)
  assert.match(out[0].label, /Problem Statement/)
  assert.match(out[1].label, /^⚠️/)
})

test('buildNavigationOptions truncates long labels with ellipsis (≤80 chars)', () => {
  const longMsg = 'x'.repeat(200)
  const out = buildNavigationOptions([
    { rule: 'empty-problem-statement', severity: 'error', nodeId: 'x', message: longMsg, context: {} },
  ])
  assert.ok(out[0].label.length <= 80)
  assert.match(out[0].label, /…$/)
})
```

- [ ] **Step 2: Run, verify failure**

Run: `node --test lib/check-helpers.test.mjs`
Expected: FAIL.

- [ ] **Step 3: Implement**

Append to `lib/check-helpers.mjs`:

```js
const NAV_LABEL_MAX = 80

export function buildNavigationOptions(findings) {
  return findings.map((f) => {
    const icon = ICON[f.severity] ?? '•'
    const raw = `${icon} ${f.message}`
    const label = raw.length <= NAV_LABEL_MAX ? raw : raw.slice(0, NAV_LABEL_MAX - 1) + '…'
    return { label, nodeId: f.nodeId }
  })
}
```

- [ ] **Step 4: Verify**

Run: `node --test lib/check-helpers.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/check-helpers.mjs lib/check-helpers.test.mjs
git commit -m "feat(check-helpers): add buildNavigationOptions"
```

---

## Task 14: `buildNavigateToNodeJs`

**Files:**
- Modify: `lib/check-helpers.mjs`
- Modify: `lib/check-helpers.test.mjs`

- [ ] **Step 1: Write failing tests**

Append:

```js
import { buildNavigateToNodeJs } from './check-helpers.mjs'

test('buildNavigateToNodeJs throws on missing nodeId', () => {
  assert.throws(() => buildNavigateToNodeJs({}),
    (err) => err.code === 'MISSING_NODE_ID')
})

test('buildNavigateToNodeJs returns parseable JS targeting the node', () => {
  const js = buildNavigateToNodeJs({ nodeId: 'abc-123' })
  assertParseable(js)
  assert.match(js, /scrollAndZoomIntoView/)
  assert.match(js, /currentPage\.selection/)
  assert.match(js, /"abc-123"/)
})

test('buildNavigateToNodeJs returns NODE_NOT_FOUND when node is missing', () => {
  const js = buildNavigateToNodeJs({ nodeId: 'abc-123' })
  assert.match(js, /NODE_NOT_FOUND/)
})
```

- [ ] **Step 2: Run, verify failure**

Run: `node --test lib/check-helpers.test.mjs`
Expected: FAIL.

- [ ] **Step 3: Implement**

Append to `lib/check-helpers.mjs`:

```js
export function buildNavigateToNodeJs({ nodeId } = {}) {
  if (!nodeId || typeof nodeId !== 'string') {
    throw new CheckError('nodeId is required', { code: 'MISSING_NODE_ID' })
  }
  const idLit = jsonStringify(nodeId)
  return `
await figma.loadAllPagesAsync()
const node = await figma.getNodeByIdAsync(${idLit})
if (!node) return JSON.stringify({ error: 'NODE_NOT_FOUND' })
const page = (node.type === 'PAGE') ? node : (function findPage(n) {
  let cur = n
  while (cur && cur.type !== 'PAGE') cur = cur.parent
  return cur
})(node)
if (page && page.type === 'PAGE') await figma.setCurrentPageAsync(page)
figma.viewport.scrollAndZoomIntoView([node])
if ('selection' in figma.currentPage) figma.currentPage.selection = [node]
return JSON.stringify({ navigated: true, nodeId: ${idLit} })
`
}
```

- [ ] **Step 4: Verify**

Run: `node --test lib/check-helpers.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/check-helpers.mjs lib/check-helpers.test.mjs
git commit -m "feat(check-helpers): add buildNavigateToNodeJs"
```

---

## Task 15: `commands/meet-criteria-check.md`

**Files:**
- Create: `commands/meet-criteria-check.md`

- [ ] **Step 1: Write the command file**

Create `commands/meet-criteria-check.md`:

```markdown
---
description: Roda checks determinísticos no deliverable Meet Criteria atual e oferece navegação até cada pendência
---

# /meet-criteria-check

Sintaxe: `/meet-criteria-check [<slug>] [--yes]`

- `<slug>` — opcional. Se omitido, a skill resolve via auto-detect (current page) ou `AskUserQuestion` listando `.meet-criteria/`.
- `--yes` — pula a navegação interativa após o relatório (útil em uso autônomo / CI conceitual).

Comando read-only. Nunca escreve no Figma. Aplica 6 regras determinísticas e mostra um relatório pt-BR no terminal com lista navegável.

Invoque a skill `checking-deliverables` para executar.
```

- [ ] **Step 2: Verify file is registered (manual sanity)**

Run: `ls commands/`
Expected: `meet-criteria-check.md` listed alongside `meet-criteria-{setup,new,analyze}.md`.

- [ ] **Step 3: Commit**

```bash
git add commands/meet-criteria-check.md
git commit -m "feat(commands): add /meet-criteria-check slash command entry-point"
```

---

## Task 16: `skills/checking-deliverables.md`

**Files:**
- Create: `skills/checking-deliverables.md`

- [ ] **Step 1: Write the skill**

Create `skills/checking-deliverables.md`:

```markdown
# checking-deliverables

Orquestra `/meet-criteria-check [<slug>] [--yes]` em 6 passos. Use os helpers em
`lib/check-helpers.mjs` para todo JS de Figma — não escreva JS solto na conversa.

## Passo 1 — Resolver o slug do deliverable

Mesma regra do `/meet-criteria-analyze`:

1. Se o usuário forneceu `<slug>` como argumento → use direto.
2. Caso contrário, importe `buildDetectDeliverableJs` de `lib/analyze-helpers.mjs` e execute via `figma_execute`.
3. `{ found: false }` → liste pastas em `.meet-criteria/` (`ls .meet-criteria/`) e use `AskUserQuestion`. Sem pastas → aborte com `DELIVERABLE_NOT_FOUND`.
4. `{ found: true, ambiguous: true, candidates }` → `AskUserQuestion` com os `ticketRef`/`slug`.
5. `{ found: true, ambiguous: false, sectionId, ticketRef, slug, type }` → use direto.

## Passo 2 — Montar `knownPlaceholders`

```js
import { ANALYSIS_SECTION_PLACEHOLDERS } from '../lib/render-manifest.mjs'
const knownPlaceholders = Object.fromEntries(
  Object.entries(ANALYSIS_SECTION_PLACEHOLDERS).map(([k, v]) => [`analysis.${k}`, v])
)
```

## Passo 3 — Snapshot

Gere `buildCheckSnapshotJs({ sectionId, knownPlaceholders })` e execute via `figma_execute`.

Validação imediata da resposta:
- Se `JSON.parse` falhar ou faltar `sectionId` → throw `CheckError('snapshot inválido', { code: 'MALFORMED_SNAPSHOT' })`.
- Se vier `{ error: 'SECTION_NOT_FOUND' }` → throw `CheckError(..., { code: 'SECTION_NOT_FOUND' })`.

## Passo 4 — Aplicar regras

```js
const findings = runRules(snapshot)
```

Mensagens já vêm prontas em pt-BR (cada regra usa `flow.flowName` + `screenIndex + 1`).

## Passo 5 — Imprimir relatório

```js
const report = formatReport(findings, snapshot)
console.log(report)
```

Exemplo de saída esperada:

```
📋 Meet Criteria — PROD-1234 (feature)

Resumo: 2 erros, 3 avisos

❌  Problem Statement está vazio.
❌  Tela 2 do flow "Onboarding" não recebeu Paste-to-Replace.
⚠️  Tela 3 do flow "Onboarding" sem justificativa — rode /meet-criteria-analyze.
⚠️  Sub-seção "discussion" ainda contém o texto placeholder canônico.
⚠️  Análise nunca foi rodada neste deliverable (lastAnalyzedAt ausente).
```

## Passo 6 — Loop de navegação

Em **auto mode** (flag `--yes` ou contexto autônomo) ou se `findings.length === 0`: encerre após o relatório.

Caso contrário, loop:

1. `options = buildNavigationOptions(findings)` + `{ label: 'Sair sem navegar', nodeId: null }`.
2. `AskUserQuestion` com `options`.
3. Se escolha for `null` → break.
4. Senão: gere `buildNavigateToNodeJs({ nodeId })` e execute via `figma_execute`.
   - Se resposta tiver `error: 'NODE_NOT_FOUND'`: imprima aviso, **filtre o finding correspondente da lista** (por `nodeId`), e reapresente as opções.
   - Caso contrário: imprima "→ Navegado para `<label>`. Quer ver outra pendência?" e continue o loop.

## Idempotência

`/meet-criteria-check` é puramente read-only. Pode rodar quantas vezes quiser sem efeitos colaterais. Re-rodar reflete o estado atual do Figma (sem cache).

## Erros conhecidos

| code | quando |
|---|---|
| `DELIVERABLE_NOT_FOUND` | Passo 1, sem candidatos |
| `DELIVERABLE_AMBIGUOUS` | Passo 1, múltiplos sem desambiguação possível |
| `MISSING_SECTION_ID` | builder chamado sem `sectionId` (bug interno) |
| `SECTION_NOT_FOUND` | Passo 3, `sectionId` stale |
| `MALFORMED_SNAPSHOT` | Passo 3, JSON inválido ou sem `sectionId` |
| `NODE_NOT_FOUND` | Passo 6, node deletado entre snapshot e navegação (não fatal) |
```

- [ ] **Step 2: Sanity-check that imports referenced match actual exports**

Run:
```bash
node -e "import('./lib/check-helpers.mjs').then(m => console.log(Object.keys(m).sort().join(',')))"
```
Expected output (one line):
```
CheckError,buildCheckSnapshotJs,buildNavigateToNodeJs,buildNavigationOptions,formatReport,ruleAnalyzeNeverRun,ruleEmptyAnalysisSection,ruleEmptyJustification,ruleEmptyProblemStatement,ruleEmptyScreenSlot,rulePlaceholderTextNotReplaced,runRules
```

If any export is missing, fix the corresponding earlier task before proceeding.

- [ ] **Step 3: Commit**

```bash
git add skills/checking-deliverables.md
git commit -m "feat(skills): add checking-deliverables orchestration skill"
```

---

## Task 17: `/analyze` pre-flight (Step 0.5)

**Files:**
- Modify: `skills/analyzing-deliverables.md`

- [ ] **Step 1: Insert Step 0.5 between Passo 1 and Passo 2**

Open `skills/analyzing-deliverables.md` and immediately after the `## Passo 1 — Resolver o slug do deliverable` section, before the `## Passo 2 —` heading, insert:

```markdown
## Passo 0.5 — Pré-flight check (informacional)

Antes de gastar tokens, rode os checks determinísticos como pré-flight:

1. `import { ANALYSIS_SECTION_PLACEHOLDERS } from '../lib/render-manifest.mjs'`
2. `import { buildCheckSnapshotJs, runRules } from '../lib/check-helpers.mjs'`
3. Monte `knownPlaceholders` (mesma regra da skill `checking-deliverables`).
4. Gere e execute `buildCheckSnapshotJs({ sectionId, knownPlaceholders })`.
5. `findings = runRules(snapshot)`.
6. Comportamento por severidade:
   - `0 findings` → silencie, prossiga.
   - Só `warn` → imprima `ℹ️ N avisos detectados (rode /meet-criteria-check pra detalhes)` e prossiga.
   - 1+ `error` → use `AskUserQuestion`:
     - "Detectados N erros antes da análise. Continuar mesmo assim ou cancelar pra rodar /meet-criteria-check?"
     - Opções: `["Continuar", "Cancelar"]`
     - Em auto mode (`--yes`): imprima "⚠️ N erros detectados — prosseguindo em auto mode" e prossiga.

Pré-flight é informacional. `/analyze` continua sendo o único command que escreve no Figma.
```

- [ ] **Step 2: Update the "Erros conhecidos" table at the bottom of `analyzing-deliverables.md`**

Find the existing `## Erros conhecidos` table and append two rows:

```markdown
| `MALFORMED_SNAPSHOT` | Passo 0.5 (pré-flight, fatal — sectionId provavelmente stale) |
| `SECTION_NOT_FOUND` | Passo 0.5 (pré-flight, fatal) |
```

- [ ] **Step 3: Manual sanity diff**

Run: `git diff skills/analyzing-deliverables.md | head -60`
Expected: shows the new "Passo 0.5" block inserted between Passo 1 and Passo 2, plus 2 new rows in the errors table. No other lines changed.

- [ ] **Step 4: Commit**

```bash
git add skills/analyzing-deliverables.md
git commit -m "feat(analyze): add Step 0.5 pre-flight using check-helpers"
```

---

## Task 18: `README.md`

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Update the status line and roadmap**

In `README.md`:

1. Status line under the title — replace:
   ```
   > **Status:** em construção. Planos 1, 2, 3, 3.5, 3.6 e 4 implementados ...
   ```
   with:
   ```
   > **Status:** em construção. Planos 1, 2, 3, 3.5, 3.6, 4 e 6 implementados (Foundation + Setup & Onboarding + /meet-criteria-new + render Figma + feature template rewrite + /meet-criteria-analyze + /meet-criteria-check). Plano 5 (Âncoras) deferido. Veja `docs/superpowers/plans/`.
   ```

2. Roadmap section — change item 5/6 to reflect Plan 6 done and Plan 5 deferred:

   ```markdown
   ## Roadmap (planos restantes)

   1. ✅ Foundation — schema, templates, tokens, validador
   2. ✅ Setup & onboarding (`/meet-criteria-setup`)
   3. ✅ Geração de templates (`/meet-criteria-new`)
   3.5. ✅ Render Figma (helpers `create*` expandidos + loop de validação visual)
   3.6. ✅ Feature template rewrite (firefly palette, Section root, multi-flow, English helpers)
   4. ✅ Análise IA (`/meet-criteria-analyze`)
   5. ⏭ Âncoras (`/meet-criteria-anchor`, `/meet-criteria-export-annotations`) — deferido
   6. ✅ Checks determinísticos (`/meet-criteria-check`)
   ```

- [ ] **Step 2: Add the "Verificando um entregável" section**

Insert immediately after the "Analisando um entregável" section:

```markdown
## Verificando um entregável

Antes de uma reunião ou de fechar o ticket, rode `/meet-criteria-check` (ou `/meet-criteria-check <slug>`) para uma varredura determinística (sem IA, read-only). A skill `checking-deliverables` aplica 6 regras (problem statement vazio, screen slot pristine, justificativa em branco, sub-seção vazia, texto placeholder não substituído, análise nunca rodada) e oferece lista navegável que centraliza o cursor do Figma na pendência escolhida.

Detalhes: [`skills/checking-deliverables.md`](skills/checking-deliverables.md).
```

- [ ] **Step 3: Update file tree under "Estrutura do repositório"**

Within the existing tree:

- Add `meet-criteria-check.md` to `commands/` listing (after `meet-criteria-analyze.md`).
- Add `checking-deliverables.md` to `skills/` listing.
- Add `lib/check-helpers.mjs` to the `lib/` listing.

- [ ] **Step 4: Update the "Comandos" code block**

Within the existing `## Comandos` block, no shell command changes are required — `npm test` already runs the new test file via the suite. Confirm with:

Run: `npm test 2>&1 | tail -20`
Expected: ends with a summary including `check-helpers.test.mjs` cases (all green).

- [ ] **Step 5: Commit**

```bash
git add README.md
git commit -m "docs(readme): mark Plan 6 as complete; add /meet-criteria-check section"
```

---

## Task 19: Full verification

**Files:** none

- [ ] **Step 1: Full test suite**

Run: `npm test`
Expected: ALL green; counts visibly increased relative to baseline (≥30 new check-helpers cases).

- [ ] **Step 2: Template validation**

Run: `npm run validate:templates`
Expected: PASS — no template changes were intended; this is just a guard.

- [ ] **Step 3: Manual smoke (documented for human runner; not automated)**

Document in the PR description:
- Run `/meet-criteria-check` against an existing deliverable with everything green → expect "Tudo verde".
- Empty out the Problem Statement manually in Figma → re-run `/check` → expect 1 error finding pointing at the problem-statement text node; choose it via `AskUserQuestion` → Figma scrolls/centers on that node.
- Without running `/meet-criteria-analyze`, expect `analyze-never-run` (warn).

- [ ] **Step 4: No commit (verification only).**

If any step fails, debug and fix in a follow-up commit before proceeding.

---

## Task 20: Open the PR

**Files:** none

- [ ] **Step 1: Push the branch**

Run: `git push -u origin feat/meet-criteria-check`

- [ ] **Step 2: Open the PR**

Run:
```bash
gh pr create --title "feat: /meet-criteria-check (Plan 6) — deterministic pendency audit" --body "$(cat <<'EOF'
## Summary
- New `/meet-criteria-check [<slug>] [--yes]` slash command — read-only, zero IA, audita 6 regras determinísticas (problem statement vazio, screen slot pristine, justificativa em branco, sub-seção vazia, placeholder canônico não substituído, análise nunca rodada) sobre um snapshot único do Figma e oferece navegação direta ao node pendente via `AskUserQuestion`.
- Novo `lib/check-helpers.mjs` (pure functions + JS builders + tests).
- `/meet-criteria-analyze` ganha pré-flight informacional (Step 0.5) que reusa `runRules` para alertar erros antes de gastar tokens.
- `ANALYSIS_SECTION_PLACEHOLDERS` agora é exportado de `render-manifest.mjs` para uso compartilhado.

Spec: `docs/superpowers/specs/2026-05-02-meet-criteria-check-design.md`
Plan: `docs/superpowers/plans/2026-05-02-meet-criteria-check.md`

## Test plan
- [ ] `npm test` all green (≥30 novos cases em `check-helpers.test.mjs`)
- [ ] `npm run validate:templates` green
- [ ] Manual: rodar `/meet-criteria-check` em deliverable verde → "Tudo verde"
- [ ] Manual: apagar Problem Statement → rodar `/check` → 1 error com navegação correta
- [ ] Manual: rodar `/check` em deliverable sem `lastAnalyzedAt` → 1 warn `analyze-never-run`
- [ ] Manual: pré-flight de `/analyze` em deliverable com erro → `AskUserQuestion` "Continuar / Cancelar"
EOF
)"
```

- [ ] **Step 3: Wait for explicit user approval before merging.**

The user gates merges (project memory: PR confirmation gate). Do **not** auto-merge even if checks pass.

- [ ] **Step 4: Post-merge cleanup (only after user confirms merge)**

```bash
cd /Users/brunobach/Projetos/meet-criteria
git fetch origin
git checkout main && git pull --ff-only
git worktree remove .worktrees/meet-criteria-check
git branch -D feat/meet-criteria-check
```

---

## Self-Review notes

- **Spec coverage:**
  - 6 regras → Tasks 5–10 (one each, full TDD).
  - `buildCheckSnapshotJs` → Task 3.
  - `runRules` ordering → Task 11.
  - `formatReport` pt-BR → Task 12.
  - `buildNavigationOptions` truncation → Task 13.
  - `buildNavigateToNodeJs` + NODE_NOT_FOUND → Task 14.
  - Slug resolution + skill flow → Task 16.
  - Step 0.5 pre-flight → Task 17.
  - Read-only invariant → enforced by skill (no write builders) and tested implicitly (only `buildNavigateToNodeJs` mutates `currentPage.selection`, which the spec accepts as transient).
  - Edge cases: `analysisOverview === null` (Task 8), `bodyTextNodeId === null` (Task 8), pristine slot skip (Task 7), unknown placeholder key (Task 9), invalid `lastAnalyzedAt` string (handled in snapshot builder Task 3 via `Date.parse` guard).

- **Type consistency:** Finding shape (`rule`, `severity`, `nodeId`, `message`, `context`) is identical across all rules and consumers (`runRules`, `formatReport`, `buildNavigationOptions`).

- **No placeholders left:** every step contains the exact code or command. No "TBD" / "implement later" / "similar to Task N".
