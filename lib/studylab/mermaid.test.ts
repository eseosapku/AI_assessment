// lib/studylab/mermaid.test.ts
import { describe, it, expect } from 'vitest'
import { sanitiseMermaid, mermaidImageUrl } from './mermaid'

describe('sanitiseMermaid', () => {
  it('quotes a label containing parentheses, which Mermaid cannot otherwise parse', () => {
    // The exact diagram that rendered as "Diagram unavailable" on a lesson
    // about photosynthesis.
    const out = sanitiseMermaid(
      'graph TD; A[Sunlight] --> B(Leaves); C[Water (Roots)] --> D(Stem); E[Carbon Dioxide (Air)] --> B;',
    )
    expect(out).toContain('C["Water (Roots)"]')
    expect(out).toContain('E["Carbon Dioxide (Air)"]')
  })

  it('leaves a clean label alone rather than quoting everything', () => {
    const out = sanitiseMermaid('graph TD; A[Sunlight] --> B[Leaves]')
    expect(out).toBe('graph TD; A[Sunlight] --> B[Leaves]')
  })

  it('keeps round and curly node shapes working', () => {
    expect(sanitiseMermaid('graph TD; A(Start) --> B{Choice}')).toBe('graph TD; A(Start) --> B{Choice}')
  })

  it('does not re-quote a label that is already quoted', () => {
    const src = 'graph TD; A["Water (Roots)"] --> B[Stem]'
    expect(sanitiseMermaid(src)).toBe(src)
  })

  it('drops an internal double quote instead of producing a broken quoted label', () => {
    // Mermaid has no escape inside a quoted label, so keeping it would break
    // the diagram a second way.
    expect(sanitiseMermaid('graph TD; A[He said "hi" (loudly)]')).toContain('A["He said hi (loudly)"]')
  })

  it('strips a code fence the model wrapped the diagram in', () => {
    expect(sanitiseMermaid('```mermaid\ngraph TD; A[X] --> B[Y]\n```')).toBe('graph TD; A[X] --> B[Y]')
  })

  it('strips a stray leading "mermaid" line', () => {
    expect(sanitiseMermaid('mermaid\ngraph TD; A[X]')).toBe('graph TD; A[X]')
  })

  it('does not treat an arrow label bracket as a node label', () => {
    const src = 'graph TD; A[X] -->|goes to| B[Y]'
    expect(sanitiseMermaid(src)).toBe(src)
  })

  it('leaves an unbalanced diagram as it stands rather than mangling it', () => {
    expect(sanitiseMermaid('graph TD; A[Unclosed')).toBe('graph TD; A[Unclosed')
  })

  it('returns empty for nothing at all', () => {
    expect(sanitiseMermaid('')).toBe('')
    expect(sanitiseMermaid('   ')).toBe('')
  })
})

describe('mermaidImageUrl', () => {
  it('recognises a markdown image put in the diagram field', () => {
    expect(mermaidImageUrl('![a plant](https://example.com/p.png)')).toBe('https://example.com/p.png')
  })

  it('returns null for an actual diagram', () => {
    expect(mermaidImageUrl('graph TD; A[X]')).toBeNull()
  })
})
