'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { Suspense, useCallback, useEffect, useState, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Clock, ChevronLeft, ChevronRight, Check, Lock, TrendingUp } from 'lucide-react'
import 'katex/dist/katex.min.css'
import { useAuth } from '@/components/AuthProvider'
import FeedbackPanel from '@/components/FeedbackPanel'
import ExamFigure from '@/components/ExamFigure'
import {
  InteractiveQuestionPlayer,
  InteractiveResultCard,
  isInteractiveQuestionType,
} from '@/components/interactive/InteractiveQuestionPlayer'
import { gradeInteractiveQuestion, isInteractiveAnswerComplete } from '@/lib/grade-interactive'
import { isCalculationDemand } from '@/lib/calculation-demand'
import { isCompositionQuestion } from '@/lib/slot-shape'
import { stripPrintedMarks } from '@/lib/demand-variety'
import type { InteractiveAnswer, InteractiveQuestion, InteractiveGrade } from '@/types/interactive'
import { createAiJob, triggerAiJobExecution, waitForAiJob } from '@/lib/client-ai-jobs'
import { LatexText as L } from '@/lib/latex-text'
import type { FigureGroupMeta } from '@/lib/assessment-figure-groups'
import PassageReader from '@/components/exam/PassageReader'
import { pace, marksAttempted } from '@/lib/exam-pacing'
import NextStepsPanel from '@/components/assessment/NextStepsPanel'
import LongformHintPanel from '@/components/assessment/LongformHintPanel'
import { attachLongformHints, studentHintsOf } from '@/lib/longform-hints'
import { repairBookReferences } from '@/lib/book-reference'
import { Modal } from '@/components/ui/Modal'
import {
  summarizeWeakAreas,
  pickProblemAreas,
  creditFromMarks,
  type QuestionOutcome,
} from '@/lib/assessment-weak-areas'
import { checkpointReport } from '@/lib/checkpoint-report'
import { gradeShortAnswer, type ShortAnswerKey } from '@/lib/short-answer'
import { checkpointSubject } from '@/lib/cambridge-checkpoint'
import CheckpointStrandReport, { type CheckpointPaperMeta } from '@/components/CheckpointStrandReport'
import {
  buildRetakePayload,
  rememberRetakeOrigin,
  takeRetakeOrigin,
  CURRENT_ASSESSMENT_KEY,
  type RetakeOrigin,
} from '@/lib/assessment-retake'
import { improvementBetween, describeImprovement } from '@/lib/study-loop'
import { registerViolation, BLUR_GRACE_MS } from '@/lib/assessment-proctor'
import {
  questionState,
  unansweredQuestions,
  unansweredSummary,
  answeredCount,
  type ProgressInput,
} from '@/lib/assessment-progress'
import {
  timerPolicy,
  shouldWarn,
  extendRemaining,
  formatRemaining,
  describeRemaining,
  WARN_AT_SECONDS,
} from '@/lib/assessment-timer'
import {
  readQueue,
  writeQueue,
  upsert,
  removeById,
  shouldRetry,
  nextBackoffMs,
  isRetryableStatus,
  isOnline,
  type PendingSubmission,
} from '@/lib/offline-submission'


const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const PAUSED_ASSESSMENT_KEY = 'pausedAssessmentState'
const RESUME_ASSESSMENT_KEY = 'resumeAssessment'
const USE_ASYNC_AI_JOBS = process.env.NEXT_PUBLIC_USE_ASYNC_AI_JOBS === 'true'

function isUuid(value: string | null | undefined) {
  return UUID_RE.test(String(value ?? ''))
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface MCQQuestion {
  id: number
  type?: 'mcq'
  question: string
  options: string[]
  correct_answer: number
  explanation: string
  passage?: string
  passage_source?: string
  /** The setup this question shares with its siblings, lifted off the stem. */
  scenario?: string
  diagram_svg?: string
  image_url?: string
  figureGroup?: FigureGroupMeta
}

interface LongFormQuestion {
  id: number
  type: 'longform'
  question: string
  marks: number
  /**
   * Present on a one-mark Checkpoint-style answer: a word or a number, marked
   * here against this key instead of by a model. Most of a real Checkpoint
   * paper is these, and sending thirty of them to be graded would be slow and
   * pointless when the answer is "condensation".
   */
  short_answer?: ShortAnswerKey
  marking_criteria: string[]
  hints?: string[]
  model_answer: string
  explanation: string
  passage?: string
  passage_source?: string
  /** The setup this question shares with its siblings, lifted off the stem. */
  scenario?: string
  diagram_svg?: string
  image_url?: string
  figureGroup?: FigureGroupMeta
}

type Question = MCQQuestion | LongFormQuestion | InteractiveQuestion

interface CriterionResult {
  criterion: string
  met: boolean
  relevant_quote: string | null
  note: string
}

interface LongFormGrade {
  marks_awarded: number
  marks_total: number
  criteria_results: CriterionResult[]
  general_feedback: string
}

interface Assessment {
  assessment_id: string
  estimated_time: number
  questions: Question[]
  subject: string
  topics: string[]
  curriculum?: string
  questionType?: string
  /**
   * Present only on a Cambridge Checkpoint component, set by ExamPrepForm.
   * It is what lets the result screen report by strand rather than showing a
   * bare score — which is the difference between Checkpoint practice and a
   * quiz wearing a syllabus code.
   */
  checkpoint?: CheckpointPaperMeta
}

interface PausedAssessmentState {
  assessment: Assessment
  currentQuestion: number
  timeRemaining: number
  selectedAnswers: Record<number, number>
  longFormAnswers: Record<number, string>
  interactiveAnswers: Record<number, InteractiveAnswer>
  pausedAt: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function isLongForm(q: Question): q is LongFormQuestion {
  return q.type === 'longform'
}

/** A written answer short enough to mark by matching rather than by model. */
function isShortAnswer(q: Question): q is LongFormQuestion {
  return q.type === 'longform' && Array.isArray((q as LongFormQuestion).short_answer?.accepted)
}

function isInteractive(q: Question): q is InteractiveQuestion {
  return isInteractiveQuestionType(q)
}

function sanitizeSvg(svg: string): string {
  return svg
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/\son\w+="[^"]*"/gi, '')
    .replace(/\son\w+='[^']*'/gi, '')
    .replace(/javascript:/gi, '')
}

function DiagramSvg({ svg }: { svg: string }) {
  return (
    <div
      className="flex flex-col items-center my-4"
      dangerouslySetInnerHTML={{ __html: sanitizeSvg(svg) }}
    />
  )
}

// A figure reused across several questions is shown as one contiguous set —
// this label makes that relationship visible instead of the image just
// silently reappearing.
function FigureGroupLabel({ group }: { group: FigureGroupMeta }) {
  const start = group.startIndex + 1
  const end = group.endIndex + 1
  return (
    // ss-accent, not apple-blue: #007AFF measures 4.0:1 here, under the
    // 4.5:1 floor, and this line is the only thing telling a learner that the
    // next five questions all hang off one figure.
    <p className="text-xs font-semibold uppercase tracking-wide text-ss-accent mb-2">
      {start === end ? `Question ${start} refers` : `Questions ${start}–${end} refer`} to the figure below
    </p>
  )
}


// Highlight a quote inside the student answer text
function AnnotatedText({
  answer,
  highlight,
  highlightColor,
}: {
  answer: string
  highlight: string | null
  highlightColor: 'green' | 'red' | null
}) {
  if (!highlight || !highlightColor) {
    return <span className="text-gray-800 dark:text-gray-200 text-sm leading-relaxed whitespace-pre-wrap">{answer}</span>
  }

  const idx = answer.toLowerCase().indexOf(highlight.toLowerCase())
  if (idx === -1) {
    return <span className="text-gray-800 dark:text-gray-200 text-sm leading-relaxed whitespace-pre-wrap">{answer}</span>
  }

  const before = answer.slice(0, idx)
  const match = answer.slice(idx, idx + highlight.length)
  const after = answer.slice(idx + highlight.length)
  const bg = highlightColor === 'green'
    ? 'bg-green-200 dark:bg-green-800/60 text-green-900 dark:text-green-100'
    : 'bg-red-200 dark:bg-red-800/60 text-red-900 dark:text-red-100'

  return (
    <span className="text-gray-800 dark:text-gray-200 text-sm leading-relaxed whitespace-pre-wrap">
      {before}
      <mark className={`px-0.5 rounded ${bg}`}>{match}</mark>
      {after}
    </span>
  )
}

// ── Passage / extract display ─────────────────────────────────────────────────

/** Which token each pace state speaks in. Good, neutral, warn, bad. */
const PACE_TOKEN: Record<string, string> = {
  ahead: '--ss-good',
  'on-track': '--ss-slate',
  behind: '--ss-warn',
  'well-behind': '--ss-bad',
  unknown: '--ss-slate',
}

function PassageBox({ passage, source }: { passage: string; source?: string }) {
  const [collapsed, setCollapsed] = useState(false)
  const wordCount = passage.split(/\s+/).filter(Boolean).length

  return (
    <div className="mb-6 rounded-2xl border-2 border-amber-300 dark:border-amber-600/60 bg-amber-50 dark:bg-amber-900/10 overflow-hidden shadow-sm">
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-amber-100 dark:bg-amber-900/30 border-b border-amber-200 dark:border-amber-700/40">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-amber-800 dark:text-amber-300 text-sm font-bold tracking-tight">
            📄 Reading Extract — read carefully before answering
          </span>
          <span className="px-2 py-0.5 rounded-full bg-amber-200 dark:bg-amber-800/50 text-amber-700 dark:text-amber-300 text-xs font-medium">
            ~{wordCount} words
          </span>
        </div>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="text-xs font-medium text-amber-700 dark:text-amber-400 hover:underline flex-shrink-0 ml-3"
        >
          {collapsed ? '▼ Show extract' : '▲ Hide'}
        </button>
      </div>

      {/* Source line */}
      {source && !collapsed && (
        <div className="px-5 pt-3 pb-0">
          <p className="text-xs italic text-amber-600 dark:text-amber-400 border-l-2 border-amber-300 dark:border-amber-600 pl-2">
            {source}
          </p>
        </div>
      )}

      <AnimatePresence>
        {!collapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
          >
            {/* Scrollable passage body — tall enough for 500+ words */}
            <div className="px-5 py-4 max-h-[480px] overflow-y-auto">
              <p className="text-sm sm:text-base text-gray-800 dark:text-gray-200 leading-[1.85] whitespace-pre-wrap font-serif">
                {passage}
              </p>
            </div>
            {/* Footer hint */}
            <div className="px-5 pb-3 text-xs text-amber-600 dark:text-amber-500 italic">
              Scroll up to re-read the extract at any time while answering.
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Long-form result card ──────────────────────────────────────────────────────

function LongFormResultCard({
  q,
  idx,
  studentAnswer,
  grade,
}: {
  q: LongFormQuestion
  idx: number
  studentAnswer: string
  grade: LongFormGrade | undefined
}) {
  const [activeCriterion, setActiveCriterion] = useState<number | null>(null)
  const [showModelAnswer, setShowModelAnswer] = useState(false)

  const isGraded = !!grade
  const overallPass = isGraded && grade.marks_awarded >= Math.ceil(grade.marks_total / 2)

  const activeCrit = activeCriterion !== null ? grade?.criteria_results[activeCriterion] : null
  const highlightQuote = activeCrit?.met ? activeCrit.relevant_quote : null
  const highlightColor = activeCrit?.met ? 'green' : null

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: idx * 0.05 }}
      className={`glass dark:glass-dark rounded-apple p-6 border-l-4 ${!isGraded
        ? 'border-l-gray-400'
        : overallPass
          ? 'border-l-green-500'
          : 'border-l-red-500'
        }`}
    >
      {/* Question header */}
      <div className="flex items-start gap-4 mb-4">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-1 text-sm font-bold ${!isGraded
          ? 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
          : overallPass
            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
            : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
          }`}>
          {isGraded ? `${grade.marks_awarded}/${grade.marks_total}` : '?'}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm text-apple-dark-gray">Question {idx + 1}</span>
            <span className="px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-xs font-semibold">
              Long-form · {q.marks} {q.marks === 1 ? 'mark' : 'marks'}
            </span>
          </div>
          {q.image_url && (!q.figureGroup || idx === q.figureGroup.startIndex) && (
            <>
              {q.figureGroup && <FigureGroupLabel group={q.figureGroup} />}
              <ExamFigure src={q.image_url} lazy />
            </>
          )}
          {q.diagram_svg && (
            <div className="bg-white dark:bg-gray-900 rounded-xl p-3 mb-3 border border-gray-200 dark:border-gray-700 overflow-x-auto">
              <DiagramSvg svg={q.diagram_svg} />
            </div>
          )}
          {q.passage && (
            <PassageBox passage={q.passage} source={q.passage_source} />
          )}
          <h3 className="text-lg font-medium text-gray-900 dark:text-white"><L>{q.question}</L></h3>
        </div>
      </div>

      {/* Student answer with annotation */}
      <div className="ml-12 mb-4">
        <div className="text-xs font-semibold uppercase tracking-wider text-ss-slate mb-2">Your Answer</div>
        <div className="bg-gray-50 dark:bg-gray-800/60 rounded-xl p-4 border border-gray-200 dark:border-gray-700 min-h-[60px]">
          {studentAnswer ? (
            <AnnotatedText
              answer={studentAnswer}
              highlight={highlightQuote ?? null}
              highlightColor={highlightColor}
            />
          ) : (
            <span className="text-ss-slate italic text-sm">You left this one blank</span>
          )}
        </div>
        {activeCrit && (
          <motion.div
            key={activeCriterion}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className={`mt-2 p-3 rounded-xl text-sm border ${activeCrit.met
              ? 'bg-green-50 border-green-200 text-green-800 dark:bg-green-900/20 dark:border-green-800/50 dark:text-green-200'
              : 'bg-red-50 border-red-200 text-red-800 dark:bg-red-900/20 dark:border-red-800/50 dark:text-red-200'
              }`}
          >
            <span className="font-semibold">{activeCrit.met ? '✓ Criterion met:' : '✗ Criterion missed:'}</span>{' '}
            {activeCrit.note}
            {activeCrit.met && activeCrit.relevant_quote && (
              <div className="mt-1 text-xs opacity-75">Found in what you wrote</div>
            )}
          </motion.div>
        )}
      </div>

      {/* Criteria checklist */}
      {isGraded && (
        <div className="ml-12 mb-4">
          <div className="text-xs font-semibold uppercase tracking-wider text-ss-slate mb-2">
            Marking Criteria — click any to see why
          </div>
          <div className="space-y-2">
            {grade.criteria_results.map((cr, crIdx) => (
              <motion.button
                key={crIdx}
                onClick={() => setActiveCriterion(activeCriterion === crIdx ? null : crIdx)}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                className={`w-full text-left flex items-start gap-2 p-2.5 rounded-xl border transition-all cursor-pointer ${activeCriterion === crIdx
                  ? cr.met
                    ? 'border-green-400 bg-green-50 dark:bg-green-900/20 dark:border-green-700'
                    : 'border-red-400 bg-red-50 dark:bg-red-900/20 dark:border-red-700'
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 bg-white dark:bg-gray-800/40'
                  }`}
              >
                <span className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold mt-0.5 ${cr.met
                  ? 'bg-green-500 text-white'
                  : 'bg-red-500 text-white'
                  }`}>
                  {cr.met ? '✓' : '✗'}
                </span>
                <span className="text-sm text-gray-700 dark:text-gray-300 flex-1">{cr.criterion}</span>
                <span className="text-xs text-ss-slate flex-shrink-0 mt-0.5">tap</span>
              </motion.button>
            ))}
          </div>

          {/* AI general feedback */}
          {grade.general_feedback && (
            <div className="mt-3 p-3 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/30 text-sm text-blue-800 dark:text-blue-200">
              <span className="font-semibold">AI Feedback: </span>{grade.general_feedback}
            </div>
          )}
        </div>
      )}

      {!isGraded && (
        <div className="ml-12 mb-4 flex items-center gap-2 text-sm text-gray-500">
          <div className="animate-spin rounded-full h-3 w-3 border-t-2 border-b-2 border-gray-400"></div>
          Grading in progress...
        </div>
      )}

      {/* Model answer toggle */}
      <div className="ml-12">
        <button
          onClick={() => setShowModelAnswer(!showModelAnswer)}
          className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
        >
          {showModelAnswer ? 'Hide model answer' : 'Show model answer'}
        </button>
        <AnimatePresence>
          {showModelAnswer && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-2 bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 text-sm text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700"
            >
              <div className="font-semibold text-gray-900 dark:text-gray-100 mb-1">Model Answer</div>
              <p className="leading-relaxed">{q.model_answer}</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}

// ── Client-side MCQ answer validator ───────────────────────────────────────────
// Mirrors the server-side validator so old assessments loaded from sessionStorage
// also get corrected. Explanation-first strategy is most reliable.
function fixMcqAnswers(questions: Question[]): void {
  for (const q of questions) {
    if (isLongForm(q) || isInteractive(q)) continue
    const mcq = q as MCQQuestion
    if (!Array.isArray(mcq.options) || mcq.options.length !== 4) continue
    const ci = Number(mcq.correct_answer)
    if (isNaN(ci) || ci < 0 || ci > 3) mcq.correct_answer = 0

    // Skip when options are sequences (e.g. "3, 5, 8, 12") — stripping commas gives
    // a bare number that wrongly matches a single-value option.
    if (mcq.options.some(o => String(o).includes(','))) continue

    // Skip when options are arithmetic expressions like "5+5" or "3+7".
    if (mcq.options.some(o => /[+\-×÷\/]/.test(String(o)))) continue

    // ── Strategy 1: deterministic arithmetic from question text ───────────────
    const t = (mcq.question || '').replace(/\$+/g, '').trim()
    let computed: number | null = null

    const a = t.match(/(\d+)\s*\+\s*(\d+)\s*=?\s*\?/)
    if (a) computed = +a[1] + +a[2]
    if (computed === null) { const s = t.match(/(\d+)\s*[-−]\s*(\d+)\s*=?\s*\?/); if (s) computed = +s[1] - +s[2] }
    if (computed === null) { const m = t.match(/(\d+)\s*[×x*]\s*(\d+)\s*=?\s*\?/); if (m) computed = +m[1] * +m[2] }
    if (computed === null) {
      const addNoQ = t.match(/(?:what\s+is|calculate|find|solve)[:\s]*(-?\d+)\s*\+\s*(-?\d+)/i)
        || t.match(/^\s*(-?\d+)\s*\+\s*(-?\d+)\s*$/)
      if (addNoQ) computed = +addNoQ[1] + +addNoQ[2]
    }
    if (computed === null) {
      const subNoQ = t.match(/(?:what\s+is|calculate|find|solve)[:\s]*(-?\d+)\s*[-−]\s*(-?\d+)/i)
        || t.match(/^\s*(-?\d+)\s*[-−]\s*(-?\d+)\s*$/)
      if (subNoQ) computed = +subNoQ[1] - +subNoQ[2]
    }
    if (computed === null) {
      const ma = t.match(/(\d+)\s*\+\s*\?\s*=\s*(\d+)/) || t.match(/\?\s*\+\s*(\d+)\s*=\s*(\d+)/)
      if (ma) computed = +ma[2] - +ma[1]
    }
    if (computed === null) {
      // "same sum: A+B and C+?" → (A+B) - C
      const ss = t.match(/(\d+)\s*\+\s*(\d+)\s+and\s+(\d+)\s*\+\s*\?/i)
      if (ss) computed = (+ss[1] + +ss[2]) - +ss[3]
    }
    if (computed === null) { const bf = t.match(/bond\s+to\s+(\d+)\s+for\s+(\d+)/i); if (bf) computed = +bf[1] - +bf[2] }
    if (computed === null) { const aft = t.match(/(?:comes?|right)\s+after\s+(\d+)/i); if (aft) computed = +aft[1] + 1 }
    if (computed === null) { const bef = t.match(/(?:comes?|right)\s+before\s+(\d+)/i); if (bef) { const v = +bef[1] - 1; if (v >= 0) computed = v } }
    if (computed === null) { const df = t.match(/difference\s+between\s+(\d+)\s+and\s+(\d+)/i); if (df) computed = Math.abs(+df[1] - +df[2]) }
    if (computed === null) {
      const sw = t.match(/(\d+)\s+(?:\w+\s+){0,8}(?:take\s+away|give[s]?(?:\s+away)?|subtract[s]?|minus|remove[s]?)\s+(\d+)/i)
      if (sw) computed = +sw[1] - +sw[2]
    }
    if (computed === null) {
      const sumOf = t.match(/(?:sum|total)\s+of\s+(\d+)\s+and\s+(\d+)/i)
      if (sumOf) computed = +sumOf[1] + +sumOf[2]
    }
    if (computed === null) {
      const prodOf = t.match(/product\s+of\s+(\d+)\s+and\s+(\d+)/i)
      if (prodOf) computed = +prodOf[1] * +prodOf[2]
    }
    if (computed === null) {
      const aw = t.match(/(?:combining|adding)\s+(\d+)\s+and\s+(\d+)/i)
        || t.match(/(\d+)\s+(?:\w+\s+){0,8}(?:add[s]?\s+(\d+)\s+more|get[s]?\s+(\d+)\s+more|and\s+(\d+)\s+more|plus\s+(\d+))/i)
        || t.match(/have\s+(\d+)\s+(?:\w+\s+){0,6}add[s]?\s+(\d+)/i)
      if (aw) { const b = Number(aw[2] || aw[3] || aw[4]); if (Number.isFinite(b)) computed = +aw[1] + b }
    }

    if (computed !== null && Number.isFinite(computed)) { applyPatch(mcq, computed); continue }

    // ── Strategy 2: extract answer value from explanation text ────────────────
    // Prefer explicit final-answer phrases; only use arithmetic equations as a guarded fallback.
    if (mcq.explanation) {
      const expl = mcq.explanation.replace(/\$+/g, '').replace(/[−–]/g, '-')
      const finalPats = [
        /(?:therefore|thus|so|hence)[,\s]+(?:the\s+)?(?:correct\s+)?answer\s+is\s+(?:[A-D]:\s*)?(-?\d+(?:\.\d+)?)/i,
        /(?:the\s+)?(?:only\s+)?correct\s+answer\s+is\s+(?:[A-D]:\s*)?(-?\d+(?:\.\d+)?)/i,
        /(?:final\s+)?answer\s*(?:is|:)\s*(-?\d+(?:\.\d+)?)/i,
        /the\s+(?:result|sum|total|difference|product|answer)\s+is\s+(-?\d+(?:\.\d+)?)/i,
        /missing\s+number\s+is\s+(-?\d+(?:\.\d+)?)/i,
        /(?:sum|total)\s+of\s+\d+\s+and\s+\d+\s+is\s+(-?\d+)/i,
      ]
      for (const p of finalPats) {
        const m = expl.match(p)
        if (m) { const v = Number(m[1]); if (Number.isFinite(v)) { applyPatch(mcq, v); break } }
      }

      // Guarded arithmetic fallback: only when there's one equation, or when an
      // equation matches the question's own direct expression operands/operator.
      const eqRe = /(-?\d+(?:\.\d+)?)\s*([+\-×*÷\/])\s*(-?\d+(?:\.\d+)?)\s*=\s*(-?\d+(?:\.\d+)?)/g
      const eqs: Array<{ a: number; b: number; op: string; r: number }> = []
      let em: RegExpExecArray | null
      while ((em = eqRe.exec(expl)) !== null) {
        const aNum = Number(em[1]); const bNum = Number(em[3]); const rNum = Number(em[4])
        if (Number.isFinite(aNum) && Number.isFinite(bNum) && Number.isFinite(rNum)) {
          eqs.push({ a: aNum, b: bNum, op: em[2], r: rNum })
        }
      }

      if (eqs.length === 1) {
        applyPatch(mcq, eqs[0].r)
      } else if (eqs.length > 1) {
        const qExpr = t.match(/(-?\d+(?:\.\d+)?)\s*([+\-−×x*÷\/])\s*(-?\d+(?:\.\d+)?)/)
        if (qExpr) {
          const qa = Number(qExpr[1]); const qb = Number(qExpr[3])
          const qop = qExpr[2] === '−' ? '-' : qExpr[2] === '×' || qExpr[2] === 'x' ? '*' : qExpr[2] === '÷' ? '/' : qExpr[2]
          const matched = eqs.find((e) => {
            const eop = e.op === '−' ? '-' : e.op === '×' ? '*' : e.op === '÷' ? '/' : e.op
            if (eop !== qop) return false
            if (qop === '+' || qop === '*') return (e.a === qa && e.b === qb) || (e.a === qb && e.b === qa)
            return e.a === qa && e.b === qb
          })
          if (matched) applyPatch(mcq, matched.r)
        }
      }
    }
  }
}

function applyPatch(q: MCQQuestion, expected: number): void {
  if (!Number.isFinite(expected)) return
  const optNum = (o: string) => Number(o.replace(/[^0-9.\-]/g, ''))
  if (optNum(String(q.options[q.correct_answer])) === expected) return
  const idx = q.options.findIndex(o => optNum(String(o)) === expected)
  if (idx !== -1) {
    q.correct_answer = idx
  } else {
    // Correct answer is not in options at all — replace the marked slot with the right value
    q.options[q.correct_answer] = String(expected)
  }
}

// ── Main component ─────────────────────────────────────────────────────────────

function AssessmentLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-apple-blue mx-auto mb-4"></div>
        <p className="text-apple-dark-gray">Getting your quiz ready…</p>
      </div>
    </div>
  )
}

function AssessmentPageClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user: authUser } = useAuth()
  const assignmentParam = searchParams.get('assignment') || searchParams.get('assignment_id')
  const retakeParam = searchParams.get('retake')
  const isClassroomAssignment = Boolean(assignmentParam)
  // A teacher-set assignment keeps its timing; a practice quiz must not.
  const timerControls = timerPolicy(Boolean(assignmentParam))
  const [assessment, setAssessment] = useState<Assessment | null>(null)
  const [assignmentId, setAssignmentId] = useState<string | null>(null)
  const [loadError, setLoadError] = useState('')
  const [currentQuestion, setCurrentQuestion] = useState(0)
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({})
  const [longFormAnswers, setLongFormAnswers] = useState<Record<number, string>>({})
  const [interactiveAnswers, setInteractiveAnswers] = useState<Record<number, InteractiveAnswer>>({})
  const [interactiveGrades, setInteractiveGrades] = useState<Record<number, InteractiveGrade>>({})
  /**
   * Questions the learner has marked to come back to.
   *
   * Every real exam has this and the runner did not. Without it the only
   * way to leave a hard question and find it again on a forty-question
   * paper is to remember its number.
   */
  const [flagged, setFlagged] = useState<Record<number, boolean>>({})
  /** The paper's topic list, shown on request rather than truncated. */
  const [topicsOpen, setTopicsOpen] = useState(false)
  /**
   * The question strip, on a phone only.
   *
   * Forty buttons in a wrapping row is one line on a laptop and five on a
   * phone — about 190px of jump targets stacked above a sign-in banner and a
   * timer that wraps to two rows of its own. Walked at 400px, the first screen
   * of a forty-question paper was entirely chrome: no question text, not even
   * the question number, without scrolling.
   *
   * So on a small screen it starts closed behind a one-line summary, and on
   * `sm` and up it is always open and this state is not consulted at all.
   */
  const [navOpen, setNavOpen] = useState(false)
  /** The not-signed-in note, hidden for this sitting once acknowledged. */
  const [unsavedHidden, setUnsavedHidden] = useState(false)
  const [timeRemaining, setTimeRemaining] = useState(0)
  const [isPaused, setIsPaused] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [showResults, setShowResults] = useState(false)
  // Claimed once, when the paper loads — the comparison belongs to this
  // attempt and must not survive into the next one.
  const [retakeOrigin, setRetakeOrigin] = useState<RetakeOrigin | null>(null)
  useEffect(() => {
    setRetakeOrigin(takeRetakeOrigin())
  }, [])
  const [isRetaking, setIsRetaking] = useState(false)
  const [results, setResults] = useState<any>(null)
  const [feedback, setFeedback] = useState<string>('')
  const [isGeneratingFeedback, setIsGeneratingFeedback] = useState(false)
  const [longFormGrades, setLongFormGrades] = useState<Record<number, LongFormGrade>>({})
  const [isGradingLongForm, setIsGradingLongForm] = useState(false)
  const [strictMode, setStrictMode] = useState(false)
  const [hintsEnabled, setHintsEnabled] = useState(true)
  const [violationCount, setViolationCount] = useState(0)
  const [submissionReason, setSubmissionReason] = useState<'manual' | 'timer' | 'violation'>('manual')
  // Mirrors violationCount for the event listeners, which are registered once
  // and would otherwise close over a stale count.
  const violationCountRef = useRef(0)
  const [violationNotice, setViolationNotice] = useState<string | null>(null)
  const [offline, setOffline] = useState(false)
  const [pendingSync, setPendingSync] = useState(false)
  const [limitDisabled, setLimitDisabled] = useState(false)
  const [unsavedReason, setUnsavedReason] = useState<'not-signed-in' | null>(null)
  // Which questions have been landed on, so "walked past and left blank" can be
  // told apart from "not reached yet".
  const [visited, setVisited] = useState<Set<number>>(() => new Set([0]))
  const [showUnansweredCheck, setShowUnansweredCheck] = useState(false)

  const prepareAssessment = (assessmentData: Assessment) => {
    if (Array.isArray(assessmentData.questions)) {
      // Papers generated before the pipeline learned to strip these are still
      // in the database and still being re-served — "Use the diagram on page
      // 286 to support your explanation", to a student with no page 286. Only
      // the wording is repaired here, never the count: a stored paper's answers
      // are keyed by position, so removing a question would misalign them.
      // Runs before the hints are built, so they are built from clean criteria.
      repairBookReferences(assessmentData.questions as { question?: unknown }[])

      assessmentData.questions.forEach((q: Question, i) => {
        if (isLongForm(q)) {
          // Assignment start already stripped hints when the teacher turned them off.
          // Do not rebuild them from the mark scheme.
          if (!isClassroomAssignment || Array.isArray((q as LongFormQuestion).hints)) {
            assessmentData.questions[i] = attachLongformHints(q) as Question
          }
          return
        }
        if (!isInteractive(q)) {
          q.question = q.question.replace(/\s*[\(\[]\s*[Aa]\s*[\)\]]\s*[\s\S]*$/, '').trim()
          q.question = q.question.replace(/\$\?\$/g, '?')
        }
      })
      fixMcqAnswers(assessmentData.questions)
    }
    return assessmentData
  }

  const readPausedState = () => {
    try {
      const raw = localStorage.getItem(PAUSED_ASSESSMENT_KEY)
      if (!raw) return null
      const parsed = JSON.parse(raw) as PausedAssessmentState
      if (!parsed?.assessment || !Array.isArray(parsed.assessment.questions)) return null
      return parsed
    } catch {
      return null
    }
  }

  const clearPausedState = useCallback(() => {
    localStorage.removeItem(PAUSED_ASSESSMENT_KEY)
    sessionStorage.removeItem(RESUME_ASSESSMENT_KEY)
  }, [])

  useEffect(() => {
    const load = async () => {
      if (assessment) return
      if (assignmentParam && assignmentId) return
      setLoadError('')

      if (assignmentParam) {
        if (!authUser?.id && !authUser?.email) return
        try {
          const res = await fetch(`/api/assignments/${assignmentParam}/start`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              student_id: isUuid(authUser?.id) ? authUser?.id : null,
              student_email: authUser?.email ?? null,
            }),
          })
          const json = await res.json()
          if (!res.ok) throw new Error(json.error || 'Failed to load assignment')
          const data = prepareAssessment(json.data as Assessment)
          setAssessment(data)
          setAssignmentId(assignmentParam)
          setTimeRemaining(data.estimated_time * 60)
          if (json.data?.strict_mode) setStrictMode(true)
          setHintsEnabled(json.data?.hints_enabled !== false)
          return
        } catch (err: any) {
          setLoadError(err?.message || 'Failed to load assignment')
          return
        }
      }

      // Retake from a result card: the card carries only a result id, so the
      // paper is fetched here. Takes priority over any stored paper — the
      // student explicitly asked for this one.
      if (retakeParam) {
        try {
          const res = await fetch(
            `/api/results/${encodeURIComponent(retakeParam)}${authUser?.id ? `?user_id=${encodeURIComponent(authUser.id)}` : ''}`,
          )
          const json = await res.json()
          if (!res.ok) throw new Error(json?.error || 'Could not load that quiz')
          const row = json?.data
          const payload = buildRetakePayload({
            assessment_id: row?.assessment_id,
            subject: row?.assessments?.subject,
            questions: row?.assessments?.questions_data,
          })
          if (!payload) throw new Error('That quiz can no longer be retaken.')
          sessionStorage.setItem(CURRENT_ASSESSMENT_KEY, JSON.stringify(payload))
          // prepareAssessment does the same normalisation/validation applied to
          // a paper restored from sessionStorage, so the stored questions are
          // checked rather than trusted.
          const prepared = prepareAssessment(payload as unknown as Assessment)
          setAssessment(prepared)
          setTimeRemaining(prepared.estimated_time * 60)
          return
        } catch (err: any) {
          setLoadError(err?.message || 'Could not load that quiz')
          return
        }
      }

      const resumeRequested = sessionStorage.getItem(RESUME_ASSESSMENT_KEY) === 'true'
      if (resumeRequested) sessionStorage.removeItem(RESUME_ASSESSMENT_KEY)

      const stored = sessionStorage.getItem('currentAssessment')
      if (!resumeRequested && stored) {
        const assessmentData = prepareAssessment(JSON.parse(stored))
        setAssessment(assessmentData)
        setTimeRemaining(assessmentData.estimated_time * 60)
        return
      }

      const paused = readPausedState()
      if (paused) {
        const assessmentData = prepareAssessment(paused.assessment)
        setAssessment(assessmentData)
        setTimeRemaining(Number.isFinite(paused.timeRemaining)
          ? paused.timeRemaining
          : assessmentData.estimated_time * 60)
        setSelectedAnswers(paused.selectedAnswers ?? {})
        setLongFormAnswers(paused.longFormAnswers ?? {})
        setInteractiveAnswers(paused.interactiveAnswers ?? {})
        const safeIndex = Math.min(
          Math.max(Number(paused.currentQuestion) || 0, 0),
          Math.max(assessmentData.questions.length - 1, 0)
        )
        setCurrentQuestion(safeIndex)
        setIsPaused(false)
        return
      }

      if (stored) {
        const assessmentData = prepareAssessment(JSON.parse(stored))
        setAssessment(assessmentData)
        setTimeRemaining(assessmentData.estimated_time * 60)
        return
      }

      router.push('/')
    }

    load()
  }, [assignmentParam, assignmentId, retakeParam, authUser, router, assessment])

  const handleAnswerSelect = (optionIndex: number) => {
    setSelectedAnswers({ ...selectedAnswers, [currentQuestion]: optionIndex })
  }

  const handleLongFormChange = (text: string) => {
    setLongFormAnswers({ ...longFormAnswers, [currentQuestion]: text })
  }

  const handleInteractiveChange = (answer: InteractiveAnswer) => {
    setInteractiveAnswers({ ...interactiveAnswers, [currentQuestion]: answer })
  }

  // One definition of "answered" for every question type, shared by the
  // progress bar, the number strip and the pre-submit check — so the strip can
  // never disagree with the button.
  const isAnswered = (q: Question, idx: number): boolean => {
    if (isLongForm(q)) return (longFormAnswers[idx] || '').trim().length > 0
    if (isInteractive(q)) return isInteractiveAnswerComplete(q, interactiveAnswers[idx])
    return selectedAnswers[idx] !== undefined
  }
  const answeredSet = new Set<number>(
    (assessment?.questions ?? []).map((q, idx) => (isAnswered(q, idx) ? idx : -1)).filter((i) => i >= 0),
  )
  const allAnswered = (assessment?.questions.length ?? 0) > 0 && answeredSet.size === assessment!.questions.length

  const handlePause = () => {
    if (isClassroomAssignment || !assessment) return
    const payload: PausedAssessmentState = {
      assessment,
      currentQuestion,
      timeRemaining,
      selectedAnswers,
      longFormAnswers,
      interactiveAnswers,
      pausedAt: new Date().toISOString(),
    }
    localStorage.setItem(PAUSED_ASSESSMENT_KEY, JSON.stringify(payload))
    sessionStorage.removeItem('currentAssessment')
    setIsPaused(true)
    router.push('/')
  }

  const handleQuit = () => {
    if (isClassroomAssignment) return
    sessionStorage.removeItem('currentAssessment')
    clearPausedState()
    router.push('/')
  }

  const downloadReport = () => {
    if (!assessment || !results) return
    const date = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })
    const safeSubject = assessment.subject.replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '')
    const dateStamp = new Date().toISOString().slice(0, 10)
    const reportTitle = `${safeSubject || 'Assessment'}_Report_${dateStamp}`
    const optionLabels = ['A', 'B', 'C', 'D']

    const questionsHtml = assessment.questions.map((q, idx) => {
      if (isLongForm(q)) {
        const lf = q as LongFormQuestion
        const grade = longFormGrades[idx]
        const studentAnswer = longFormAnswers[idx] || ''
        const marksLabel = grade ? `${grade.marks_awarded}/${grade.marks_total}` : `?/${lf.marks}`

        const criteriaRows = grade
          ? grade.criteria_results.map(cr => `
              <tr>
                <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;">${cr.met ? '✓' : '✗'}</td>
                <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;color:${cr.met ? '#15803d' : '#b91c1c'};">${cr.criterion}</td>
                <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;color:#6b7280;font-size:13px;">${cr.note}</td>
              </tr>`).join('')
          : ''

        const passageHtml = lf.passage ? `
          <div style="background:#fffbeb;border:1px solid #fcd34d;border-radius:8px;padding:14px 18px;margin-bottom:14px;">
            <div style="font-size:12px;font-weight:700;color:#92400e;margin-bottom:6px;text-transform:uppercase;letter-spacing:.05em;">Reading Passage${lf.passage_source ? ` — ${lf.passage_source}` : ''}</div>
            <p style="font-size:14px;line-height:1.75;color:#374151;white-space:pre-wrap;font-family:Georgia,serif;">${lf.passage}</p>
          </div>` : ''

        return `
          <div style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:24px;margin-bottom:20px;border-left:4px solid ${grade && grade.marks_awarded >= Math.ceil(grade.marks_total / 2) ? '#22c55e' : '#ef4444'};">
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">
              <span style="background:#f3e8ff;color:#7c3aed;font-size:12px;font-weight:700;padding:3px 10px;border-radius:99px;">Q${idx + 1} · Long-form · ${lf.marks} marks</span>
              <span style="font-weight:700;font-size:15px;color:${grade && grade.marks_awarded >= Math.ceil(grade.marks_total / 2) ? '#15803d' : '#b91c1c'};">${marksLabel} marks awarded</span>
            </div>
            ${passageHtml}
            <p style="font-size:16px;font-weight:600;color:#111827;margin-bottom:14px;">${lf.question}</p>
            <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:14px 18px;margin-bottom:14px;">
              <div style="font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px;">Your Answer</div>
              <p style="font-size:14px;line-height:1.8;color:#374151;white-space:pre-wrap;">${studentAnswer || '<em style="color:#9ca3af;">You left this one blank.</em>'}</p>
            </div>
            ${criteriaRows ? `
            <div style="margin-bottom:14px;">
              <div style="font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px;">What the marks were for</div>
              <table style="width:100%;border-collapse:collapse;font-size:14px;">
                <thead><tr style="background:#f3f4f6;">
                  <th style="padding:6px 10px;text-align:left;width:30px;"></th>
                  <th style="padding:6px 10px;text-align:left;">Criterion</th>
                  <th style="padding:6px 10px;text-align:left;">Note</th>
                </tr></thead>
                <tbody>${criteriaRows}</tbody>
              </table>
            </div>` : ''}
            ${grade?.general_feedback ? `
            <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:12px 16px;margin-bottom:14px;">
              <span style="font-weight:700;color:#1d4ed8;">AI Feedback: </span><span style="color:#1e40af;font-size:14px;">${grade.general_feedback}</span>
            </div>` : ''}
            <details style="margin-top:8px;">
              <summary style="cursor:pointer;font-size:13px;color:#3b82f6;font-weight:600;">Show a full-mark answer</summary>
              <div style="background:#f9fafb;border-radius:8px;padding:12px 16px;margin-top:8px;font-size:14px;color:#374151;line-height:1.7;">${lf.model_answer}</div>
            </details>
          </div>`
      }

      if (isInteractive(q)) {
        const grade = interactiveGrades[idx] ?? gradeInteractiveQuestion(q, interactiveAnswers[idx])
        const itemRows = grade.item_results.map((r) => `
              <li style="color:${r.correct ? '#15803d' : '#b91c1c'};">${r.correct ? '✓' : '✗'} ${r.label}</li>`).join('')
        return `
          <div style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:20px;margin-bottom:16px;border-left:4px solid ${grade.marks_awarded >= grade.marks_total / 2 ? '#22c55e' : '#ef4444'};">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
              <span style="background:#ccfbf1;color:#0f766e;font-size:12px;font-weight:700;padding:3px 10px;border-radius:99px;">Q${idx + 1} · Interactive · ${q.kind}</span>
              <span style="font-weight:700;">${grade.marks_awarded}/${grade.marks_total} marks</span>
            </div>
            <p style="font-size:15px;font-weight:600;color:#111827;margin-bottom:12px;">${q.question}</p>
            <ul style="font-size:13px;margin-bottom:12px;padding-left:18px;">${itemRows}</ul>
            ${q.explanation ? `<div style="margin-top:10px;padding:10px 14px;background:#f0f9ff;border-radius:8px;font-size:13px;"><strong>Explanation:</strong> ${q.explanation}</div>` : ''}
          </div>`
      }

      // MCQ
      const mcq = q as any
      const userAnswer = results.answers[idx]
      const isCorrect = userAnswer === mcq.correct_answer
      const optionsHtml = mcq.options.map((opt: string, oi: number) => {
        let bg = '#f9fafb', border = '#e5e7eb', color = '#374151'
        if (oi === mcq.correct_answer) { bg = '#f0fdf4'; border = '#86efac'; color = '#166534' }
        else if (oi === userAnswer && !isCorrect) { bg = '#fef2f2'; border = '#fca5a5'; color = '#991b1b' }
        return `<div style="padding:10px 14px;border:1px solid ${border};border-radius:8px;background:${bg};color:${color};margin-bottom:6px;font-size:14px;">
          <strong>${optionLabels[oi]}.</strong> ${opt}${oi === mcq.correct_answer ? ' <span style="font-size:12px;font-weight:700;">✓ Correct</span>' : ''}${oi === userAnswer && !isCorrect ? ' <span style="font-size:12px;font-weight:700;">← Your answer</span>' : ''}
        </div>`
      }).join('')

      return `
        <div style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:20px;margin-bottom:16px;border-left:4px solid ${isCorrect ? '#22c55e' : '#ef4444'};">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
            <span style="background:#dbeafe;color:#1d4ed8;font-size:12px;font-weight:700;padding:3px 10px;border-radius:99px;">Q${idx + 1} · MCQ</span>
            <span style="font-weight:700;color:${isCorrect ? '#15803d' : '#b91c1c'};">${isCorrect ? '✓ Correct' : '✗ Incorrect'}</span>
          </div>
          <p style="font-size:15px;font-weight:600;color:#111827;margin-bottom:12px;">${mcq.question}</p>
          ${optionsHtml}
          ${mcq.explanation ? `<div style="margin-top:10px;padding:10px 14px;background:#f0f9ff;border-radius:8px;font-size:13px;color:#0369a1;"><strong>Explanation:</strong> ${mcq.explanation}</div>` : ''}
        </div>`
    }).join('')

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${reportTitle}</title>
  <style>
    @page { size: A4; margin: 14mm; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f9fafb; margin: 0; padding: 0; color: #111827; }
    .page { max-width: 860px; margin: 0 auto; padding: 40px 24px; }
    @media print {
      body { background: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .page { padding: 20px; }
      details { display: block; }
      details summary { display: none; }
    }
  </style>
</head>
<body>
<div class="page">
  <div style="background:linear-gradient(135deg,#1d4ed8,#7c3aed);color:#fff;border-radius:16px;padding:32px;margin-bottom:28px;">
    <h1 style="margin:0 0 6px;font-size:26px;font-weight:800;">${assessment.subject}</h1>
    <p style="margin:0 0 4px;opacity:.85;font-size:15px;">${assessment.topics?.join(', ')}</p>
    <p style="margin:0;opacity:.7;font-size:13px;">${date}</p>
    ${results.score !== null ? `
    <div style="display:flex;gap:40px;margin-top:24px;">
      <div><div style="font-size:48px;font-weight:900;line-height:1;">${results.score}%</div><div style="font-size:12px;opacity:.8;text-transform:uppercase;letter-spacing:.05em;">Score</div></div>
      <div style="width:1px;background:rgba(255,255,255,.3);"></div>
      <div><div style="font-size:48px;font-weight:900;line-height:1;">${results.grade}</div><div style="font-size:12px;opacity:.8;text-transform:uppercase;letter-spacing:.05em;">Grade</div></div>
      ${results.mcqTotal > 0 ? `<div style="width:1px;background:rgba(255,255,255,.3);"></div><div><div style="font-size:24px;font-weight:700;line-height:1;">${results.mcqCorrect}/${results.mcqTotal}</div><div style="font-size:12px;opacity:.8;text-transform:uppercase;letter-spacing:.05em;">MCQ</div></div>` : ''}
      ${results.longFormTotal > 0 ? `<div style="width:1px;background:rgba(255,255,255,.3);"></div><div><div style="font-size:24px;font-weight:700;line-height:1;">${results.longFormMarksEarned}/${results.longFormTotal}</div><div style="font-size:12px;opacity:.8;text-transform:uppercase;letter-spacing:.05em;">Written</div></div>` : ''}
    </div>` : ''}
  </div>

  ${feedback ? `
  <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:12px;padding:24px;margin-bottom:28px;">
    <h2 style="margin:0 0 12px;font-size:17px;font-weight:700;color:#1e40af;">✨ AI Feedback</h2>
    <div style="font-size:14px;line-height:1.8;color:#1e3a8a;white-space:pre-wrap;">${feedback}</div>
  </div>` : ''}

  <h2 style="font-size:20px;font-weight:800;margin-bottom:16px;">Every question, and why</h2>
  ${questionsHtml}

  <div style="text-align:center;margin-top:40px;padding-top:20px;border-top:1px solid #e5e7eb;font-size:12px;color:#9ca3af;">
    Generated by AI Assessment Platform · ${date}
  </div>
</div>
</body>
</html>`

    const blob = new Blob([html], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const win = window.open(url, '_blank')
    if (!win) {
      URL.revokeObjectURL(url)
      return
    }
    win.addEventListener('load', () => {
      try {
        win.document.title = reportTitle
        win.focus()
        win.print()
      } finally {
        setTimeout(() => URL.revokeObjectURL(url), 30000)
      }
    })
  }

  const handleSubmit = useCallback(async () => {
    setIsSubmitted(true)

    if (!isClassroomAssignment) {
      clearPausedState()
      sessionStorage.removeItem('currentAssessment')
    }

    const questions = assessment?.questions ?? []

    // Grade interactive questions (deterministic, instant)
    const interactiveGradesResult: Record<number, InteractiveGrade> = {}
    let interactiveEarned = 0
    let interactiveTotal = 0
    questions.forEach((q, idx) => {
      if (isInteractive(q)) {
        const grade = gradeInteractiveQuestion(q, interactiveAnswers[idx])
        interactiveGradesResult[idx] = grade
        interactiveEarned += grade.marks_awarded
        interactiveTotal += grade.marks_total
      }
    })
    setInteractiveGrades(interactiveGradesResult)

    // Calculate MCQ marks
    let mcqCorrect = 0
    let mcqTotal = 0
    questions.forEach((q, idx) => {
      if (!isLongForm(q) && !isInteractive(q)) {
        mcqTotal++
        if (selectedAnswers[idx] === q.correct_answer) mcqCorrect++
      }
    })

    const hasLongForm = questions.some(isLongForm)
    const longFormTotal = questions.filter(isLongForm).reduce((sum, q) => sum + (q as LongFormQuestion).marks, 0)
    const hasInteractive = questions.some(isInteractive)

    // Show results immediately (long-form grades come in async)
    const preliminaryResult = {
      assessment_id: assessment?.assessment_id,
      mcqCorrect,
      mcqTotal,
      interactiveEarned,
      interactiveTotal,
      longFormMarksEarned: 0,
      longFormTotal,
      score: mcqTotal > 0 && !hasLongForm && !hasInteractive ? Math.round((mcqCorrect / mcqTotal) * 100) : null,
      grade: '',
      answers: selectedAnswers,
      longFormAnswers,
      interactiveAnswers,
      completed_at: new Date().toISOString(),
    }

    setResults(preliminaryResult)
    setShowResults(true)
    setIsSubmitted(false)

    // Mark the short answers here, before anything is sent anywhere. A word
    // or a number is checked against the question's own key in microseconds;
    // only the questions that really need reading go to the model below.
    const longFormGradesResult: Record<number, LongFormGrade> = {}
    questions.forEach((q, idx) => {
      if (!isShortAnswer(q)) return
      const verdict = gradeShortAnswer(longFormAnswers[idx], q.short_answer!)
      longFormGradesResult[idx] = {
        marks_awarded: verdict.correct ? q.marks : 0,
        marks_total: q.marks,
        criteria_results: [],
        general_feedback: verdict.correct
          ? 'Correct.'
          : verdict.reason === 'blank'
            ? 'No answer given.'
            : `The expected answer was: ${q.short_answer!.accepted[0]}`,
      }
    })
    if (Object.keys(longFormGradesResult).length > 0) setLongFormGrades({ ...longFormGradesResult })

    const needsModel = questions.some((q, idx) => isLongForm(q) && !isShortAnswer(q) && longFormAnswers[idx] !== undefined)
    if (hasLongForm && needsModel) {
      setIsGradingLongForm(true)
      try {
        // Only the questions a model has to read. Short answers are already
        // marked, and including them would pay for a judgement already made.
        const gradingPayload = {
          questions: questions.map((q, idx) => (isShortAnswer(q) ? { ...q, __skip: idx } : q)),
          answers: Object.fromEntries(
            Object.entries(longFormAnswers).filter(([k]) => !isShortAnswer(questions[Number(k)])),
          ),
          subject: assessment?.subject,
        }
        let data: any
        if (USE_ASYNC_AI_JOBS) {
          const job = await createAiJob('grade_longform', gradingPayload)
          await triggerAiJobExecution(job.id)
          data = await waitForAiJob<any>(job.id, { timeoutMs: 210000, pollIntervalMs: 2500 })
        } else {
          const res = await fetch('/api/grade-longform', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(gradingPayload),
          })
          data = await res.json()
        }
        Object.assign(longFormGradesResult, data.grades ?? {})
        setLongFormGrades({ ...longFormGradesResult })
      } catch (err) {
        console.error('Long-form grading failed:', err)
      } finally {
        setIsGradingLongForm(false)
      }
    }

    // Final score with long-form results
    const longFormEarned = Object.values(longFormGradesResult).reduce(
      (sum, g) => sum + (g.marks_awarded ?? 0),
      0
    )
    const totalEarned = mcqCorrect + interactiveEarned + longFormEarned
    const totalPossible = mcqTotal + interactiveTotal + longFormTotal
    const finalScore = totalPossible > 0 ? Math.round((totalEarned / totalPossible) * 100) : 0
    const grade =
      finalScore >= 90 ? 'A+' :
        finalScore >= 80 ? 'A' :
          finalScore >= 70 ? 'B+' :
            finalScore >= 60 ? 'B' :
              finalScore >= 50 ? 'C' : 'D'

    const finalResult = { ...preliminaryResult, longFormMarksEarned: longFormEarned, score: finalScore, grade }
    setResults(finalResult)

    // Generate overall AI feedback
    setIsGeneratingFeedback(true)
    let generatedFeedback = 'Great effort! Review the criteria and explanations below to improve.'
    const storedUser = JSON.parse(localStorage.getItem('user') || '{}')

    try {
      const feedbackPayload = {
        assessment,
        answers: selectedAnswers,
        longFormAnswers,
        longFormGrades: longFormGradesResult,
        interactiveAnswers,
        interactiveGrades: interactiveGradesResult,
        score: finalScore,
        grade,
        className: storedUser.class,
      }
      let feedbackData: any
      if (USE_ASYNC_AI_JOBS) {
        const job = await createAiJob('generate_feedback', feedbackPayload)
        await triggerAiJobExecution(job.id)
        feedbackData = await waitForAiJob<any>(job.id, { timeoutMs: 210000, pollIntervalMs: 2500 })
      } else {
        const feedbackRes = await fetch('/api/generate-feedback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(feedbackPayload),
        })
        feedbackData = await feedbackRes.json()
      }
      if (feedbackData.feedback) generatedFeedback = feedbackData.feedback
    } catch {
      // keep fallback
    } finally {
      setFeedback(generatedFeedback)
      setIsGeneratingFeedback(false)
    }

    const resolvedUserId = isUuid(authUser?.id)
      ? authUser?.id
      : isUuid(storedUser?.id)
        ? storedUser?.id
        : null

    // No usable identity means the result cannot be attributed to anyone. It
    // used to be dropped here in silence: the student finished, saw a score,
    // and nothing was ever saved. Say so instead — and keep saying it on the
    // results screen, where they can still act on it.
    if (!resolvedUserId) setUnsavedReason('not-signed-in')

    if (resolvedUserId) {
      const totalSeconds = Number.isFinite(assessment?.estimated_time)
        ? (assessment?.estimated_time ?? 0) * 60
        : null
      const timeTaken = totalSeconds !== null ? Math.max(totalSeconds - timeRemaining, 0) : null
      const payload = {
        user_id: resolvedUserId,
        assessment_id: assessment?.assessment_id,
        assignment_id: assignmentId ?? null,
        student_email: authUser?.email ?? storedUser?.email ?? null,
        answers: { mcq: selectedAnswers, longform: longFormAnswers, interactive: interactiveAnswers },
        total_questions: questions.length,
        score: finalScore,
        grade,
        feedback: generatedFeedback,
        questions_data: assessment?.questions ?? [],
        longform_grades: longFormGradesResult,
        time_taken: timeTaken,
        submission_reason: submissionReason,
        violation_count: violationCount,
      }

      // Queue before sending, not after. This used to be a bare fetch with no
      // error handling, so a student who lost signal at the moment they
      // finished lost the whole attempt in silence. Writing locally first means
      // the work survives the network, and the drain loop delivers it later.
      const pending: PendingSubmission = {
        id: `${assessment?.assessment_id ?? 'quiz'}-${Date.now()}`,
        payload,
        queuedAt: Date.now(),
        attempts: 0,
      }
      writeQueue(upsert(readQueue(), pending))
      setPendingSync(true)

      const delivered = await deliverPending(pending)
      if (delivered) setPendingSync(readQueue().length > 0)
    }
  }, [assessment, selectedAnswers, longFormAnswers, interactiveAnswers, assignmentId, timeRemaining, authUser, isClassroomAssignment, clearPausedState])

  /**
   * Try to deliver one queued result. Returns true when it is safely stored
   * server-side and can leave the queue.
   *
   * A refusal (4xx) is dropped rather than retried forever — the server
   * understood and said no, so the queue would only spin. Anything transient
   * stays queued with its attempt count bumped.
   */
  const deliverPending = useCallback(async (item: PendingSubmission): Promise<boolean> => {
    if (!isOnline()) return false
    let status: number | null = null
    try {
      const res = await fetch('/api/save-result', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item.payload),
      })
      status = res.status
      if (res.ok) {
        writeQueue(removeById(readQueue(), item.id))
        return true
      }
    } catch {
      status = null // network failure
    }

    if (!isRetryableStatus(status)) {
      writeQueue(removeById(readQueue(), item.id))
      return true
    }
    writeQueue(upsert(readQueue(), { ...item, attempts: item.attempts + 1 }))
    return false
  }, [])

  /**
   * Drain the queue: on mount, whenever the browser reports it is back online,
   * and on a backoff timer while anything is still waiting.
   */
  useEffect(() => {
    let timer: number | null = null
    let cancelled = false

    const drain = async () => {
      if (cancelled) return
      const queue = readQueue()
      setPendingSync(queue.length > 0)
      if (queue.length === 0 || !isOnline()) return

      for (const entry of queue) {
        if (cancelled) return
        if (!shouldRetry(entry)) continue
        await deliverPending(entry)
      }

      const left = readQueue()
      setPendingSync(left.length > 0)
      if (left.length > 0 && !cancelled) {
        const worst = Math.min(...left.map((i) => i.attempts))
        timer = window.setTimeout(drain, nextBackoffMs(worst))
      }
    }

    void drain()
    window.addEventListener('online', drain)
    return () => {
      cancelled = true
      if (timer !== null) window.clearTimeout(timer)
      window.removeEventListener('online', drain)
    }
  }, [deliverPending])

  /**
   * Check the session before the work is done, not after.
   *
   * A signed-out or expired session meant a finished attempt was silently
   * discarded at submit. Warning up front lets a student sign in while it
   * still costs them nothing.
   */
  useEffect(() => {
    if (showResults) return
    const stored = (() => {
      try { return JSON.parse(localStorage.getItem('user') || 'null') } catch { return null }
    })()
    const hasIdentity = isUuid(authUser?.id) || isUuid(stored?.id)
    setUnsavedReason(hasIdentity ? null : 'not-signed-in')
  }, [authUser, showResults])

  // Honest connection state while answering, so a student on a patchy line
  // knows before they reach the end.
  useEffect(() => {
    const sync = () => setOffline(!isOnline())
    sync()
    window.addEventListener('online', sync)
    window.addEventListener('offline', sync)
    return () => {
      window.removeEventListener('online', sync)
      window.removeEventListener('offline', sync)
    }
  }, [])

  /**
   * Strict-mode violation detection.
   *
   * This used to submit the whole attempt on the FIRST blur, which meant a
   * screen reader taking focus, an on-screen keyboard, a system notification
   * or a click on the browser's address bar ended the exam outright — with
   * assistive-technology users hit hardest, since AT takes focus routinely.
   *
   * Now the two signals are treated as the different evidence they are:
   * a backgrounded tab counts at once, while a bare blur only counts if focus
   * has not returned within a grace window. Either way the student is warned
   * and only loses the attempt after passing the threshold.
   */
  useEffect(() => {
    if (!strictMode || isSubmitted) return

    let blurTimer: number | null = null

    const clearBlurTimer = () => {
      if (blurTimer !== null) {
        window.clearTimeout(blurTimer)
        blurTimer = null
      }
    }

    const record = (kind: 'hidden' | 'blur') => {
      const decision = registerViolation(kind, violationCountRef.current)
      violationCountRef.current = decision.count
      setViolationCount(decision.count)
      setViolationNotice(decision.message)
      if (decision.action === 'submit') {
        setSubmissionReason('violation')
        handleSubmit()
      }
    }

    const handleVisibilityChange = () => {
      if (document.hidden) {
        // A backgrounded tab is unambiguous, so the grace timer is redundant.
        clearBlurTimer()
        record('hidden')
      }
    }

    const handleBlur = () => {
      if (document.hidden) return // visibilitychange already owns this case
      clearBlurTimer()
      blurTimer = window.setTimeout(() => {
        blurTimer = null
        if (!document.hasFocus()) record('blur')
      }, BLUR_GRACE_MS)
    }

    // Coming back inside the grace window means nothing happened worth
    // recording — a notification, a keyboard, a screen reader.
    const handleFocus = clearBlurTimer

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('blur', handleBlur)
    window.addEventListener('focus', handleFocus)

    return () => {
      clearBlurTimer()
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('blur', handleBlur)
      window.removeEventListener('focus', handleFocus)
    }
  }, [strictMode, isSubmitted, handleSubmit])

  useEffect(() => {
    violationCountRef.current = 0
    setViolationCount(0)
    setViolationNotice(null)
  }, [assessment])

  // The quiz is paged (one question per screen) but the page itself scrolls
  // on `window` (no inner scroll container — the passage box's own
  // overflow-y-auto is unrelated). Without this, moving from a scrolled-down
  // question to the next can leave that question's figure above the fold.
  useEffect(() => {
    if (showResults) return
    setVisited((prev) => (prev.has(currentQuestion) ? prev : new Set(prev).add(currentQuestion)))
  }, [currentQuestion, showResults])

  useEffect(() => {
    if (showResults) return
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    window.scrollTo({ top: 0, behavior: prefersReducedMotion ? 'auto' : 'smooth' })
  }, [currentQuestion, showResults])

  useEffect(() => {
    if (timeRemaining > 0 && !isSubmitted && !isPaused) {
      const timer = setInterval(() => {
        setTimeRemaining((prev) => {
          // The limit can be switched off mid-attempt (WCAG 2.2.1), so the
          // clock must stop counting rather than silently reaching zero.
          if (limitDisabled) return prev
          if (prev <= 1) {
            setSubmissionReason('timer')
            handleSubmit()
            return 0
          }
          return prev - 1
        })
      }, 1000)
      return () => clearInterval(timer)
    }
  }, [timeRemaining, isSubmitted, isPaused, handleSubmit, limitDisabled])

  useEffect(() => {
    if (!authUser?.id || !assessment || !isUuid(authUser.id)) return
    const intervalSeconds = 60
    const tick = async () => {
      if (document.visibilityState !== 'visible') return
      try {
        await fetch('/api/activity/ping', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: authUser.id, seconds: intervalSeconds }),
        })
      } catch {
        // Ignore activity ping errors silently.
      }
    }

    const timer = window.setInterval(tick, intervalSeconds * 1000)
    return () => window.clearInterval(timer)
  }, [authUser, assessment])

  if (!assessment) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-apple-blue mx-auto mb-4"></div>
          <p className="text-apple-dark-gray">Getting your quiz ready…</p>
          {loadError && (
            <p className="mt-2 text-xs text-red-600">{loadError}</p>
          )}
        </div>
      </div>
    )
  }

  // ── Results view ────────────────────────────────────────────────────────────
  if (showResults && results) {
    const scoreNow = typeof results.score === 'number' ? results.score : null
    const retakeImprovement = improvementBetween(retakeOrigin?.score, scoreNow)
    const retakeLine = describeImprovement(retakeImprovement)

    const hasLongForm = assessment.questions.some(isLongForm)
    const hasInteractive = assessment.questions.some(isInteractive)

    // Group the attempt into named areas so the score turns into next steps.
    // Every question type contributes on the same 0..1 scale, so a half-marked
    // written answer weighs the same as half an MCQ rather than as a wipeout.
    const outcomes: QuestionOutcome[] = assessment.questions.map((q, idx) => {
      const label = String((q as { topic_label?: string }).topic_label ?? '')
      if (isLongForm(q)) {
        const g = longFormGrades[idx]
        return { index: idx, label, credit: creditFromMarks(g?.marks_awarded, g?.marks_total ?? q.marks) }
      }
      if (isInteractive(q)) {
        const g = interactiveGrades[idx] ?? gradeInteractiveQuestion(q, interactiveAnswers[idx])
        return { index: idx, label, credit: creditFromMarks(g?.marks_awarded, g?.marks_total) }
      }
      return { index: idx, label, credit: results.answers[idx] === q.correct_answer ? 1 : 0 }
    })
    const problemAreas = pickProblemAreas(summarizeWeakAreas(outcomes))

    // Checkpoint reads back by strand. `outcomes` already carries per-question
    // credit on a 0..1 scale, so a half-marked written answer counts as half
    // rather than as a wipeout — the same basis the weak-area grouping uses.
    const checkpointMeta = assessment.checkpoint
    // The stored paper carries which subject it was, not the subject's strands
    // — those live in the syllabus module, which is the single place they are
    // allowed to live.
    const checkpointSubjectDef = checkpointMeta
      ? checkpointSubject(checkpointMeta.programme, checkpointMeta.subject)
      : undefined
    const strandReport = checkpointMeta && checkpointSubjectDef
      ? checkpointReport(
          assessment.questions,
          // Marks, not right-or-wrong. A Checkpoint paper is fifty marks of
          // one-mark multiple choice and two- and three-mark written answers,
          // so rounding each question to a boolean would throw away every part
          // mark a written answer earned — which is most of what it is for.
          outcomes.map((o, idx) => {
            const marks = Number((assessment.questions[idx] as { marks?: number }).marks ?? 1)
            return o.credit * (Number.isFinite(marks) && marks > 0 ? marks : 1)
          }),
          checkpointSubjectDef,
        )
      : null

    const jumpToQuestion = (n: number) => {
      const el = document.getElementById(`question-${n}`)
      if (!el) return
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      // Brief ring so the eye lands on the right card after the scroll settles.
      el.classList.add('ring-2', 'ring-ss-accent')
      window.setTimeout(() => el.classList.remove('ring-2', 'ring-ss-accent'), 1600)
    }

    const handleRetake = () => {
      const payload = buildRetakePayload({ ...assessment, questions: assessment.questions })
      if (!payload) return
      setIsRetaking(true)
      try {
        sessionStorage.setItem(CURRENT_ASSESSMENT_KEY, JSON.stringify(payload))
        sessionStorage.removeItem('gapMapReturn')
      } catch {
        setIsRetaking(false)
        return
      }
      // Full reload rather than a client push: this component is already
      // mounted with a finished attempt in state, and a soft navigation to the
      // same route would keep showing the results view.
      window.location.href = '/assessment'
    }

    return (
      <div className="min-h-screen bg-[#FAFAFA] dark:bg-[#0A0A0A]">
        {/* Always-reachable way out. The dashboard link at the foot of the page
            sits below every question, so on a long review it may as well not
            exist. */}
        <div className="sticky top-0 z-30 border-b border-ss-line bg-[#FAFAFA]/90 backdrop-blur dark:bg-[#0A0A0A]/90">
          <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
            <button
              onClick={() => {
                sessionStorage.removeItem('gapMapReturn')
                router.push('/')
              }}
              className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-[13px] font-bold text-ss-slate transition-colors hover:bg-black/5 hover:text-ss-ink dark:hover:bg-white/5"
            >
              <ChevronLeft className="h-4 w-4" />
              Done
            </button>
            <p className="min-w-0 flex-1 truncate text-right text-[12.5px] font-bold text-ss-slate">
              {assessment.subject}
            </p>
          </div>
        </div>

        <div className="max-w-4xl mx-auto space-y-8 px-4 py-8 sm:px-6 lg:px-8">
          {/* The moment the loop closes. A student who studied a topic,
              retook it and improved was previously told nothing at all —
              which teaches that studying achieves nothing. */}
          {retakeLine && (
            <div
              role="status"
              className={`rounded-2xl border p-5 ${
                retakeImprovement?.regressed
                  ? 'border-[color:var(--ss-warn)]/40 bg-[color:var(--ss-warn)]/10'
                  : 'border-[color:var(--ss-good)]/40 bg-[color:var(--ss-good)]/10'
              }`}
            >
              <p className="flex items-center gap-2 text-[12px] font-black uppercase tracking-widest text-ss-ink">
                <TrendingUp className="h-4 w-4" aria-hidden />
                {retakeImprovement?.regressed ? 'Compared with last time' : 'Your studying worked'}
              </p>
              <p className="mt-1.5 text-[15px] font-bold text-ss-ink">{retakeLine}</p>
            </div>
          )}

          {/* Score card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white dark:bg-[#1c1c1e] rounded-3xl p-8 sm:p-12 text-center shadow-xl border border-gray-200/50 dark:border-gray-800/50"
          >
            <div className="w-20 h-20 mx-auto bg-green-50 dark:bg-green-900/20 rounded-full flex items-center justify-center mb-6">
              <Check className="w-10 h-10 text-green-500" />
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold mb-3 text-gray-900 dark:text-white tracking-tight">
              Assessment Complete!
            </h1>
            <p className="text-gray-500 dark:text-gray-400 mb-6 text-lg">
              {/* A Checkpoint paper spans 30-odd topics, and listing every one
                  printed a paragraph of run-on topic names above the score.
                  A handful, then a count. */}
              {assessment.subject} — {assessment.topics.length > 4
                ? `${assessment.topics.slice(0, 3).join(', ')} and ${assessment.topics.length - 3} more topics`
                : assessment.topics.join(', ')}
            </p>

            {/* U5: a tester finished a quiz and never realised feedback
                existed, because it sits below the whole question review. The
                score is not the product — knowing what to do about it is. */}
            {results.score !== null && !isGradingLongForm && (
              <button
                type="button"
                onClick={() => {
                  const el = document.getElementById('next-steps-panel')
                  el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                }}
                className="mb-10 inline-flex items-center gap-2 rounded-full bg-[color:var(--ss-accent)]/12 px-5 py-2.5 text-[13.5px] font-bold text-ss-accent transition-colors hover:bg-[color:var(--ss-accent)]/20"
              >
                {problemAreas.length > 0
                  ? `We found ${problemAreas.length} thing${problemAreas.length === 1 ? '' : 's'} to work on — see what to study`
                  : 'See what to study next'}
                <ChevronRight className="h-4 w-4" aria-hidden />
              </button>
            )}

            {/* The strand breakdown, above the question review: on a Checkpoint
                paper this IS the result. A bare score tells a student nothing
                they can act on; "weakest strand: Earth and Space" does. */}
            {checkpointMeta && strandReport && (
              <div className="mb-10 text-left">
                <CheckpointStrandReport meta={checkpointMeta} report={strandReport} />
              </div>
            )}

            {/* Score / Grade */}
            {results.score !== null ? (
              <div className="flex justify-center items-center gap-12 mb-10">
                <div className="text-center">
                  <div className="text-6xl font-bold text-blue-600 dark:text-blue-400 mb-2 tracking-tighter">
                    {results.score}%
                  </div>
                  <div className="text-sm font-medium text-ss-slate uppercase tracking-widest">Final Score</div>
                </div>
                <div className="w-px h-20 bg-gray-200 dark:bg-gray-800"></div>
                <div className="text-center">
                  <div className="text-6xl font-bold text-blue-600 dark:text-blue-400 mb-2 tracking-tighter">
                    {results.grade}
                  </div>
                  <div className="text-sm font-medium text-ss-slate uppercase tracking-widest">Grade</div>
                </div>
              </div>
            ) : (
              <div className="flex justify-center items-center gap-3 mb-10 text-blue-600 dark:text-blue-400">
                <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-current"></div>
                <span className="font-medium">Grading written answers…</span>
              </div>
            )}

            {/* Marks breakdown for mixed/longform */}
            {(hasLongForm || hasInteractive) && results.score !== null && (
              <div className="flex justify-center gap-6 mb-8 text-sm text-gray-500 dark:text-gray-400 flex-wrap">
                {results.mcqTotal > 0 && (
                  <span>MCQ: {results.mcqCorrect}/{results.mcqTotal}</span>
                )}
                {results.interactiveTotal > 0 && (
                  <span>Interactive: {results.interactiveEarned}/{results.interactiveTotal} marks</span>
                )}
                {results.longFormTotal > 0 && (
                  <span>Written: {results.longFormMarksEarned}/{results.longFormTotal} marks</span>
                )}
              </div>
            )}

            <FeedbackPanel
              feedback={feedback}
              loading={isGeneratingFeedback || (isGradingLongForm && results.score === null)}
              loadingMessage={isGradingLongForm ? 'Grading written answers…' : 'Analysing your performance…'}
            />
          </motion.div>

          {unsavedReason && (
            <div role="status" className="rounded-2xl border-2 border-amber-400 bg-amber-50 p-4 dark:border-amber-600 dark:bg-amber-900/25">
              <p className="text-[14px] font-bold text-amber-900 dark:text-amber-100">This attempt wasn&apos;t saved</p>
              <p className="mt-1 text-[13px] font-medium text-amber-900/90 dark:text-amber-100/90">
                You weren&apos;t signed in, so it isn&apos;t part of your progress or your gap map. Your
                answers and feedback are still on this screen — sign in and retake it to keep the score.
              </p>
            </div>
          )}

          {/* Next steps — only once grading has settled, so the areas shown
              aren't based on written answers that are still being marked. */}
          {results.score !== null && !isGradingLongForm && (
            <div id="next-steps-panel">
              <NextStepsPanel
                areas={problemAreas}
                subject={assessment.subject}
                onJumpToQuestion={jumpToQuestion}
                onRetake={handleRetake}
                retaking={isRetaking}
              />
            </div>
          )}

          {/* Download report button */}
          {results.score !== null && !isGeneratingFeedback && (
            <div className="flex justify-center">
              <button
                onClick={downloadReport}
                className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-semibold text-sm hover:opacity-80 transition-opacity shadow-md"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Save as PDF
              </button>
            </div>
          )}

          {/* Detailed review */}
          <div className="space-y-6">
            <h2 className="text-2xl font-bold px-2">Every question, and why</h2>
            {assessment.questions.map((q, idx) => {
              // Anchors live on a wrapper for these two so the jump targets are
              // uniform across every question type without threading an id
              // through each card component.
              if (isLongForm(q)) {
                return (
                  <div key={idx} id={`question-${idx + 1}`} className="scroll-mt-24 rounded-apple transition-shadow">
                    <LongFormResultCard
                      q={q}
                      idx={idx}
                      studentAnswer={longFormAnswers[idx] || ''}
                      grade={longFormGrades[idx]}
                    />
                  </div>
                )
              }

              if (isInteractive(q)) {
                const grade = interactiveGrades[idx] ?? gradeInteractiveQuestion(q, interactiveAnswers[idx])
                return (
                  <div key={idx} id={`question-${idx + 1}`} className="scroll-mt-24 rounded-apple transition-shadow">
                    <InteractiveResultCard
                      question={q}
                      answer={interactiveAnswers[idx]}
                      grade={grade}
                      idx={idx}
                    />
                  </div>
                )
              }

              // MCQ result card
              const userAnswer = results.answers[idx]
              const isCorrect = userAnswer === q.correct_answer
              return (
                <motion.div
                  key={idx}
                  id={`question-${idx + 1}`}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  // scroll-mt clears the sticky header when jumped to from the
                  // next-steps panel.
                  className={`scroll-mt-24 rounded-apple border-l-4 p-6 transition-shadow glass dark:glass-dark ${isCorrect ? 'border-l-green-500' : 'border-l-red-500'
                    }`}
                >
                  <div className="flex items-start gap-4 mb-4">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-1 ${isCorrect
                      ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400'
                      : 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
                      }`}>
                      {isCorrect ? <Check className="w-5 h-5" /> : <span className="font-bold text-lg">×</span>}
                    </div>
                    <div className="flex-1">
                      <div className="text-sm text-apple-dark-gray mb-1">Question {idx + 1}</div>
                      {q.image_url && (!q.figureGroup || idx === q.figureGroup.startIndex) && (
                        <>
                          {q.figureGroup && <FigureGroupLabel group={q.figureGroup} />}
                          <ExamFigure src={q.image_url} lazy />
                        </>
                      )}
          {q.diagram_svg && (
                        <div className="bg-white dark:bg-gray-900 rounded-xl p-3 mb-3 border border-gray-200 dark:border-gray-700 overflow-x-auto">
                          <DiagramSvg svg={q.diagram_svg} />
                        </div>
                      )}
                      {q.passage && (
                        <PassageBox passage={q.passage} source={q.passage_source} />
                      )}
                      <h3 className="text-lg font-medium"><L>{q.question}</L></h3>
                    </div>
                  </div>

                  <div className="space-y-2 ml-12 mb-4">
                    {q.options.map((opt, optIdx) => {
                      let optClass = 'p-3 rounded-xl text-sm sm:text-base border '
                      if (optIdx === q.correct_answer) {
                        optClass += 'bg-green-50 border-green-200 text-green-800 dark:bg-green-900/20 dark:border-green-800/50 dark:text-green-200 font-medium'
                      } else if (optIdx === userAnswer && !isCorrect) {
                        optClass += 'bg-red-50 border-red-200 text-red-800 dark:bg-red-900/20 dark:border-red-800/50 dark:text-red-200'
                      } else {
                        optClass += 'bg-gray-50 border-transparent text-gray-600 dark:bg-gray-800/50 dark:text-gray-400'
                      }
                      return (
                        <div key={optIdx} className={optClass}>
                          <L>{opt}</L>
                          {optIdx === q.correct_answer && (
                            <span className="ml-2 text-xs uppercase tracking-wider font-bold text-green-600 dark:text-green-400">(Correct)</span>
                          )}
                          {optIdx === userAnswer && !isCorrect && (
                            <span className="ml-2 text-xs uppercase tracking-wider font-bold text-red-600 dark:text-red-400">(Your Answer)</span>
                          )}
                        </div>
                      )
                    })}
                  </div>

                  <div className="ml-12 bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 text-sm text-apple-dark-gray break-words">
                    <span className="font-semibold text-gray-900 dark:text-gray-100">Explanation: </span>
                    <L>{q.explanation ?? ''}</L>
                  </div>
                </motion.div>
              )
            })}
          </div>

          <div className="flex flex-col sm:flex-row justify-center gap-3 pt-8 pb-12">
            <button
              onClick={() => {
                sessionStorage.removeItem('gapMapReturn')
                router.push('/')
              }}
              className="btn-primary px-8 py-3"
            >
              Return to Dashboard
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Quiz view ───────────────────────────────────────────────────────────────
  const question = assessment.questions[currentQuestion]
  const isCurrentLongForm = isLongForm(question)
  const isCurrentInteractive = isInteractive(question)
  // Every question on a reading paper carries the same text, so this is
  // "does this paper have a passage" as much as "does this question".
  const currentPassage =
    'passage' in question && typeof question.passage === 'string' ? question.passage.trim() : ''
  const currentPassageSource =
    'passage_source' in question && typeof question.passage_source === 'string'
      ? question.passage_source
      : undefined
  // A figure gets the same treatment as a passage: its own pinned column on a
  // wide screen. Stacked above the stem it pushes the question down, so a
  // learner reads "Look at the diagram", scrolls up to look, and scrolls back
  // to find out what was being asked -- reported as "I don't like that I have
  // to scroll down or up to view the image".
  const currentFigure = question.image_url || question.diagram_svg ? question : null
  const splitColumn = Boolean(currentPassage) || Boolean(currentFigure)
  const progressInput: ProgressInput = {
    total: assessment.questions.length,
    current: currentQuestion,
    answered: answeredSet,
    visited,
  }
  const answered = answeredCount(progressInput)
  // Was (currentQuestion + 1) / total — that measured how far the student had
  // paged, not how much they had actually done, so skipping ahead showed a
  // bar that had not been earned.
  const progress = (answered / assessment.questions.length) * 100
  const blanks = unansweredQuestions(progressInput)

  // Pace, in minutes rather than percent.
  //
  // A Checkpoint paper runs about a mark a minute, and running out of time is
  // one of the two ways a learner who knows the material still loses marks.
  // The countdown says how long is left and nothing about whether it is
  // enough; the progress bar counts QUESTIONS, which on a paper where they
  // are worth 1 to 25 marks is not the quantity that matters.
  const paperSeconds = Number.isFinite(assessment?.estimated_time)
    ? Number(assessment.estimated_time) * 60
    : 0
  const currentPace = pace({
    totalMarks: assessment.questions.reduce((t, q: any) => t + (Number(q?.marks) || 0), 0),
    marksAttempted: marksAttempted(assessment.questions as any[], (i) => answeredSet.has(i)),
    totalSeconds: paperSeconds,
    secondsRemaining: timeRemaining,
  })

  return (
    <div className="min-h-screen bg-[#FAFAFA] dark:bg-[#0A0A0A] flex flex-col font-sans">
      {/* Strict Mode Warning Banner */}
      {strictMode && (
        <div className="bg-[#1c1f26] border-b border-black/20 px-4 sm:px-6 py-2">
          <div className="max-w-4xl mx-auto flex items-center gap-2">
            <Lock className="w-3 h-3 text-amber-400 flex-shrink-0" />
            <p className="text-[12px] text-white/80 tracking-wide">
              <span className="font-semibold text-amber-400">Strict</span>
              {' '}— Switching tabs or windows will immediately auto-submit your assessment.
            </p>
          </div>
        </div>
      )}
      {/* Header */}
      <div className="bg-white/80 dark:bg-[#1c1c1e]/80 backdrop-blur-xl sticky top-0 z-30 header-fade">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 sm:py-5">
          {/* Stacked on a phone, side by side from `sm`.
              Side by side at 400px left the title column about 140px wide, so
              "40 questions · 42 marks · 16 topics" broke over three lines and
              the paper's own name wrapped to two. The controls beside it are
              five pills that wrap to two rows regardless; giving each its own
              full-width row costs nothing and buys the meta line back. */}
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 sm:gap-4">
            <div className="min-w-0 sm:flex-1">
              <h1 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white tracking-tight truncate">
                {assessment.subject}
              </h1>
              {/* What this PAPER is, not a truncated list of its topics.
                  The subtitle used to read "the human digestive system,
                  atomic structure, conservation of ..." — twenty foci cut off
                  after three, which is neither readable nor ignorable.
                  Reported as "I'm confused by the stuff at the top, if it's
                  important it's really hard to notice." A real paper's cover
                  says its marks and its length; the topics go behind a
                  control for anyone who wants them. */}
              {/* The separator is drawn BEFORE each item after the first,
                  not as a sibling of its own. As siblings in a wrapping flex
                  row they are wrap opportunities, and at phone width the row
                  broke as "40 questions / · / 42 marks / · / 16 topics" —
                  five lines, two of them a lone middle dot. Attached with
                  ::before it can only ever wrap together with the item it
                  belongs to. */}
              <div className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[13px] text-ss-slate [&>*+*]:before:content-['·'] [&>*+*]:before:mr-2.5">
                <span className="font-semibold">
                  {assessment.questions.length} questions
                </span>
                <span className="font-semibold">
                  {assessment.questions.reduce((t: number, q: any) => t + (Number(q?.marks) || 0), 0)} marks
                </span>
                {assessment.topics.length > 0 && (
                  <>
                    <button
                      type="button"
                      onClick={() => setTopicsOpen((v) => !v)}
                      aria-expanded={topicsOpen}
                      className="font-semibold underline decoration-dotted underline-offset-2 hover:text-ss-accent"
                    >
                      {assessment.topics.length} topics
                    </button>
                  </>
                )}
              </div>
              {topicsOpen && assessment.topics.length > 0 && (
                <p className="mt-2 max-w-2xl text-[12.5px] leading-relaxed text-ss-slate">
                  {assessment.topics.join(' · ')}
                </p>
              )}
            </div>

            <div className="flex items-center gap-2 flex-wrap justify-end">
              {!isClassroomAssignment && (
                <>
                  <button
                    type="button"
                    onClick={handlePause}
                    className="px-3 py-1.5 rounded-full text-xs sm:text-sm font-semibold bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800/50"
                  >
                    Pause
                  </button>
                  <button
                    type="button"
                    onClick={handleQuit}
                    className="px-3 py-1.5 rounded-full text-xs sm:text-sm font-semibold bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100 dark:bg-gray-800/50 dark:text-gray-300 dark:border-gray-700"
                  >
                    Quit
                  </button>
                </>
              )}
              <div className="flex items-center gap-2">
                <div
                  className={`flex items-center gap-2 rounded-full border border-gray-300/70 bg-gray-50 px-4 py-2 dark:border-gray-700/50 dark:bg-gray-800/50 ${
                    // ss-accent, not apple-blue. #007AFF on the near-white
                    // header is 3.8:1, under the 4.5:1 AA floor for 16px
                    // text, and the clock is the one thing on this screen a
                    // learner glances at rather than reads. #0C6FAE is the
                    // app's own accent token and measures 5.1:1.
                    limitDisabled ? 'text-gray-600 dark:text-gray-300' : timeRemaining < WARN_AT_SECONDS ? 'text-orange-600' : 'text-ss-accent'
                  }`}
                >
                  <Clock className="w-4 h-4 sm:w-5 sm:h-5" aria-hidden />
                  {/* The digits are decorative for assistive tech; the spoken
                      form is announced on the warning instead of ticking every
                      second, which would make the page unusable to listen to. */}
                  <span className="font-mono font-bold text-sm sm:text-base tracking-tight" aria-hidden>
                    {limitDisabled ? 'No limit' : formatRemaining(timeRemaining)}
                  </span>
                  <span className="sr-only">
                    {limitDisabled ? 'No time limit' : describeRemaining(timeRemaining)}
                  </span>
                </div>

                {/* WCAG 2.2.1: a practice quiz's limit must be adjustable. A
                    teacher-set assignment keeps its timing, so these are hidden
                    there rather than shown and refused. */}
                {timerControls.canExtend && !limitDisabled && (
                  <button
                    type="button"
                    onClick={() => setTimeRemaining((t) => extendRemaining(t))}
                    className="rounded-full border border-gray-300 px-3 py-2 text-[12px] font-bold text-gray-700 transition-colors hover:border-ss-accent hover:text-ss-accent dark:border-gray-600 dark:text-gray-300"
                  >
                    +5 min
                  </button>
                )}
                {timerControls.canDisable && !limitDisabled && (
                  <button
                    type="button"
                    onClick={() => setLimitDisabled(true)}
                    className="rounded-full border border-gray-300 px-3 py-2 text-[12px] font-bold text-gray-700 transition-colors hover:border-ss-accent hover:text-ss-accent dark:border-gray-600 dark:text-gray-300"
                  >
                    Turn off timer
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Pace. Says it in minutes, because "four minutes behind" is
              advice and "62%" is not. Silent for the first two minutes of a
              paper and whenever it has nothing honest to say. */}
          {currentPace.state !== 'unknown' && !isSubmitted && (
            <div
              role="status"
              aria-live="polite"
              className="mt-3 inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[12px] font-semibold"
              // ss-* are CSS variables, so the alpha modifiers do nothing on
              // them and every tint is mixed here.
              style={{
                borderColor: `color-mix(in srgb, var(${PACE_TOKEN[currentPace.state]}) 45%, var(--ss-line))`,
                background: `color-mix(in srgb, var(${PACE_TOKEN[currentPace.state]}) 10%, transparent)`,
                color: `var(${PACE_TOKEN[currentPace.state]})`,
              }}
            >
              <span aria-hidden>
                {currentPace.state === 'ahead' ? '▲' : currentPace.state === 'on-track' ? '●' : '▼'}
              </span>
              {currentPace.message}
              <span className="font-normal opacity-80">
                {currentPace.state === 'well-behind'
                  ? '— leave a hard one and come back'
                  : currentPace.state === 'behind'
                    ? '— keep moving'
                    : ''}
              </span>
            </div>
          )}

          {/* Question strip. U1: a student could walk past a question and only
              discover it at the end. Grey means not reached, amber means seen
              and left blank, and every one of them jumps. */}
          <button
            type="button"
            onClick={() => setNavOpen((v) => !v)}
            aria-expanded={navOpen}
            aria-controls="question-strip"
            className="mt-4 flex w-full items-center justify-between gap-2 rounded-xl border border-ss-line bg-ss-panel px-3 py-2 text-[13px] font-semibold text-ss-ink sm:hidden"
          >
            <span>
              Question {currentQuestion + 1} of {assessment.questions.length}
            </span>
            <span className="font-medium text-ss-slate">
              {navOpen ? 'Hide list' : 'All questions'}
            </span>
          </button>

          <div
            id="question-strip"
            className={`mt-4 ${navOpen ? 'flex' : 'hidden'} flex-wrap gap-1.5 sm:flex`}
            role="group"
            aria-label="Jump to a question"
          >
            {assessment.questions.map((_, i) => {
              const state = questionState(i, progressInput)
              const style =
                state === 'answered'
                  ? 'bg-ss-accent text-white border-ss-accent'
                  : state === 'current'
                    ? 'bg-ss-panel text-ss-ink border-ss-accent ring-2 ring-[color:var(--ss-accent)]/30'
                    : state === 'skipped'
                      ? 'bg-amber-50 text-amber-900 border-amber-500 dark:bg-amber-900/25 dark:text-amber-100'
                      : 'bg-ss-panel text-ss-slate border-ss-line'
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => setCurrentQuestion(i)}
                  data-flagged={flagged[i] ? 'true' : undefined}
                  aria-current={state === 'current' ? 'step' : undefined}
                  aria-label={
                    `Question ${i + 1}: ` +
                    (state === 'answered' ? 'answered' : state === 'skipped' ? 'seen but not answered' : state === 'current' ? 'current question' : 'not reached yet') +
                    (flagged[i] ? ', flagged for review' : '')
                  }
                  title={(() => {
                    const q = assessment.questions[i]
                    const kind = isLongForm(q) ? `Long-form, ${(q as LongFormQuestion).marks} marks` : isInteractive(q) ? 'Interactive' : 'Multiple choice'
                    return `Question ${i + 1} — ${kind}`
                  })()}
                  className={`relative h-8 min-w-8 rounded-lg border-2 px-2 text-[12px] font-extrabold transition-colors ${style}`}
                >
                  {i + 1}
                  {flagged[i] && (
                    // A corner wedge rather than a colour: flagged is
                    // orthogonal to answered, and a learner can flag a
                    // question they HAVE answered.
                    <span
                      aria-hidden
                      className="pointer-events-none absolute -right-[2px] -top-[2px] h-0 w-0 rounded-tr-[4px] border-l-[9px] border-t-[9px] border-l-transparent"
                      style={{ borderTopColor: 'var(--ss-warn)' }}
                    />
                  )}
                </button>
              )
            })}
          </div>

          <div className="mt-4 h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-blue-600"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
            />
          </div>
        </div>
      </div>

      {/* Pre-submit check. Replaces a Submit button that simply sat disabled
          whenever anything was blank, telling the student nothing about what
          was missing or where to find it. */}
      <Modal
        open={showUnansweredCheck}
        onClose={() => setShowUnansweredCheck(false)}
        title="Some questions are still blank"
        className="max-w-lg"
      >
        <div className="p-6">
          <h3 className="text-lg font-extrabold text-ss-ink">Before you submit</h3>
          <p className="mt-2 text-[14px] font-medium text-ss-slate">
            {unansweredSummary(blanks)} You can go back to any of them, or submit as you are.
          </p>

          <div className="mt-4 flex flex-wrap gap-1.5">
            {blanks.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => {
                  setShowUnansweredCheck(false)
                  setCurrentQuestion(n - 1)
                }}
                className="h-9 min-w-9 rounded-lg border-2 border-amber-500 bg-amber-50 px-2.5 text-[13px] font-extrabold text-amber-900 hover:bg-amber-100 dark:bg-amber-900/25 dark:text-amber-100"
                aria-label={`Go to question ${n}`}
              >
                {n}
              </button>
            ))}
          </div>

          <div className="mt-6 flex flex-col gap-2 sm:flex-row-reverse">
            <button
              type="button"
              onClick={() => {
                setShowUnansweredCheck(false)
                setCurrentQuestion(blanks[0] - 1)
              }}
              className="flex-1 rounded-xl bg-ss-accent px-5 py-3 text-[14px] font-extrabold text-white hover:opacity-90"
            >
              Go to question {blanks[0]}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowUnansweredCheck(false)
                handleSubmit()
              }}
              className="flex-1 rounded-xl border border-ss-line px-5 py-3 text-[14px] font-extrabold text-ss-ink hover:border-ss-accent hover:text-ss-accent"
            >
              Submit anyway
            </button>
          </div>
        </div>
      </Modal>

      {/* Time-limit warning. WCAG 2.2.1 requires warning before a limit expires
          and a simple way to extend — this is that, with the extension offered
          in the same breath rather than buried in the header. */}
      {shouldWarn(timeRemaining, limitDisabled) && !isSubmitted && (
        <div className="px-4 pt-4 sm:px-6 lg:px-8">
          <div
            role="alert"
            className="mx-auto flex max-w-3xl flex-wrap items-center gap-3 rounded-2xl border-2 border-orange-400 bg-orange-50 p-3.5 dark:border-orange-600 dark:bg-orange-900/25"
          >
            <span className="text-base leading-none" aria-hidden>⏳</span>
            <p className="flex-1 text-[13px] font-semibold text-orange-900 dark:text-orange-100">
              {describeRemaining(timeRemaining)}.
              {timerControls.canExtend
                ? ' You can add more time if you need it.'
                : ' Finish up — your answers will be submitted when the time is up.'}
            </p>
            {timerControls.canExtend && (
              <button
                type="button"
                onClick={() => setTimeRemaining((t) => extendRemaining(t))}
                className="rounded-xl bg-orange-600 px-4 py-2 text-[12.5px] font-bold text-white hover:opacity-90"
              >
                Add 5 minutes
              </button>
            )}
            {timerControls.canDisable && (
              <button
                type="button"
                onClick={() => setLimitDisabled(true)}
                className="rounded-xl border border-orange-500 px-4 py-2 text-[12.5px] font-bold text-orange-900 hover:bg-orange-100 dark:text-orange-100 dark:hover:bg-orange-800/40"
              >
                Turn off the timer
              </button>
            )}
          </div>
        </div>
      )}

      {/* A note, not a banner.
          It was a thick amber box with a warning emoji, full-width above the
          question, and on every screen it was the loudest thing there -- more
          prominent than the question the learner was meant to be answering.
          It is worth saying once and plainly; it is not worth shouting on
          every question. One quiet line, dismissible for the sitting. */}
      {unsavedReason && !showResults && !unsavedHidden && (
        <div className="px-4 pt-3 sm:px-6 lg:px-8">
          <div role="status" className="mx-auto flex max-w-3xl items-center gap-2.5 text-[12.5px] text-ss-slate">
            <span
              aria-hidden
              className="h-1.5 w-1.5 shrink-0 rounded-full"
              style={{ background: 'color-mix(in srgb, var(--ss-accent) 30%, #d97706)' }}
            />
            <p className="flex-1">
              Not signed in — this attempt won&apos;t be saved. Sign in in another tab and it&apos;ll be
              picked up when you finish.
            </p>
            <button
              type="button"
              onClick={() => setUnsavedHidden(true)}
              className="shrink-0 rounded-md px-2 py-1 font-semibold text-ss-slate hover:text-ss-ink"
            >
              Hide
            </button>
          </div>
        </div>
      )}

      {/* Connection state. Says plainly that answers are safe, because the
          honest fear here is losing the work, not the connection itself. */}
      {(offline || pendingSync) && (
        <div className="px-4 pt-4 sm:px-6 lg:px-8">
          <div
            role="status"
            aria-live="polite"
            className={`mx-auto flex max-w-3xl items-start gap-3 rounded-2xl border-2 p-3.5 ${
              offline
                ? 'border-amber-400 bg-amber-50 dark:border-amber-600 dark:bg-amber-900/25'
                : 'border-blue-300 bg-blue-50 dark:border-blue-700 dark:bg-blue-900/25'
            }`}
          >
            <span className="mt-0.5 text-base leading-none" aria-hidden>{offline ? '📴' : '↻'}</span>
            <p className="flex-1 text-[13px] font-semibold text-gray-900 dark:text-gray-100">
              {offline
                ? 'You’re offline. Keep going — your answers are saved on this device and will be sent when you reconnect.'
                : 'Finishing up — your results are saved on this device and are being sent now.'}
            </p>
          </div>
        </div>
      )}

      {/* Proctoring warning. Announced politely rather than assertively so a
          screen reader finishes the current sentence first — the student is
          being warned, not interrupted mid-answer. */}
      {violationNotice && (
        <div className="px-4 pt-4 sm:px-6 lg:px-8">
          <div
            role="status"
            aria-live="polite"
            className="mx-auto flex max-w-3xl items-start gap-3 rounded-2xl border-2 border-amber-400 bg-amber-50 p-4 dark:border-amber-600 dark:bg-amber-900/25"
          >
            <span className="mt-0.5 text-lg leading-none" aria-hidden>⚠️</span>
            <p className="flex-1 text-[13.5px] font-semibold text-amber-900 dark:text-amber-100">
              {violationNotice}
            </p>
            <button
              type="button"
              onClick={() => setViolationNotice(null)}
              className="shrink-0 rounded-lg px-2 py-1 text-[12px] font-bold text-amber-900 hover:bg-amber-100 dark:text-amber-100 dark:hover:bg-amber-800/40"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Question content.
          A question with a reading text gets two columns on a wide screen:
          the text pinned in its own scroller on the left, the question on the
          right. Stacked, it was a 480px box on top of every question and a
          footer telling the learner to scroll up to re-read it -- forty times
          on an ESL paper. Below lg there is no room for two, so the stacked
          box stays and is collapsible. */}
      <div className="flex-1 flex items-start justify-center p-4 sm:p-6 lg:p-8">
        <div
          className={
            splitColumn
              ? 'grid w-full max-w-7xl items-start gap-6 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]'
              : 'w-full max-w-3xl'
          }
        >
          {currentPassage && (
            <PassageReader
              passage={currentPassage}
              source={currentPassageSource}
              variant="aside"
            />
          )}
          {!currentPassage && currentFigure && (
            <aside
              aria-label="Figure for this question"
              className="hidden rounded-3xl border border-ss-line bg-ss-panel p-4 shadow-ss-panel lg:sticky lg:top-6 lg:block"
            >
              {currentFigure.figureGroup && <FigureGroupLabel group={currentFigure.figureGroup} />}
              {currentFigure.image_url && <ExamFigure src={currentFigure.image_url} />}
              {currentFigure.diagram_svg && (
                <div className="overflow-x-auto rounded-2xl border border-ss-line bg-ss-panel p-3">
                  <DiagramSvg svg={currentFigure.diagram_svg} />
                </div>
              )}
            </aside>
          )}
          <AnimatePresence mode="wait">
            <motion.div
              key={currentQuestion}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="bg-white dark:bg-[#1c1c1e] rounded-3xl p-6 sm:p-8 lg:p-10 shadow-xl border border-gray-200/50 dark:border-gray-800/50"
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="inline-flex items-center justify-center px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 text-xs sm:text-sm font-semibold">
                  Question {currentQuestion + 1} of {assessment.questions.length}
                </div>
                {isCurrentLongForm && (
                  <div className="inline-flex items-center justify-center px-3 py-1 rounded-full bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 text-xs sm:text-sm font-semibold">
                    {(question as LongFormQuestion).marks} {(question as LongFormQuestion).marks === 1 ? 'mark' : 'marks'}
                  </div>
                )}
                {isCurrentInteractive && (
                  <div className="inline-flex items-center justify-center px-3 py-1 rounded-full bg-teal-50 dark:bg-teal-900/20 text-teal-600 dark:text-teal-400 text-xs sm:text-sm font-semibold">
                    {(question as InteractiveQuestion).marks} {(question as InteractiveQuestion).marks === 1 ? 'mark' : 'marks'}
                  </div>
                )}

                {/* Leave it and come back. Every real exam lets you; this one
                    did not, so the only way to find a hard question again on
                    a forty-question paper was to remember its number. */}
                <button
                  type="button"
                  onClick={() => setFlagged((f) => ({ ...f, [currentQuestion]: !f[currentQuestion] }))}
                  aria-pressed={Boolean(flagged[currentQuestion])}
                  className={`ml-auto inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                    flagged[currentQuestion] ? 'text-ss-warn' : 'border-ss-line text-ss-slate hover:text-ss-warn'
                  }`}
                  // ss-* are CSS variables, so Tailwind's alpha modifiers do
                  // nothing on them; the flagged tint is set inline.
                  style={flagged[currentQuestion] ? {
                    borderColor: 'color-mix(in srgb, var(--ss-warn) 55%, var(--ss-line))',
                    background: 'color-mix(in srgb, var(--ss-warn) 12%, transparent)',
                  } : undefined}
                >
                  <span aria-hidden>{flagged[currentQuestion] ? '⚑' : '⚐'}</span>
                  {flagged[currentQuestion] ? 'Flagged' : 'Flag for review'}
                </button>
              </div>

              {/* Stacked only where there is no room for the pinned column:
                  below lg, or beside a passage that already has it. */}
              <div className={currentPassage ? '' : 'lg:hidden'}>
                {question.image_url && (
                  <>
                    {question.figureGroup && <FigureGroupLabel group={question.figureGroup} />}
                    <ExamFigure src={question.image_url} className="mb-6" />
                  </>
                )}
                {question.diagram_svg && (
                  <div className="mb-6 overflow-x-auto rounded-2xl border border-ss-line bg-ss-panel p-4">
                    <DiagramSvg svg={question.diagram_svg} />
                  </div>
                )}
              </div>

              {currentPassage && (
                <PassageReader
                  passage={currentPassage}
                  source={currentPassageSource}
                  variant="stacked"
                />
              )}

              {/* The situation this question and its siblings share.
                  Printed once above the demand rather than inside every one
                  of them: five parts each restating it read as five copies
                  of the same question. */}
              {'scenario' in question && question.scenario && (
                <p className="mb-4 rounded-2xl border-l-4 border-ss-accent bg-ss-chip px-4 py-3 text-[15px] leading-relaxed text-ss-ink">
                  {question.scenario}
                </p>
              )}

              <h2
                id={`question-text-${currentQuestion}`}
                className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white mb-8 sm:mb-10 leading-relaxed tracking-tight"
              >
                {/* Stripped again here, not only at generation.
                    The marks chip above already says "2 marks", so a stem
                    ending "[2]" prints the allocation twice. Generation now
                    removes it, but a paper already sitting in a learner's
                    sessionStorage was made before that and still carries it,
                    and this costs nothing. */}
                <L>{stripPrintedMarks(isCurrentInteractive && question.kind === 'fill_blank' ? (question as InteractiveQuestion & { kind: 'fill_blank' }).question : question.question)}</L>
              </h2>

              {/* Interactive study */}
              {isCurrentInteractive && (
                <InteractiveQuestionPlayer
                  question={question as InteractiveQuestion}
                  value={interactiveAnswers[currentQuestion]}
                  onChange={handleInteractiveChange}
                />
              )}

              {/* MCQ options.
                  These were plain buttons whose selected state existed only as
                  a filled circle and an unlabelled tick, so a screen-reader
                  user could not tell which answer they had chosen — a WCAG
                  4.1.2 failure on the most important screen in the product.
                  They are now a real radio group: role, checked state, and
                  arrow-key movement, with a roving tabindex so Tab enters the
                  group once rather than stepping through every option. */}
              {!isCurrentLongForm && !isCurrentInteractive && (
                <div
                  role="radiogroup"
                  aria-labelledby={`question-text-${currentQuestion}`}
                  className="space-y-3 sm:space-y-4"
                  onKeyDown={(e) => {
                    const opts = (question as MCQQuestion).options
                    const forward = e.key === 'ArrowDown' || e.key === 'ArrowRight'
                    const back = e.key === 'ArrowUp' || e.key === 'ArrowLeft'
                    if (!forward && !back) return
                    e.preventDefault()
                    const current = selectedAnswers[currentQuestion]
                    const from = typeof current === 'number' ? current : forward ? -1 : 0
                    const next = (from + (forward ? 1 : -1) + opts.length) % opts.length
                    handleAnswerSelect(next)
                    // Move real focus with the selection, which is what the
                    // radio pattern expects.
                    const group = e.currentTarget as HTMLElement
                    const target = group.querySelectorAll<HTMLElement>('[role="radio"]')[next]
                    target?.focus()
                  }}
                >
                  {(question as MCQQuestion).options.map((option, index) => {
                    const checked = selectedAnswers[currentQuestion] === index
                    const isFocusable = checked || (selectedAnswers[currentQuestion] === undefined && index === 0)
                    return (
                      <motion.button
                        key={index}
                        type="button"
                        role="radio"
                        aria-checked={checked}
                        tabIndex={isFocusable ? 0 : -1}
                        onClick={() => handleAnswerSelect(index)}
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.99 }}
                        className={`mcq-option w-full text-left ${checked ? 'selected' : ''}`}
                      >
                        <div className="flex items-center gap-3 sm:gap-4">
                          {/* Decorative: the state is carried by aria-checked. */}
                          <div
                            aria-hidden
                            className={`w-5 h-5 sm:w-6 sm:h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${checked
                              ? 'border-apple-blue bg-apple-blue'
                              : 'border-gray-300 dark:border-gray-600'
                              }`}
                          >
                            {checked && <Check className="w-3 h-3 sm:w-4 sm:h-4 text-white" />}
                          </div>
                          <span className="flex-1 text-sm sm:text-base"><L>{option}</L></span>
                        </div>
                      </motion.button>
                    )
                  })}
                </div>
              )}

              {/* Long-form textarea */}
              {/* A one-mark answer is a word or a number. Giving it a
                  nine-row essay box and telling the learner to aim for
                  twenty-five words misdescribes the question -- the real
                  paper prints a single ruled line, sometimes with the unit
                  already beside it. */}
              {isCurrentLongForm && isShortAnswer(question) && (
                <div>
                  <div className="text-xs text-ss-slate mb-2">
                    One answer — a word, a phrase or a number.
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={longFormAnswers[currentQuestion] || ''}
                      onChange={(e) => handleLongFormChange(e.target.value)}
                      placeholder="Your answer"
                      autoComplete="off"
                      className="w-full max-w-md rounded-2xl border-2 border-gray-200 bg-gray-50 p-4 text-gray-900 transition-colors focus:border-blue-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800/60 dark:text-white dark:focus:border-blue-400 text-sm sm:text-base"
                    />
                    {question.short_answer?.unit && (
                      <span className="shrink-0 text-sm font-semibold text-ss-slate">
                        {question.short_answer.unit}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {isCurrentLongForm && !isShortAnswer(question) && (
                <div>
                  {/* A calculation is not measured in words.
                      A multi-mark Maths question is a `written` slot, which is
                      right for marking -- part marks are for working, and
                      working is marked against criteria rather than matched
                      against a word list. But it was also drawing the prose
                      box, so a live paper showed "Calculate 3 + 4 × 2 − 6 ÷ 3
                      using the correct order of operations" above a nine-row
                      textarea reading "Aim for ~25–40 words". The answer is 5.
                      Nine of twenty-nine questions on that paper looked like
                      that. Cambridge gives a calculation a working space and
                      an answer line, so that is what this draws. */}
                  {isCalculationDemand((question as LongFormQuestion).question) ? (
                    <>
                      <div className="text-xs text-ss-slate mb-2">
                        Show your working, then write your final answer.
                        {(question as LongFormQuestion).marks > 1 &&
                          ' Marks are given for the method as well as the answer.'}
                      </div>
                      <textarea
                        value={longFormAnswers[currentQuestion] || ''}
                        onChange={(e) => handleLongFormChange(e.target.value)}
                        placeholder="Working…"
                        className="w-full min-h-[120px] p-4 rounded-2xl border-2 border-ss-line bg-ss-panel text-ss-ink resize-y focus:outline-none focus:border-ss-accent transition-colors font-mono text-sm leading-relaxed"
                        rows={4}
                      />
                      <div className="mt-2 text-xs text-ss-slate">
                        {(question as LongFormQuestion).marks}{' '}
                        {(question as LongFormQuestion).marks === 1 ? 'mark' : 'marks'} available
                      </div>
                    </>
                  ) : (
                    <>
                  <div className="text-xs text-ss-slate mb-2">
                    {/* A composition is marked in bands -- content, structure,
                        sentences, vocabulary -- not a point per mark, and
                        telling a learner to "cover each criterion" for a
                        25-mark story sends them hunting for 25 points. */}
                    {isCompositionQuestion(question)
                      ? 'Plan first, then write it in full. It is marked on your ideas, how you organise them, your sentences and your vocabulary.'
                      : 'Write a detailed answer. Each mark has a specific criterion — cover as much as you can.'}
                  </div>
                  <textarea
                    value={longFormAnswers[currentQuestion] || ''}
                    onChange={(e) => handleLongFormChange(e.target.value)}
                    placeholder={`Write your answer here… (${(question as LongFormQuestion).marks} marks available)`}
                    className={`w-full ${isCompositionQuestion(question) ? 'min-h-[420px]' : 'min-h-[220px]'} p-4 rounded-2xl border-2 border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60 text-gray-900 dark:text-white resize-y focus:outline-none focus:border-blue-500 dark:focus:border-blue-400 transition-colors text-sm sm:text-base leading-relaxed`}
                    rows={isCompositionQuestion(question) ? 18 : 9}
                  />
                  <div className="mt-2 flex justify-between text-xs text-ss-slate">
                    <span>
                      {(longFormAnswers[currentQuestion] || '').split(/\s+/).filter(Boolean).length} words
                    </span>
                    {/* A per-mark target is right for a 2- or 4-mark answer and
                        nonsense for a composition: a 25-mark piece of writing
                        read "Aim for ~625–1000 words", which no Stage 9 learner
                        writes in the time. Above six marks the length is
                        whatever the task asks for, so no number is invented. */}
                    {(question as LongFormQuestion).marks <= 6 && (
                      <span>
                        Aim for ~{(question as LongFormQuestion).marks * 25}–{(question as LongFormQuestion).marks * 40} words
                      </span>
                    )}
                  </div>
                    </>
                  )}
                  {hintsEnabled && (
                    <LongformHintPanel
                      questionKey={currentQuestion}
                      hints={studentHintsOf(question as LongFormQuestion)}
                    />
                  )}
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          {/* Navigation */}
          <div className="flex justify-between items-center mt-4 sm:mt-6 gap-2">
            <motion.button
              onClick={() => setCurrentQuestion(Math.max(0, currentQuestion - 1))}
              disabled={currentQuestion === 0}
              whileHover={{ scale: currentQuestion === 0 ? 1 : 1.05 }}
              whileTap={{ scale: currentQuestion === 0 ? 1 : 0.95 }}
              className="btn-secondary flex items-center gap-1 sm:gap-2 disabled:opacity-60 disabled:cursor-not-allowed text-sm sm:text-base px-3 sm:px-6 py-2 sm:py-3"
            >
              <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="hidden sm:inline">Previous</span>
              <span className="sm:hidden">Prev</span>
            </motion.button>

            {currentQuestion === assessment.questions.length - 1 ? (
              <motion.button
                onClick={() => (blanks.length > 0 ? setShowUnansweredCheck(true) : handleSubmit())}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="btn-primary text-sm sm:text-base px-3 sm:px-6 py-2 sm:py-3"
              >
                <span className="hidden sm:inline">Submit Assessment</span>
                <span className="sm:hidden">Submit</span>
              </motion.button>
            ) : (
              <motion.button
                onClick={() => setCurrentQuestion(Math.min(assessment.questions.length - 1, currentQuestion + 1))}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="btn-primary flex items-center gap-1 sm:gap-2 text-sm sm:text-base px-3 sm:px-6 py-2 sm:py-3"
              >
                <span>Next</span>
                <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />
              </motion.button>
            )}
          </div>

          {/* Legend for mixed */}
          {(assessment.questions.some(isLongForm) || assessment.questions.some(isInteractive)) &&
            assessment.questions.some((q) => !isLongForm(q) && !isInteractive(q)) && (
            <div className="flex justify-center gap-4 mt-3 text-xs text-ss-slate flex-wrap">
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded-sm bg-green-500 inline-block"></span> MCQ answered
              </span>
              {assessment.questions.some(isInteractive) && (
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded-sm bg-teal-500 inline-block"></span> Interactive answered
                </span>
              )}
              {assessment.questions.some(isLongForm) && (
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded-sm bg-purple-500 inline-block"></span> Written answered
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {isSubmitted && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          role="status"
          aria-live="assertive"
          className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50"
        >
          <motion.div
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            className="glass dark:glass-dark p-6 sm:p-8 rounded-apple text-center max-w-sm mx-4"
          >
            <div className="w-12 h-12 sm:w-16 sm:h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4">
              <Check className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
            </div>
            <h3 className="text-xl sm:text-2xl font-bold mb-2">Assessment Submitted!</h3>
            <p className="text-sm sm:text-base text-apple-dark-gray">Calculating your results…</p>
          </motion.div>
        </motion.div>
      )}
    </div>
  )
}

export default function AssessmentPage() {
  return (
    <Suspense fallback={<AssessmentLoading />}>
      <AssessmentPageClient />
    </Suspense>
  )
}
