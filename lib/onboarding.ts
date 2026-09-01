const STORAGE_KEY = 'ss_onboarding_done'
const FOCUS_KEY = 'ss_focus'

export type FocusId = 'grades' | 'exams' | 'explore'

export function getFocus(userId?: string | null): FocusId | null {
  if (!userId || typeof window === 'undefined') return null
  const v = localStorage.getItem(`${FOCUS_KEY}:${userId}`)
  return v === 'grades' || v === 'exams' || v === 'explore' ? v : null
}

export function setFocus(userId: string, focus: FocusId) {
  if (typeof window === 'undefined') return
  localStorage.setItem(`${FOCUS_KEY}:${userId}`, focus)
}

export function onboardingDoneLocal(userId: string) {
  if (typeof window === 'undefined') return false
  return localStorage.getItem(`${STORAGE_KEY}:${userId}`) === '1'
}

export function setOnboardingDoneLocal(userId: string) {
  localStorage.setItem(`${STORAGE_KEY}:${userId}`, '1')
}

export async function fetchOnboardingStatus(userId: string): Promise<boolean> {
  if (onboardingDoneLocal(userId)) return true
  try {
    const res = await fetch(`/api/user/onboarding?user_id=${encodeURIComponent(userId)}`, { cache: 'no-store' })
    if (!res.ok) return onboardingDoneLocal(userId)
    const json = await res.json()
    if (json.completed) {
      setOnboardingDoneLocal(userId)
      return true
    }
    return false
  } catch {
    return onboardingDoneLocal(userId)
  }
}

export async function completeOnboarding(userId: string, focus?: FocusId): Promise<void> {
  setOnboardingDoneLocal(userId)
  if (focus) setFocus(userId, focus)
  try {
    await fetch('/api/user/onboarding', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, completed: true, focus }),
    })
  } catch {
    // local flag is enough for UX if API unavailable
  }
}

export async function resolvePostAuthPath(user: { id: string; role: string; profileComplete?: boolean }): Promise<string> {
  if (user.profileComplete === false) return '/complete-profile'
  if (user.role === 'teacher') return '/dashboard'
  const done = await fetchOnboardingStatus(user.id)
  return done ? '/dashboard' : '/welcome'
}
