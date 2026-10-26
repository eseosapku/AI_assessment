// lib/studylab/engines/types.ts
import type { ComponentType } from 'react'
import type { Dimension } from '../activities/dimensions'

/** How a scene's view is told it was marked. */
export type SceneMarked = 'idle' | 'right' | 'wrong' | 'shown'

export interface SceneViewProps<C, S> {
  config: C
  state: S
  setState(next: S): void
  marked: SceneMarked
  reduced: boolean
  /** Locked once solved: the learner can look, not change. */
  locked: boolean
}

/**
 * A purpose-built interactive scene, like Brilliant's game types: the tutor
 * names a few semantic fields (`config`), and the engine computes everything
 * the learner sees and marks it. Any config `parse` accepts and `faults`
 * passes is correct, solvable and starts unsolved -- each engine's property
 * tests prove it.
 */
export interface SceneEngine<C, S> {
  id: string
  /** The syllabus ideas it teaches, for the tutor's catalogue. */
  covers: string[]
  /** What the learner's actions vary, for the teaching-intent check. */
  isolates: Dimension
  /** The config as the engine reads it, or null when it cannot. */
  parse(raw: unknown): C | null
  /** Why a config would teach nothing or wrongly, in words a writer can fix. */
  faults(config: C): string[]
  initial(config: C): S
  check(config: C, state: S): { ok: boolean; wrongIds: string[] }
  /** A state that passes check: proves the scene can be solved. */
  solve(config: C): S
  View: ComponentType<SceneViewProps<C, S>>
  /** The catalogue entry the tutor reads: what it shows, its config, an example. */
  prompt: string
}
