'use client'

import { useState, type ReactNode } from 'react'
import { useAuth } from '@/components/AuthProvider'
import ProfileSidebar from '@/components/ProfileSidebar'
import ProductTour from './ProductTour'
import { SideNav, MobileNav } from './SideNav'
import { TopBar } from './TopBar'

export default function AppShell({ children, rail }: { children: ReactNode; rail?: ReactNode }) {
  const { user } = useAuth()
  const [profileOpen, setProfileOpen] = useState(false)
  const firstName = user?.name?.split(' ')[0] ?? 'You'

  return (
    // Fixed-height frame: the shell never scrolls; only the main column does, so
    // the sidebar + top bar stay put.
    <div className="relative h-[100dvh] overflow-hidden bg-ss-canvas p-3 sm:p-6">
      {/* First stop for a keyboard user, so the sidebar is not re-traversed on
          every page. */}
      <a href="#main-content" className="skip-link">Skip to main content</a>
      <div
        className={`mx-auto grid h-full max-w-[1660px] grid-cols-1 overflow-hidden rounded-[30px] bg-ss-panel shadow-ss-panel lg:grid-cols-[248px_1fr] ${
          rail ? 'xl:grid-cols-[248px_1fr_320px]' : ''
        }`}
      >
        <SideNav />
        {/* The column is a plain div, not <main>. A <header> nested inside
            <main> is not a banner landmark — the implicit role is scoped away —
            so putting the top bar inside it would have left the shell with no
            banner at all, however the tag was written. Header and main are
            siblings here, which is what makes both landmarks real. */}
        <div className="flex min-w-0 flex-col overflow-hidden">
          <div className="shrink-0 px-5 pt-5 sm:px-6 sm:pt-6">
            <TopBar firstName={firstName} onProfile={() => setProfileOpen(true)} />
          </div>
          <main id="main-content" tabIndex={-1} className="min-h-0 flex-1 overflow-y-auto px-5 pb-24 outline-none sm:px-6 sm:pb-8 lg:pb-6">{children}</main>
        </div>
        {rail && <aside aria-label="Related information" className="hidden overflow-y-auto border-l border-ss-line bg-[color:var(--ss-canvas)]/40 p-5 xl:block">{rail}</aside>}
      </div>
      <MobileNav />
      <ProfileSidebar isOpen={profileOpen} onClose={() => setProfileOpen(false)} />
      {/* Runs once, and only inside the signed-in shell where the sidebar it
          points at actually exists. */}
      <ProductTour />
    </div>
  )
}
