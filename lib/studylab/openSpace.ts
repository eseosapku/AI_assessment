// Open a LearnSpace in a new browser tab. Falls back to in-tab navigation if a
// popup blocker stops the new tab (e.g. when called after an async create, where
// the original click gesture has been lost).
//
// NOTE: we must NOT pass 'noopener' in the features string — with it, window.open
// returns null even on success, which would make the fallback fire and open the
// space twice (new tab + same tab). Instead we null out `opener` ourselves for the
// same security benefit while keeping a usable return value to detect a real block.
export function openLearnSpace(id: string, router: { push: (url: string) => void }) {
  const url = `/studylab/${id}`
  if (typeof window === 'undefined') {
    router.push(url)
    return
  }
  const w = window.open(url, '_blank')
  if (w) {
    try {
      w.opener = null
    } catch {
      /* cross-origin guard — ignore */
    }
  } else {
    router.push(url)
  }
}
