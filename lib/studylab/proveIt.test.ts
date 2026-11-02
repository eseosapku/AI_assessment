// lib/studylab/proveIt.test.ts
import { describe, it, expect } from 'vitest'
import { lessonQuizScope, proveItTopics } from './proveIt'

describe('what the Prove-it quiz covers', () => {
  it('names every station once', () => {
    const run = { steps: [{ title: 'Finding the missing term' }, { title: 'Vertex form' }, { title: 'Vertex form' }] } as never
    expect(proveItTopics(run, 'Completing the square')).toEqual(['Finding the missing term', 'Vertex form'])
  })
  it('falls back to the lesson with no stations, and to nothing with neither', () => {
    expect(proveItTopics(null, 'Completing the square')).toEqual(['Completing the square'])
    expect(proveItTopics({ steps: [] } as never, undefined)).toEqual([])
  })
})

describe('what the checker is told', () => {
  it('names what the lesson covered, and that nothing else belongs', () => {
    const scope = lessonQuizScope(['Finding the missing term', 'Vertex form'])
    expect(scope).toContain('Finding the missing term; Vertex form')
    expect(scope).toContain('drop it')
  })
})
