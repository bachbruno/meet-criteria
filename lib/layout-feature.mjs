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
  IPHONE_TO_JUSTIFICATION_GAP: 16,
  JUSTIFICATION_HEIGHT:        120,
})

const C = LAYOUT_CONSTANTS

function maxScreens(flows) {
  return flows.reduce((acc, f) => Math.max(acc, f.screens), 0)
}

function screensRowWidth(n) {
  return n <= 0 ? 0 : n * C.IPHONE_WIDTH + (n - 1) * C.BETWEEN_SCREENS_GAP
}

export function screenBlockHeight() {
  return C.BANNER_HEIGHT
    + C.FLOW_BANNER_TO_TAG_GAP
    + C.TAG_HEIGHT
    + C.TAG_TO_IPHONE_GAP
    + C.IPHONE_HEIGHT
    + C.IPHONE_TO_JUSTIFICATION_GAP
    + C.JUSTIFICATION_HEIGHT
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
        tag:           { x, y: tagY, width: C.IPHONE_WIDTH, height: C.TAG_HEIGHT },
        placeholder:   { x, y: phY, width: C.IPHONE_WIDTH, height: C.IPHONE_HEIGHT },
        justification: { x, y: phY + C.IPHONE_HEIGHT + C.IPHONE_TO_JUSTIFICATION_GAP, width: C.IPHONE_WIDTH, height: C.JUSTIFICATION_HEIGHT },
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
