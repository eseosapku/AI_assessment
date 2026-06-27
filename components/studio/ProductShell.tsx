'use client'

import type { ReactNode } from 'react'
import AppShell from './AppShell'

// Thin adapter — the (studio) layout renders <ProductShell>. All chrome now
// lives in AppShell/SideNav/TopBar.
export default function ProductShell({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>
}
