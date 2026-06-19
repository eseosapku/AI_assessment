'use client'

import Image from 'next/image'

/**
 * StudySquare visual identity. The mark riffs on the "square" in the name —
 * a tessellation of four rounded tiles that hint at building blocks of knowledge.
 * Brand accent is the Brain Ink cyan.
 */

export function SquareMark({ className = 'w-9 h-9' }: { className?: string }) {
  return (
    <span className={`relative inline-flex shrink-0 items-center justify-center ${className}`}>
      <svg viewBox="0 0 40 40" fill="none" className="h-full w-full">
        <rect x="1.5" y="1.5" width="37" height="37" rx="11" fill="url(#ss-mark-grad)" />
        <rect
          x="1.5"
          y="1.5"
          width="37"
          height="37"
          rx="11"
          stroke="white"
          strokeOpacity="0.22"
          strokeWidth="1"
        />
        <g fill="white">
          <rect x="10.5" y="10.5" width="8" height="8" rx="2.4" fillOpacity="0.96" />
          <rect x="21.5" y="10.5" width="8" height="8" rx="2.4" fillOpacity="0.5" />
          <rect x="10.5" y="21.5" width="8" height="8" rx="2.4" fillOpacity="0.5" />
          <rect x="21.5" y="21.5" width="8" height="8" rx="2.4" fillOpacity="0.96" />
        </g>
        <defs>
          <linearGradient id="ss-mark-grad" x1="2" y1="2" x2="38" y2="38" gradientUnits="userSpaceOnUse">
            <stop stopColor="#2ACBF2" />
            <stop offset="1" stopColor="#0C86CE" />
          </linearGradient>
        </defs>
      </svg>
    </span>
  )
}

export function Wordmark({
  light = false,
  size = 'md',
  className = '',
}: {
  light?: boolean
  size?: 'sm' | 'md' | 'lg'
  className?: string
}) {
  const markSize = size === 'lg' ? 'w-10 h-10' : size === 'sm' ? 'w-7 h-7' : 'w-8 h-8'
  const textSize = size === 'lg' ? 'text-2xl' : size === 'sm' ? 'text-base' : 'text-lg'
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <SquareMark className={markSize} />
      <span
        className={`font-bold tracking-tight ${textSize} ${
          light ? 'text-white' : 'text-slate-900 dark:text-white'
        }`}
      >
        Study<span className="text-[#13a7df]">Square</span>
      </span>
    </span>
  )
}

/** Endorsement lockup: "A product of [Brain Ink]" — keeps the white-bg logo legible on any surface. */
export function BrainInkBadge({
  light = false,
  className = '',
}: {
  light?: boolean
  className?: string
}) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <span
        className={`text-[11px] font-medium uppercase tracking-[0.18em] ${
          light ? 'text-white/55' : 'text-slate-400 dark:text-white/40'
        }`}
      >
        A product of
      </span>
      <span className="inline-flex items-center rounded-md bg-white px-2 py-1 shadow-sm ring-1 ring-black/5">
        <Image src="/logo1.png" alt="Brain Ink" width={80} height={45} className="h-3.5 w-auto object-contain" />
      </span>
    </span>
  )
}
