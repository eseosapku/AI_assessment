'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { ChevronDown, Gift } from 'lucide-react'
import ThemeToggle from '@/components/ThemeToggle'
import { useSubscription } from '@/components/SubscriptionProvider'
import { useAuth } from '@/components/AuthProvider'
import Avatar from '@/components/studio/Avatar'
import NotificationBell from '@/components/studio/NotificationBell'

export function TopBar({ firstName, onProfile }: { firstName: string; onProfile: () => void }) {
  const { openPaywall, snapshot } = useSubscription()
  const { user } = useAuth()
  const [hasActiveReferral, setHasActiveReferral] = useState(false)

  useEffect(() => {
    if (!user?.id) {
      setHasActiveReferral(false)
      return
    }
    let cancelled = false
    const load = async () => {
      try {
        const response = await fetch(`/api/referrals/status?user_id=${encodeURIComponent(user.id)}`, { cache: 'no-store' })
        const body = await response.json()
        if (!cancelled) setHasActiveReferral(response.ok && body?.active === true)
      } catch {
        if (!cancelled) setHasActiveReferral(false)
      }
    }
    void load()
    const timer = window.setInterval(load, 60_000)
    window.addEventListener('focus', load)
    return () => {
      cancelled = true
      window.clearInterval(timer)
      window.removeEventListener('focus', load)
    }
  }, [user?.id])
  return (
    // banner landmark: the shell had main, navigation and complementary but no
    // banner, so the one region a screen-reader user jumps to for identity and
    // account controls did not exist.
    <header className="mb-5 flex items-center gap-3">
      <div className="text-[12.5px] font-semibold leading-tight text-ss-slate">
        Welcome back,
        <br />
        <span className="text-[18px] font-extrabold text-ss-ink">{firstName}</span>
      </div>

      {/* Theme + Pro are in the sidebar on desktop; surface them here for mobile. */}
      <div className="ml-auto flex items-center gap-2 lg:hidden">
        {!snapshot.isSubscribed && (
          <button type="button" onClick={() => openPaywall('assessment')} className="rounded-full bg-ss-accent px-2.5 py-1 text-[12px] font-bold text-white">
            Subscribe
          </button>
        )}
        <ThemeToggle />
      </div>

      <div className="lg:ml-auto">
        {hasActiveReferral && (
          <Link
            href="/referrals"
            className="mr-2 inline-flex h-11 items-center gap-2 rounded-2xl bg-ss-accent px-3.5 text-[13px] font-black text-white shadow-sm transition-transform hover:-translate-y-0.5"
          >
            <Gift className="h-[18px] w-[18px]" strokeWidth={1.9} />
            <span className="hidden sm:inline">Referral</span>
          </Link>
        )}
        <NotificationBell />
      </div>

      <button
        type="button"
        onClick={onProfile}
        className="flex items-center gap-2 rounded-full bg-ss-chip py-[5px] pl-[5px] pr-3 text-[13.5px] font-bold text-ss-ink"
      >
        <Avatar userId={user?.id} name={user?.name} size={31} className="ring-2 ring-[color:var(--ss-accent)]/40" />
        <span className="hidden sm:inline">{firstName}</span>
        <ChevronDown className="h-4 w-4 text-ss-slate" />
      </button>
    </header>
  )
}
