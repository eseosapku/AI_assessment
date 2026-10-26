'use client'
import { useState } from 'react'
import { useReducedMotion } from 'framer-motion'
import type { ActivitySpec, ActivityState, ScenePayload } from '@/lib/studylab/activities/types'
import { getEngine, type SceneMarked } from '@/lib/studylab/engines'
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
  // How the last check went, until the learner moves something: a scene's
  // engine reports no wrong pieces, so the card keeps the verdict itself.
  const [verdict, setVerdict] = useState<SceneMarked>('idle')
  const marked: SceneMarked = a.solved ? 'right' : verdict

  return (
    <ActivityFrame
      prompt={spec.prompt} solved={a.solved} reveal={spec.reveal} revealed={a.revealed}
      hint={a.hint} hintAvailable={a.hintAvailable} onHint={a.showHint}
      onCheck={() => {
        const o = a.check()
        if (!o) return
        setVerdict(engine && config && engine.check(config, a.work).ok ? 'right' : 'wrong')
        onOutcome(o)
      }}
    >
      {engine && config && View ? (
        <View config={config} state={a.work} setState={(next: unknown) => { setVerdict('idle'); a.setWork(next as Record<string, unknown>) }} marked={marked} reduced={reduced} locked={a.solved} />
      ) : (
        <p className="text-[12px] text-ss-slate">This scene could not be loaded.</p>
      )}
    </ActivityFrame>
  )
}
