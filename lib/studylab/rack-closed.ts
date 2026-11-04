/**
 * Which subject trays a student has closed on the Gap Map, and whether the
 * bottom "Quizzes not on a chapter" card is open. Saved per student in
 * localStorage; every read and write is guarded because storage can be blocked.
 */
const store = (given?: Storage): Storage | null => {
  if (given) return given
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

const closedKey = (userId: string) => `ss-gap-closed:${userId}`
const otherKey = (userId: string) => `ss-gap-other-open:${userId}`

export function readClosedTrays(userId: string, storage?: Storage): string[] {
  try {
    const raw = store(storage)?.getItem(closedKey(userId))
    const list = raw ? JSON.parse(raw) : []
    return Array.isArray(list) ? list.filter((k): k is string => typeof k === 'string') : []
  } catch {
    return []
  }
}

export function writeClosedTrays(userId: string, keys: readonly string[], storage?: Storage): void {
  try {
    store(storage)?.setItem(closedKey(userId), JSON.stringify([...keys]))
  } catch {
    /* a remembered tab is a nicety */
  }
}

/** null means the student has not decided, so the page picks a default. */
export function readOtherOpen(userId: string, storage?: Storage): boolean | null {
  try {
    const v = store(storage)?.getItem(otherKey(userId))
    return v === '1' ? true : v === '0' ? false : null
  } catch {
    return null
  }
}

export function writeOtherOpen(userId: string, open: boolean, storage?: Storage): void {
  try {
    store(storage)?.setItem(otherKey(userId), open ? '1' : '0')
  } catch {
    /* a remembered tab is a nicety */
  }
}
