'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { BarChart3, FlaskConical, Home, Map, Settings, Sparkles, Target, Users } from 'lucide-react'
import { SquareMark } from '@/components/Brand'
import ThemeToggle from '@/components/ThemeToggle'
import { useSubscription } from '@/components/SubscriptionProvider'

type NavItem = { href: string; label: string; icon: typeof Home; match: (p: string) => boolean }

// Ported verbatim from the previous ProductShell so routing/active behavior is unchanged.
export const studentNav: NavItem[] = [
  { href: '/dashboard', label: 'Home', icon: Home, match: (p) => p === '/dashboard' },
  {
    href: '/practice',
    label: 'Practice',
    icon: Target,
    match: (p) => p.startsWith('/practice') || p === '/exam-prep' || p.startsWith('/recall') || p === '/report-card',
  },
  // "StudyLab" named a container, not a thing students do. Split into the two
  // distinct jobs it actually held: learning a topic, and seeing where the gaps
  // are. The gap map keeps its /studylab/gap-map route so existing links and
  // deep links from a finished quiz still resolve.
  { href: '/studylab', label: 'LearnSpace', icon: FlaskConical, match: (p) => p === '/studylab' || /^\/studylab\/(?!gap-map)/.test(p) },
  { href: '/studylab/gap-map', label: 'Gap Maps', icon: Map, match: (p) => p.startsWith('/studylab/gap-map') },
  { href: '/progress', label: 'Progress', icon: BarChart3, match: (p) => p.startsWith('/progress') },
  { href: '/classrooms', label: 'Classes', icon: Users, match: (p) => p.startsWith('/classrooms') },
]

export function SideNav() {
  const pathname = usePathname()
  const { openPaywall, snapshot } = useSubscription()

  return (
    <aside className="hidden flex-col gap-6 overflow-y-auto border-r border-ss-line p-[26px_16px] lg:flex">
      <Link href="/dashboard" className="flex items-center gap-2.5 px-2 py-1 text-[18px] font-extrabold text-ss-ink">
        <SquareMark className="h-8 w-8" />
        <span>
          Study<span className="text-ss-accent">Square</span>
        </span>
      </Link>

      <nav aria-label="Main" className="flex flex-col gap-1">
        <span className="px-3 pb-1 pt-2.5 text-[12px] font-bold uppercase tracking-[0.16em] text-[color:var(--ss-slate)]/70">Menu</span>
        {studentNav.map((item) => {
          const active = item.match(pathname)
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-[13px] px-3 py-[11px] text-[14.5px] font-semibold transition-colors ${
                active ? 'bg-ss-accent text-white shadow-[0_12px_26px_-12px_rgba(14,143,209,.85)]' : 'text-ss-slate hover:bg-ss-chip hover:text-ss-ink'
              }`}
            >
              <Icon className="h-5 w-5" strokeWidth={1.9} />
              {item.label}
            </Link>
          )
        })}
      </nav>

      <div className="mt-auto flex flex-col gap-2">
        <Link
          href="/settings"
          className={`flex items-center gap-3 rounded-[13px] px-3 py-[11px] text-[14.5px] font-semibold transition-colors ${
            pathname === '/settings' ? 'bg-ss-chip text-ss-ink' : 'text-ss-slate hover:bg-ss-chip'
          }`}
        >
          <Settings className="h-5 w-5" strokeWidth={1.9} />
          Settings
        </Link>
        <div className="flex items-center justify-between rounded-[13px] bg-ss-chip px-3 py-2">
          <ThemeToggle />
          {!snapshot.isSubscribed && (
            <button
              type="button"
              onClick={() => openPaywall('assessment')}
              className="inline-flex items-center gap-1 rounded-full bg-ss-accent px-2.5 py-1 text-[12px] font-bold text-white"
            >
              <Sparkles className="h-3 w-3" />
              Subscribe
            </button>
          )}
        </div>
      </div>
    </aside>
  )
}

export function MobileNav() {
  const pathname = usePathname()
  return (
    <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-40 flex items-stretch justify-around border-t border-ss-line bg-[color:var(--ss-panel)]/95 px-2 py-2 backdrop-blur-xl lg:hidden">
      {studentNav.map((item) => {
        const active = item.match(pathname)
        const Icon = item.icon
        return (
          <Link key={item.href} href={item.href} className={`flex flex-1 flex-col items-center gap-0.5 rounded-xl py-2 text-[12px] font-bold ${active ? 'text-ss-accent' : 'text-ss-slate'}`}>
            <span className={`grid h-9 w-9 place-items-center rounded-2xl ${active ? 'bg-ss-accent text-white' : ''}`}>
              <Icon className="h-5 w-5" strokeWidth={1.9} />
            </span>
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
