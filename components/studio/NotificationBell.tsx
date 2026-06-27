'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { Bell, CalendarClock, Check, Flame, GraduationCap } from 'lucide-react'
import { useAuth } from '@/components/AuthProvider'
import { useNotifications } from '@/lib/hooks/useNotifications'
import { relativeTime, type NotificationKind } from '@/lib/studio/notifications'

const KIND: Record<NotificationKind, { icon: typeof Bell; chip: string }> = {
  graded: { icon: GraduationCap, chip: 'bg-[color:var(--ss-good)]/15 text-ss-good' },
  due: { icon: CalendarClock, chip: 'bg-[color:var(--ss-warn)]/15 text-ss-warn' },
  streak: { icon: Flame, chip: 'bg-[color:var(--ss-accent)]/15 text-ss-accent' },
}

export default function NotificationBell() {
  const { user } = useAuth()
  const router = useRouter()
  const { items, readIds, unreadCount, markOne, markAllRead } = useNotifications(user)
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const place = () => {
    const r = btnRef.current?.getBoundingClientRect()
    if (r) setPos({ top: r.bottom + 8, right: Math.max(12, window.innerWidth - r.right) })
  }

  const toggle = () => {
    if (!open) place()
    setOpen((o) => !o)
  }

  useEffect(() => {
    if (!open) return
    const close = () => setOpen(false)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    window.addEventListener('resize', close)
    window.addEventListener('scroll', close, true)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', close)
      window.removeEventListener('scroll', close, true)
    }
  }, [open])

  const onItem = (id: string, href: string) => {
    markOne(id)
    setOpen(false)
    router.push(href)
  }

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={toggle}
        className="relative grid h-[42px] w-[42px] place-items-center rounded-[13px] bg-ss-chip text-ss-slate transition-colors hover:text-ss-ink"
        aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
      >
        <Bell className="h-[18px] w-[18px]" strokeWidth={1.9} />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-ss-accent px-1 text-[10px] font-extrabold text-white ring-2 ring-ss-panel">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {mounted && open && pos &&
        createPortal(
          <>
            <div className="fixed inset-0 z-[60]" onClick={() => setOpen(false)} />
            <div
              className="fixed z-[61] w-[340px] max-w-[calc(100vw-24px)] overflow-hidden rounded-[18px] border border-ss-line bg-ss-panel shadow-[0_24px_60px_-20px_rgba(20,60,90,.5)]"
              style={{ top: pos.top, right: pos.right }}
            >
              <div className="flex items-center justify-between border-b border-ss-line px-4 py-3">
                <p className="text-[14px] font-extrabold text-ss-ink">Notifications</p>
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={markAllRead}
                    className="inline-flex items-center gap-1 text-[11.5px] font-bold text-ss-accent hover:underline"
                  >
                    <Check className="h-3.5 w-3.5" />
                    Mark all read
                  </button>
                )}
              </div>

              <div className="max-h-[60vh] overflow-y-auto">
                {items.length === 0 ? (
                  <div className="px-4 py-10 text-center">
                    <Bell className="mx-auto mb-2 h-7 w-7 text-[color:var(--ss-slate)]/50" strokeWidth={1.6} />
                    <p className="text-[13px] font-bold text-ss-ink">You&apos;re all caught up</p>
                    <p className="mt-1 text-[11.5px] font-semibold text-ss-slate">New results and assignments show up here.</p>
                  </div>
                ) : (
                  items.map((n) => {
                    const cfg = KIND[n.kind]
                    const Icon = cfg.icon
                    const unread = !readIds.has(n.id)
                    return (
                      <button
                        key={n.id}
                        type="button"
                        onClick={() => onItem(n.id, n.href)}
                        className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-ss-chip ${unread ? 'bg-[color:var(--ss-accent)]/[0.04]' : ''}`}
                      >
                        <span className={`mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl ${cfg.chip}`}>
                          <Icon className="h-[18px] w-[18px]" strokeWidth={1.9} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] font-extrabold text-ss-ink">{n.title}</span>
                          {n.body && <span className="block truncate text-[12px] font-semibold text-ss-slate">{n.body}</span>}
                          <span className="mt-0.5 block text-[10.5px] font-bold uppercase tracking-wide text-[color:var(--ss-slate)]/70">{relativeTime(n.ts)}</span>
                        </span>
                        {unread && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-ss-accent" />}
                      </button>
                    )
                  })
                )}
              </div>
            </div>
          </>,
          document.body,
        )}
    </>
  )
}
