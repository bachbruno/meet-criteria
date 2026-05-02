import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  LAYOUT_CONSTANTS,
  computeFeatureLayout,
} from './layout-feature.mjs'

const C = LAYOUT_CONSTANTS

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

test('LAYOUT_CONSTANTS exposes JUSTIFICATION_HEIGHT and IPHONE_TO_JUSTIFICATION_GAP', () => {
  assert.equal(typeof C.JUSTIFICATION_HEIGHT, 'number')
  assert.equal(typeof C.IPHONE_TO_JUSTIFICATION_GAP, 'number')
  assert.ok(C.JUSTIFICATION_HEIGHT > 0)
  assert.ok(C.IPHONE_TO_JUSTIFICATION_GAP > 0)
})

test('computeFeatureLayout for 1 flow × 4 screens reproduces the user reference', () => {
  const layout = computeFeatureLayout({
    flows: [{ name: 'Flow A', screens: 4 }],
  })
  const blockHeight = C.BANNER_HEIGHT + C.FLOW_BANNER_TO_TAG_GAP + C.TAG_HEIGHT + C.TAG_TO_IPHONE_GAP + C.IPHONE_HEIGHT + C.IPHONE_TO_JUSTIFICATION_GAP + C.JUSTIFICATION_HEIGHT
  assert.equal(layout.section.width, 4468) // 2596 + (4*390 + 3*104)
  assert.equal(layout.section.height, 2 * C.SECTION_PADDING + blockHeight)

  // Problem statement card on the left
  assert.equal(layout.problemStatement.x, 280)
  assert.equal(layout.problemStatement.y, 280)
  assert.equal(layout.problemStatement.width, 738)
  assert.equal(layout.problemStatement.height, blockHeight)

  // Analysis overview card on the right
  assert.equal(layout.analysisOverview.x, 4468 - 280 - 738) // 3450
  assert.equal(layout.analysisOverview.y, 280)
  assert.equal(layout.analysisOverview.width, 738)
  assert.equal(layout.analysisOverview.height, blockHeight)

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
  const blockHeight = C.BANNER_HEIGHT + C.FLOW_BANNER_TO_TAG_GAP + C.TAG_HEIGHT + C.TAG_TO_IPHONE_GAP + C.IPHONE_HEIGHT + C.IPHONE_TO_JUSTIFICATION_GAP + C.JUSTIFICATION_HEIGHT
  // Width uses the MAX flow width (3 screens → 3*390 + 2*104 = 1378)
  assert.equal(layout.section.width, 280 + 738 + 280 + 1378 + 280 + 738 + 280) // 3974
  // Height: top padding + 2 rows + gap + bottom padding
  assert.equal(layout.section.height, 280 + 2 * blockHeight + 200 + 280)

  assert.equal(layout.flows.length, 2)
  assert.equal(layout.flows[0].banner.y, 280)
  assert.equal(layout.flows[1].banner.y, 280 + blockHeight + 200)

  // Side cards span the full inner height
  assert.equal(layout.problemStatement.height, 2 * blockHeight + 200)
  assert.equal(layout.analysisOverview.height, 2 * blockHeight + 200)

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

test('computeFeatureLayout includes justification rect per screen', () => {
  const layout = computeFeatureLayout({ flows: [{ name: 'A', screens: 2 }] })
  const screen = layout.flows[0].screens[0]
  assert.ok(screen.justification, 'justification rect missing')
  assert.equal(screen.justification.x, screen.placeholder.x)
  assert.equal(screen.justification.width, screen.placeholder.width)
  assert.equal(screen.justification.y, screen.placeholder.y + C.IPHONE_HEIGHT + C.IPHONE_TO_JUSTIFICATION_GAP)
  assert.equal(screen.justification.height, C.JUSTIFICATION_HEIGHT)
})

test('flow-row block height includes justification space', () => {
  const layout1 = computeFeatureLayout({ flows: [{ name: 'A', screens: 1 }] })
  const layout2 = computeFeatureLayout({ flows: [{ name: 'A', screens: 1 }, { name: 'B', screens: 1 }] })
  const delta = layout2.section.height - layout1.section.height
  // Adding one flow grows section by: blockHeight + BETWEEN_FLOWS_GAP
  // blockHeight = banner + gap + tag + gap + iPhone + gap + justification
  const expectedBlock = C.BANNER_HEIGHT + C.FLOW_BANNER_TO_TAG_GAP + C.TAG_HEIGHT + C.TAG_TO_IPHONE_GAP + C.IPHONE_HEIGHT + C.IPHONE_TO_JUSTIFICATION_GAP + C.JUSTIFICATION_HEIGHT
  assert.equal(delta, expectedBlock + C.BETWEEN_FLOWS_GAP)
})

test('side cards height matches rowsHeight including justifications', () => {
  const layout = computeFeatureLayout({ flows: [{ name: 'A', screens: 1 }, { name: 'B', screens: 1 }] })
  // rowsHeight = N * blockHeight + (N-1) * BETWEEN_FLOWS_GAP
  const blockHeight = C.BANNER_HEIGHT + C.FLOW_BANNER_TO_TAG_GAP + C.TAG_HEIGHT + C.TAG_TO_IPHONE_GAP + C.IPHONE_HEIGHT + C.IPHONE_TO_JUSTIFICATION_GAP + C.JUSTIFICATION_HEIGHT
  const expectedRows = 2 * blockHeight + 1 * C.BETWEEN_FLOWS_GAP
  assert.equal(layout.problemStatement.height, expectedRows)
  assert.equal(layout.analysisOverview.height, expectedRows)
})
