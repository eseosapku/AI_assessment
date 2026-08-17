'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import { useEffect, useState, createContext, useContext, useMemo, type ReactNode } from 'react'
import {
  ArrowRight,
  Zap,
  Globe,
  Check,
  Target,
  FlaskConical,
  Layers,
  Users,
  GraduationCap,
  BarChart3,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react'
import ThemeToggle from './ThemeToggle'
import { Wordmark } from './Brand'
import AuthModal from './AuthModal'

type AuthModalMode = 'login' | 'signup'

const LandingAuthContext = createContext<{ openLogin: () => void; openSignup: () => void }>({
  openLogin: () => {},
  openSignup: () => {},
})
const useLandingAuth = () => useContext(LandingAuthContext)

const CYAN = 'linear-gradient(120deg,#0C74B4,#0E94D6 55%,#2ACBF2)'
const GREEN = 'linear-gradient(120deg,#0E7A5A,#16B67A 60%,#3FD08F)'
const AMBER = 'linear-gradient(120deg,#C77B16,#F0A93E 60%,#FFC777)'

/* ============================================================== shared bits */

function Reveal({ children, delay = 0, y = 20, className = '' }: { children: ReactNode; delay?: number; y?: number; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

function MiniMark({ className = '' }: { className?: string }) {
  return (
    <span className={`grid grid-cols-2 gap-[2px] ${className}`}>
      <span className="h-1.5 w-1.5 rounded-[1px] bg-[#2ACBF2]" />
      <span className="h-1.5 w-1.5 rounded-[1px] bg-[#2ACBF2]/40" />
      <span className="h-1.5 w-1.5 rounded-[1px] bg-[#2ACBF2]/40" />
      <span className="h-1.5 w-1.5 rounded-[1px] bg-[#2ACBF2]" />
    </span>
  )
}

function Eyebrow({ children, light = false }: { children: ReactNode; light?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-2.5 text-xs font-bold uppercase tracking-[0.2em] ${light ? 'text-white/85' : 'text-[#0c86ce] dark:text-cyan-300'}`}>
      <MiniMark />
      {children}
    </span>
  )
}

function GridTexture({ opacity = 0.5 }: { opacity?: number }) {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0"
      style={{
        opacity,
        backgroundImage: 'linear-gradient(rgba(255,255,255,0.12) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.12) 1px, transparent 1px)',
        backgroundSize: '40px 40px',
        maskImage: 'radial-gradient(ellipse 80% 80% at 70% 20%, black 20%, transparent 80%)',
        WebkitMaskImage: 'radial-gradient(ellipse 80% 80% at 70% 20%, black 20%, transparent 80%)',
      }}
    />
  )
}

/* A browser-chrome frame that shows a product screenshot, or a themed
   placeholder until the real image is dropped into /public/landing. */
function ShotFrame({ src, alt, label, tone = CYAN, className = '' }: { src: string; alt: string; label: string; tone?: string; className?: string }) {
  const [ok, setOk] = useState(true)
  return (
    <div className={`overflow-hidden rounded-2xl border border-black/10 bg-white shadow-[0_40px_90px_-40px_rgba(8,47,73,0.55)] dark:border-white/10 dark:bg-[#0e1424] ${className}`}>
      <div className="flex items-center gap-1.5 border-b border-black/5 px-3 py-2.5 dark:border-white/5">
        <span className="h-2.5 w-2.5 rounded-full bg-red-400/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-amber-400/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/70" />
      </div>
      {ok ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={alt} loading="lazy" onError={() => setOk(false)} className="block w-full" />
      ) : (
        <div className="grid aspect-[16/10] place-items-center text-white" style={{ background: tone }}>
          <div className="text-center">
            <p className="text-sm font-extrabold">{label}</p>
            <p className="mt-0.5 text-[12px] font-semibold uppercase tracking-widest opacity-80">product preview</p>
          </div>
        </div>
      )}
    </div>
  )
}

/* Hero centerpiece art with graceful fallback to existing art. */
function HeroArt() {
  const [src, setSrc] = useState('/art/hero-scene.png')
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" aria-hidden onError={() => src !== '/art/hero-motif.png' && setSrc('/art/hero-motif.png')} className="pointer-events-none h-full w-full object-contain drop-shadow-[0_30px_60px_rgba(12,116,180,0.35)]" />
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
    <header className={`fixed inset-x-0 top-0 z-50 transition-all ${scrolled ? 'border-b border-black/[0.06] bg-white/80 backdrop-blur-xl dark:border-white/10 dark:bg-[#0a0f1e]/80' : 'border-b border-transparent'}`}>
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:px-8">
        <Link href="/" aria-label="StudySquare home">
          <Wordmark />
        </Link>
        <nav className="hidden items-center gap-8 md:flex">
          {[['Features', '#features'], ['StudyLab', '#studylab'], ['Exam prep', '#features'], ['Pricing', '#pricing']].map(([label, href]) => (
            <a key={label} href={href} className="text-sm font-semibold text-slate-600 transition-colors hover:text-slate-900 dark:text-slate-300 dark:hover:text-white">
              {label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-2 sm:gap-3">
          <ThemeToggle />
          <button type="button" onClick={openLogin} className="hidden rounded-full px-3 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-white/10 sm:block">
            Sign in
          </button>
          <button type="button" onClick={openSignup} className="group inline-flex items-center gap-1.5 rounded-full px-5 py-2.5 text-sm font-bold text-white shadow-[0_10px_30px_-12px_rgba(14,143,209,0.9)] transition-transform hover:scale-[1.03]" style={{ background: CYAN }}>
            Get started
            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </button>
        </div>
      </div>
    </header>
  )
}

/* =================================================================== hero */

const HERO_CHIPS = [
  { icon: Zap, label: 'Instant AI feedback' },
  { icon: FlaskConical, label: 'Builds you the lesson' },
  { icon: Globe, label: 'Your curriculum' },
]

function Hero() {
  const { openSignup } = useLandingAuth()
  return (
    <section className="relative overflow-hidden pb-20 pt-28 sm:pt-36 lg:pb-28">
      {/* cyan wash + dot grid */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-[#EAF6FD] via-white to-white dark:from-[#0b1322] dark:via-[#0a0f1e] dark:to-[#0a0f1e]" />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-60 dark:opacity-40"
        style={{
          backgroundImage: 'radial-gradient(circle, rgba(14,143,209,0.10) 1px, transparent 1px)',
          backgroundSize: '26px 26px',
          maskImage: 'radial-gradient(ellipse 70% 60% at 50% 0%, black 20%, transparent 75%)',
          WebkitMaskImage: 'radial-gradient(ellipse 70% 60% at 50% 0%, black 20%, transparent 75%)',
        }}
      />
      <div className="mx-auto grid max-w-7xl items-center gap-12 px-5 sm:px-8 lg:grid-cols-[1fr_1.15fr]">
        <div>
          <Reveal>
            <Eyebrow>AI tutor · curriculum-aligned</Eyebrow>
          </Reveal>
          <Reveal delay={0.05}>
            <h1 className="mt-5 font-sans text-[40px] font-extrabold leading-[1.04] tracking-[-0.03em] text-slate-900 dark:text-white sm:text-[58px]">
              Stuck on something?{' '}
              <span className="bg-gradient-to-r from-[#0C74B4] to-[#2ACBF2] bg-clip-text text-transparent">We&apos;ll build you a way through it.</span>
            </h1>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="mt-6 max-w-xl text-lg font-medium leading-relaxed text-slate-600 dark:text-slate-300">
              Practice any topic, get unstuck with an AI tutor that draws you the whole lesson on a living canvas, and lock it into memory for good — all aligned to your curriculum.
            </p>
          </Reveal>
          <Reveal delay={0.15}>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <button type="button" onClick={openSignup} className="group inline-flex items-center gap-2 rounded-full px-7 py-4 text-sm font-bold text-white shadow-[0_16px_40px_-16px_rgba(14,143,209,0.9)] transition-transform hover:scale-[1.03]" style={{ background: CYAN }}>
                Get started free
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </button>
              <a href="#how" className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-6 py-4 text-sm font-bold text-slate-800 transition-colors hover:border-[#0E8FD1] dark:border-white/15 dark:bg-white/5 dark:text-white">
                See how it works
              </a>
            </div>
          </Reveal>
          <Reveal delay={0.2}>
            <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2">
              {HERO_CHIPS.map(({ icon: Icon, label }) => (
                <span key={label} className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 dark:text-slate-400">
                  <Icon className="h-4 w-4 text-[#0E8FD1]" />
                  {label}
                </span>
              ))}
            </div>
          </Reveal>
        </div>

        {/* art + tilted product panel — dashboard is the in-flow centerpiece,
            the brain art peeks from behind its top-right corner. */}
        <Reveal delay={0.1} className="relative">
          <div className="relative mx-auto w-full max-w-md px-2 sm:max-w-lg lg:max-w-none lg:pr-4">
            <div aria-hidden className="absolute -left-6 bottom-8 -z-10 h-52 w-52 rounded-full bg-[#16B67A]/20 blur-[70px]" />
            <div aria-hidden className="absolute right-8 -top-6 -z-10 h-44 w-44 rounded-full bg-[#F0A93E]/20 blur-[70px]" />
            <div aria-hidden className="absolute inset-10 -z-10 rounded-[3rem] bg-gradient-to-br from-[#2ACBF2]/30 to-[#16B67A]/15 blur-[70px]" />

            {/* brain art peeking from behind the panel's top-right corner */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
              className="absolute -top-14 right-2 z-0 h-36 w-36 sm:-top-20 sm:right-6 sm:h-48 sm:w-48"
            >
              <HeroArt />
            </motion.div>

            {/* dashboard (entrance on the outer div, static 3D tilt on the inner) */}
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
              className="relative z-10 mt-20 sm:mt-24"
            >
              <div style={{ transform: 'perspective(1500px) rotateY(7deg) rotateX(2deg) rotate(-4deg)' }}>
                <ShotFrame src="/landing/shot-dashboard.png" alt="StudySquare dashboard" label="Your dashboard" />
              </div>
            </motion.div>

            {/* floating glossy stat card */}
            <motion.div
              initial={{ opacity: 0, scale: 0.8, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: [0, -8, 0] }}
              transition={{ opacity: { duration: 0.6, delay: 0.5 }, scale: { duration: 0.6, delay: 0.5 }, y: { duration: 4, repeat: Infinity, ease: 'easeInOut' } }}
              className="absolute -bottom-5 left-0 z-20 flex items-center gap-2.5 rounded-2xl border border-black/[0.06] bg-white/95 px-3.5 py-2.5 shadow-xl backdrop-blur dark:border-white/10 dark:bg-[#0e1424]/95 sm:left-2"
            >
              <Ring pct={92} tone="#16B67A" size={44} />
              <div>
                <p className="text-[12px] font-extrabold leading-tight text-slate-800 dark:text-white">Gap closed</p>
                <p className="text-[12px] font-semibold text-slate-400">Algebra · mastered</p>
              </div>
            </motion.div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}

/* ============================================================ trust strip */

function TrustStrip() {
  const items = ['REB · Rwanda', 'WAEC & JAMB · Nigeria', 'Cambridge IGCSE', 'SAT', 'Your national syllabus']
  return (
    <section className="border-y border-black/[0.06] bg-white py-7 dark:border-white/10 dark:bg-[#0a0f1e]">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-5 sm:px-8">
        <p className="text-[12px] font-bold uppercase tracking-[0.2em] text-slate-400">Built for your curriculum</p>
        <div className="flex flex-wrap items-center justify-center gap-2.5">
          {items.map((c) => (
            <span key={c} className="rounded-full border border-slate-200 bg-slate-50 px-4 py-1.5 text-sm font-bold text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
              {c}
            </span>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ============================================================= bento grid */

function FeatureArt({ src, tone }: { src: string; tone: string }) {
  return (
    <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl shadow-lg" style={{ background: tone }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" aria-hidden className="h-9 w-9 object-contain drop-shadow" />
    </span>
  )
}

/* A glossy score ring used as a warm flourish across tiles. */
function Ring({ pct, tone, size = 64 }: { pct: number; tone: string; size?: number }) {
  const inner = size - 16
  return (
    <div className="grid shrink-0 place-items-center rounded-full" style={{ width: size, height: size, background: `conic-gradient(${tone} ${pct}%, rgba(148,163,184,0.18) 0)` }}>
      <div className="grid place-items-center rounded-full bg-white text-[13px] font-extrabold text-slate-800 dark:bg-[#0e1424] dark:text-white" style={{ width: inner, height: inner }}>
        {pct}%
      </div>
    </div>
  )
}

/* ---- tile mini-visuals (CSS, on-brand) ---- */

function MiniRecall() {
  const btns: [string, string][] = [['Again', 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-300'], ['Hard', 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'], ['Good', 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'], ['Easy', 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300']]
  return (
    <div className="relative mt-6 h-[118px]">
      <div className="absolute left-3 top-3 h-[86px] w-[80%] rotate-[5deg] rounded-2xl border border-black/[0.06] bg-white dark:border-white/10 dark:bg-[#10182a]" />
      <div className="absolute left-1.5 top-1.5 h-[90px] w-[84%] rotate-[2.5deg] rounded-2xl border border-black/[0.06] bg-white dark:border-white/10 dark:bg-[#10182a]" />
      <div className="absolute left-0 top-0 w-[88%] rounded-2xl border border-black/[0.06] bg-white p-3.5 shadow-sm dark:border-white/10 dark:bg-[#0e1424]">
        <p className="text-[13px] font-bold text-slate-800 dark:text-white">What causes a supply curve to shift?</p>
        <div className="mt-3 flex gap-1.5">
          {btns.map(([b, c]) => (
            <span key={b} className={`rounded-md px-2 py-1 text-[12px] font-bold ${c}`}>{b}</span>
          ))}
        </div>
      </div>
    </div>
  )
}

function MiniProgress() {
  const bars: [string, number, string][] = [['Physics', 72, '#16B67A'], ['Maths', 54, '#F0A93E'], ['Chemistry', 38, '#E2645F']]
  return (
    <div className="mt-6 flex items-center gap-4">
      <Ring pct={64} tone="#F0A93E" />
      <div className="flex-1 space-y-2.5">
        {bars.map(([s, v, c]) => (
          <div key={s}>
            <div className="flex justify-between text-[12px] font-semibold text-slate-500 dark:text-slate-400"><span>{s}</span><span>{v}%</span></div>
            <div className="mt-1 h-1.5 rounded-full bg-slate-100 dark:bg-white/10"><div className="h-full rounded-full" style={{ width: `${v}%`, background: c }} /></div>
          </div>
        ))}
      </div>
    </div>
  )
}

function Features() {
  return (
    <section id="features" className="relative overflow-hidden bg-slate-50 py-24 dark:bg-[#070b16] sm:py-28">
      <div aria-hidden className="pointer-events-none absolute -left-32 top-20 h-72 w-72 rounded-full opacity-[0.12] blur-3xl" style={{ background: AMBER }} />
      <div aria-hidden className="pointer-events-none absolute -right-32 bottom-20 h-72 w-72 rounded-full opacity-[0.12] blur-3xl" style={{ background: GREEN }} />
      <div className="relative mx-auto max-w-6xl px-5 sm:px-8">
        <Reveal className="max-w-2xl">
          <Eyebrow>Everything in one place</Eyebrow>
          <h2 className="mt-5 font-sans text-4xl font-bold leading-[1.04] tracking-[-0.02em] text-slate-900 dark:text-white sm:text-5xl">
            One study space. <span className="bg-gradient-to-r from-[#0C74B4] to-[#2ACBF2] bg-clip-text text-transparent">Every way to learn it.</span>
          </h2>
        </Reveal>

        <div className="mt-12 grid auto-rows-[minmax(0,1fr)] gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {/* StudyLab — big tile */}
          <Reveal className="sm:col-span-2 sm:row-span-2">
            <div className="group relative flex h-full flex-col overflow-hidden rounded-[24px] border border-black/[0.06] bg-white p-8 dark:border-white/10 dark:bg-[#0e1424]">
              <div aria-hidden className="absolute -right-10 -top-10 h-48 w-48 rounded-full opacity-25 blur-3xl" style={{ background: GREEN }} />
              <div className="relative flex items-center gap-3">
                <FeatureArt src="/art/studylab.png" tone={GREEN} />
                <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[12px] font-extrabold uppercase tracking-wide text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">Flagship</span>
              </div>
              <h3 className="relative mt-5 font-sans text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">StudyLab — your AI draws the whole lesson</h3>
              <p className="relative mt-3 max-w-lg text-[15px] leading-relaxed text-slate-600 dark:text-slate-300">
                Ask anything and watch it become an interactive canvas: explainer cards, diagrams, runnable examples, and checkpoints that quiz you. Stuck on homework? Type it, snap it, or drop a PDF — the tutor reads it and walks you through.
              </p>
              <div className="relative mt-6 flex-1">
                <ShotFrame src="/landing/shot-studylab.png" alt="StudyLab canvas" label="StudyLab canvas" tone={GREEN} />
              </div>
            </div>
          </Reveal>

          {/* Recall — with flashcard stack */}
          <Reveal delay={0.05}>
            <div className="relative h-full overflow-hidden rounded-[24px] border border-black/[0.06] bg-white p-7 dark:border-white/10 dark:bg-[#0e1424]">
              <div aria-hidden className="absolute -right-8 -top-8 h-32 w-32 rounded-full opacity-20 blur-2xl" style={{ background: CYAN }} />
              <div className="relative flex items-center gap-3">
                <FeatureArt src="/art/recall.png" tone={CYAN} />
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">Recall</h3>
              </div>
              <p className="relative mt-2 text-[15px] leading-relaxed text-slate-600 dark:text-slate-300">Forgot it already? Recall rebuilds flashcards from exactly what you got wrong — and resurfaces them right before you&apos;d forget.</p>
              <MiniRecall />
            </div>
          </Reveal>

          {/* Progress / gaps — with ring + bars */}
          <Reveal delay={0.1}>
            <div className="relative h-full overflow-hidden rounded-[24px] border border-black/[0.06] bg-white p-7 dark:border-white/10 dark:bg-[#0e1424]">
              <div aria-hidden className="absolute -right-8 -top-8 h-32 w-32 rounded-full opacity-20 blur-2xl" style={{ background: AMBER }} />
              <div className="relative flex items-center gap-3">
                <FeatureArt src="/art/brain.png" tone={AMBER} />
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">Progress &amp; gaps</h3>
              </div>
              <p className="relative mt-2 text-[15px] leading-relaxed text-slate-600 dark:text-slate-300">A living map of every subject — see where you&apos;re strong vs stuck, then tap a gap to study it.</p>
              <MiniProgress />
            </div>
          </Reveal>

          {/* AI assessments — wide, with graded card */}
          <Reveal delay={0.05} className="sm:col-span-2">
            <div className="relative flex h-full flex-col gap-6 overflow-hidden rounded-[24px] border border-black/[0.06] bg-white p-7 dark:border-white/10 dark:bg-[#0e1424] sm:flex-row sm:items-center">
              <div aria-hidden className="absolute -left-10 -bottom-10 h-40 w-40 rounded-full opacity-15 blur-3xl" style={{ background: CYAN }} />
              <div className="relative flex-1">
                <FeatureArt src="/art/quiz-builder.png" tone={CYAN} />
                <h3 className="mt-4 text-xl font-bold text-slate-900 dark:text-white">AI assessments, every question type</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-slate-600 dark:text-slate-300">
                  Build a quiz on any topic in seconds — graded instantly with feedback that actually explains.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {['MCQ', 'Fill gaps', 'Order', 'Categorize', 'Long-form'].map((t) => (
                    <span key={t} className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-600 dark:bg-white/5 dark:text-slate-300">{t}</span>
                  ))}
                </div>
              </div>
              <div className="relative flex items-center gap-3 rounded-2xl border border-black/[0.06] bg-slate-50 p-4 dark:border-white/10 dark:bg-white/[0.03] sm:w-52">
                <Ring pct={78} tone="#0E8FD1" />
                <div>
                  <span className="rounded-lg bg-sky-50 px-2.5 py-1 text-[15px] font-extrabold text-sky-700 dark:bg-sky-900/30 dark:text-sky-300">B+</span>
                  <p className="mt-1.5 text-[12px] font-semibold text-slate-500 dark:text-slate-400">Algebra · graded instantly</p>
                </div>
              </div>
            </div>
          </Reveal>

          {/* Classes — mini class card */}
          <Reveal delay={0.1}>
            <div className="relative h-full overflow-hidden rounded-[24px] border border-black/[0.06] bg-white p-7 dark:border-white/10 dark:bg-[#0e1424]">
              <div className="flex items-center gap-3">
                <FeatureArt src="/art/classroom.png" tone={CYAN} />
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">Classes</h3>
              </div>
              <p className="mt-2 text-[15px] leading-relaxed text-slate-600 dark:text-slate-300">Join your teacher&apos;s classroom — assignments and deadlines, where you study.</p>
              <div className="mt-5 overflow-hidden rounded-2xl border border-black/[0.06] dark:border-white/10">
                <div className="relative h-12" style={{ background: CYAN }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/art/classroom.png" alt="" aria-hidden className="absolute right-2 top-1/2 h-[150%] -translate-y-1/2 object-contain" />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-white/25 px-2 py-0.5 text-[12px] font-bold text-white backdrop-blur">3 open</span>
                </div>
                <div className="bg-white px-3 py-2.5 dark:bg-[#0e1424]">
                  <p className="text-[13px] font-extrabold text-slate-800 dark:text-white">Grade 8 · Science</p>
                </div>
              </div>
            </div>
          </Reveal>

          {/* Exam prep — past-paper card */}
          <Reveal delay={0.15}>
            <div className="relative h-full overflow-hidden rounded-[24px] border border-black/[0.06] bg-white p-7 dark:border-white/10 dark:bg-[#0e1424]">
              <div aria-hidden className="absolute -right-8 -top-8 h-32 w-32 rounded-full opacity-20 blur-2xl" style={{ background: AMBER }} />
              <div className="relative flex items-center gap-3">
                <FeatureArt src="/art/exam.png" tone={AMBER} />
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">Exam prep</h3>
              </div>
              <p className="relative mt-2 text-[15px] leading-relaxed text-slate-600 dark:text-slate-300">Past-paper-style practice for national exams — walk in ready.</p>
              <div className="relative mt-5 flex gap-2">
                {['WAEC', 'JAMB', 'SAT'].map((e) => (
                  <span key={e} className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[13px] font-extrabold text-amber-700 dark:border-amber-800/40 dark:bg-amber-900/20 dark:text-amber-300">{e}</span>
                ))}
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  )
}

/* ===================================================== question-type marquee */

function QuestionMarquee() {
  const shots = ['/hero/q-order.png', '/hero/q-fillgaps.png', '/hero/q-categorize.png']
  const row = [...shots, ...shots]
  return (
    <section className="overflow-hidden border-y border-black/[0.06] bg-white py-16 dark:border-white/10 dark:bg-[#0a0f1e]">
      <div className="mx-auto mb-8 max-w-6xl px-5 text-center sm:px-8">
        <Reveal>
          <h2 className="font-sans text-3xl font-bold tracking-[-0.02em] text-slate-900 dark:text-white sm:text-4xl">
            Not just multiple choice. <span className="bg-gradient-to-r from-[#16B67A] to-[#3FD08F] bg-clip-text text-transparent">Every question type.</span>
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-slate-500 dark:text-slate-400">Drag-to-order, fill-the-gaps, categorize, long-form — all interactive, all graded the instant you answer.</p>
        </Reveal>
      </div>
      <div className="relative">
        <div aria-hidden className="pointer-events-none absolute inset-y-0 left-0 z-10 w-24 bg-gradient-to-r from-white to-transparent dark:from-[#0a0f1e]" />
        <div aria-hidden className="pointer-events-none absolute inset-y-0 right-0 z-10 w-24 bg-gradient-to-l from-white to-transparent dark:from-[#0a0f1e]" />
        <motion.div
          className="flex w-max gap-5 px-5"
          animate={{ x: ['0%', '-50%'] }}
          transition={{ duration: 28, ease: 'linear', repeat: Infinity }}
        >
          {row.map((src, i) => (
            <div key={i} className="w-[320px] shrink-0 overflow-hidden rounded-2xl border border-black/[0.06] bg-white shadow-[0_24px_60px_-30px_rgba(8,47,73,0.5)] dark:border-white/10 dark:bg-[#0e1424] sm:w-[400px]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="Interactive question type" loading="lazy" className="block w-full" />
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}

/* ========================================================= studylab spotlight */

function StudyLabSpotlight() {
  const { openSignup } = useLandingAuth()
  const nodes = ['Concept card', 'Diagram', 'Worked example', 'Checkpoint quiz', 'Run the code']
  return (
    <section id="studylab" className="relative overflow-hidden py-24 sm:py-28" style={{ background: 'linear-gradient(160deg,#0A2A40,#0C74B4 60%,#0E94D6)' }}>
      <GridTexture opacity={0.5} />
      <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-5 sm:px-8 lg:grid-cols-[0.85fr_1.15fr]">
        <Reveal>
          <Eyebrow light>The differentiator</Eyebrow>
          <h2 className="mt-5 font-sans text-4xl font-bold leading-[1.05] tracking-[-0.02em] text-white sm:text-5xl">
            Ask anything. Watch it become a lesson.
          </h2>
          <p className="mt-5 max-w-lg text-lg leading-relaxed text-white/85">
            StudyLab isn&apos;t a chatbot in a box. It lays your topic out on a spatial canvas you can explore — and quizzes you with checkpoints so it actually sticks.
          </p>
          <div className="mt-7 flex flex-wrap gap-2">
            {nodes.map((n) => (
              <span key={n} className="inline-flex items-center gap-1.5 rounded-full bg-white/12 px-3.5 py-1.5 text-sm font-semibold text-white ring-1 ring-white/20 backdrop-blur">
                <Check className="h-3.5 w-3.5 text-[#9BE3FB]" /> {n}
              </span>
            ))}
          </div>
          <button type="button" onClick={openSignup} className="mt-8 inline-flex items-center gap-2 rounded-full bg-white px-6 py-3.5 text-sm font-bold text-[#0C5E92] transition-transform hover:scale-[1.03]">
            Try StudyLab free <ArrowRight className="h-4 w-4" />
          </button>
        </Reveal>
        <Reveal delay={0.1} className="lg:scale-[1.04]">
          <ShotFrame src="/landing/shot-canvas.png" alt="StudyLab interactive canvas" label="StudyLab canvas" tone={GREEN} />
        </Reveal>
      </div>
    </section>
  )
}

/* ========================================================== how it works */

const STEPS = [
  { icon: Target, art: '/art/quiz-builder.png', title: 'Pick a topic', body: 'Type any topic or snap your homework. We align to your curriculum automatically.' },
  { icon: FlaskConical, art: '/art/studylab.png', title: 'Practice & get tutored', body: 'Quiz yourself, or open a LearnSpace and let the AI draw the whole lesson for you.' },
  { icon: BarChart3, art: '/art/trophy.png', title: 'Track gaps & close them', body: 'See your weak spots on the gap map, and Recall makes sure you never forget the wins.' },
]

function HowItWorks() {
  return (
    <section id="how" className="bg-slate-50 py-24 dark:bg-[#070b16] sm:py-28">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <Reveal className="max-w-xl">
          <Eyebrow>How it works</Eyebrow>
          <h2 className="mt-5 font-sans text-4xl font-bold leading-[1.04] tracking-[-0.02em] text-slate-900 dark:text-white sm:text-5xl">
            From stuck to mastered, in three steps.
          </h2>
        </Reveal>
        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <Reveal key={s.title} delay={i * 0.08}>
              <div className="relative h-full rounded-[24px] border border-black/[0.06] bg-white p-7 dark:border-white/10 dark:bg-[#0e1424]">
                <span className="absolute right-6 top-6 text-5xl font-black text-slate-100 dark:text-white/5">{i + 1}</span>
                <span className="grid h-14 w-14 place-items-center rounded-2xl" style={{ background: CYAN }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={s.art} alt="" aria-hidden className="h-10 w-10 object-contain" />
                </span>
                <h3 className="mt-5 text-xl font-bold text-slate-900 dark:text-white">{s.title}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-slate-600 dark:text-slate-300">{s.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ========================================================= gap map showcase */

function GapMapShowcase() {
  return (
    <section className="bg-white py-24 dark:bg-[#0a0f1e] sm:py-28">
      <div className="mx-auto grid max-w-7xl items-center gap-12 px-5 sm:px-8 lg:grid-cols-2">
        <Reveal delay={0.1} className="order-2 lg:order-1">
          <ShotFrame src="/landing/shot-gapmap.png" alt="Learning gap map" label="Learning gap map" tone={AMBER} />
        </Reveal>
        <Reveal className="order-1 lg:order-2">
          <Eyebrow>Know exactly where you stand</Eyebrow>
          <h2 className="mt-5 font-sans text-4xl font-bold leading-[1.05] tracking-[-0.02em] text-slate-900 dark:text-white sm:text-5xl">
            Your whole syllabus, color-coded.
          </h2>
          <p className="mt-5 max-w-lg text-lg leading-relaxed text-slate-600 dark:text-slate-300">
            Every subject you&apos;ve been assessed in, mapped into a branched tree — mastered, developing, or a gap. Tap any weak branch and StudyLab starts a directed session on the spot.
          </p>
          <div className="mt-7 flex flex-wrap gap-4">
            {[['Mastered', 'bg-blue-500'], ['Developing', 'bg-amber-500'], ['Learning gap', 'bg-red-500']].map(([l, c]) => (
              <span key={l} className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 dark:text-slate-300">
                <span className={`h-2.5 w-2.5 rounded-full ${c}`} /> {l}
              </span>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  )
}

/* ============================================================= for teachers */

function ForTeachers() {
  const { openSignup } = useLandingAuth()
  return (
    <section id="teachers" className="bg-slate-50 py-24 dark:bg-[#070b16] sm:py-28">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <Reveal>
          <div className="relative overflow-hidden rounded-[28px] border border-black/[0.06] bg-[#0F1B2A] p-8 text-white sm:p-12 dark:border-white/10">
            <div aria-hidden className="absolute -right-16 -top-16 h-64 w-64 rounded-full opacity-30 blur-3xl" style={{ background: CYAN }} />
            <div className="relative grid items-center gap-8 lg:grid-cols-[1.2fr_1fr]">
              <div>
                <Eyebrow light>For teachers</Eyebrow>
                <h2 className="mt-5 font-sans text-3xl font-bold leading-[1.08] tracking-[-0.02em] sm:text-4xl">Run your class, see every student.</h2>
                <p className="mt-4 max-w-xl text-white/80">
                  Create a classroom, set assignments, and watch each student&apos;s progress and gaps in real time — built on the same curriculum-aligned engine your students learn with.
                </p>
                <button type="button" onClick={openSignup} className="mt-7 inline-flex items-center gap-2 rounded-full px-6 py-3.5 text-sm font-bold text-white transition-transform hover:scale-[1.03]" style={{ background: CYAN }}>
                  <Users className="h-4 w-4" /> Set up a classroom
                </button>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {([[Users, 'Classrooms'], [GraduationCap, 'Assignments'], [BarChart3, 'Live progress'], [Target, 'Per-student gaps'], [Layers, 'Curriculum-aligned'], [ShieldCheck, 'Secure']] as [LucideIcon, string][]).map(([Icon, label], i) => (
                  <div key={i} className="flex flex-col items-center gap-2 rounded-2xl bg-white/[0.06] p-4 text-center ring-1 ring-white/10">
                    <Icon className="h-5 w-5 text-[#9BE3FB]" />
                    <span className="text-[12px] font-bold leading-tight text-white/85">{label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}

/* ================================================================ pricing */

function Pricing() {
  const { openSignup } = useLandingAuth()
  return (
    <section id="pricing" className="bg-white py-24 dark:bg-[#0a0f1e] sm:py-28">
      <div className="mx-auto max-w-5xl px-5 sm:px-8">
        <Reveal className="text-center">
          <div className="flex justify-center"><Eyebrow>Pricing</Eyebrow></div>
          <h2 className="mt-5 font-sans text-4xl font-bold leading-[1.04] tracking-[-0.02em] text-slate-900 dark:text-white sm:text-5xl">
            One price. <span className="bg-gradient-to-r from-[#16B67A] to-[#3FD08F] bg-clip-text text-transparent">Everything included.</span>
          </h2>
          <p className="mx-auto mt-5 max-w-md text-slate-500 dark:text-slate-400">
            Start with 2 free assessments — no card needed. Then unlock all of it for one simple monthly price, in your local currency.
          </p>
        </Reveal>
        <Reveal delay={0.08}>
          <div className="relative mx-auto mt-14 max-w-xl overflow-hidden rounded-[2rem] p-8 text-white shadow-2xl shadow-cyan-500/20 sm:p-10" style={{ background: CYAN }}>
            <GridTexture opacity={0.6} />
            <div className="relative">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-[12px] font-bold uppercase tracking-[0.12em] ring-1 ring-white/25">
                <Check className="h-3.5 w-3.5" /> 2 assessments free to start
              </span>
              <div className="mt-6 flex items-end gap-2">
                <span className="font-sans text-6xl font-bold tracking-tight">$5</span>
                <span className="pb-2 text-base font-medium text-white/85">/ month</span>
              </div>
              <p className="mt-2 text-sm text-white/85">Billed monthly · pay in your local currency · cancel anytime.</p>
              <div className="my-7 h-px w-full bg-white/15" />
              <ul className="grid gap-3 text-sm sm:grid-cols-2">
                {['Unlimited AI assessments', 'Full StudyLab tutor', 'Recall flashcards', 'Progress & gap map', 'Every question type', 'Exam prep & report cards'].map((f) => (
                  <li key={f} className="flex items-center gap-2.5 text-white/95">
                    <Check className="h-4 w-4 shrink-0" strokeWidth={2.6} /> {f}
                  </li>
                ))}
              </ul>
              <button type="button" onClick={openSignup} className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-full bg-white py-3.5 text-sm font-bold text-[#0C5E92] transition-transform hover:scale-[1.02]">
                Start learning free <ArrowRight className="h-4 w-4" />
              </button>
              <p className="mt-3 text-center text-xs text-white/70">No card required for your free assessments.</p>
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
        <div className="relative mx-auto max-w-6xl overflow-hidden rounded-[2.25rem] px-8 py-16 text-center sm:py-20" style={{ background: CYAN }}>
          <GridTexture opacity={0.7} />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/art/celebration.png" alt="" aria-hidden onError={(e) => ((e.currentTarget.style.display = 'none'))} className="pointer-events-none absolute right-6 top-6 h-24 w-24 opacity-90" />
          <div className="relative">
            <h2 className="mx-auto max-w-2xl font-sans text-4xl font-bold leading-[1.05] tracking-[-0.02em] text-white sm:text-6xl">
              Your next study session could be your best one.
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-white/85">Turn any topic into mastery — your first assessments are on us.</p>
            <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
              <button type="button" onClick={openSignup} className="group inline-flex items-center gap-2 rounded-full bg-[#0F1B2A] px-7 py-4 text-sm font-bold text-white shadow-xl transition-transform hover:scale-[1.03]">
                Get started free
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </button>
              <button type="button" onClick={openLogin} className="inline-flex items-center rounded-full bg-white/15 px-7 py-4 text-sm font-bold text-white ring-1 ring-white/25 backdrop-blur transition-colors hover:bg-white/25">
                I already have an account
              </button>
            </div>
            <div className="mt-10 flex items-center justify-center gap-2 text-xs font-medium text-white/80">
              <ShieldCheck className="h-4 w-4" /> Secure checkout powered by Flutterwave
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  )
}

/* ================================================================== footer */

function Footer() {
  return (
    <footer className="border-t border-black/[0.06] bg-white py-12 dark:border-white/10 dark:bg-[#0a0f1e]">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 px-5 sm:flex-row sm:px-8">
        <Wordmark />
        <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
          {[['Features', '#features'], ['StudyLab', '#studylab'], ['Exam prep', '#features'], ['Pricing', '#pricing']].map(([l, h]) => (
            <a key={l} href={h} className="text-sm font-semibold text-slate-500 transition-colors hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">{l}</a>
          ))}
        </nav>
        <p className="text-xs font-medium text-slate-400">© {new Date().getFullYear()} StudySquare · Brain Ink</p>
      </div>
    </footer>
  )
}

/* ==================================================================== root */

export default function LandingPage() {
  const [authModal, setAuthModal] = useState<AuthModalMode | null>(null)
  const authValue = useMemo(() => ({ openLogin: () => setAuthModal('login'), openSignup: () => setAuthModal('signup') }), [])

  return (
    <LandingAuthContext.Provider value={authValue}>
      <div className="min-h-screen bg-white font-sans dark:bg-[#0a0f1e]">
        <Nav />
        <main>
          <Hero />
          <TrustStrip />
          <Features />
          <QuestionMarquee />
          <StudyLabSpotlight />
          <HowItWorks />
          <GapMapShowcase />
          <ForTeachers />
          <Pricing />
          <FinalCTA />
        </main>
        <Footer />
      </div>
      {authModal && <AuthModal mode={authModal} onClose={() => setAuthModal(null)} onSwitch={(mode) => setAuthModal(mode)} />}
    </LandingAuthContext.Provider>
  )
}
