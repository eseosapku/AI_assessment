// Derived notification feed. We don't have a notifications backend, so we build
// a useful feed from data the dashboard already loads — graded results, open /
// upcoming class assignments, and a practice nudge — and persist read-state per
// user in localStorage. Swap buildNotifications' inputs for a server feed later
// without changing the bell UI.

export type NotificationKind = 'graded' | 'due' | 'streak'

export interface AppNotification {
  id: string
  kind: NotificationKind
  title: string
  body?: string
  href: string
  ts: number
}

export function buildNotifications(data: {
  recentAssessments?: any[]
  classrooms?: any[]
}): AppNotification[] {
  const out: AppNotification[] = []
  const now = Date.now()
  const recents = Array.isArray(data.recentAssessments) ? data.recentAssessments : []
  const rooms = Array.isArray(data.classrooms) ? data.classrooms : []

  // Open / upcoming class assignments — most actionable, so anchored to "now".
  rooms.forEach((r: any) => {
    const open = Number(r?.open_count ?? 0)
    const upcoming = Number(r?.upcoming_count ?? 0)
    if (open > 0) {
      out.push({
        id: `due:${r.classroom_id}:${open}`,
        kind: 'due',
        title: `${open} open assignment${open === 1 ? '' : 's'}`,
        body: r.name,
        href: `/classrooms/${r.classroom_id}`,
        ts: now,
      })
    } else if (upcoming > 0) {
      out.push({
        id: `upcoming:${r.classroom_id}:${upcoming}`,
        kind: 'due',
        title: `${upcoming} upcoming assignment${upcoming === 1 ? '' : 's'}`,
        body: r.name,
        href: `/classrooms/${r.classroom_id}`,
        ts: now - 1000,
      })
    }
  })

  // Practice nudge if it's been a while (or there's nothing yet).
  const lastTs = recents[0]?.date ? Date.parse(recents[0].date) : NaN
  const daysSince = Number.isNaN(lastTs) ? Infinity : Math.floor((now - lastTs) / 86_400_000)
  if (recents.length === 0 || daysSince >= 3) {
    const today = new Date().toISOString().slice(0, 10)
    out.push({
      id: `streak:${today}`,
      kind: 'streak',
      title: recents.length === 0 ? 'Start your first practice' : "You haven't practiced in a few days",
      body: 'Keep your streak alive',
      href: '/practice',
      ts: now - 2000,
    })
  }

  // Recently graded results.
  recents.slice(0, 6).forEach((a: any, i: number) => {
    const parsed = a?.date ? Date.parse(a.date) : NaN
    const ts = Number.isNaN(parsed) ? now - (i + 1) * 3_600_000 : parsed
    const pct = Math.round(a?.percentage ?? a?.score ?? 0)
    out.push({
      id: `graded:${a.id}`,
      kind: 'graded',
      title: `${a.subject} graded — ${a.grade}`,
      body: `${pct}% · ${a.topic || 'Assessment'}`,
      href: `/results/${a.id}`,
      ts,
    })
  })

  return out.sort((a, b) => b.ts - a.ts)
}

// ── Read-state persistence ───────────────────────────────────────────────────
export const NOTIF_EVENT = 'ss-notifs-change'
const READ_KEY = (userId: string) => `ss-notifs-read:${userId}`

export function getReadIds(userId?: string | null): Set<string> {
  if (!userId || typeof window === 'undefined') return new Set()
  try {
    return new Set(JSON.parse(localStorage.getItem(READ_KEY(userId)) || '[]'))
  } catch {
    return new Set()
  }
}

export function markRead(userId: string, ids: string[]) {
  if (typeof window === 'undefined' || ids.length === 0) return
  const set = getReadIds(userId)
  ids.forEach((id) => set.add(id))
  localStorage.setItem(READ_KEY(userId), JSON.stringify([...set]))
  window.dispatchEvent(new CustomEvent(NOTIF_EVENT, { detail: { userId } }))
}

export function relativeTime(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000)
  if (s < 60) return 'just now'
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d}d ago`
  return `${Math.floor(d / 7)}w ago`
}
