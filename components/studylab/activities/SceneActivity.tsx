'use client'
import { useReducedMotion } from 'framer-motion'
import type { ActivitySpec, ActivityState, ScenePayload } from '@/lib/studylab/activities/types'
import { getEngine } from '@/lib/studylab/engines'
import { ActivityFrame } from './ActivityFrame'
import { useActivityState } from './useActivityState'

/**
 * A scene on the board: the lesson's prompt over the engine's own view, and
 * the check bar every activity has. The engine draws, the learner acts, the
 * engine marks.
 */
export function SceneActivity({ id, spec, onOutcome, initialState }: {
  id: string; spec: ActivitySpec; onOutcome: (o: unknown) => void; initialState?: ActivityState
}) {
  const payload = spec.payload as ScenePayload
  const engine = getEngine(payload.engine)
  const config = engine?.parse(payload.config) ?? null
  const a = useActivityState(id, spec, initialState)
  const reduced = useReducedMotion() ?? false
  const View = engine?.View
  const marked = a.solved ? 'right' : a.wrongIds.length > 0 ? 'wrong' : 'idle'

  return (
    <ActivityFrame
      prompt={spec.prompt} solved={a.solved} reveal={spec.reveal} revealed={a.revealed}
      hint={a.hint} hintAvailable={a.hintAvailable} onHint={a.showHint}
      onCheck={() => { const o = a.check(); if (o) onOutcome(o) }}
    >
      {engine && config && View ? (
        <View config={config} state={a.work} setState={(next: unknown) => a.setWork(next as Record<string, unknown>)} marked={marked} reduced={reduced} locked={a.solved} />
      ) : (
        <p className="text-[12px] text-ss-slate">This scene could not be loaded.</p>
      )}
    </ActivityFrame>
  )
}
