// lib/studylab/varyRenderer.test.ts
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

/**
 * A vary material is drawn by the renderer that draws what was written for the
 * lesson: its own prompt, one labelled bar per quantity computed from the
 * model's formula, a floating object in a tank, a plotted curve, the readouts.
 *
 * Routed through the variable-model apparatus it lost all of that: a fixed
 * "Move the control until the model reaches its target", one unlabelled bar
 * bound to the slider's own number, and "Low"/"High" filler. A river lesson
 * showed a slider and a bar reading 0 that said nothing about rivers.
 */
describe('a vary material on the board', () => {
  const node = readFileSync('components/studylab/activities/ActivityNode.tsx', 'utf8')
  const varyCase = node.slice(node.indexOf("case 'vary':"), node.indexOf('case ', node.indexOf("case 'vary':") + 1))

  it('is drawn by the renderer that shows what the lesson wrote', () => {
    expect(varyCase).toMatch(/<VaryActivity/)
  })

  it('never goes through the variable-model apparatus, which keeps only the slider', () => {
    expect(varyCase).not.toMatch(/variable-model/)
    expect(varyCase).not.toMatch(/MaterialActivity/)
  })
})
