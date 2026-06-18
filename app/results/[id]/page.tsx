'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Check, Download } from 'lucide-react'
import Latex from 'react-latex-next'
import 'katex/dist/katex.min.css'
import { useAuth } from '@/components/AuthProvider'
import FeedbackPanel from '@/components/FeedbackPanel'
import { supabase } from '@/lib/supabase'

function L({ children }: { children: string }) {
    const text = children ?? ''
    const hasDelimiters = text.includes('$') || text.includes('\\(') || text.includes('\\[')
    const wrapped = hasDelimiters ? text : /\\[a-zA-Z]|[\^_]/.test(text) ? `$${text}$` : text
    return <Latex>{wrapped}</Latex>
}

interface MCQQuestion {
    id: number
    type?: 'mcq'
    question: string
    options: string[]
    correct_answer: number
    explanation: string
    passage?: string
    passage_source?: string
    diagram_svg?: string
}

interface LongFormQuestion {
    id: number
    type: 'longform'
    question: string
    marks: number
    marking_criteria: string[]
    model_answer?: string
    explanation?: string
    passage?: string
    passage_source?: string
    diagram_svg?: string
}

type Question = MCQQuestion | LongFormQuestion

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

function isLongForm(q: Question): q is LongFormQuestion {
    return q.type === 'longform'
}

function getGradeFromScore(score: number): string {
    if (score >= 90) return 'A+'
    if (score >= 80) return 'A'
    if (score >= 70) return 'B+'
    if (score >= 60) return 'B'
    if (score >= 50) return 'C'
    return 'D'
}

function normalizeFeedback(feedback: unknown): string {
    if (!feedback) return 'No feedback available.'
    if (typeof feedback === 'string') return feedback
    if (typeof feedback === 'object' && feedback && 'text' in feedback) {
        const text = (feedback as { text?: string }).text
        if (typeof text === 'string' && text.trim()) return text
    }
    return 'No feedback available.'
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

function PassageBox({ passage, source }: { passage: string; source?: string }) {
    const [collapsed, setCollapsed] = useState(false)
    const wordCount = passage.split(/\s+/).filter(Boolean).length

    return (
        <div className="mb-6 rounded-2xl border-2 border-amber-300 dark:border-amber-600/60 bg-amber-50 dark:bg-amber-900/10 overflow-hidden shadow-sm">
            <div className="flex items-center justify-between px-4 py-3 bg-amber-100 dark:bg-amber-900/30 border-b border-amber-200 dark:border-amber-700/40">
                <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-amber-800 dark:text-amber-300 text-sm font-bold tracking-tight">
                        Reading extract - read carefully before answering
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-amber-200 dark:bg-amber-800/50 text-amber-700 dark:text-amber-300 text-xs font-medium">
                        ~{wordCount} words
                    </span>
                </div>
                <button
                    onClick={() => setCollapsed(!collapsed)}
                    className="text-xs font-medium text-amber-700 dark:text-amber-400 hover:underline flex-shrink-0 ml-3"
                >
                    {collapsed ? 'Show extract' : 'Hide extract'}
                </button>
            </div>

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
                        <div className="px-5 py-4 max-h-[480px] overflow-y-auto">
                            <p className="text-sm sm:text-base text-gray-800 dark:text-gray-200 leading-[1.85] whitespace-pre-wrap font-serif">
                                {passage}
                            </p>
                        </div>
                        <div className="px-5 pb-3 text-xs text-amber-600 dark:text-amber-500 italic">
                            Scroll up to re-read the extract at any time while answering.
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}

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
                            Long form - {q.marks} marks
                        </span>
                    </div>
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

            <div className="ml-12 mb-4">
                <div className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Your Answer</div>
                <div className="bg-gray-50 dark:bg-gray-800/60 rounded-xl p-4 border border-gray-200 dark:border-gray-700 min-h-[60px]">
                    {studentAnswer ? (
                        <AnnotatedText
                            answer={studentAnswer}
                            highlight={highlightQuote ?? null}
                            highlightColor={highlightColor}
                        />
                    ) : (
                        <span className="text-gray-400 italic text-sm">No answer written</span>
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
                        <span className="font-semibold">{activeCrit.met ? 'Criterion met:' : 'Criterion missed:'}</span>{' '}
                        {activeCrit.note}
                    </motion.div>
                )}
            </div>

            {isGraded && (
                <div className="ml-12 mb-4">
                    <div className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">
                        Marking criteria - click any to see why
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
                                    {cr.met ? 'Y' : 'N'}
                                </span>
                                <span className="text-sm text-gray-700 dark:text-gray-300 flex-1">{cr.criterion}</span>
                                <span className="text-xs text-gray-400 flex-shrink-0 mt-0.5">tap</span>
                            </motion.button>
                        ))}
                    </div>

                    {grade.general_feedback && (
                        <div className="mt-3 p-3 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/30 text-sm text-blue-800 dark:text-blue-200">
                            <span className="font-semibold">AI Feedback: </span>{grade.general_feedback}
                        </div>
                    )}
                </div>
            )}

            {!isGraded && (
                <div className="ml-12 mb-4 space-y-3">
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                        <div className="h-3 w-3 rounded-full border-2 border-gray-400 border-t-transparent animate-spin" />
                        Grading data not available for this attempt.
                    </div>
                    {Array.isArray(q.marking_criteria) && q.marking_criteria.length > 0 && (
                        <div>
                            <div className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Marking criteria</div>
                            <div className="space-y-2">
                                {q.marking_criteria.map((criterion, cIdx) => (
                                    <div
                                        key={cIdx}
                                        className="w-full text-left flex items-start gap-2 p-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/40"
                                    >
                                        <span className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold mt-0.5 bg-gray-300 text-gray-700 dark:bg-gray-700 dark:text-gray-200">
                                            ?
                                        </span>
                                        <span className="text-sm text-gray-700 dark:text-gray-300 flex-1">{criterion}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {q.model_answer && (
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
            )}
        </motion.div>
    )
}

function McqResultCard({
    q,
    idx,
    userAnswer,
}: {
    q: MCQQuestion
    idx: number
    userAnswer: number | null
}) {
    const isCorrect = userAnswer !== null && userAnswer === q.correct_answer

    return (
        <motion.div
            key={idx}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.05 }}
            className={`glass dark:glass-dark rounded-apple p-6 border-l-4 ${isCorrect ? 'border-l-green-500' : 'border-l-red-500'}`}
        >
            <div className="flex items-start gap-4 mb-4">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-1 ${isCorrect
                    ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400'
                    : 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
                    }`}>
                    {isCorrect ? <Check className="w-5 h-5" /> : <span className="font-bold text-lg">x</span>}
                </div>
                <div className="flex-1">
                    <div className="text-sm text-apple-dark-gray mb-1">Question {idx + 1}</div>
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
                {(q.options ?? []).map((opt, optIdx) => {
                    let optClass = 'p-3 rounded-xl text-sm sm:text-base border '
                    if (optIdx === q.correct_answer) {
                        optClass += 'bg-green-50 border-green-200 text-green-800 dark:bg-green-900/20 dark:border-green-800/50 dark:text-green-200 font-medium'
                    } else if (userAnswer !== null && optIdx === userAnswer) {
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
                            {userAnswer !== null && optIdx === userAnswer && optIdx !== q.correct_answer && (
                                <span className="ml-2 text-xs uppercase tracking-wider font-bold text-red-600 dark:text-red-400">(Your answer)</span>
                            )}
                        </div>
                    )
                })}
            </div>

            <div className="ml-12 bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 text-sm text-apple-dark-gray">
                <span className="font-semibold text-gray-900 dark:text-gray-100">Explanation: </span>
                <L>{q.explanation ?? ''}</L>
            </div>
        </motion.div>
    )
}

function buildReportHtml({
    subject,
    topic,
    date,
    grade,
    score,
    feedback,
    questions,
    mcqAnswers,
    longFormAnswers,
    longFormGrades,
}: {
    subject: string
    topic: string
    date: string
    grade: string
    score: number
    feedback: string
    questions: Question[]
    mcqAnswers: Record<string, number>
    longFormAnswers: Record<string, string>
    longFormGrades: Record<string, LongFormGrade>
}): string {
    const safe = (value: unknown) => String(value ?? '')
    const questionBlocks = questions.map((q, i) => {
        const idx = q.id ?? i
        if (isLongForm(q)) {
            const g = longFormGrades[idx] ?? longFormGrades[String(idx)]
            const studentAnswer = longFormAnswers[idx] ?? longFormAnswers[String(idx)] ?? ''
            const criteriaRows = g?.criteria_results?.map((c) => `
        <tr>
          <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;">${safe(c.criterion)}</td>
          <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;text-align:center;">${c.met ? 'Yes' : 'No'}</td>
          <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;color:#6b7280;font-size:13px;">${safe(c.note)}</td>
        </tr>`).join('') ?? ''
            const fallbackCriteria = !criteriaRows && Array.isArray(q.marking_criteria)
                ? q.marking_criteria.map((c) => `
            <tr>
              <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;">${safe(c)}</td>
              <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;text-align:center;">?</td>
              <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;color:#6b7280;font-size:13px;">Criteria data not graded.</td>
            </tr>`).join('')
                : ''
            const criteriaBlock = criteriaRows
                ? `<table style="width:100%;border-collapse:collapse;margin-bottom:12px;">
            <thead><tr style="background:#f9fafb;">
              <th style="padding:6px 10px;text-align:left;font-size:11px;color:#6b7280;font-weight:700;text-transform:uppercase;">Criterion</th>
              <th style="padding:6px 10px;text-align:center;font-size:11px;color:#6b7280;font-weight:700;text-transform:uppercase;">Met</th>
              <th style="padding:6px 10px;text-align:left;font-size:11px;color:#6b7280;font-weight:700;text-transform:uppercase;">Note</th>
            </tr></thead><tbody>${criteriaRows}</tbody></table>`
                : fallbackCriteria
                    ? `<table style="width:100%;border-collapse:collapse;margin-bottom:12px;">
              <thead><tr style="background:#f9fafb;">
                <th style="padding:6px 10px;text-align:left;font-size:11px;color:#6b7280;font-weight:700;text-transform:uppercase;">Criterion</th>
                <th style="padding:6px 10px;text-align:center;font-size:11px;color:#6b7280;font-weight:700;text-transform:uppercase;">Met</th>
                <th style="padding:6px 10px;text-align:left;font-size:11px;color:#6b7280;font-weight:700;text-transform:uppercase;">Note</th>
              </tr></thead><tbody>${fallbackCriteria}</tbody></table>`
                    : ''

            return `
        <div style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:20px;margin-bottom:16px;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
            <span style="font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.06em;">Long form - Q${i + 1}</span>
            <span style="font-size:12px;font-weight:700;color:#1d4ed8;">${g ? `${g.marks_awarded}/${g.marks_total}` : 'Marks not available'}</span>
          </div>
          <p style="font-size:14px;font-weight:600;color:#111827;margin-bottom:12px;">${safe(q.question)}</p>
          ${q.passage ? `<div style="background:#f9fafb;border-left:3px solid #d1d5db;padding:12px 16px;border-radius:0 8px 8px 0;margin-bottom:12px;font-size:13px;color:#4b5563;">${safe(q.passage)}</div>` : ''}
          <div style="background:#eff6ff;border-radius:8px;padding:12px 16px;margin-bottom:12px;">
            <p style="font-size:11px;font-weight:700;color:#2563eb;text-transform:uppercase;margin-bottom:6px;">Your answer</p>
            <p style="font-size:13px;color:#1e3a5f;white-space:pre-wrap;">${studentAnswer || '<em style="color:#9ca3af">No answer provided</em>'}</p>
          </div>
          ${criteriaBlock}
          ${g?.general_feedback ? `<div style="background:#f0fdf4;border-radius:8px;padding:12px 16px;font-size:13px;color:#166534;"><strong>Feedback:</strong> ${safe(g.general_feedback)}</div>` : ''}
          ${q.model_answer ? `<div style="background:#f8fafc;border-radius:8px;padding:12px 16px;margin-top:12px;font-size:13px;color:#334155;"><strong>Model answer:</strong> ${safe(q.model_answer)}</div>` : ''}
        </div>
      `
        }

        const studentAnswer = mcqAnswers[idx] ?? mcqAnswers[String(idx)]
        const optionsHtml = (q.options ?? []).map((opt, oi) => {
            const isCorrect = oi === q.correct_answer
            const isChosen = Number(studentAnswer) === oi
            const bg = isCorrect ? '#f0fdf4' : isChosen ? '#fef2f2' : '#f9fafb'
            const border = isCorrect ? '#86efac' : isChosen ? '#fca5a5' : '#e5e7eb'
            const label = isCorrect ? 'Correct' : isChosen ? 'Your answer' : ''
            return `
        <div style="padding:10px 14px;border:1px solid ${border};border-radius:8px;background:${bg};margin-bottom:6px;font-size:13px;color:#374151;">
          ${safe(opt)}${label ? ` <span style="font-size:11px;font-weight:700;">(${label})</span>` : ''}
        </div>`
        }).join('')

        return `
      <div style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:20px;margin-bottom:16px;">
        <span style="font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;display:block;margin-bottom:10px;">MCQ - Q${i + 1}</span>
        <p style="font-size:14px;font-weight:600;color:#111827;margin-bottom:14px;">${safe(q.question)}</p>
        ${optionsHtml}
        ${q.explanation ? `<div style="margin-top:12px;background:#fefce8;border-radius:8px;padding:10px 14px;font-size:13px;color:#713f12;"><strong>Explanation:</strong> ${safe(q.explanation)}</div>` : ''}
      </div>
    `
    }).join('')

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${subject} Report</title>
  <style>
    @page { size: A4; margin: 14mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #111827; background: #f9fafb; }
    .page { max-width: 860px; margin: 0 auto; padding: 40px 24px; }
    @media print {
      body { background: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .page { padding: 20px; }
    }
  </style>
</head>
<body>
  <div class="page">
    <div style="background:linear-gradient(135deg,#1d4ed8,#7c3aed);color:#fff;border-radius:16px;padding:32px;margin-bottom:28px;">
      <h1 style="margin:0 0 6px;font-size:26px;font-weight:800;">${subject}</h1>
      <p style="margin:0 0 4px;opacity:.85;font-size:15px;">${topic}</p>
      <p style="margin:0;opacity:.7;font-size:13px;">${date}</p>
      <div style="display:flex;gap:40px;margin-top:24px;">
        <div><div style="font-size:48px;font-weight:900;line-height:1;">${score}%</div><div style="font-size:12px;opacity:.8;text-transform:uppercase;letter-spacing:.05em;">Score</div></div>
        <div style="width:1px;background:rgba(255,255,255,.3);"></div>
        <div><div style="font-size:48px;font-weight:900;line-height:1;">${grade}</div><div style="font-size:12px;opacity:.8;text-transform:uppercase;letter-spacing:.05em;">Grade</div></div>
      </div>
    </div>

    <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:12px;padding:24px;margin-bottom:28px;">
      <h2 style="margin:0 0 12px;font-size:17px;font-weight:700;color:#1e40af;">AI Feedback</h2>
      <div style="font-size:14px;line-height:1.8;color:#1e3a8a;white-space:pre-wrap;">${safe(feedback)}</div>
    </div>

    <h2 style="font-size:20px;font-weight:800;margin-bottom:16px;">Detailed Review</h2>
    ${questionBlocks}

    <div style="text-align:center;margin-top:40px;padding-top:20px;border-top:1px solid #e5e7eb;font-size:12px;color:#9ca3af;">
      Generated by Brain Ink AI - ${date}
    </div>
  </div>
</body>
</html>`
}

export default function ResultDetailPage() {
    const { user, isLoading } = useAuth()
    const router = useRouter()
    const params = useParams()
    const resultId = Array.isArray(params?.id) ? params?.id[0] : params?.id

    const [isLoadingResult, setIsLoadingResult] = useState(true)
    const [result, setResult] = useState<any>(null)
    const [questions, setQuestions] = useState<Question[]>([])
    const [feedback, setFeedback] = useState('')

    useEffect(() => {
        if (!isLoading && !user) router.push('/login')
    }, [user, isLoading, router])

    useEffect(() => {
        if (!user?.id || !resultId) return
        const isTeacher = user?.role === 'teacher'

        const load = async () => {
            setIsLoadingResult(true)
            let query = supabase
                .from('results')
                .select('*, assessments(subject, difficulty, questions_data)')
                .eq('id', resultId)

            if (!isTeacher) {
                query = query.eq('user_id', user.id)
            }

            let { data, error } = await query.single()

            if ((error || !data) && error?.message?.includes('questions_data')) {
                let fallbackQuery = supabase
                    .from('results')
                    .select('*, assessments(subject, difficulty)')
                    .eq('id', resultId)

                if (!isTeacher) {
                    fallbackQuery = fallbackQuery.eq('user_id', user.id)
                }

                const fallback = await fallbackQuery.single()
                data = fallback.data
                error = fallback.error
            }

            if (error || !data) {
                console.error('Failed to load result:', error)
                setIsLoadingResult(false)
                return
            }

            const qData = data.questions_data ?? data.assessments?.questions_data ?? []
            setQuestions(Array.isArray(qData) ? qData : [])
            setFeedback(normalizeFeedback(data.feedback))
            setResult(data)
            setIsLoadingResult(false)
        }

        load()
    }, [user, resultId])

    const answers = result?.answers ?? {}
    const mcqAnswers = answers?.mcq ?? answers ?? {}
    const longFormAnswers = answers?.longform ?? {}
    const longFormGrades = result?.longform_grades ?? {}

    const score = Number(result?.percentage ?? result?.score ?? 0)
    const grade = result?.grade ?? getGradeFromScore(score)
    const subject = result?.assessments?.subject || 'Assessment'
    const topic = result?.assessments?.difficulty || 'Assessment'
    const completedOn = result?.created_at
        ? new Date(result.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        : ''

    const totals = useMemo(() => {
        let mcqTotal = 0
        let mcqCorrect = 0
        let longFormTotal = 0
        let longFormEarned = 0

        questions.forEach((q, idx) => {
            if (isLongForm(q)) {
                longFormTotal += q.marks ?? 0
                const g = longFormGrades[idx] ?? longFormGrades[String(idx)]
                if (g?.marks_awarded) longFormEarned += g.marks_awarded
            } else {
                mcqTotal += 1
                const ans = mcqAnswers[idx] ?? mcqAnswers[String(idx)]
                if (Number(ans) === q.correct_answer) mcqCorrect += 1
            }
        })

        return { mcqTotal, mcqCorrect, longFormTotal, longFormEarned }
    }, [questions, mcqAnswers, longFormGrades])

    const handleDownload = () => {
        if (!result) return
        const reportTitle = `${subject.replace(/[^a-z0-9]+/gi, '_') || 'Assessment'}_Report_${new Date().toISOString().slice(0, 10)}`
        const html = buildReportHtml({
            subject,
            topic,
            date: completedOn || new Date().toLocaleDateString('en-US'),
            grade,
            score,
            feedback,
            questions,
            mcqAnswers,
            longFormAnswers,
            longFormGrades,
        })

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

    if (isLoading || isLoadingResult) {
        return (
            <div className="min-h-screen bg-[#FAFAFA] dark:bg-[#0A0A0A] flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600 mx-auto mb-4" />
                    <p className="text-gray-500 dark:text-gray-400 font-medium">Loading results...</p>
                </div>
            </div>
        )
    }

    if (!result) {
        return (
            <div className="min-h-screen bg-[#FAFAFA] dark:bg-[#0A0A0A] flex items-center justify-center">
                <div className="text-center">
                    <p className="text-gray-700 dark:text-gray-300 font-semibold">Result not found.</p>
                    <button
                        onClick={() => router.push('/')}
                        className="mt-4 px-5 py-2 text-sm font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-colors"
                    >
                        Back to dashboard
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-[#FAFAFA] dark:bg-[#0A0A0A] py-8 px-4 sm:px-6 lg:px-8">
            <div className="max-w-4xl mx-auto space-y-8">
                <div className="flex items-center justify-between">
                    <button
                        onClick={() => router.push('/')}
                        className="flex items-center gap-2 text-sm font-semibold text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Dashboard
                    </button>
                    <button
                        onClick={handleDownload}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-semibold text-xs sm:text-sm hover:opacity-80 transition-opacity"
                    >
                        <Download className="w-4 h-4" />
                        Save as PDF
                    </button>
                </div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white dark:bg-[#1c1c1e] rounded-3xl p-8 sm:p-12 text-center shadow-xl border border-gray-200/50 dark:border-gray-800/50"
                >
                    <div className="w-20 h-20 mx-auto bg-green-50 dark:bg-green-900/20 rounded-full flex items-center justify-center mb-6">
                        <Check className="w-10 h-10 text-green-500" />
                    </div>
                    <h1 className="text-3xl sm:text-4xl font-bold mb-3 text-gray-900 dark:text-white tracking-tight">
                        Assessment Review
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400 mb-10 text-lg">
                        {subject} {topic ? `- ${topic}` : ''}
                    </p>

                    <div className="flex justify-center items-center gap-12 mb-8">
                        <div className="text-center">
                            <div className="text-6xl font-bold text-blue-600 dark:text-blue-400 mb-2 tracking-tighter">
                                {score}%
                            </div>
                            <div className="text-sm font-medium text-gray-400 uppercase tracking-widest">Final Score</div>
                        </div>
                        <div className="w-px h-20 bg-gray-200 dark:bg-gray-800" />
                        <div className="text-center">
                            <div className="text-6xl font-bold text-blue-600 dark:text-blue-400 mb-2 tracking-tighter">
                                {grade}
                            </div>
                            <div className="text-sm font-medium text-gray-400 uppercase tracking-widest">Grade</div>
                        </div>
                    </div>

                    {(totals.mcqTotal > 0 || totals.longFormTotal > 0) && (
                        <div className="flex justify-center gap-6 mb-8 text-sm text-gray-500 dark:text-gray-400">
                            {totals.mcqTotal > 0 && (
                                <span>MCQ: {totals.mcqCorrect}/{totals.mcqTotal}</span>
                            )}
                            {totals.longFormTotal > 0 && (
                                <span>Written: {totals.longFormEarned}/{totals.longFormTotal} marks</span>
                            )}
                            {completedOn && (
                                <span>Completed: {completedOn}</span>
                            )}
                        </div>
                    )}

                    <FeedbackPanel feedback={feedback} />
                </motion.div>

                <div className="space-y-6">
                    <h2 className="text-2xl font-bold px-2">Detailed Review</h2>
                    {questions.length === 0 ? (
                        <div className="bg-white dark:bg-gray-900 rounded-3xl p-8 border border-gray-200/60 dark:border-white/5 text-center text-sm text-gray-500">
                            Question review data is not available for this attempt.
                        </div>
                    ) : (
                        questions.map((q, idx) => {
                            if (isLongForm(q)) {
                                const answer = longFormAnswers[idx] ?? longFormAnswers[String(idx)] ?? ''
                                const grade = longFormGrades[idx] ?? longFormGrades[String(idx)]
                                return (
                                    <LongFormResultCard
                                        key={idx}
                                        q={q}
                                        idx={idx}
                                        studentAnswer={answer}
                                        grade={grade}
                                    />
                                )
                            }

                            const answer = mcqAnswers[idx] ?? mcqAnswers[String(idx)]
                            const userAnswer = Number.isFinite(Number(answer)) ? Number(answer) : null
                            return (
                                <McqResultCard
                                    key={idx}
                                    q={q}
                                    idx={idx}
                                    userAnswer={userAnswer}
                                />
                            )
                        })
                    )}
                </div>
            </div>
        </div>
    )
}
