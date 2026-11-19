import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { blockedWheelPan } from './wheel'

describe('issue-20-lesson-board-overflow', () => {
  it('pans the board when a non-scrollable card blocks React Flow wheel handling', () => {
    expect(blockedWheelPan({ blockedByNoWheel: true, scrollableCanConsume: false, deltaX: 4, deltaY: 80 }))
      .toEqual({ x: -4, y: -80 })
    expect(blockedWheelPan({ blockedByNoWheel: true, scrollableCanConsume: true, deltaX: 0, deltaY: 80 }))
      .toBeNull()

    const canvas = readFileSync(join(process.cwd(), 'components/studylab/trail/TrailCanvas.tsx'), 'utf8')
    expect(canvas).toContain('onWheelCapture={onWheelCapture}')
  })
})
