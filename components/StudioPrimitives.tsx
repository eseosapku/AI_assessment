'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'
import { ArrowRight, Sparkles } from 'lucide-react'

type Tone = 'blue' | 'orange' | 'lime' | 'pink' | 'ink' | 'mint'

const toneClasses: Record<Tone, string> = {
  blue: 'bg-brand-sky text-brand-ink',
  orange: 'bg-brand-orange text-brand-ink',
  lime: 'bg-brand-lime text-brand-ink',
  pink: 'bg-brand-pink text-brand-ink',
  ink: 'bg-brand-ink text-white',
  mint: 'bg-brand-mint text-brand-ink',
}

export function StudioShell({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div className={`studio-surface min-h-screen overflow-hidden text-brand-ink ${className}`}>
      <StudioScribbles />
      {children}
    </div>
  )
}

export function StudioScribbles() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <div className="absolute left-[-8rem] top-24 h-72 w-72 rounded-full bg-brand-lime/40 blur-3xl" />
      <div className="absolute right-[-10rem] top-1/3 h-96 w-96 rounded-full bg-brand-sky/25 blur-3xl" />
      <div className="absolute bottom-[-12rem] left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-brand-orange/20 blur-3xl" />
      <svg className="absolute left-6 top-28 h-56 w-56 text-brand-lime/70" viewBox="0 0 240 240" fill="none">
        <path
          d="M25 142C68 24 194 17 196 83c2 70-154 34-102 102 31 40 89 17 121-7"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray="8 12"
        />
      </svg>
      <svg className="absolute right-8 top-[18rem] h-48 w-48 text-brand-orange/45" viewBox="0 0 220 220" fill="none">
        <path
          d="M22 119c45-73 142-91 160-39 20 60-73 52-82 95"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
        />
      </svg>
    </div>
  )
}

export function Marker({
  children,
  tone = 'orange',
}: {
  children: ReactNode
  tone?: Tone
}) {
  return (
    <span className="relative inline-block">
      <span
        aria-hidden
        className={`absolute inset-x-[-0.08em] bottom-[0.04em] -z-10 h-[0.42em] -rotate-1 rounded-full ${toneClasses[tone]}`}
      />
      {children}
    </span>
  )
}

export function StudioPill({
  children,
  tone = 'blue',
  className = '',
}: {
  children: ReactNode
  tone?: Tone
  className?: string
}) {
  return (
    <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-extrabold ${toneClasses[tone]} ${className}`}>
      {children}
    </span>
  )
}

export function StudioButton({
  href,
  children,
  tone = 'ink',
  className = '',
}: {
  href: string
  children: ReactNode
  tone?: Tone
  className?: string
}) {
  return (
    <Link
      href={href}
      className={`group inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-extrabold transition-[transform,box-shadow,background-color] duration-200 ease-out active:scale-[0.97] ${toneClasses[tone]} ${className}`}
    >
      {children}
      <ArrowRight className="h-4 w-4 transition-transform duration-200 ease-out group-hover:translate-x-0.5" />
    </Link>
  )
}

export function StudioCard({
  children,
  className = '',
  tilt = '',
}: {
  children: ReactNode
  className?: string
  tilt?: string
}) {
  return (
    <div className={`rounded-[1.65rem] border border-black/[0.06] bg-white shadow-studio transition-transform duration-300 ease-out ${tilt} ${className}`}>
      {children}
    </div>
  )
}

export function SparkBadge({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex h-11 w-11 items-center justify-center rounded-full bg-brand-lime text-brand-ink shadow-studio ${className}`}>
      <Sparkles className="h-5 w-5" strokeWidth={2.4} />
    </span>
  )
}
