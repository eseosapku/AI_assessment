'use client'

import { useCallback, useRef, useState } from 'react'
import {
  checkFlow, initialCheckFlow,
  type CheckEvent, type CheckFlowState, type CheckMode,
} from '@/lib/studylab/checkFlow'
import { playSound } from '@/lib/studylab/sound'

/**
 * The check flow as component state. Every change is handed to `onPersist`,
 * so the card can save `attempts` on its cell and a reload comes back at the
 * same try. Sounds play on the transition out of marking, once.
 */
export function useCheckFlow(
  mode: CheckMode,
  saved: Parameters<typeof initialCheckFlow>[1],
  onPersist: (state: CheckFlowState) => void,
): { state: CheckFlowState; dispatch: (event: CheckEvent) => void } {
  const [state, setState] = useState(() => initialCheckFlow(mode, saved))
  const current = useRef(state)
  const persist = useRef(onPersist)
  persist.current = onPersist

  const dispatch = useCallback((event: CheckEvent) => {
    const prev = current.current
    const next = checkFlow(prev, event)
    if (next === prev) return
    current.current = next
    setState(next)
    if (prev.phase === 'checking') {
      if (next.phase === 'correct') playSound('correct')
      else if (next.phase === 'retry' || next.phase === 'wrong') playSound('wrong')
    }
    persist.current(next)
  }, [])

  return { state, dispatch }
}
