/**
 * Which subject trays a student has closed on the Gap Map. Saved per student in
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
