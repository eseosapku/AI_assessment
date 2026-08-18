'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ArrowRight, BookOpen, Check, FlaskConical, Sparkles, Target } from 'lucide-react'
import { useState } from 'react'
import { SquareMark } from '@/components/Brand'
import { useAuth } from '@/components/AuthProvider'
import Avatar from '@/components/studio/Avatar'
import { completeOnboarding, type FocusId } from '@/lib/onboarding'
import { examPrepAvailable } from '@/lib/countries'

type Goal = {
  id: FocusId
  label: string
  desc: string
  icon: typeof Target
  art: string
  grad: string
  echo: string
}

const GOALS: Goal[] = [
  {
    id: 'grades',
    label: 'Boost my grades',
    desc: 'Practice, track your scores, and climb.',
    icon: Target,
    art: '/art/trophy.png',
    grad: 'linear-gradient(135deg,#0C74B4,#2ACBF2)',
    echo: 'grade-boosting practice',
  },
  {
    id: 'exams',
    label: 'Crush national exams',
    desc: 'Targeted prep for your national exams.',
    icon: BookOpen,
    art: '/art/exam.png',
    grad: 'linear-gradient(135deg,#C77B16,#F0A93E)',
    echo: 'exam preparation',
  },
  {
    id: 'explore',
    label: 'Explore & learn',
    desc: 'Tutor, flashcards, and free exploration.',
    icon: FlaskConical,
    art: '/art/studylab.png',
    grad: 'linear-gradient(135deg,#0E7A5A,#3FD08F)',
    echo: 'open exploration in LearnSpace',
  },
]

const QUICK_LINKS = [
  { label: 'Practice', href: '/practice', icon: Target },
  { label: 'LearnSpace', href: '/studylab', icon: FlaskConical },
  { label: 'Recall', href: '/recall', icon: Sparkles },
]

export default function WelcomeFlow() {
  const { user } = useAuth()
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [goal, setGoal] = useState<FocusId | null>(null)
  const [saving, setSaving] = useState(false)
  const [burstOk, setBurstOk] = useState(true)

  const firstName = user?.name?.split(' ')[0] ?? 'there'
  // National-exam prep is only live in some countries — don't offer it elsewhere.
  const goals = GOALS.filter((g) => g.id !== 'exams' || examPrepAvailable(user?.country))
  const chosen = GOALS.find((g) => g.id === goal) ?? null

  const finish = async () => {
    if (!user?.id || !goal) return
    setSaving(true)
    await completeOnboarding(user.id, goal)
    router.replace('/dashboard')
  }

  return (
    <main className="flex min-h-[100dvh] flex-col items-center justify-center bg-ss-canvas px-4 py-10">
      <div className="w-full max-w-lg overflow-hidden rounded-[28px] border border-ss-line bg-ss-panel p-7 shadow-ss-panel sm:p-9">
        {/* Step indicator */}
        <div className="mb-7 flex items-center justify-center gap-1.5">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all ${i === step ? 'w-6 bg-ss-accent' : i < step ? 'w-1.5 bg-ss-accent' : 'w-1.5 bg-ss-line'}`}
            />
          ))}
        </div>

        <AnimatePresence mode="wait">
          {/* ── Step 0: Welcome ── */}
          {step === 0 && (
            <motion.div
              key="welcome"
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.22 }}
              className="text-center"
            >
              <div className="mb-5 flex justify-center">
                <SquareMark className="h-14 w-14" />
              </div>
              <h1 className="font-display text-[28px] font-black tracking-tight text-ss-ink sm:text-[32px]">
                Hey {firstName} <span className="inline-block">👋</span>
              </h1>
              <p className="mt-2 text-[15px] font-bold text-ss-ink">Welcome to Study<span className="text-ss-accent">Square</span></p>
              <p className="mx-auto mt-2 max-w-sm text-sm font-semibold text-ss-slate">
                Your space for practice, progress, and getting unstuck. Let&apos;s set it up — it takes ten seconds.
              </p>

              <div className="relative mt-6 overflow-hidden rounded-[20px] px-6 py-7 text-white" style={{ background: 'linear-gradient(115deg,#0C74B4,#0E94D6 52%,#2ACBF2)' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/art/hero-motif.png" alt="" aria-hidden className="pointer-events-none absolute right-0 top-0 h-full w-[55%] object-cover opacity-90 mix-blend-screen" />
                <div className="relative flex items-center gap-3">
                  <Avatar userId={user?.id} name={user?.name} size={48} className="ring-2 ring-white/40" />
                  <div className="text-left">
                    <p className="text-[12px] font-bold uppercase tracking-[0.18em] opacity-85">Signed in as</p>
                    <p className="text-[16px] font-extrabold">{user?.name ?? 'Student'}</p>
                  </div>
                </div>
              </div>

              <button type="button" onClick={() => setStep(1)} className="btn-primary mt-7 w-full justify-center">
                Let&apos;s go
                <ArrowRight className="h-4 w-4" />
              </button>
            </motion.div>
          )}

          {/* ── Step 1: Focus ── */}
          {step === 1 && (
            <motion.div
              key="focus"
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.22 }}
            >
              <div className="text-center">
                <h1 className="font-display text-[26px] font-black tracking-tight text-ss-ink sm:text-[30px]">What&apos;s your focus?</h1>
                <p className="mx-auto mt-2 max-w-sm text-sm font-semibold text-ss-slate">
                  Pick one to personalize your dashboard. You can change this anytime in settings.
                </p>
              </div>

              <div className="mt-6 space-y-3">
                {goals.map((g) => {
                  const selected = goal === g.id
                  return (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => setGoal(g.id)}
                      className={`flex w-full items-center gap-4 rounded-[18px] border-2 p-3 text-left transition-all ${
                        selected ? 'border-ss-accent bg-[color:var(--ss-accent)]/[0.06]' : 'border-ss-line bg-ss-panel hover:border-[color:var(--ss-accent)]/40'
                      }`}
                    >
                      <span className="relative grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-2xl" style={{ background: g.grad }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={g.art} alt="" aria-hidden className="h-[88%] w-[88%] object-contain drop-shadow" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[15.5px] font-extrabold text-ss-ink">{g.label}</span>
                        <span className="block text-[12.5px] font-semibold text-ss-slate">{g.desc}</span>
                      </span>
                      <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 transition-all ${selected ? 'border-ss-accent bg-ss-accent text-white' : 'border-ss-line text-transparent'}`}>
                        <Check className="h-3.5 w-3.5" strokeWidth={3} />
                      </span>
                    </button>
                  )
                })}
              </div>

              <div className="mt-7 flex items-center gap-3">
                <button type="button" onClick={() => setStep(0)} className="inline-flex items-center gap-1.5 rounded-full px-4 py-3 text-sm font-bold text-ss-slate transition-colors hover:text-ss-ink">
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </button>
                <button type="button" onClick={() => setStep(2)} disabled={!goal} className="btn-primary flex-1 justify-center disabled:cursor-not-allowed disabled:opacity-60">
                  Continue
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </motion.div>
          )}

          {/* ── Step 2: All set ── */}
          {step === 2 && (
            <motion.div
              key="done"
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.22 }}
              className="text-center"
            >
              <div className="relative mx-auto mb-5 grid h-28 w-28 place-items-center">
                {burstOk && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src="/art/celebration.png" alt="" aria-hidden onError={() => setBurstOk(false)} className="pointer-events-none absolute inset-0 h-full w-full object-contain" />
                )}
                {!burstOk &&
                  [0, 1, 2, 3, 4, 5].map((i) => (
                    <motion.span
                      key={i}
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: [0, 1, 0], x: Math.cos((i / 6) * Math.PI * 2) * 46, y: Math.sin((i / 6) * Math.PI * 2) * 46 }}
                      transition={{ duration: 1, delay: 0.15 + i * 0.04, repeat: Infinity, repeatDelay: 0.6 }}
                      className="absolute h-2.5 w-2.5 rounded-full"
                      style={{ background: ['#0E8FD1', '#2ACBF2', '#16B67A', '#F0A93E', '#E2645F', '#2ACBF2'][i] }}
                    />
                  ))}
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 320, damping: 18 }}
                  className="grid h-16 w-16 place-items-center rounded-full bg-ss-accent text-white shadow-[0_12px_30px_-10px_rgba(14,143,209,.8)]"
                >
                  <Check className="h-8 w-8" strokeWidth={3} />
                </motion.div>
              </div>

              <h1 className="font-display text-[26px] font-black tracking-tight text-ss-ink sm:text-[30px]">You&apos;re all set, {firstName}!</h1>
              <p className="mx-auto mt-2 max-w-sm text-sm font-semibold text-ss-slate">
                We&apos;ll put <span className="font-extrabold text-ss-ink">{chosen?.echo ?? 'your goals'}</span> front and center on your dashboard.
              </p>

              <div className="mt-6 flex items-center justify-center gap-2">
                {QUICK_LINKS.map((q) => {
                  const Icon = q.icon
                  return (
                    <span key={q.label} className="inline-flex items-center gap-1.5 rounded-full bg-ss-chip px-3 py-1.5 text-[12px] font-bold text-ss-ink">
                      <Icon className="h-3.5 w-3.5 text-ss-accent" />
                      {q.label}
                    </span>
                  )
                })}
              </div>

              <button type="button" onClick={finish} disabled={saving} className="btn-primary mt-7 w-full justify-center disabled:opacity-60">
                {saving ? 'Setting up…' : 'Go to dashboard'}
                {!saving && <ArrowRight className="h-4 w-4" />}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </main>
  )
}
