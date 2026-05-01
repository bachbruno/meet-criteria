import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { loadTemplate, SUPPORTED_TYPES, TemplateLoadError } from './template-loader.mjs'

test('SUPPORTED_TYPES é exatamente os 3 tipos do MVP', () => {
  assert.deepEqual([...SUPPORTED_TYPES].sort(), ['conceito', 'feature', 'mudanca'])
})

test('loadTemplate("feature") devolve template válido com type/version/structure', () => {
  const tpl = loadTemplate('feature')
  assert.equal(tpl.type, 'feature')
  assert.equal(typeof tpl.version, 'string')
  assert.ok(Array.isArray(tpl.structure))
  assert.ok(tpl.structure.length > 0)
})

test('loadTemplate("mudanca") devolve type="mudanca"', () => {
  const tpl = loadTemplate('mudanca')
  assert.equal(tpl.type, 'mudanca')
})

test('loadTemplate("conceito") devolve type="conceito"', () => {
  const tpl = loadTemplate('conceito')
  assert.equal(tpl.type, 'conceito')
})

test('loadTemplate com tipo desconhecido joga TemplateLoadError', () => {
  assert.throws(() => loadTemplate('mvp'), TemplateLoadError)
  assert.throws(() => loadTemplate('mvp'), /tipo desconhecido|unknown type/i)
})

test('loadTemplate com tipo não-string joga TypeError', () => {
  assert.throws(() => loadTemplate(null), /string/i)
})

test('loadTemplate aceita templatesDir override', () => {
  const dir = mkdtempSync(join(tmpdir(), 'mc-tpl-'))
  const cfg = {
    $schema: '../schemas/template.schema.json',
    type: 'feature',
    version: '9.9.9',
    label: 'Custom feature',
    layout: { kind: 'horizontal-columns', gap: 80, padding: 64 },
    structure: [
      { id: 'context', component: 'ContextMacro', required: true },
      { id: 'problem-statement', component: 'ProblemStatement', required: true },
      { id: 'flows', component: 'FlowList', required: true, minCount: 1, maxCount: 10,
        itemTemplate: { component: 'Flow' } },
      { id: 'final-analysis', component: 'FinalAnalysis', required: true,
        sections: ['resolution', 'strengths', 'attention', 'discussion'] },
    ],
  }
  writeFileSync(join(dir, 'feature.jsonc'), JSON.stringify(cfg))
  const tpl = loadTemplate('feature', { templatesDir: dir })
  assert.equal(tpl.version, '9.9.9')
  assert.equal(tpl.label, 'Custom feature')
})

test('loadTemplate com arquivo ausente no templatesDir custom joga TemplateLoadError', () => {
  const dir = mkdtempSync(join(tmpdir(), 'mc-tpl-empty-'))
  assert.throws(() => loadTemplate('feature', { templatesDir: dir }), TemplateLoadError)
})

test('loadTemplate com schema inválido propaga errors detalhados', () => {
  const dir = mkdtempSync(join(tmpdir(), 'mc-tpl-bad-'))
  writeFileSync(join(dir, 'feature.jsonc'), JSON.stringify({
    type: 'feature',
    version: '1.0.0',
    label: 'Bad',
    layout: { kind: 'horizontal-columns' },
  }))
  let caught
  try {
    loadTemplate('feature', { templatesDir: dir })
  } catch (err) {
    caught = err
  }
  assert.ok(caught instanceof TemplateLoadError)
  assert.match(caught.message, /structure/i)
  assert.ok(Array.isArray(caught.errors))
  assert.ok(caught.errors.length > 0)
})
