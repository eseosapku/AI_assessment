'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { Calendar } from 'lucide-react'

interface Assessment {
  id: string
  date: string
  subject: string
  topic: string
  grade: string
  score: number
  percentage?: number
  feedback: string
  questions_data?: any[] | null
  answers?: Record<string, string> | null
  longform_grades?: Record<string, any> | null
}

const GRADE_CONFIG: Record<string, { bar: string; text: string; watermark: string; badge: string }> = {
  'A+': { bar: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-400', watermark: 'text-emerald-500/10 dark:text-emerald-400/[0.07]', badge: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/25 dark:text-emerald-400' },
  'A': { bar: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-400', watermark: 'text-emerald-500/10 dark:text-emerald-400/[0.07]', badge: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/25 dark:text-emerald-400' },
  'B+': { bar: 'bg-blue-500', text: 'text-blue-600 dark:text-blue-400', watermark: 'text-blue-500/10 dark:text-blue-400/[0.07]', badge: 'bg-blue-50 text-blue-700 dark:bg-blue-900/25 dark:text-blue-400' },
  'B': { bar: 'bg-blue-500', text: 'text-blue-600 dark:text-blue-400', watermark: 'text-blue-500/10 dark:text-blue-400/[0.07]', badge: 'bg-blue-50 text-blue-700 dark:bg-blue-900/25 dark:text-blue-400' },
  'C': { bar: 'bg-amber-500', text: 'text-amber-600 dark:text-amber-400', watermark: 'text-amber-500/10 dark:text-amber-400/[0.07]', badge: 'bg-amber-50 text-amber-700 dark:bg-amber-900/25 dark:text-amber-400' },
  'D': { bar: 'bg-red-500', text: 'text-red-600 dark:text-red-400', watermark: 'text-red-500/10 dark:text-red-400/[0.07]', badge: 'bg-red-50 text-red-700 dark:bg-red-900/25 dark:text-red-400' },
}

const SCORE_COLOR = (s: number) => s >= 70 ? 'bg-emerald-500' : s >= 50 ? 'bg-amber-500' : 'bg-red-500'
export default function AssessmentCard({ assessment }: { assessment: Assessment }) {
  const cfg = GRADE_CONFIG[assessment.grade] ?? GRADE_CONFIG['D']
  const pct = assessment.percentage ?? assessment.score

  return (
    <Link
      href={`/results/${assessment.id}`}
      className="group relative flex flex-col bg-white dark:bg-[#111115] border border-gray-200/70 dark:border-white/[0.07] rounded-2xl overflow-hidden transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-black/8 dark:hover:shadow-black/40 hover:border-gray-300 dark:hover:border-white/10"
      aria-label={`View results for ${assessment.subject}`}
    >
      <div className={`h-[3px] w-full ${cfg.bar}`} />

      <div className="p-5 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-gray-400 dark:text-gray-600 mb-1.5 truncate">
              {assessment.topic}
            </p>
            <h3 className="text-base font-black text-gray-900 dark:text-white leading-snug">
              {assessment.subject}
            </h3>
          </div>
          <span className={`text-xs font-black px-2 py-1 rounded-lg ${cfg.badge}`}>
            {assessment.grade}
          </span>
        </div>

        <div className="mt-4 flex items-end gap-2">
          <span className="text-3xl font-black tabular-nums text-gray-900 dark:text-white leading-none">{pct}</span>
          <span className="text-sm font-bold text-gray-400 dark:text-gray-600">%</span>
          <span className={`ml-auto text-xs font-semibold ${cfg.text} opacity-80 group-hover:opacity-100`}>
            View details
          </span>
        </div>

        <div className="mt-2 h-1.5 bg-gray-100 dark:bg-white/[0.06] rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.9, ease: 'easeOut' }}
            className={`h-full rounded-full ${SCORE_COLOR(pct)}`}
          />
        </div>

        <div className="mt-4 flex items-center justify-between text-[11px] text-gray-400 dark:text-gray-600">
          <span className="flex items-center gap-1.5">
            <Calendar className="w-3 h-3" />
            {assessment.date}
          </span>
          <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-300 dark:text-gray-600 group-hover:text-blue-500">
            Tap to review
          </span>
        </div>
      </div>
    </Link>
  )
}
