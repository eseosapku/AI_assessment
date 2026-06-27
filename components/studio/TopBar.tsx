'use client'

import { ChevronDown } from 'lucide-react'
import ThemeToggle from '@/components/ThemeToggle'
import { useSubscription } from '@/components/SubscriptionProvider'
import { useAuth } from '@/components/AuthProvider'
import Avatar from '@/components/studio/Avatar'
import NotificationBell from '@/components/studio/NotificationBell'

export function TopBar({ firstName, onProfile }: { firstName: string; onProfile: () => void }) {
  const { openPaywall, snapshot } = useSubscription()
  const { user } = useAuth()
  return (
    <div className="mb-5 flex items-center gap-3">
      <div className="text-[12.5px] font-semibold leading-tight text-ss-slate">
        Welcome back,
        <br />
        <span className="text-[18px] font-extrabold text-ss-ink">{firstName}</span>
      </div>

      {/* Theme + Pro are in the sidebar on desktop; surface them here for mobile. */}
      <div className="ml-auto flex items-center gap-2 lg:hidden">
        {!snapshot.isSubscribed && (
          <button type="button" onClick={() => openPaywall('assessment')} className="rounded-full bg-ss-accent px-2.5 py-1 text-[10px] font-bold text-white">
            Subscribe
          </button>
        )}
        <ThemeToggle />
      </div>

      <div className="lg:ml-auto">
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
    </div>
  )
}
