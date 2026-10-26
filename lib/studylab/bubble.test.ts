// lib/studylab/bubble.test.ts
import { describe, it, expect } from 'vitest'
import { latestLine, placeBubble, type Rect } from './bubble'
import type { ChatMessage } from './types'

const say = (content: string, extra: Partial<ChatMessage> = {}): ChatMessage => ({ role: 'assistant', content, ...extra })

describe('latestLine', () => {
  it('is the newest thing the tutor said', () => {
    const msgs: ChatMessage[] = [say('First.'), { role: 'user', content: 'Why?' }, say('Because.')]
    expect(latestLine(msgs)).toEqual({ index: 2, text: 'Because.', tone: 'say' })
  })

  it('skips status lines, plans, question pickers and empty turns', () => {
    const msgs: ChatMessage[] = [
      say('The real line.'),
      say('2 of 3 right.', { kind: 'status' }),
      say('', { kind: 'plan' }),
      say('Which questions?', { kind: 'homework' }),
      say('   '),
    ]
    expect(latestLine(msgs)?.text).toBe('The real line.')
  })

  it('keeps a refusal or an error, with its retry only while it is the last message', () => {
    const err = say('Could not reach the tutor.', { kind: 'error', retryAction: { type: 'next_beat' } })
    expect(latestLine([err])).toEqual({ index: 0, text: 'Could not reach the tutor.', tone: 'error', retryAction: { type: 'next_beat' } })
    const after: ChatMessage[] = [err, say('Moved on.', { kind: 'status' })]
    expect(latestLine(after)).toEqual({ index: 0, text: 'Could not reach the tutor.', tone: 'error' })
    expect(latestLine([say('Not that one.', { kind: 'refusal' })])?.tone).toBe('refusal')
  })

  it('is null when the tutor has said nothing yet', () => {
    expect(latestLine([])).toBeNull()
    expect(latestLine([{ role: 'user', content: 'Hi' }])).toBeNull()
  })
})

describe('placeBubble', () => {
  const board: Rect = { x: 0, y: 0, w: 1000, h: 700 }
  const inky: Rect = { x: 16, y: 624, w: 56, h: 56 }
  const size = { w: 320, h: 100 }
  const compact = { w: 240, h: 44 }

  it('sits right of Inky, bottom-aligned, when nothing is there', () => {
    expect(placeBubble({ board, inky, avoid: [], size, compact })).toEqual({ x: 84, y: 580, compact: false, tail: 'left' })
  })

  it('goes above Inky when the work reaches down beside it', () => {
    // Overlaps the bubble's place right of Inky, clear of the space above it.
    const card: Rect = { x: 350, y: 600, w: 300, h: 90 }
    expect(placeBubble({ board, inky, avoid: [card], size, compact })).toEqual({ x: 16, y: 512, compact: false, tail: 'bottom' })
  })

  it('shrinks to a pill when neither full place is free', () => {
    // Covers the space above Inky and the right-hand bubble's top half, but
    // leaves the pill's strip beside Inky clear.
    const card: Rect = { x: 10, y: 300, w: 500, h: 300 }
    expect(placeBubble({ board, inky, avoid: [card], size, compact })).toEqual({ x: 84, y: 636, compact: true, tail: 'left' })
  })

  it('tries the pill above Inky next', () => {
    // One rect takes the strip beside Inky, the other the space high above it;
    // only the pill just above Inky is left.
    const beside: Rect = { x: 270, y: 630, w: 300, h: 60 }
    const high: Rect = { x: 10, y: 300, w: 400, h: 250 }
    expect(placeBubble({ board, inky, avoid: [beside, high], size, compact })).toEqual({
      x: 16, y: 568, compact: true, tail: 'bottom',
    })
  })

  it('keeps a margin from the work, not just a non-overlap', () => {
    // Four pixels to the right of where the full bubble would end: too close.
    const card: Rect = { x: 84 + 320 + 4, y: 500, w: 200, h: 200 }
    expect(placeBubble({ board, inky, avoid: [card], size, compact }).tail).toBe('bottom')
  })

  it('falls back to the pill beside Inky when nothing fits', () => {
    const everything: Rect = { x: 0, y: 0, w: 1000, h: 700 }
    expect(placeBubble({ board, inky, avoid: [everything], size, compact })).toEqual({ x: 84, y: 636, compact: true, tail: 'left' })
  })

  it('never places a bubble outside the board', () => {
    const narrow: Rect = { x: 0, y: 0, w: 360, h: 700 }
    // A 320-wide bubble right of Inky would run past 360; above Inky it fits.
    expect(placeBubble({ board: narrow, inky, avoid: [], size, compact })).toMatchObject({ tail: 'bottom', compact: false })
  })
})
