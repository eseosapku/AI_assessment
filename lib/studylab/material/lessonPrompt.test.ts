// lib/studylab/material/lessonPrompt.test.ts
import { describe, it, expect } from 'vitest'
import { withLessonPrompt } from './lessonPrompt'
import type { MaterialSpec } from './types'

/**
 * A lesson's activity drawn as a material showed the converter's own sentence
 * -- "Place the cards in order along the track", "Sort each item into its
 * matching frame" -- in place of what was written for the lesson: "Drag these
 * aspects of pre-industrial life onto the timeline".
 */
const material = { prompt: 'Place the cards in order along the track.', pieces: [], groups: [], slots: [], controls: [], displays: [], rules: [], goal: { kind: 'exactOrder', itemIds: [] } } as unknown as MaterialSpec

describe('withLessonPrompt', () => {
  it('shows the instruction written for the lesson', () => {
    const shown = withLessonPrompt(material, { prompt: 'Drag these aspects of pre-industrial life onto the timeline.' })
    expect(shown.prompt).toBe('Drag these aspects of pre-industrial life onto the timeline.')
    expect(shown.pieces).toBe(material.pieces)
  })

  it("keeps the material's own sentence when the lesson wrote none", () => {
    expect(withLessonPrompt(material, { prompt: '  ' }).prompt).toBe('Place the cards in order along the track.')
    expect(withLessonPrompt(material, {}).prompt).toBe('Place the cards in order along the track.')
  })
})
