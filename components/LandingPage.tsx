'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import Image from 'next/image'
import { useEffect, useState, createContext, useContext, useMemo, type ReactNode } from 'react'
import {
  ArrowRight,
  Sparkles,
  Zap,
  BookOpen,
  LineChart,
  Users,
  Blocks,
  Check,
  Wand2,
  Target,
  ShieldCheck,
} from 'lucide-react'
import ThemeToggle from './ThemeToggle'
import { Wordmark, BrainInkBadge } from './Brand'
import AuthModal from './AuthModal'

type AuthModalMode = 'login' | 'signup'

const LandingAuthContext = createContext<{
  openLogin: () => void
  openSignup: () => void
}>({
  openLogin: () => {},
  openSignup: () => {},
})

function useLandingAuth() {
  return useContext(LandingAuthContext)
}

/* ============================================================== shared bits */

function Reveal({
  children,
  delay = 0,
  y = 18,
  className = '',
}: {
  children: ReactNode
  delay?: number
  y?: number
  className?: string
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.55, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

/* The four-tile micro-mark — the StudySquare signature, reused in every eyebrow. */
function MiniMark({ className = '' }: { className?: string }) {
  return (
    <span className={`grid grid-cols-2 gap-[2px] ${className}`}>
      <span className="h-1.5 w-1.5 rounded-[1px] bg-[#13a7df]" />
      <span className="h-1.5 w-1.5 rounded-[1px] bg-[#13a7df]/40" />
      <span className="h-1.5 w-1.5 rounded-[1px] bg-[#13a7df]/40" />
      <span className="h-1.5 w-1.5 rounded-[1px] bg-[#13a7df]" />
    </span>
  )
}

function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2.5 text-xs font-bold uppercase tracking-[0.2em] text-[#0c86ce] dark:text-cyan-300">
      <MiniMark />
      {children}
    </span>
  )
}

/* White-line grid texture for use on dark / gradient surfaces. */
function GridTexture({ opacity = 0.5 }: { opacity?: number }) {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0"
      style={{
        opacity,
        backgroundImage:
          'linear-gradient(rgba(255,255,255,0.12) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.12) 1px, transparent 1px)',
        backgroundSize: '40px 40px',
        maskImage: 'radial-gradient(ellipse 80% 80% at 70% 20%, black 20%, transparent 80%)',
        WebkitMaskImage: 'radial-gradient(ellipse 80% 80% at 70% 20%, black 20%, transparent 80%)',
      }}
    />
  )
}

/* ===================================================================== nav */

function Nav() {
  const [scrolled, setScrolled] = useState(false)
  const { openLogin, openSignup } = useLandingAuth()
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'border-b border-black/5 bg-white/80 backdrop-blur-xl dark:border-white/10 dark:bg-[#0a0f1e]/80'
          : 'border-b border-transparent'
      }`}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:px-8">
        <Link href="/" aria-label="StudySquare home">
          <Wordmark />
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          {[
            ['Features', '#features'],
            ['How it works', '#how'],
            ['Exam prep', '#exams'],
            ['For teachers', '#teachers'],
            ['Pricing', '#pricing'],
          ].map(([label, href]) => (
            <a
              key={label}
              href={href}
              className="text-sm font-semibold text-slate-600 transition-colors hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
            >
              {label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          <ThemeToggle />
          <button
            type="button"
            onClick={openLogin}
            className="hidden rounded-full px-3 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-white/10 sm:block"
          >
            Sign in
          </button>
          <button
            type="button"
            onClick={openSignup}
            className="group inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition-all hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
          >
            Get started
            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </button>
        </div>
      </div>
    </header>
  )
}

/* =================================================================== hero */

const HERO_LABELS = [
  { icon: Zap, label: 'Instant AI feedback' },
  { icon: Blocks, label: 'Every question type' },
  { icon: Check, label: 'No setup needed' },
]

const HERO_CARDS = [
  { src: '/hero/q-order.png', w: 1024, h: 764, cls: 'right-[2%] top-[1%] z-10 w-[68%] rotate-[4deg]', alt: 'Put the steps in order — interactive question' },
  { src: '/hero/q-fillgaps.png', w: 1024, h: 771, cls: 'bottom-[6%] left-[1%] z-20 w-[65%] -rotate-[5deg]', alt: 'Fill in the gaps — interactive question' },
  { src: '/hero/q-categorize.png', w: 1024, h: 718, cls: 'left-1/2 top-[48%] z-30 w-[84%] -translate-x-1/2 -translate-y-1/2 -rotate-[1.5deg]', alt: 'Categorize into groups — interactive question' },
]

function HeroDeck() {
  return (
    <div className="relative mx-auto h-[360px] w-full max-w-md sm:h-[420px] sm:max-w-lg lg:h-[500px] lg:max-w-none lg:-translate-y-2">
      <div
        aria-hidden
        className="absolute inset-x-2 inset-y-0 -z-10 rounded-[3rem] bg-gradient-to-br from-[#19b5e8]/30 via-[#7c5cff]/18 to-[#22d3a5]/25 blur-[80px]"
      />
      {HERO_CARDS.map((c, i) => (
        <motion.div
          key={c.src}
          initial={{ opacity: 0, y: 26, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.7, delay: 0.2 + i * 0.12, ease: [0.22, 1, 0.36, 1] }}
          className={`absolute overflow-hidden rounded-2xl border border-white/70 bg-white shadow-[0_30px_70px_-28px_rgba(15,23,42,0.4)] ring-1 ring-black/[0.04] ${c.cls}`}
        >
          <Image src={c.src} alt={c.alt} width={c.w} height={c.h} className="h-auto w-full" priority={i === 2} />
        </motion.div>
      ))}
      {/* soft fade so the deck melts into the background instead of a hard cut */}
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-x-4 bottom-[-2px] h-20 bg-gradient-to-t from-white via-white/70 to-transparent dark:from-[#0a0f1e] dark:via-[#0a0f1e]/70"
      />
    </div>
  )
}

function Hero() {
  const { openSignup } = useLandingAuth()
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-[#f1faff] via-white to-white pb-16 pt-28 dark:from-[#0b1322] dark:via-[#0a0f1e] dark:to-[#0a0f1e] sm:pt-32 lg:pb-24 lg:pt-36">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-60 dark:opacity-100"
        style={{
          backgroundImage:
            'linear-gradient(rgba(15,23,42,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(15,23,42,0.035) 1px, transparent 1px)',
          backgroundSize: '42px 42px',
          maskImage: 'radial-gradient(ellipse 75% 60% at 22% 12%, black, transparent 80%)',
          WebkitMaskImage: 'radial-gradient(ellipse 75% 60% at 22% 12%, black, transparent 80%)',
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute right-[-12%] top-[-8%] h-[460px] w-[560px] rounded-full bg-[#19b5e8]/15 blur-[130px]"
      />

      <div className="relative mx-auto max-w-7xl px-5 sm:px-8">
        <div className="grid items-center gap-y-14 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] lg:gap-x-6">
          {/* left — copy */}
          <div className="relative z-10 max-w-xl">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <Eyebrow>WAEC · JAMB · NECO · SAT · ACT · IGCSE</Eyebrow>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.06 }}
              className="mt-5 font-sans text-5xl font-bold leading-[0.96] tracking-[-0.03em] text-slate-900 dark:text-white sm:text-6xl lg:text-[4.5rem]"
            >
              Master the syllabus,
              <br />
              <span className="text-slate-300 dark:text-slate-600">walk in exam-ready</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.14 }}
              className="mt-6 max-w-md text-base leading-relaxed text-slate-500 dark:text-slate-400 sm:text-lg"
            >
              Adaptive quizzes, interactive study sets and instant AI feedback — built for
              regional exams like <span className="font-semibold text-slate-700 dark:text-slate-200">WAEC, JAMB, SATs and ACT</span>,
              plus your country&apos;s national syllabus and curriculum.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.22 }}
              className="mt-9 flex flex-wrap items-center gap-3"
            >
              <button
                type="button"
                onClick={openSignup}
                className="group inline-flex items-center gap-2.5 rounded-full bg-slate-900 px-7 py-4 text-sm font-bold text-white shadow-xl shadow-slate-900/15 transition-transform hover:scale-[1.02] dark:bg-white dark:text-slate-900"
              >
                <Sparkles className="h-4 w-4 text-[#22d3a5]" />
                Start learning free
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </button>
              <a
                href="#how"
                className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-6 py-4 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50 dark:border-white/15 dark:bg-transparent dark:text-slate-200 dark:hover:bg-white/5"
              >
                See how it works
              </a>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-2.5"
            >
              {HERO_LABELS.map(({ icon: Icon, label }) => (
                <span
                  key={label}
                  className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.1em] text-slate-400 dark:text-slate-500"
                >
                  <Icon className="h-4 w-4 text-[#13a7df]" strokeWidth={2.4} />
                  {label}
                </span>
              ))}
            </motion.div>
          </div>

          {/* right — layered product cards */}
          <div className="relative lg:translate-x-6 xl:translate-x-12">
            <HeroDeck />
          </div>
        </div>
      </div>
    </section>
  )
}

/* ========================================================= exams marquee */

function ExamsMarquee() {
  const items = ['WAEC', 'JAMB', 'NECO', 'KCSE', 'SAT', 'ACT', 'IGCSE', 'Cambridge', 'GCSE', 'AS & A Level', 'National syllabi']
  const row = [...items, ...items]
  return (
    <section id="exams" className="overflow-hidden border-b border-slate-200 bg-white py-10 dark:border-white/10 dark:bg-[#0a0f1e]">
      <div className="mx-auto max-w-3xl px-5 text-center">
        <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#0c86ce] dark:text-cyan-300">
          Regional exam prep
        </p>
        <p className="mt-2 text-base font-semibold text-slate-600 dark:text-slate-300">
          From WAEC, JAMB and NECO to SATs, ACT and IGCSE — aligned to your national
          syllabus and curriculum, not a generic question bank.
        </p>
      </div>
      <div className="relative mt-7">
        <motion.div
          className="flex w-max items-center gap-10"
          animate={{ x: ['0%', '-50%'] }}
          transition={{ duration: 26, repeat: Infinity, ease: 'linear' }}
        >
          {row.map((it, i) => (
            <span key={i} className="flex shrink-0 items-center gap-3 text-xl font-bold text-slate-300 dark:text-slate-600">
              <span className="h-2 w-2 rounded-[2px] bg-[#13a7df]/50" />
              {it}
            </span>
          ))}
        </motion.div>
        <div className="pointer-events-none absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-white to-transparent dark:from-[#0a0f1e]" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-white to-transparent dark:from-[#0a0f1e]" />
      </div>
    </section>
  )
}

/* ============================================================== features */

const FEATURES = [
  { n: '02', icon: Blocks, title: 'Interactive study mode', body: 'Match, order, categorize and fill-the-blank sets that make revision stick.' },
  { n: '03', icon: Zap, title: 'Instant AI feedback', body: 'Every answer graded the moment you submit, with clear explanations.' },
  { n: '04', icon: BookOpen, title: 'Curriculum aligned', body: 'Topics mapped to real textbooks, so practice matches what you are taught.' },
  { n: '05', icon: LineChart, title: 'Progress that motivates', body: 'Track scores by subject and watch averages climb as mastery builds.' },
]

function Features() {
  return (
    <section id="features" className="bg-slate-50 py-24 dark:bg-[#070b16] sm:py-28">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr] lg:items-end">
          <Reveal>
            <Eyebrow>Everything in one square</Eyebrow>
            <h2 className="mt-5 max-w-xl font-sans text-4xl font-bold leading-[1.02] tracking-[-0.02em] text-slate-900 dark:text-white sm:text-5xl">
              A complete study companion,{' '}
              <span className="text-slate-300 dark:text-slate-600">not just a quiz maker</span>
            </h2>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="text-slate-500 dark:text-slate-400 lg:pb-2 lg:text-right">
              From the first question to the final grade, StudySquare handles the busywork so
              learners can focus on understanding.
            </p>
          </Reveal>
        </div>

        <div className="mt-14 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {/* featured — vibrant cyan */}
          <Reveal className="md:col-span-2 lg:col-span-2 lg:row-span-2">
            <article className="relative flex h-full flex-col overflow-hidden rounded-3xl bg-gradient-to-br from-[#19b5e8] to-[#0a72bf] p-8 text-white sm:p-10">
              <GridTexture opacity={0.6} />
              <span className="pointer-events-none absolute right-7 top-5 font-sans text-7xl font-bold leading-none text-white/15">
                01
              </span>
              <div className="relative flex h-full flex-col">
                <Sparkles className="h-7 w-7" strokeWidth={2} />
                <h3 className="mt-6 font-sans text-2xl font-bold tracking-tight sm:text-3xl">AI assessment builder</h3>
                <p className="mt-3 max-w-md text-white/85">
                  Pick a subject, topic and difficulty — StudySquare writes a complete,
                  curriculum-accurate quiz in seconds.
                </p>

                <div className="mt-auto pt-8">
                  <div className="rounded-2xl border border-white/20 bg-white/10 p-4 backdrop-blur-sm">
                    <div className="flex flex-wrap items-center gap-2 text-[11px] font-medium text-white/90">
                      <span className="rounded-md bg-white/15 px-2 py-1">Biology · Grade 9</span>
                      <span className="rounded-md bg-white/15 px-2 py-1">Topic: Cells</span>
                      <span className="rounded-md bg-white/15 px-2 py-1">10 questions</span>
                    </div>
                    <div className="mt-3 flex items-center gap-2 text-xs font-semibold">
                      <Wand2 className="h-3.5 w-3.5" />
                      Generating your assessment…
                    </div>
                    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/20">
                      <motion.div
                        initial={{ width: '12%' }}
                        whileInView={{ width: '80%' }}
                        viewport={{ once: true }}
                        transition={{ duration: 1.4, ease: 'easeInOut' }}
                        className="h-full rounded-full bg-white"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </article>
          </Reveal>

          {FEATURES.map((f, i) => (
            <Reveal key={f.title} delay={i * 0.06}>
              <article className="group relative h-full overflow-hidden rounded-3xl border border-slate-200/80 bg-white p-7 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-cyan-500/5 dark:border-white/10 dark:bg-[#0e1424]">
                <span className="pointer-events-none absolute right-5 top-3 font-sans text-5xl font-bold leading-none text-slate-900/[0.05] dark:text-white/[0.06]">
                  {f.n}
                </span>
                <f.icon className="h-6 w-6 text-[#0c86ce] dark:text-cyan-300" strokeWidth={1.9} />
                <h3 className="mt-5 text-lg font-bold text-slate-900 dark:text-white">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-500 dark:text-slate-400">{f.body}</p>
                <span className="absolute bottom-0 left-0 h-1 w-0 bg-gradient-to-r from-[#19b5e8] to-[#0c86ce] transition-all duration-300 group-hover:w-full" />
              </article>
            </Reveal>
          ))}

          <Reveal className="md:col-span-2 lg:col-span-3">
            <article className="group relative flex flex-col items-start justify-between gap-5 overflow-hidden rounded-3xl border border-slate-200/80 bg-white p-7 transition-all duration-300 hover:shadow-xl hover:shadow-cyan-500/5 dark:border-white/10 dark:bg-[#0e1424] sm:flex-row sm:items-center sm:p-8">
              <span className="pointer-events-none absolute right-6 top-2 font-sans text-6xl font-bold leading-none text-slate-900/[0.04] dark:text-white/[0.05]">
                06
              </span>
              <div className="relative max-w-xl">
                <Users className="h-6 w-6 text-[#0c86ce] dark:text-cyan-300" strokeWidth={1.9} />
                <h3 className="mt-4 text-lg font-bold text-slate-900 dark:text-white">Tools for teachers</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
                  Generate assessments straight from a PDF, assign them to a class, and review
                  every student&rsquo;s results from one dashboard.
                </p>
              </div>
              <a
                href="#teachers"
                className="relative inline-flex shrink-0 items-center gap-1.5 rounded-full bg-slate-900 px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-slate-800 dark:bg-white dark:text-slate-900"
              >
                See teacher tools
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </a>
            </article>
          </Reveal>
        </div>
      </div>
    </section>
  )
}

/* ============================================================ how it works */

const STEPS = [
  { n: '01', kicker: 'Choose', title: 'Pick your topics', body: 'Select your subject, class and the exact topics you want to focus on.' },
  { n: '02', kicker: 'Generate', title: 'AI builds your set', body: 'A tailored assessment or interactive study set is ready in seconds, at your level.' },
  { n: '03', kicker: 'Learn', title: 'Get instant feedback', body: 'Answer, get graded instantly, and see exactly what to revise next.' },
]

function StepSnippet({ step }: { step: number }) {
  if (step === 0) {
    const chips = [
      { label: 'Photosynthesis', on: true },
      { label: 'Cell division', on: false },
      { label: 'Genetics', on: true },
      { label: 'Osmosis', on: false },
      { label: 'Ecology', on: false },
    ]
    return (
      <div>
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#eaf7fe] px-2.5 py-1 text-[11px] font-bold text-[#0c86ce] dark:bg-[#13a7df]/15 dark:text-cyan-300">
            <BookOpen className="h-3 w-3" strokeWidth={2.4} /> Biology · Grade 10
          </span>
          <span className="text-[11px] font-semibold text-slate-400">2 selected</span>
        </div>
        <div className="mt-3.5 flex flex-wrap gap-2">
          {chips.map((c) =>
            c.on ? (
              <span
                key={c.label}
                className="inline-flex items-center gap-1 rounded-lg bg-gradient-to-br from-[#19b5e8] to-[#0a72bf] px-2.5 py-1.5 text-xs font-semibold text-white shadow-sm"
              >
                <Check className="h-3 w-3" strokeWidth={3} />
                {c.label}
              </span>
            ) : (
              <span
                key={c.label}
                className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-500 dark:border-white/10 dark:text-slate-400"
              >
                {c.label}
              </span>
            )
          )}
        </div>
      </div>
    )
  }

  if (step === 1) {
    return (
      <div>
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-[#7c5cff] to-[#5b8def] text-white">
            <Wand2 className="h-3.5 w-3.5" strokeWidth={2.2} />
          </span>
          <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Generating set</span>
          <span className="ml-1 flex gap-1">
            {[0, 1, 2].map((d) => (
              <motion.span
                key={d}
                className="h-1.5 w-1.5 rounded-full bg-[#7c5cff]"
                animate={{ opacity: [0.25, 1, 0.25] }}
                transition={{ duration: 1.1, repeat: Infinity, delay: d * 0.18 }}
              />
            ))}
          </span>
        </div>
        <div className="mt-4 space-y-2.5">
          {['w-full', 'w-[88%]', 'w-[72%]'].map((w, i) => (
            <div key={i} className="flex items-center gap-2.5">
              <span className="h-5 w-5 shrink-0 rounded-md bg-slate-100 dark:bg-white/[0.06]" />
              <span className={`h-2.5 rounded-full bg-gradient-to-r from-slate-200 to-slate-100 dark:from-white/10 dark:to-white/[0.04] ${w} animate-pulse`} />
            </div>
          ))}
        </div>
        <div className="mt-4 flex items-center gap-1.5 text-[11px] font-semibold text-slate-400">
          <span>12 questions</span>
          <span className="h-1 w-1 rounded-full bg-slate-300" />
          <span>Medium</span>
          <span className="h-1 w-1 rounded-full bg-slate-300" />
          <span>MCQ + short answer</span>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-end justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Your score</p>
          <p className="font-sans text-3xl font-bold leading-none text-slate-900 dark:text-white">84%</p>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300">
          <Check className="h-3 w-3" strokeWidth={3} /> Graded
        </span>
      </div>
      <div className="mt-3.5 space-y-2">
        <div className="flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-300">
          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-300">
            <Check className="h-2.5 w-2.5" strokeWidth={3} />
          </span>
          Cell structure
          <span className="ml-auto text-[11px] font-semibold text-emerald-600 dark:text-emerald-300">Correct</span>
        </div>
        <div className="flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-300">
          <span className="h-4 w-4 rounded-full border-2 border-amber-400" />
          Osmosis
          <span className="ml-auto text-[11px] font-semibold text-amber-500">Review</span>
        </div>
      </div>
      <div className="mt-3.5 flex items-center gap-1.5 rounded-lg bg-[#eaf7fe] px-3 py-2 text-[11px] font-semibold text-[#0c86ce] dark:bg-[#13a7df]/12 dark:text-cyan-300">
        <ArrowRight className="h-3 w-3" strokeWidth={2.6} /> Next: revise Osmosis &amp; diffusion
      </div>
    </div>
  )
}

function HowItWorks() {
  return (
    <section id="how" className="bg-white py-24 dark:bg-[#0a0f1e] sm:py-28">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <div className="grid gap-6 md:grid-cols-[1fr_auto] md:items-end">
          <Reveal>
            <Eyebrow>How it works</Eyebrow>
            <h2 className="mt-5 max-w-lg font-sans text-4xl font-bold leading-[1.02] tracking-[-0.02em] text-slate-900 dark:text-white sm:text-5xl">
              From topic to top grade,{' '}
              <span className="text-slate-300 dark:text-slate-600">in three steps</span>
            </h2>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="max-w-xs text-slate-500 dark:text-slate-400 md:text-right">
              No question bank to maintain. Just choose, generate, and learn.
            </p>
          </Reveal>
        </div>

        <div className="relative mt-16">
          <div className="grid gap-12 md:grid-cols-3 md:gap-8">
            {STEPS.map((s, i) => (
              <Reveal key={s.title} delay={i * 0.12} className="relative flex flex-col">
                {/* node + connector to the next step */}
                <div className="flex items-center">
                  <span className="relative z-10 flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#19b5e8] to-[#0a72bf] font-sans text-xl font-bold text-white shadow-lg shadow-[#19b5e8]/30">
                    {s.n}
                  </span>
                  {i < STEPS.length - 1 && (
                    <span
                      aria-hidden
                      className="ml-4 hidden h-[3px] flex-1 rounded-full bg-gradient-to-r from-[#19b5e8] to-[#7c5cff]/40 md:block md:mr-[-2rem]"
                    />
                  )}
                </div>

                <div className="mt-5">
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#13a7df]">{s.kicker}</p>
                  <h3 className="mt-1 text-lg font-bold text-slate-900 dark:text-white">{s.title}</h3>
                </div>

                <div className="mt-6 flex flex-1 flex-col justify-center rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_24px_60px_-34px_rgba(15,23,42,0.45)] dark:border-white/10 dark:bg-[#0e1424]">
                  <StepSnippet step={i} />
                </div>

                <p className="mt-5 max-w-xs text-[15px] leading-relaxed text-slate-500 dark:text-slate-400">{s.body}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

/* ========================================================= interactive study */

function InteractiveStudy() {
  const modes = ['Multiple choice', 'Match pairs', 'Put in order', 'Categorize', 'Fill the blank', 'Short answer']
  return (
    <section id="interactive" className="bg-gradient-to-b from-[#f4fbff] to-white py-24 dark:from-[#0b1226] dark:to-[#070b16] sm:py-28">
      <div className="mx-auto grid max-w-7xl items-center gap-14 px-5 sm:px-8 lg:grid-cols-2">
        <Reveal>
          <Eyebrow>Interactive study</Eyebrow>
          <h2 className="mt-5 font-sans text-4xl font-bold leading-[1.02] tracking-[-0.02em] text-slate-900 dark:text-white sm:text-5xl">
            Revision that feels{' '}
            <span className="text-slate-300 dark:text-slate-600">less like a test</span>
          </h2>
          <p className="mt-5 max-w-md text-slate-500 dark:text-slate-400">
            Switch from formal assessments to hands-on study sets. Drag, match and sort your way
            through a topic — then let the AI explain anything you missed.
          </p>

          <div className="mt-8 grid grid-cols-1 gap-x-10 sm:grid-cols-2">
            {modes.map((m, i) => (
              <div
                key={m}
                className="group flex items-center gap-3 border-b border-slate-200/80 py-3 dark:border-white/10"
              >
                <span className="font-sans text-sm font-bold tabular-nums text-[#13a7df]">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span className="text-[15px] font-semibold text-slate-700 transition-colors group-hover:text-[#0c86ce] dark:text-slate-200 dark:group-hover:text-cyan-300">
                  {m}
                </span>
              </div>
            ))}
          </div>
        </Reveal>

        <Reveal delay={0.1}>
          <div className="relative">
            <div className="absolute -inset-4 rounded-[2rem] bg-gradient-to-br from-[#19b5e8]/15 to-[#7c5cff]/15 blur-2xl" />
            <div className="relative grid grid-cols-2 gap-4">
              {[
                { label: 'Match the term', tint: 'from-[#19b5e8] to-[#0c86ce]', items: ['Mitosis', 'Osmosis', 'Diffusion', 'Enzyme'] },
                { label: 'Put in order', tint: 'from-[#7c5cff] to-[#5b8def]', items: ['Prophase', 'Metaphase', 'Anaphase', 'Telophase'] },
              ].map((card, idx) => (
                <div
                  key={card.label}
                  className={`overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-white/10 dark:bg-[#0e1424] ${
                    idx === 1 ? 'translate-y-8' : ''
                  }`}
                >
                  <div className={`bg-gradient-to-br ${card.tint} px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-white`}>
                    {card.label}
                  </div>
                  <div className="space-y-2 p-4">
                    {card.items.map((it, i) => (
                      <div
                        key={it}
                        className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-300"
                      >
                        {idx === 1 && (
                          <span className="flex h-4 w-4 items-center justify-center rounded bg-[#7c5cff] text-[9px] font-bold text-white">
                            {i + 1}
                          </span>
                        )}
                        {it}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}

/* ============================================================= for teachers */

const TEACHER_FEATURES = [
  { icon: Wand2, title: 'Build from anything', body: 'Generate a quiz from a PDF, a topic, or your exam board’s syllabus in seconds.' },
  { icon: Zap, title: 'Marking on autopilot', body: 'Every submission is graded the instant it lands, with AI feedback per student.' },
  { icon: LineChart, title: 'See the whole class', body: 'Spot weak topics, watch averages move, and follow every learner’s progress.' },
  { icon: Target, title: 'Assign in a click', body: 'Send an assessment to a class, set difficulty and timing, then reuse it next term.' },
  { icon: Users, title: 'Roster without friction', body: 'Students join with a school ID or email — no accounts to chase down.' },
  { icon: BookOpen, title: 'Aligned to your board', body: 'Prep classes for WAEC, JAMB, NECO, IGCSE, SAT, A-Level and more.' },
]

function TeacherMock() {
  const students = [
    { initials: 'AJ', name: 'Aisha Jallow', score: 92 },
    { initials: 'TO', name: 'Tunde Okafor', score: 78 },
    { initials: 'MK', name: 'Maria Kente', score: 85 },
    { initials: 'DN', name: 'David Nkosi', score: 61 },
  ]
  const barColor = (s: number) => (s >= 85 ? 'bg-emerald-500' : s >= 70 ? 'bg-[#19b5e8]' : 'bg-amber-500')
  const avg = 84
  const R = 22
  const C = 2 * Math.PI * R

  return (
    <div className="relative">
      <div className="absolute -inset-4 rounded-[2rem] bg-gradient-to-br from-[#19b5e8]/15 to-[#7c5cff]/15 blur-2xl" />
      <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[#0e1424]">
        <div className="flex items-center justify-between bg-gradient-to-br from-[#19b5e8] to-[#0a72bf] px-6 py-5 text-white">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/20 ring-1 ring-white/25">
              <BookOpen className="h-4 w-4" />
            </span>
            <div>
              <div className="text-sm font-bold">Grade 11 · Chemistry</div>
              <div className="text-[11px] text-white/80">Acids, Bases &amp; Salts</div>
            </div>
          </div>
          <span className="rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-semibold">28 students</span>
        </div>

        <div className="flex items-center gap-4 px-6 py-5">
          <div className="relative flex h-16 w-16 items-center justify-center">
            <svg className="h-16 w-16 -rotate-90" viewBox="0 0 56 56">
              <circle cx="28" cy="28" r={R} fill="none" stroke="currentColor" strokeWidth="5" className="text-slate-100 dark:text-white/10" />
              <circle cx="28" cy="28" r={R} fill="none" stroke="#19b5e8" strokeWidth="5" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - avg / 100)} />
            </svg>
            <span className="absolute text-sm font-bold text-slate-900 dark:text-white">{avg}%</span>
          </div>
          <div>
            <div className="text-sm font-bold text-slate-900 dark:text-white">Class average</div>
            <div className="mt-0.5 inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              <ArrowRight className="h-3 w-3 -rotate-45" /> +6% this week
            </div>
          </div>
        </div>

        <div className="space-y-3 px-6 pb-5">
          {students.map((st) => (
            <div key={st.name} className="flex items-center gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-[11px] font-bold text-slate-600 dark:bg-white/5 dark:text-slate-300">
                {st.initials}
              </span>
              <span className="w-28 shrink-0 truncate text-xs font-medium text-slate-700 dark:text-slate-300">{st.name}</span>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-white/10">
                <div className={`h-full rounded-full ${barColor(st.score)}`} style={{ width: `${st.score}%` }} />
              </div>
              <span className="w-8 shrink-0 text-right text-xs font-bold text-slate-900 dark:text-white">{st.score}</span>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2 border-t border-slate-100 px-6 py-4 dark:border-white/10">
          <span className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full bg-slate-900 py-2.5 text-xs font-bold text-white dark:bg-white dark:text-slate-900">
            <Wand2 className="h-3.5 w-3.5" /> Assign new assessment
          </span>
          <span className="rounded-full border border-slate-200 px-3 py-2.5 text-xs font-semibold text-slate-600 dark:border-white/15 dark:text-slate-300">
            Export
          </span>
        </div>
      </div>
    </div>
  )
}

function ForTeachers() {
  const { openSignup } = useLandingAuth()
  return (
    <section id="teachers" className="bg-slate-50 py-24 dark:bg-[#070b16] sm:py-28">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="grid items-center gap-14 lg:grid-cols-2">
          <Reveal delay={0.1} className="order-2 lg:order-1">
            <TeacherMock />
          </Reveal>

          <Reveal className="order-1 lg:order-2">
            <Eyebrow>For teachers</Eyebrow>
            <h2 className="mt-5 max-w-md font-sans text-4xl font-bold leading-[1.02] tracking-[-0.02em] text-slate-900 dark:text-white sm:text-5xl">
              Less marking,{' '}
              <span className="text-slate-300 dark:text-slate-600">more teaching</span>
            </h2>
            <p className="mt-5 max-w-md text-slate-500 dark:text-slate-400">
              StudySquare hands you the busywork — generating assessments, grading every script
              and turning results into insight — so your time goes where it counts.
            </p>
            <button
              type="button"
              onClick={openSignup}
              className="group mt-8 inline-flex items-center gap-2 rounded-full bg-slate-900 px-6 py-3.5 text-sm font-bold text-white transition-all hover:bg-slate-800 dark:bg-white dark:text-slate-900"
            >
              Create a teacher account
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </button>
          </Reveal>
        </div>

        <div className="mt-20 grid gap-x-10 gap-y-9 sm:grid-cols-2 lg:grid-cols-3">
          {TEACHER_FEATURES.map((f, i) => (
            <Reveal key={f.title} delay={i * 0.05}>
              <div className="flex gap-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#13a7df]/10 text-[#0c86ce] dark:bg-cyan-500/15 dark:text-cyan-300">
                  <f.icon className="h-5 w-5" strokeWidth={1.9} />
                </span>
                <div>
                  <h4 className="text-[15px] font-bold text-slate-900 dark:text-white">{f.title}</h4>
                  <p className="mt-1.5 text-sm leading-relaxed text-slate-500 dark:text-slate-400">{f.body}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ================================================================= pricing */

function Pricing() {
  const { openSignup } = useLandingAuth()
  return (
    <section id="pricing" className="bg-white py-24 dark:bg-[#0a0f1e] sm:py-28">
      <div className="mx-auto max-w-5xl px-5 sm:px-8">
        <Reveal className="text-center">
          <div className="flex justify-center">
            <Eyebrow>Pricing</Eyebrow>
          </div>
          <h2 className="mt-5 font-sans text-4xl font-bold leading-[1.02] tracking-[-0.02em] text-slate-900 dark:text-white sm:text-5xl">
            One price.{' '}
            <span className="text-slate-300 dark:text-slate-600">Everything included.</span>
          </h2>
          <p className="mx-auto mt-5 max-w-md text-slate-500 dark:text-slate-400">
            No tiers, no add-ons. Try it with 2 free assessments, then unlock everything
            for a single monthly price.
          </p>
        </Reveal>

        <Reveal delay={0.08}>
          <div className="relative mx-auto mt-14 max-w-xl overflow-hidden rounded-[2rem] bg-gradient-to-br from-[#19b5e8] via-[#0e9fd6] to-[#0a72bf] p-8 text-white shadow-2xl shadow-cyan-500/20 sm:p-10">
            <GridTexture opacity={0.6} />
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0"
              style={{
                backgroundImage:
                  'radial-gradient(90% 90% at 100% 0%, rgba(124,92,255,0.4), transparent 55%), radial-gradient(80% 80% at 0% 100%, rgba(34,211,165,0.35), transparent 50%)',
              }}
            />
            <div className="relative">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.12em] ring-1 ring-white/25">
                <Sparkles className="h-3.5 w-3.5" /> 2 assessments free to start
              </span>

              <div className="mt-6 flex items-end gap-2">
                <span className="font-sans text-6xl font-bold tracking-tight">$5</span>
                <span className="pb-2 text-base font-medium text-white/85">/ month</span>
              </div>
              <p className="mt-2 text-sm text-white/85">
                Billed monthly · pay in your local currency · cancel anytime.
              </p>

              <div className="my-7 h-px w-full bg-white/15" />

              <ul className="grid gap-3 text-sm sm:grid-cols-2">
                {[
                  'Unlimited AI assessments',
                  'Full interactive study mode',
                  'Every question type',
                  'Progress analytics by subject',
                  'Instant AI feedback',
                  'WAEC, JAMB, SAT, IGCSE & more',
                ].map((f) => (
                  <li key={f} className="flex items-center gap-2.5 text-white/95">
                    <Check className="h-4 w-4 shrink-0" strokeWidth={2.6} />
                    {f}
                  </li>
                ))}
              </ul>

              <button
                type="button"
                onClick={openSignup}
                className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-full bg-white py-3.5 text-sm font-bold text-slate-900 transition-transform hover:scale-[1.02]"
              >
                Start learning free
                <ArrowRight className="h-4 w-4" />
              </button>
              <p className="mt-3 text-center text-xs text-white/70">
                No card required for your free assessments.
              </p>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}

/* =============================================================== final cta */

function FinalCTA() {
  const { openLogin, openSignup } = useLandingAuth()
  return (
    <section className="bg-white px-5 pb-24 dark:bg-[#0a0f1e] sm:px-8">
      <Reveal>
        <div className="relative mx-auto max-w-6xl overflow-hidden rounded-[2.25rem] bg-gradient-to-br from-[#19b5e8] via-[#0e9fd6] to-[#0a72bf] px-8 py-16 text-center sm:py-20">
          <GridTexture opacity={0.7} />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              backgroundImage:
                'radial-gradient(100% 100% at 90% 0%, rgba(124,92,255,0.4), transparent 55%), radial-gradient(80% 80% at 0% 100%, rgba(34,211,165,0.4), transparent 50%)',
            }}
          />
          <div className="relative">
            <h2 className="mx-auto max-w-2xl font-sans text-4xl font-bold leading-[1.02] tracking-[-0.02em] text-white sm:text-6xl">
              Ready to study smarter?
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-white/85">
              Join StudySquare and turn any topic into mastery — your first assessments are on us.
            </p>
            <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={openSignup}
                className="group inline-flex items-center gap-2 rounded-full bg-slate-900 px-7 py-4 text-sm font-bold text-white shadow-xl transition-transform hover:scale-[1.02]"
              >
                <Sparkles className="h-4 w-4 text-[#22d3a5]" />
                Start learning free
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </button>
              <button
                type="button"
                onClick={openLogin}
                className="inline-flex items-center rounded-full bg-white/15 px-7 py-4 text-sm font-bold text-white ring-1 ring-white/25 backdrop-blur transition-colors hover:bg-white/25"
              >
                I already have an account
              </button>
            </div>
            <div className="mt-10 flex items-center justify-center gap-2 text-xs font-medium text-white/80">
              <ShieldCheck className="h-4 w-4" />
              Secure checkout powered by Flutterwave
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  )
}

/* ================================================================== footer */

function Footer() {
  const { openLogin, openSignup } = useLandingAuth()
  return (
    <footer className="border-t border-slate-200 bg-slate-50 dark:border-white/10 dark:bg-[#070b16]">
      <div className="mx-auto max-w-7xl px-5 py-14 sm:px-8">
        <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <Wordmark />
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-slate-500 dark:text-slate-400">
              Adaptive, AI-powered assessments and study tools for students and teachers.
            </p>
            <div className="mt-5">
              <BrainInkBadge />
            </div>
          </div>

          {[
            ['Product', ['Features', 'How it works', 'Pricing', 'For teachers']],
            ['Company', ['About', 'Brain Ink', 'Contact']],
            ['Get started', ['Sign in', 'Create account']],
          ].map(([title, links]) => (
            <div key={title as string}>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">{title as string}</h4>
              <ul className="mt-4 space-y-2.5">
                {(links as string[]).map((l) => (
                  <li key={l}>
                    {l === 'Sign in' ? (
                      <button type="button" onClick={openLogin} className="text-sm text-slate-500 transition-colors hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">
                        {l}
                      </button>
                    ) : l === 'Create account' ? (
                      <button type="button" onClick={openSignup} className="text-sm text-slate-500 transition-colors hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">
                        {l}
                      </button>
                    ) : (
                      <a href="#" className="text-sm text-slate-500 transition-colors hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">
                        {l}
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-3 border-t border-slate-200 pt-7 text-sm text-slate-500 dark:border-white/10 dark:text-slate-400 sm:flex-row">
          <span>© {new Date().getFullYear()} StudySquare. All rights reserved.</span>
          <div className="flex gap-6">
            <a href="#" className="transition-colors hover:text-slate-900 dark:hover:text-white">Privacy</a>
            <a href="#" className="transition-colors hover:text-slate-900 dark:hover:text-white">Terms</a>
          </div>
        </div>
      </div>
    </footer>
  )
}

/* ==================================================================== page */

export default function LandingPage() {
  const [authModal, setAuthModal] = useState<AuthModalMode | null>(null)
  const authValue = useMemo(
    () => ({
      openLogin: () => setAuthModal('login'),
      openSignup: () => setAuthModal('signup'),
    }),
    [],
  )

  return (
    <LandingAuthContext.Provider value={authValue}>
      <div className="min-h-screen bg-white font-sans dark:bg-[#0a0f1e]">
        <Nav />
        <main>
          <Hero />
          <ExamsMarquee />
          <Features />
          <HowItWorks />
          <InteractiveStudy />
          <ForTeachers />
          <Pricing />
          <FinalCTA />
        </main>
        <Footer />
      </div>
      {authModal && (
        <AuthModal
          mode={authModal}
          onClose={() => setAuthModal(null)}
          onSwitch={(mode) => setAuthModal(mode)}
        />
      )}
    </LandingAuthContext.Provider>
  )
}
