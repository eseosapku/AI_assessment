'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowLeft, Sparkles, Blocks, GraduationCap } from 'lucide-react'
import SignupForm from '@/components/SignupForm'
import ThemeToggle from '@/components/ThemeToggle'
import { Wordmark, BrainInkBadge } from '@/components/Brand'

const HIGHLIGHTS = [
  { icon: Sparkles, title: 'Your first assessments are free', body: 'No card required — start practising in minutes.' },
  { icon: Blocks, title: 'Built for how you learn', body: 'Quizzes, interactive sets and instant AI feedback.' },
  { icon: GraduationCap, title: 'Students and teachers welcome', body: 'Sign up with an email or your school student ID.' },
]

export default function SignupPage() {
  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      {/* ---------------------------------------------------- brand panel (sticky) */}
      <aside className="relative hidden overflow-hidden bg-gradient-to-br from-[#1ec0ef] via-[#0e9fd6] to-[#0a6dba] p-12 text-white lg:flex lg:h-screen lg:flex-col lg:justify-between lg:sticky lg:top-0">
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
            Start studying{' '}
            <span className="text-cyan-100/85">smarter today.</span>
          </motion.h2>

          <ul className="mt-9 space-y-5">
            {HIGHLIGHTS.map((h, i) => (
              <motion.li
                key={h.title}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.45, delay: 0.14 + i * 0.08 }}
                className="flex gap-4"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/25 backdrop-blur-sm">
                  <h.icon className="h-4 w-4 text-white" strokeWidth={2.2} />
                </span>
                <div>
                  <p className="text-sm font-semibold text-white">{h.title}</p>
                  <p className="mt-0.5 text-sm text-white/80">{h.body}</p>
                </div>
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
            <Link href="/" className="mb-8 inline-flex lg:hidden">
              <Wordmark />
            </Link>
            <SignupForm />
          </div>
        </div>
      </section>
    </main>
  )
}
