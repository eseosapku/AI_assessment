'use client'

import Link from 'next/link'
import { ArrowRight, BookOpen, GraduationCap, Repeat, Sparkles, Wand2 } from 'lucide-react'
import { useState } from 'react'
import FlowForm from '@/components/FlowForm'
import { useAuth } from '@/components/AuthProvider'
import ProductTour from '@/components/studio/ProductTour'

type Mode = {
  id: string
  title: string
  blurb: string
  icon: typeof BookOpen
  cta: string
  gradient: string
  art?: string
  href?: string
  action?: 'modal'
  ngOnly?: boolean
}

const modes: Mode[] = [
  {
    id: 'recall',
    title: 'Recall',
    blurb: 'Flashcards on a smart schedule — review what you missed from quizzes.',
    icon: Repeat,
    href: '/recall',
    cta: 'Open Recall',
    gradient: 'linear-gradient(120deg,#0C74B4,#1AA0DC 55%,#3ED3F5)',
    art: '/art/recall.png',
  },
  {
    id: 'exam',
    title: 'Exam prep',
    blurb: 'WAEC & JAMB style drills for national exams.',
    icon: GraduationCap,
    href: '/exam-prep',
    cta: 'Open exam prep',
    gradient: 'linear-gradient(120deg,#C77B16,#F0A93E 60%,#FFC777)',
    art: '/art/exam.png',
    ngOnly: true,
  },
  {
    id: 'assign',
    title: 'Class assignment',
    blurb: 'Open the work your teacher posted in your classrooms.',
    icon: BookOpen,
    href: '/classrooms',
    cta: 'Open classes',
    gradient: 'linear-gradient(120deg,#16B67A,#3FD08F)',
    art: '/art/classroom.png',
  },
]

function ModeCard({ mode, onModal }: { mode: Mode; onModal: () => void }) {
  const Icon = mode.icon
  const inner = (
    <div className="group flex h-full flex-col overflow-hidden rounded-[22px] border border-ss-line bg-ss-panel text-left transition-all hover:-translate-y-1 hover:shadow-ss-panel">
      <div className="relative h-28 overflow-hidden" style={{ background: mode.gradient }}>
        {mode.art ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={mode.art} alt="" aria-hidden className="absolute right-3 top-1/2 h-[94%] -translate-y-1/2 object-contain drop-shadow-lg" />
        ) : (
          <Icon className="absolute right-5 top-1/2 h-14 w-14 -translate-y-1/2 text-white/85" strokeWidth={1.6} />
        )}
        <div className="absolute left-4 top-4 grid h-9 w-9 place-items-center rounded-xl bg-white/25 text-white backdrop-blur-sm">
          <Icon className="h-[18px] w-[18px]" strokeWidth={1.9} />
        </div>
      </div>
      <div className="flex flex-1 flex-col p-5">
        <h2 className="text-[18px] font-extrabold text-ss-ink">{mode.title}</h2>
        <p className="mt-1.5 flex-1 text-[13.5px] font-semibold text-ss-slate">{mode.blurb}</p>
        <span className="mt-4 inline-flex items-center gap-2 text-[12px] font-bold uppercase tracking-wider text-ss-accent">
          {mode.cta} <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </span>
      </div>
    </div>
  )
  if (mode.action === 'modal')
    return (
      <button type="button" onClick={onModal} className="block h-full text-left">
        {inner}
      </button>
    )
  return (
    <Link href={mode.href!} className="block h-full">
      {inner}
    </Link>
  )
}

export default function PracticeHub() {
  const { user } = useAuth()
  const [formOpen, setFormOpen] = useState(false)
  // Which flow the wizard opens into, so a tile that promises a free topic
  // doesn't drop the student on the curriculum picker first.
  const [formSource, setFormSource] = useState<'curriculum' | 'custom'>('curriculum')
  const visibleModes = modes.filter((m) => !m.ngOnly || user?.country === 'NG')

  const openForm = (source: 'curriculum' | 'custom') => {
    setFormSource(source)
    setFormOpen(true)
  }

  return (
    <div>
      <header className="mb-7 max-w-2xl">
        <p className="text-[12px] font-bold uppercase tracking-[0.3em] text-ss-accent">Practice</p>
        <h1 className="mt-2 text-[32px] font-extrabold tracking-tight text-ss-ink">
          Choose your <span className="text-ss-accent">mode</span>
        </h1>
        <p className="mt-2 text-sm font-semibold text-ss-slate">AI quizzes, national exam prep, and class work — each with its own flow.</p>
      </header>

      {/* Featured: build a quiz */}
      <button
        type="button"
        onClick={() => openForm('curriculum')}
        data-tour="practice-build"
        className="group relative mb-5 flex w-full items-center gap-5 overflow-hidden rounded-[24px] p-7 text-left text-white"
        style={{ background: 'linear-gradient(115deg,#0C74B4,#0E94D6 52%,#2ACBF2)' }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/art/quiz-builder.png" alt="" aria-hidden className="pointer-events-none absolute right-6 top-1/2 hidden h-[118%] -translate-y-1/2 object-contain drop-shadow-lg sm:block" />
        <span className="relative grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-white/20">
          <Sparkles className="h-7 w-7" />
        </span>
        <span className="relative min-w-0 flex-1">
          <span className="block text-[22px] font-extrabold">Build your quiz</span>
          <span className="block text-[14px] font-semibold text-white/85">Curriculum, topics, difficulty — step by step, then generate.</span>
        </span>
        <span className="relative grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#13202A] transition-transform group-hover:translate-x-0.5">
          <ArrowRight className="h-5 w-5" />
        </span>
      </button>

      {/* Off-syllabus companion to the featured card */}
      <button
        type="button"
        onClick={() => openForm('custom')}
        data-tour="practice-custom"
        className="group mb-5 flex w-full items-center gap-4 rounded-[20px] border border-dashed border-ss-line bg-[color:var(--ss-accent)]/5 p-5 text-left transition-colors hover:border-ss-accent hover:bg-[color:var(--ss-accent)]/10"
      >
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[color:var(--ss-accent)]/15 text-ss-accent">
          <Wand2 className="h-5 w-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[16px] font-extrabold text-ss-ink">Quiz me on anything</span>
          <span className="block text-[13px] font-semibold text-ss-slate">
            Off the syllabus? Type any topic or paste your own notes — we&apos;ll work out what to cover.
          </span>
        </span>
        <ArrowRight className="h-5 w-5 shrink-0 text-ss-slate transition-transform group-hover:translate-x-0.5" />
      </button>

      <div data-tour="practice-modes" className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {visibleModes.map((mode) => (
          <ModeCard key={mode.id} mode={mode} onModal={() => openForm('curriculum')} />
        ))}
      </div>

      {formOpen && (
        <FlowForm onClose={() => setFormOpen(false)} initialSourceMode={formSource} />
      )}
      <ProductTour id="practice" />
    </div>
  )
}
