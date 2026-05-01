// Render template + builder. Pure module: produz a string JS final que vai pro
// figma_execute. Não toca Figma; não é executável em Node.
//
// Substituições: o template usa __MANIFEST_JSON__ e __SELECTION_JSON__ — ambos
// substituídos por JSON.stringify(...). Isso impede injection (controlamos o
// input upstream via manifest validado) e mantém o JS sintaticamente válido.

export class RenderJsError extends Error {
  constructor(message, { code = 'UNKNOWN' } = {}) {
    super(message)
    this.name = 'RenderJsError'
    this.code = code
  }
}

export const RENDER_TEMPLATE_JS = String.raw`
// ============================================================================
// Meet Criteria — render template (gerado por lib/figma-render.mjs).
// Premissa: manifest validado em new-deliverable.mjs. Não edite aqui — edite
// o template em lib/figma-render.mjs.
// ============================================================================
const MANIFEST = __MANIFEST_JSON__
const SELECTION = __SELECTION_JSON__

const FONT_FAMILY = (MANIFEST.tokens && MANIFEST.tokens['font.family.default']) || 'Inter'

const SECTION_LABELS = {
  resolution: 'Resolução',
  strengths: 'Pontos fortes',
  attention: 'Atenção',
  discussion: 'Discussão',
}

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

function makeAutoFrame(name, kind) {
  const f = figma.createFrame()
  f.name = name
  f.layoutMode = kind
  f.primaryAxisSizingMode = 'AUTO'
  f.counterAxisSizingMode = 'AUTO'
  f.fills = []
  return f
}

function makeText(characters, opts) {
  const t = figma.createText()
  t.fontName = { family: FONT_FAMILY, style: opts.bold ? 'Bold' : 'Regular' }
  t.fontSize = opts.size
  t.characters = characters
  t.fills = [solidFill(opts.color)]
  return t
}

function createContextMacro(node, tokens) {
  const f = makeAutoFrame('Context — ' + node.title, 'HORIZONTAL')
  f.itemSpacing = 12
  f.paddingLeft = 16
  f.paddingRight = 16
  f.paddingTop = 12
  f.paddingBottom = 12
  f.cornerRadius = 16
  f.fills = [solidFill(tokens['tag.context.background'])]
  f.strokes = [solidFill(tokens['tag.context.border'])]
  f.strokeWeight = 2
  f.counterAxisAlignItems = 'CENTER'
  f.appendChild(makeText(node.title, { size: 18, bold: true, color: '#000000' }))
  setPluginData(f, node.pluginData)
  return f
}

function createProblemStatement(node, tokens) {
  const f = makeAutoFrame('Problem statement', 'VERTICAL')
  f.itemSpacing = 16
  f.paddingLeft = 32
  f.paddingRight = 32
  f.paddingTop = 32
  f.paddingBottom = 32
  f.counterAxisSizingMode = 'FIXED'
  f.resize(480, f.height)
  const heading = makeText('Problem statement', { size: 24, bold: true, color: '#ffffff' })
  heading.layoutAlign = 'STRETCH'
  f.appendChild(heading)
  const body = makeText(node.text, { size: 16, bold: false, color: '#ffffff' })
  body.textAutoResize = 'HEIGHT'
  body.layoutAlign = 'STRETCH'
  f.appendChild(body)
  setPluginData(f, node.pluginData)
  return f
}

function createSectionHeader(text, tokens) {
  const f = makeAutoFrame('SectionHeader — ' + text, 'HORIZONTAL')
  f.paddingLeft = 16
  f.paddingRight = 16
  f.paddingTop = 8
  f.paddingBottom = 8
  f.cornerRadius = 8
  f.fills = [solidFill(tokens['tag.section.background'])]
  f.appendChild(makeText(text, { size: 14, bold: true, color: tokens['tag.section.text'] }))
  return f
}

async function createScreenSlot(slot, figId, tokens) {
  const wrapper = makeAutoFrame('ScreenSlot', 'VERTICAL')
  wrapper.itemSpacing = 12
  const tag = makeAutoFrame('ScreenTag', 'HORIZONTAL')
  tag.paddingLeft = 12
  tag.paddingRight = 12
  tag.paddingTop = 4
  tag.paddingBottom = 4
  tag.cornerRadius = 999
  tag.fills = [solidFill(tokens['tag.screen.background'])]
  const fallbackIndex = (slot.pluginData && slot.pluginData.screenIndex !== undefined ? slot.pluginData.screenIndex + 1 : 1)
  const tagLabel = (slot.label) || ('Tela ' + String(fallbackIndex).padStart(2, '0'))
  tag.appendChild(makeText(tagLabel, { size: 12, bold: true, color: tokens['tag.screen.text'] }))
  wrapper.appendChild(tag)
  if (figId) {
    const original = await figma.getNodeByIdAsync(figId)
    if (original && typeof original.clone === 'function') {
      const dup = original.clone()
      wrapper.appendChild(dup)
    }
  }
  setPluginData(wrapper, slot.pluginData)
  return wrapper
}

function createDecisionCriteria(node, tokens) {
  const f = makeAutoFrame('DecisionCriteria', 'VERTICAL')
  f.itemSpacing = 12
  f.paddingLeft = 32
  f.paddingRight = 32
  f.paddingTop = 24
  f.paddingBottom = 24
  f.cornerRadius = 12
  f.fills = [solidFill('#ffffff')]
  f.strokes = [solidFill(tokens['anchor.box.border'])]
  f.strokeWeight = 1
  f.counterAxisSizingMode = 'FIXED'
  f.resize(480, f.height)
  const heading = makeText('Critérios de decisão', { size: 18, bold: true, color: '#000000' })
  heading.layoutAlign = 'STRETCH'
  f.appendChild(heading)
  const body = makeText(node.text || '', { size: 16, bold: false, color: '#000000' })
  body.textAutoResize = 'HEIGHT'
  body.layoutAlign = 'STRETCH'
  f.appendChild(body)
  setPluginData(f, node.pluginData)
  return f
}

function createFinalAnalysis(node, tokens) {
  const f = makeAutoFrame('FinalAnalysis', 'VERTICAL')
  f.itemSpacing = 24
  f.paddingLeft = 32
  f.paddingRight = 32
  f.paddingTop = 32
  f.paddingBottom = 32
  f.cornerRadius = 16
  f.fills = [solidFill('#ffffff')]
  f.strokes = [solidFill(tokens['anchor.box.border'])]
  f.strokeWeight = 1
  f.counterAxisSizingMode = 'FIXED'
  f.resize(480, f.height)
  const heading = makeText('Análise final', { size: 24, bold: true, color: '#000000' })
  heading.layoutAlign = 'STRETCH'
  f.appendChild(heading)
  for (const sec of (node.sections || [])) {
    const subHeading = makeText(SECTION_LABELS[sec.key] || sec.key, { size: 18, bold: true, color: '#000000' })
    subHeading.layoutAlign = 'STRETCH'
    f.appendChild(subHeading)
    const body = makeText(sec.text || '', { size: 14, bold: false, color: '#000000' })
    body.textAutoResize = 'HEIGHT'
    body.layoutAlign = 'STRETCH'
    f.appendChild(body)
  }
  setPluginData(f, node.pluginData)
  return f
}

await figma.loadFontAsync({ family: FONT_FAMILY, style: 'Regular' })
await figma.loadFontAsync({ family: FONT_FAMILY, style: 'Bold' })
await figma.loadAllPagesAsync()

const existingPage = figma.root.children.find((p) => p.name === MANIFEST.page.name)
if (existingPage) {
  return JSON.stringify({ error: 'Page "' + MANIFEST.page.name + '" já existe — abortando para evitar sobrescrita. Renomeie ou apague antes.' })
}

const page = figma.createPage()
page.name = MANIFEST.page.name
figma.currentPage = page

const root = figma.createFrame()
root.name = MANIFEST.container.name
root.layoutMode = MANIFEST.layout.kind === 'vertical-stack' ? 'VERTICAL' : 'HORIZONTAL'
root.itemSpacing = MANIFEST.layout.gap
root.paddingTop = root.paddingBottom = root.paddingLeft = root.paddingRight = MANIFEST.layout.padding
root.fills = [solidFill(MANIFEST.layout.background)]
root.primaryAxisSizingMode = 'AUTO'
root.counterAxisSizingMode = 'AUTO'
page.appendChild(root)
setPluginData(root, MANIFEST.container.pluginData)

let nextSelectionIdx = 0
for (const node of MANIFEST.nodes) {
  if (node.component === 'ContextMacro') {
    root.appendChild(createContextMacro(node, MANIFEST.tokens))
  } else if (node.component === 'ProblemStatement') {
    root.appendChild(createProblemStatement(node, MANIFEST.tokens))
  } else if (node.component === 'FlowList') {
    for (const flow of node.children) {
      const flowFrame = makeAutoFrame(flow.header.text, 'VERTICAL')
      flowFrame.itemSpacing = 24
      setPluginData(flowFrame, flow.pluginData)
      flowFrame.appendChild(createSectionHeader(flow.header.text, MANIFEST.tokens))
      for (const slot of flow.screens) {
        const figId = SELECTION[nextSelectionIdx++]
        flowFrame.appendChild(await createScreenSlot(slot, figId, MANIFEST.tokens))
      }
      root.appendChild(flowFrame)
    }
  } else if (node.component === 'Comparative') {
    for (const item of node.children) {
      const compName = (item.pluginData && item.pluginData.name) || 'Comparative'
      const comp = makeAutoFrame(compName, 'HORIZONTAL')
      comp.itemSpacing = 32
      setPluginData(comp, item.pluginData)
      for (const slot of item.slots) {
        const figId = SELECTION[nextSelectionIdx++]
        comp.appendChild(await createScreenSlot(slot, figId, MANIFEST.tokens))
      }
      root.appendChild(comp)
    }
  } else if (node.component === 'DecisionCriteria') {
    root.appendChild(createDecisionCriteria(node, MANIFEST.tokens))
  } else if (node.component === 'FinalAnalysis') {
    root.appendChild(createFinalAnalysis(node, MANIFEST.tokens))
  }
}

return JSON.stringify({
  page: page.id,
  container: root.id,
  name: root.name,
})
`

function expectedSelectionLength(manifest) {
  if (!Array.isArray(manifest.nodes)) {
    throw new RenderJsError('manifest.nodes deve ser array', { code: 'INVALID_MANIFEST' })
  }
  if (manifest.type === 'feature') {
    const flows = manifest.nodes.find((n) => n.id === 'flows')
    if (!flows || !Array.isArray(flows.children)) {
      throw new RenderJsError('feature manifest sem nó "flows" com children', { code: 'INVALID_MANIFEST' })
    }
    return flows.children.reduce((acc, f) => acc + (f.screens?.length ?? 0), 0)
  }
  if (manifest.type === 'mudanca') {
    const cmp = manifest.nodes.find((n) => n.id === 'comparative')
    if (!cmp || !Array.isArray(cmp.children)) {
      throw new RenderJsError('mudanca manifest sem nó "comparative" com children', { code: 'INVALID_MANIFEST' })
    }
    return cmp.children.reduce((acc, c) => acc + (c.slots?.length ?? 0), 0)
  }
  if (manifest.type === 'conceito') {
    const variants = manifest.nodes.find((n) => n.id === 'variants')
    if (!variants || !Array.isArray(variants.children) || variants.children.length === 0) {
      throw new RenderJsError('conceito manifest sem nó "variants" com children', { code: 'INVALID_MANIFEST' })
    }
    return variants.children.reduce((acc, c) => acc + (c.slots?.length ?? 0), 0)
  }
  return 0
}

export function buildRenderJs({ manifest, selectionIds }) {
  if (!manifest || typeof manifest !== 'object') {
    throw new RenderJsError('manifest é obrigatório', { code: 'MISSING_MANIFEST' })
  }
  if (!Array.isArray(selectionIds)) {
    throw new RenderJsError('selectionIds deve ser array', { code: 'INVALID_SELECTION_TYPE' })
  }
  const expected = expectedSelectionLength(manifest)
  if (selectionIds.length !== expected) {
    throw new RenderJsError(
      `selectionIds tem ${selectionIds.length} item(s); manifest espera ${expected}.`,
      { code: 'SELECTION_LENGTH_MISMATCH' },
    )
  }
  return RENDER_TEMPLATE_JS
    .replace(/__MANIFEST_JSON__/g, JSON.stringify(manifest))
    .replace(/__SELECTION_JSON__/g, JSON.stringify(selectionIds))
}
