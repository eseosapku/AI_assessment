// Open a LearnSpace in a new browser tab. Falls back to in-tab navigation if a
// popup blocker stops the new tab (e.g. when called after an async create, where
// the original click gesture has been lost).
export function openLearnSpace(id: string, router: { push: (url: string) => void }) {
  const url = `/studylab/${id}`
  const w = typeof window !== 'undefined' ? window.open(url, '_blank', 'noopener,noreferrer') : null
  if (!w) router.push(url)
}
