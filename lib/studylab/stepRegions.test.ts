// lib/studylab/stepRegions.test.ts
import { describe, it, expect } from 'vitest'
import { stepRegions } from './stepRegions'
import { emptyRun, proposePlan, acceptPlan, type LessonRun } from './lessonRun'
import { policyFor } from './lessonPolicy'
import type { StudyNode } from './types'

const POLICY = policyFor('scratch')

function runOf(count: number): LessonRun {
  const proposed = proposePlan(
    emptyRun(POLICY),
    Array.from({ length: count }, (_, i) => ({
      id: `s${i + 1}`, title: `Step ${i + 1}`, goal: 'g', status: 'pending' as const, cardIds: [],
    })),
  )
  if (!proposed.ok) throw new Error(proposed.reason)
  const started = acceptPlan(proposed.run)
  if (!started.ok) throw new Error(started.reason)
  return started.run
}

const card = (id: string, step: number, x: number, y: number): StudyNode => ({
  id, type: 'concept', position: { x, y }, data: { kind: 'concept', title: id, step },
})

describe('stepRegions', () => {
  it('boxes the cards of each step separately', () => {
    const regions = stepRegions(
      [card('a', 1, 0, 0), card('b', 1, 400, 0), card('c', 2, 1000, 0)],
      runOf(2),
    )
    expect(regions.map((r) => r.step)).toEqual([1, 2])
    expect(regions[0].x).toBeLessThan(regions[1].x)
  })

  it('contains every card it covers, with room around them', () => {
    const nodes = [card('a', 1, 100, 100), card('b', 1, 500, 300)]
    const [region] = stepRegions(nodes, runOf(1))

    for (const n of nodes) {
      expect(region.x, `${n.id} starts left of the region`).toBeLessThanOrEqual(n.position.x)
      expect(region.y).toBeLessThanOrEqual(n.position.y)
      expect(region.x + region.width).toBeGreaterThan(n.position.x)
      expect(region.y + region.height).toBeGreaterThan(n.position.y)
    }
  })

  it('leaves a strip above the cards for the title to sit in', () => {
    const [region] = stepRegions([card('a', 1, 0, 500)], runOf(1))
    // Taller above the first card than the padding alone, so the heading has
    // somewhere to go that is not on top of a card.
    expect(500 - region.y).toBeGreaterThan(40)
  })

  it('marks which step is being taught, which are done, and which are ahead', () => {
    const run = runOf(3)
    const mid: LessonRun = {
      ...run,
      currentStep: 1,
      steps: [
        { ...run.steps[0], status: 'done' },
        { ...run.steps[1], status: 'teaching' },
        { ...run.steps[2], status: 'pending' },
      ],
    }
    const regions = stepRegions(
      [card('a', 1, 0, 0), card('b', 2, 500, 0), card('c', 3, 1000, 0)],
      mid,
    )
    expect(regions.map((r) => r.status)).toEqual(['done', 'current', 'upcoming'])
  })

  it('counts a tested-out step as done', () => {
    const run = runOf(1)
    const known: LessonRun = { ...run, steps: [{ ...run.steps[0], status: 'known' }] }
    expect(stepRegions([card('a', 1, 0, 0)], known)[0].status).toBe('done')
  })

  it('leaves the learner’s own blocks out — those are theirs to place', () => {
    // `source: 'freeform'` is what marks a block as the learner's, whatever
    // shape it renders as.
    const sticky = {
      id: 'note', type: 'concept', position: { x: 9000, y: 9000 },
      data: { kind: 'concept', step: 1 }, source: 'freeform',
    } as StudyNode
    const [region] = stepRegions([card('a', 1, 0, 0), sticky], runOf(1))
    // A note dragged far away must not stretch the step across the board.
    expect(region.width).toBeLessThan(1000)
  })

  it('skips a hidden card, so a collapsed step does not leave a huge empty box', () => {
    const regions = stepRegions(
      [{ ...card('a', 1, 0, 0), hidden: true }, card('b', 2, 500, 0)],
      runOf(2),
    )
    expect(regions.map((r) => r.step)).toEqual([2])
  })

  it('ignores a step number no plan step answers to', () => {
    // Cards from an older, longer plan must not invent a region.
    expect(stepRegions([card('a', 9, 0, 0)], runOf(2))).toEqual([])
  })

  it('returns nothing when there is no run, or no plan yet', () => {
    expect(stepRegions([card('a', 1, 0, 0)], null)).toEqual([])
    expect(stepRegions([card('a', 1, 0, 0)], emptyRun(POLICY))).toEqual([])
  })
})
