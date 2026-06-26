'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import { GraduationCap, Repeat, Sparkles, Target, ArrowRight } from 'lucide-react'
import { useState } from 'react'
import FlowForm from '@/components/FlowForm'
import { Marker } from '@/components/StudioPrimitives'
import { useAuth } from '@/components/AuthProvider'

const modes = [
  {
    id: 'recall',
    title: 'Recall',
    blurb: 'Flashcards on a smart schedule — review what you missed from quizzes.',
    tone: 'bg-brand-sky/40',
    icon: Repeat,
    href: '/recall',
    cta: 'Open Recall',
  },
  {
    id: 'ai',
    title: 'Build your quiz',
    blurb: 'Curriculum, topics, difficulty — step by step, then generate.',
    tone: 'bg-gradient-to-br from-brand-ink to-brand-blue text-white',
    icon: Sparkles,
    action: 'modal' as const,
    cta: 'Build quiz',
  },
  {
    id: 'exam',
    title: 'Exam prep',
    blurb: 'WAEC & JAMB style drills for Nigerian students.',
    tone: 'bg-gradient-to-br from-brand-ink to-brand-blue text-white',
    icon: GraduationCap,
    href: '/exam-prep',
    ngOnly: true,
    cta: 'Open exam prep',
  },
  {
    id: 'assign',
    title: 'Class assignment',
    blurb: 'Open work your teacher posted in your classrooms.',
    tone: 'bg-white border border-black/[0.06]',
    icon: Target,
    href: '/classrooms',
    cta: 'Open classes',
  },
]

export default function PracticeHub() {
  const { user } = useAuth()
  const [formOpen, setFormOpen] = useState(false)

  const visibleModes = modes.filter(m => !m.ngOnly || user?.country === 'NG')

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-8 sm:py-12">
      <header className="mb-10 max-w-2xl">
        <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-brand-blue">Practice</p>
        <h1 className="mt-2 font-display text-4xl font-black tracking-[-0.04em] sm:text-5xl">
          Choose your <Marker tone="blue">mode</Marker>
        </h1>
        <p className="mt-3 text-sm font-semibold text-brand-slate">
          AI quizzes, national exam prep, report cards, and class work — each with its own flow.
        </p>
      </header>

      <div className="grid gap-5 sm:grid-cols-2">
        {visibleModes.map((mode, i) => {
          const Icon = mode.icon
          const isDark = mode.tone.includes('brand-ink')
          const inner = (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.06 * i }}
              whileHover={{ y: -4 }}
              className={`group relative overflow-hidden rounded-2xl border p-7 shadow-sm ${mode.tone}`}
            >
              <Icon className={`relative h-8 w-8 ${isDark ? 'text-brand-sky' : 'text-brand-blue'}`} />
              <h2 className={`relative mt-6 font-display text-2xl font-black tracking-tight ${isDark ? 'text-white' : 'text-brand-ink'}`}>
                {mode.title}
              </h2>
              <p className={`relative mt-2 max-w-[16rem] text-sm font-semibold ${isDark ? 'text-white/75' : 'text-brand-slate'}`}>
                {mode.blurb}
              </p>
              <span className={`relative mt-6 inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest ${isDark ? 'text-brand-sky' : 'text-brand-blue'}`}>
                {mode.cta}
                <ArrowRight className="h-4 w-4" />
              </span>
            </motion.div>
          )

          if (mode.action === 'modal') {
            return (
              <button key={mode.id} type="button" onClick={() => setFormOpen(true)} className="text-left">
                {inner}
              </button>
            )
          }
          return (
            <Link key={mode.id} href={mode.href!}>
              {inner}
            </Link>
          )
        })}
      </div>

      {formOpen && <FlowForm onClose={() => setFormOpen(false)} />}
    </div>
  )
}
