// lib/studylab/trail/queue.ts

/**
 * One card at a time from a burst.
 *
 * A tutor turn can build several cards; the Trail shows the first and keeps the
 * rest waiting, unplaced, until the learner reaches them. Moving along the queue
 * is the client's own business: it never calls the tutor.
 */
export interface QueueState {
  ids: string[]
  at: number
}

/**
 * The queue after the spotlight changes. Being sent to a card already in it moves
 * along it and keeps what is still to come; anything else is new work and starts
 * a new queue. Hands back the same object when nothing moved, so a re-render with
 * the burst still in the spotlight cannot rewind the learner.
 */
export function syncQueue(queue: QueueState | null, spotlight: string[]): QueueState | null {
  if (spotlight.length === 0) return null
  if (queue && spotlight.every((id) => queue.ids.includes(id))) {
    if (spotlight.length > 1) return queue
    const at = queue.ids.indexOf(spotlight[0])
    return at === queue.at ? queue : { ...queue, at }
  }
  return { ids: spotlight, at: 0 }
}

export function focusOf(queue: QueueState | null): string | null {
  return queue?.ids[queue.at] ?? null
}

export function waitingIds(queue: QueueState | null): string[] {
  return queue ? queue.ids.slice(queue.at + 1) : []
}

/**
 * A focus the lesson did not name (a reload) comes from a fallback that moves as
 * soon as a question is answered, which would jump past its result. Naming it once
 * keeps the learner there until they move on.
 */
export function pinnedFocus(explicit: string[], spotlight: string[]): string | null {
  return explicit.length === 0 && spotlight.length > 0 ? spotlight[0] : null
}
