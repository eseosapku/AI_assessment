import { describe, it, expect } from 'vitest'
import { BALANCE_PAN, BALANCE_PAN_TOP, BALANCE_VIEW_HEIGHT, COMPARE_ZONE } from '@/lib/studylab/activities/dropZoneGeometry'

describe('drop zones fit the cards they are drawn on', () => {
  it('a balance pan holds four rows inside the beam box', () => {
    expect(BALANCE_VIEW_HEIGHT).toBe(240)
    expect(BALANCE_PAN_TOP).toBe(95)
    expect(BALANCE_PAN.headroomPx).toBe(174)
    expect(BALANCE_PAN.maxItems).toBe(4)
  })

  it('a compare zone holds four rows under its label', () => {
    expect(COMPARE_ZONE.headroomPx).toBe(180)
    expect(COMPARE_ZONE.maxItems).toBe(4)
  })
})
