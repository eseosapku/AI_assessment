'use client'
import { useCallback, useContext, useMemo, useRef, useState } from 'react'
import type { ActivitySpec, ActivityState } from '@/lib/studylab/activities/types'
import { getPatternModule } from '@/lib/studylab/activities/registry'
import { buildOutcome } from '@/lib/studylab/activities/telemetry'
import { CanvasContext } from '../canvasShared'

const HINT_AFTER_ATTEMPTS = 2

export function useActivityState(id: string, spec: ActivitySpec, initial?: ActivityState) {
  const { onNodeDataChange } = useContext(CanvasContext)
  const mod = useMemo(() => getPatternModule(spec.pattern), [spec.pattern])
  const startedAt = useRef<number>(Date.now())

  // `initial` is now ALWAYS passed by the caller (even for a brand-new
  // activity, as `{ work: {} }`), so `initial ?? {...}` never falls through to
  // populate `work` — a truthy-but-empty `initial` short-circuits it and the
  // activity renders with no work at all. Treat an empty/absent `work` as "not
  // started" and seed it from initialWork(), while still honouring genuinely
  // persisted progress (status/attempts/hintsUsed/rejectedMoves) either way.
  const [state, setState] = useState<ActivityState>(() => {
    const freshWork = (mod?.initialWork(spec.payload as never, spec.seed) as Record<string, unknown>) ?? {}
    if (!initial) {
      return {
        status: 'untouched',
        attempts: 0,
        hintsUsed: 0,
        elapsedMs: 0,
        rejectedMoves: [],
        work: freshWork,
      }
    }
    const hasWork = initial.work && Object.keys(initial.work).length > 0
    return hasWork ? initial : { ...initial, work: freshWork }
  })
  const [wrongIds, setWrongIds] = useState<string[]>([])
  const [revealed, setRevealed] = useState(state.status === 'solved')

  const persist = useCallback((next: ActivityState) => {
    setState(next)
    onNodeDataChange?.(id, { activityState: next })
  }, [id, onNodeDataChange])

  const setWork = useCallback((work: Record<string, unknown>) => {
    persist({ ...state, work, status: state.status === 'solved' ? 'solved' : 'in_progress' })
  }, [persist, state])

  /**
   * Record a move the material refused. The piece still springs back — the
   * student self-corrects — but we keep the attempt so the tutor learns the
   * misconception. Without this, accepts()-guarded patterns report nothing.
   */
  const recordReject = useCallback((itemId: string, targetId: string) => {
    persist({
      ...state,
      status: state.status === 'solved' ? 'solved' : 'in_progress',
      rejectedMoves: [...(state.rejectedMoves ?? []), { itemId, targetId }],
    })
  }, [persist, state])

  /** Ask the material whether the current arrangement is right. */
  const check = useCallback(() => {
    if (!mod) return null
    const result = mod.validate(spec.payload as never, state.work as never, spec.success)
    const attempts = state.attempts + 1
    const next: ActivityState = {
      ...state,
      attempts,
      status: result.ok ? 'solved' : 'in_progress',
      elapsedMs: Date.now() - startedAt.current,
    }
    persist(next)
    setWrongIds(result.wrongIds)
    if (result.ok) setRevealed(true)
    return buildOutcome(id, spec.pattern, next, result)
  }, [id, mod, persist, spec, state])

  const hintAvailable = (spec.hints?.length ?? 0) > 0 && state.attempts >= HINT_AFTER_ATTEMPTS
  const hint = hintAvailable ? spec.hints![Math.min(state.hintsUsed, spec.hints!.length - 1)] : null

  const showHint = useCallback(() => {
    persist({ ...state, hintsUsed: state.hintsUsed + 1 })
  }, [persist, state])

  return {
    state, work: state.work, setWork, recordReject, check, wrongIds,
    solved: state.status === 'solved', revealed, hint, hintAvailable, showHint,
  }
}
