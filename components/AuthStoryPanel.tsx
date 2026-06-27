'use client'

import Link from 'next/link'
import { BookOpen, Check, GraduationCap, Sparkles, type LucideIcon } from 'lucide-react'
import { BrainInkBadge, Wordmark } from './Brand'
import { Marker, SparkBadge, StudioCard, StudioPill, StudioShell } from './StudioPrimitives'

const photo =
  'https://images.unsplash.com/photo-1758270705172-07b53627dfcb?auto=format&fit=crop&w=1200&q=80'

const AUTH_STEPS: Array<[string, LucideIcon]> = [
  ['Assess', BookOpen],
  ['Study', GraduationCap],
  ['Improve', Check],
]

export function AuthStoryPanel({
  title,
  marker,
  body,
}: {
  title: string
  marker: string
  body: string
}) {
  const parts = title.split(marker)
  return (
    <aside className="relative hidden min-h-screen overflow-hidden lg:block">
      <StudioShell className="h-full">
        <div className="relative z-10 flex min-h-screen flex-col justify-between p-10">
          <Link href="/" className="inline-flex">
            <Wordmark />
          </Link>

          <div className="grid gap-6">
            <StudioPill tone="lime" className="w-fit">
              <Sparkles className="h-3.5 w-3.5" />
              StudySquare studio
            </StudioPill>
            <h1 className="max-w-xl font-display text-[4.6rem] font-black leading-[0.86] tracking-[-0.04em] text-brand-ink">
              {parts[0]}
              <Marker tone="orange">{marker}</Marker>
              {parts[1]}
            </h1>
            <p className="max-w-md text-base font-semibold leading-relaxed text-brand-slate">{body}</p>

            <div className="grid max-w-lg grid-cols-3 gap-3">
              {AUTH_STEPS.map(([label, Icon]) => (
                <div key={label} className="rounded-[1.25rem] bg-white p-4 shadow-studio-tight">
                  <Icon className="h-5 w-5" />
                  <p className="mt-5 text-sm font-black">{label}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="relative">
            <StudioCard className="absolute bottom-14 right-2 w-72 overflow-hidden p-3 rotate-[4deg]">
              <img src={photo} alt="Students collaborating around a laptop" className="h-40 w-full rounded-2xl object-cover" />
              <div className="mt-3 flex items-center justify-between">
                <p className="font-display text-xl font-black">Classroom ready</p>
                <SparkBadge className="h-10 w-10" />
              </div>
            </StudioCard>
            <BrainInkBadge />
          </div>
        </div>
      </StudioShell>
    </aside>
  )
}
