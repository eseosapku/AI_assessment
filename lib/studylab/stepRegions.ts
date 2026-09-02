// lib/studylab/stepRegions.ts
import { blockSize } from './blocks'
import type { StudyNode } from './types'
import type { LessonRun } from './lessonRun'

/**
 * The area of the board each step of the lesson occupies.
 *
 * Without these the canvas is a list drawn sideways: step one's cards and step
 * five's look identical, just further right, and nothing on the board says
 * which is which. The rail knows about steps and the board did not, so the two
 * halves of the screen described the same lesson without agreeing on anything.
 *
 * Regions are derived at render time from where the cards already are — never
 * stored, never dragged, never in the reducer. They are a reading of the board,
 * not part of it, so nothing here can corrupt a lesson.
 */

export interface StepRegion {
  id: string
  /** 1-based, matching the `step` stamped on every card. */
  step: number
  title: string
  status: 'done' | 'current' | 'upcoming'
  x: number
  y: number
  width: number
  height: number
}

/** Room around the cards, and the strip above them the title sits in. */
const PAD = 40
const HEADER = 38

/** Nodes that belong to a step's area. A learner's own blocks are theirs. */
function belongsToStep(n: StudyNode): boolean {
  return !n.hidden && n.source !== 'freeform' && Number.isFinite(Number(n.data.step))
}

/**
 * Boxes the visible cards of each step.
 *
 * Measured widths are not available here, so it uses the same `blockSize` the
 * layout used to place them — the two agree by construction, which is what
 * keeps a region from cropping the card it is meant to contain.
 */
export function stepRegions(nodes: StudyNode[], run: LessonRun | null): StepRegion[] {
  if (!run || run.steps.length === 0) return []

  const byStep = new Map<number, StudyNode[]>()
  for (const n of nodes) {
    if (!belongsToStep(n)) continue
    const step = Number(n.data.step)
    if (step < 1 || step > run.steps.length) continue
    byStep.set(step, [...(byStep.get(step) ?? []), n])
  }

  const regions: StepRegion[] = []
  for (const [step, members] of [...byStep.entries()].sort((a, b) => a[0] - b[0])) {
    if (members.length === 0) continue
    // A step collapsed to its pill already says what it is and where it ends.
    // Boxing the pill draws the step's title twice, in two sizes, around one
    // small rounded rectangle.
    if (members.every((n) => n.type === 'stepGroup')) continue

    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity

    for (const n of members) {
      const size = blockSize(n.type)
      const w = n.width ?? size.w
      const h = n.height ?? size.h
      minX = Math.min(minX, n.position.x)
      minY = Math.min(minY, n.position.y)
      maxX = Math.max(maxX, n.position.x + w)
      maxY = Math.max(maxY, n.position.y + h)
    }

    const lesson = run.steps[step - 1]
    const settled = lesson.status === 'done' || lesson.status === 'known'
    regions.push({
      id: `region-${step}`,
      step,
      title: lesson.title,
      status: settled ? 'done' : step - 1 === run.currentStep ? 'current' : 'upcoming',
      x: minX - PAD,
      y: minY - PAD - HEADER,
      width: maxX - minX + PAD * 2,
      height: maxY - minY + PAD * 2 + HEADER,
    })
  }

  return regions
}
