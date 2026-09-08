import { describe, it, expect } from 'vitest'
import {
  computeAncestorScale,
  clientToContainingBlockPoint,
  clientDeltaToContainingBlockDelta,
  ghostPosition,
} from './fixedContainingBlock'

// The React Flow viewport transform observed live: matrix(0.924405, 0, 0,
// 0.924405, 77, 202.739) — a non-identity scale plus a non-zero translate.
const zoomedPannedRect = { left: 77, top: 202.739, width: 924.405, height: 924.405 }
const naturalSize = { width: 1000, height: 1000 }

describe('computeAncestorScale', () => {
  it('is 1 for an untransformed ancestor (rendered box matches layout box)', () => {
    expect(computeAncestorScale({ width: 500, height: 300 }, { width: 500, height: 300 })).toEqual({
      scaleX: 1,
      scaleY: 1,
    })
  })

  it('reads a non-identity scale off the rendered-vs-natural size ratio', () => {
    const { scaleX, scaleY } = computeAncestorScale(zoomedPannedRect, naturalSize)
    expect(scaleX).toBeCloseTo(0.924405, 9)
    expect(scaleY).toBeCloseTo(0.924405, 9)
  })

  it('falls back to 1 instead of dividing by zero on a collapsed box', () => {
    expect(computeAncestorScale({ width: 0, height: 0 }, { width: 0, height: 0 })).toEqual({
      scaleX: 1,
      scaleY: 1,
    })
  })
})

describe('clientToContainingBlockPoint', () => {
  it('passes client coordinates through unchanged when the ancestor is untransformed', () => {
    const rect = { left: 0, top: 0, width: 500, height: 300 }
    expect(clientToContainingBlockPoint(167, 336, rect, { width: 500, height: 300 })).toEqual({
      x: 167,
      y: 336,
    })
  })

  it('inverts a scale-and-translate ancestor transform', () => {
    // A point at the containing block's own rendered origin maps to local (0,0).
    expect(clientToContainingBlockPoint(77, 202.739, zoomedPannedRect, naturalSize)).toEqual({
      x: 0,
      y: 0,
    })
    // A point elsewhere unscales correctly.
    const point = clientToContainingBlockPoint(500, 600, zoomedPannedRect, naturalSize)
    expect(point.x).toBeCloseTo((500 - 77) / 0.924405, 5)
    expect(point.y).toBeCloseTo((600 - 202.739) / 0.924405, 5)
  })
})

describe('clientDeltaToContainingBlockDelta', () => {
  it('leaves a delta unchanged under an identity transform', () => {
    expect(clientDeltaToContainingBlockDelta(12, 34, { width: 500, height: 300 }, { width: 500, height: 300 })).toEqual({
      x: 12,
      y: 34,
    })
  })

  it('unscales a delta — translation cancels out, only scale matters', () => {
    const delta = clientDeltaToContainingBlockDelta(20, 40, zoomedPannedRect, naturalSize)
    expect(delta.x).toBeCloseTo(20 / 0.924405, 5)
    expect(delta.y).toBeCloseTo(40 / 0.924405, 5)
  })
})

describe('ghostPosition', () => {
  it('matches the original viewport-relative behavior when there is no containing block', () => {
    expect(ghostPosition(167, 336, 20, 15, null)).toEqual({ left: 147, top: 321 })
  })

  it('cancels the ancestor transform where the old client-relative math did not', () => {
    // The browser resolves a fixed descendant's left/top against its
    // containing block's local space, then re-applies that block's own
    // transform to render it on screen — the forward direction of the same
    // matrix this module inverts. This is what actually put the dragged
    // chip at the wrong place live: the old code hands the browser raw
    // client pixels, which then get run through that forward transform a
    // second time.
    const clientX = 167
    const clientY = 336
    const grabOffsetX = 20
    const grabOffsetY = 15
    const containing = { rect: zoomedPannedRect, natural: naturalSize }
    const toScreen = (localLeft: number, localTop: number) => ({
      x: localLeft * 0.924405 + zoomedPannedRect.left,
      y: localTop * 0.924405 + zoomedPannedRect.top,
    })
    const wantScreen = { x: clientX - grabOffsetX, y: clientY - grabOffsetY }

    // Old buggy code: left/top set straight from client pixels.
    const buggyScreen = toScreen(clientX - grabOffsetX, clientY - grabOffsetY)
    expect(Math.abs(buggyScreen.x - wantScreen.x)).toBeGreaterThan(10)
    expect(Math.abs(buggyScreen.y - wantScreen.y)).toBeGreaterThan(10)

    // Fixed code pre-converts into the containing block's local space, so
    // the browser's forward transform lands back on the real cursor point.
    const fixed = ghostPosition(clientX, clientY, grabOffsetX, grabOffsetY, containing)
    const fixedScreen = toScreen(fixed.left, fixed.top)
    expect(fixedScreen.x).toBeCloseTo(wantScreen.x, 5)
    expect(fixedScreen.y).toBeCloseTo(wantScreen.y, 5)
  })

  it('holds across different pan/zoom values, not only the one observed live', () => {
    const containing = { rect: { left: -200, top: 50, width: 1500, height: 1500 }, natural: { width: 1000, height: 1000 } }
    const result = ghostPosition(300, 400, 10, 10, containing)
    expect(result.left).toBeCloseTo((300 - -200) / 1.5 - 10 / 1.5, 5)
    expect(result.top).toBeCloseTo((400 - 50) / 1.5 - 10 / 1.5, 5)
  })
})
