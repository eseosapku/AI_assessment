'use client'

import { useCallback, useState } from 'react'
import { LOOK_KEY, resolveLook, trailEligible, type Look } from '@/lib/studylab/trail/look'
import type { LessonRun } from '@/lib/studylab/lessonRun'
import type { ChatMessage } from '@/lib/studylab/types'

function readStored(): string | null {
  try {
    return localStorage.getItem(LOOK_KEY)
  } catch {
    return null // storage blocked: classic, and the switch still works for this visit
  }
}

/**
 * The learner's look, derived on every render: a plan redrafted past what the
 * Trail can lay out drops back to classic by itself. The lesson is drawn only
 * after its loading spinner, so reading the browser straight away cannot
 * disagree with a server render.
 */
export function useLook(run: LessonRun | null, messages: ChatMessage[]): { look: Look; eligible: boolean; setLook: (look: Look) => void } {
  const [stored, setStored] = useState(() => (typeof window === 'undefined' ? null : readStored()))
  const [search, setSearch] = useState(() => (typeof window === 'undefined' ? '' : window.location.search))
  const eligible = trailEligible(run, messages)

  const setLook = useCallback((look: Look) => {
    setStored(look)
    try {
      localStorage.setItem(LOOK_KEY, look)
    } catch {
      /* storage blocked: the switch still works for this visit */
    }
    // Choosing outranks a ?look= the page was opened with, now and on reload.
    const url = new URL(window.location.href)
    if (url.searchParams.has('look')) {
      url.searchParams.delete('look')
      window.history.replaceState(window.history.state, '', url)
    }
    setSearch('')
  }, [])

  return { look: resolveLook({ search, stored, eligible }), eligible, setLook }
}
