// lib/studylab/tour/usage.ts
//
// What the learner has used and which tips they have been shown, kept in
// localStorage. Every access is guarded: with storage blocked, nothing is
// remembered and the pacing rules alone keep the tips from nagging.

const KEY = 'ss-learnspace-tour-v1'
export const USED_EVENT = 'ss-tour-used'

export interface Usage {
  used: string[]
  shown: string[]
}

type Store = Pick<Storage, 'getItem' | 'setItem'>

function defaultStore(): Store | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage
  } catch {
    return null
  }
}

export function readUsage(store: Store | null = defaultStore()): Usage {
  try {
    const raw = store?.getItem(KEY)
    if (!raw) return { used: [], shown: [] }
    const v = JSON.parse(raw) as Partial<Usage>
    const list = (x: unknown) => (Array.isArray(x) ? x.filter((i): i is string => typeof i === 'string') : [])
    return { used: list(v.used), shown: list(v.shown) }
  } catch {
    return { used: [], shown: [] }
  }
}

function add(field: keyof Usage, id: string, store: Store | null): Usage {
  const usage = readUsage(store)
  if (!usage[field].includes(id)) usage[field] = [...usage[field], id]
  else return usage
  try {
    store?.setItem(KEY, JSON.stringify(usage))
  } catch {
    /* best effort */
  }
  return usage
}

export function markShown(id: string, store: Store | null = defaultStore()): Usage {
  return add('shown', id, store)
}

/** The control's own handler calls this; a tip pointing at it then goes away. */
export function markToolUsed(id: string, store: Store | null = defaultStore()): Usage {
  const usage = add('used', id, store)
  try {
    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(USED_EVENT, { detail: id }))
  } catch {
    /* best effort */
  }
  return usage
}
