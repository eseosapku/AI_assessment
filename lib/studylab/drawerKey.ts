// lib/studylab/drawerKey.ts

/**
 * The tutor drawer's keys: `/` opens it, Escape closes it.
 *
 * `/` is a character people type, so it never opens the drawer from a text box
 * or an editable area -- a learner writing "3/4" into an answer must not find
 * the chat opening on them.
 */
export function drawerKey(e: {
  key: string
  target: { tagName?: string; isContentEditable?: boolean } | null
  open: boolean
}): 'open' | 'close' | null {
  if (e.key === 'Escape') return e.open ? 'close' : null
  if (e.key !== '/' || e.open) return null
  const tag = e.target?.tagName?.toUpperCase()
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || e.target?.isContentEditable) return null
  return 'open'
}
