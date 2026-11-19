export type LandingAuthMode = 'login' | 'signup'

const LANDING_SECTION_IDS = new Set(['features', 'how', 'pricing', 'studylab', 'exam-prep'])

export function landingAuthModeFromSearch(search: string): LandingAuthMode | null {
  const mode = new URLSearchParams(search).get('auth')
  return mode === 'login' || mode === 'signup' ? mode : null
}

export function landingSectionIdFromHash(hash: string): string | null {
  const id = decodeURIComponent(hash.replace(/^#/, ''))
  return LANDING_SECTION_IDS.has(id) ? id : null
}

export function scrollToLandingHash(
  hash: string,
  root: Pick<Document, 'getElementById'> = document,
): boolean {
  const id = landingSectionIdFromHash(hash)
  const section = id ? root.getElementById(id) : null
  if (!section) return false

  section.scrollIntoView({ block: 'start' })
  return true
}
