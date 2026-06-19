'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowLeft, Check, Sparkles, Zap, LineChart } from 'lucide-react'
import LoginForm from '@/components/LoginForm'
import ThemeToggle from '@/components/ThemeToggle'
import { Wordmark, BrainInkBadge } from '@/components/Brand'

const HIGHLIGHTS = [
  { icon: Sparkles, text: 'AI-built assessments in seconds' },
  { icon: Zap, text: 'Instant grading and feedback' },
  { icon: LineChart, text: 'Track mastery across every subject' },
]

export default function LoginPage() {
  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      {/* ---------------------------------------------------- brand panel */}
      <aside className="relative hidden overflow-hidden bg-gradient-to-br from-[#1ec0ef] via-[#0e9fd6] to-[#0a6dba] p-12 text-white lg:flex lg:flex-col lg:justify-between">
        {/* square grid texture */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.14) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.14) 1px, transparent 1px)',
            backgroundSize: '46px 46px',
            maskImage: 'radial-gradient(ellipse 95% 85% at 25% 25%, black 25%, transparent 78%)',
            WebkitMaskImage: 'radial-gradient(ellipse 95% 85% at 25% 25%, black 25%, transparent 78%)',
          }}
        />
        <div className="pointer-events-none absolute -left-24 -top-16 h-96 w-96 rounded-full bg-white/25 blur-[120px]" />
        <div className="pointer-events-none absolute -bottom-24 right-0 h-80 w-80 rounded-full bg-[#7c5cff]/35 blur-[120px]" />

        <div className="relative">
          <Link href="/" className="inline-flex">
            <Wordmark light />
          </Link>
        </div>

        <div className="relative max-w-md">
          <motion.h2
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="font-sans text-[2.6rem] font-bold leading-[1.04] tracking-[-0.02em]"
          >
            Pick up right{' '}
            <span className="text-cyan-100/85">where you left off.</span>
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.08 }}
            className="mt-5 max-w-sm text-[15px] leading-relaxed text-white/85"
          >
            Welcome back to StudySquare — your assessments, study sets and progress
            are right where you need them.
          </motion.p>

          <ul className="mt-9 space-y-3.5">
            {HIGHLIGHTS.map((h, i) => (
              <motion.li
                key={h.text}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.45, delay: 0.16 + i * 0.08 }}
                className="flex items-center gap-3"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/25 backdrop-blur-sm">
                  <h.icon className="h-4 w-4 text-white" strokeWidth={2.2} />
                </span>
                <span className="text-sm font-medium text-white/95">{h.text}</span>
              </motion.li>
            ))}
          </ul>
        </div>

        <div className="relative">
          <BrainInkBadge light />
        </div>
      </aside>

      {/* ---------------------------------------------------- form panel */}
      <section className="relative flex flex-col bg-white dark:bg-[#0a0f1e]">
        {/* soft background accents (mobile + light) */}
        <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-[#13a7df]/8 blur-3xl dark:bg-[#13a7df]/5" />

        <div className="relative flex items-center justify-between px-6 py-5 sm:px-10">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition-colors hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to home
          </Link>
          <ThemeToggle />
        </div>

        <div className="relative flex flex-1 items-center justify-center px-6 pb-12 pt-2 sm:px-10">
          <div className="w-full max-w-sm">
            {/* mobile brand lockup */}
            <Link href="/" className="mb-8 inline-flex lg:hidden">
              <Wordmark />
            </Link>
            <LoginForm />
          </div>
        </div>
      </section>
    </main>
  )
}
