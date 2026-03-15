'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { Calendar, Download, ChevronDown, BookOpen } from 'lucide-react'
import { useState } from 'react'

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

const GRADE_META: Record<string, { color: string; bg: string; darkBg: string }> = {
  'A+': { color: 'text-emerald-700 dark:text-emerald-300', bg: 'bg-emerald-50', darkBg: 'dark:bg-emerald-900/20' },
  'A':  { color: 'text-emerald-700 dark:text-emerald-300', bg: 'bg-emerald-50', darkBg: 'dark:bg-emerald-900/20' },
  'B+': { color: 'text-blue-700 dark:text-blue-300',    bg: 'bg-blue-50',    darkBg: 'dark:bg-blue-900/20' },
  'B':  { color: 'text-blue-700 dark:text-blue-300',    bg: 'bg-blue-50',    darkBg: 'dark:bg-blue-900/20' },
  'C':  { color: 'text-amber-700 dark:text-amber-300',  bg: 'bg-amber-50',   darkBg: 'dark:bg-amber-900/20' },
  'D':  { color: 'text-red-600 dark:text-red-400',      bg: 'bg-red-50',     darkBg: 'dark:bg-red-900/20' },
}

const SCORE_BAR_COLOR = (score: number) =>
  score >= 70 ? 'bg-emerald-500' : score >= 50 ? 'bg-amber-500' : 'bg-red-500'

function buildReportHtml(a: Assessment): string {
  const { subject, topic, date, grade, score, percentage, feedback, questions_data, answers, longform_grades } = a
  const accentColor = grade === 'A+' || grade === 'A' ? '#10b981' : grade === 'B+' || grade === 'B' ? '#3b82f6' : grade === 'C' ? '#f59e0b' : '#ef4444'

  let questionsHtml = ''
  if (questions_data && answers) {
    questionsHtml = questions_data.map((q: any, i: number) => {
      const idx = q.id ?? i
      const studentAnswer = answers[idx] ?? answers[String(idx)] ?? ''

      if (q.type === 'longform') {
        const gd = longform_grades?.[idx] ?? longform_grades?.[String(idx)]
        const criteriaRows = gd?.criteria_results?.map((c: any) => `
          <tr>
            <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;font-size:13px;color:#374151;">${c.criterion}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;text-align:center;font-size:14px;">${c.met ? '✅' : '❌'}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;font-size:12px;color:#6b7280;">${c.note ?? ''}</td>
          </tr>`).join('') ?? ''
        return `
          <div style="border:1px solid #e5e7eb;border-radius:12px;padding:20px;margin-bottom:16px;background:#fff;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
              <span style="font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.06em;">Long Form · Q${i + 1}</span>
              ${gd ? `<span style="font-size:13px;font-weight:700;color:${accentColor}">${gd.marks_awarded}/${gd.marks_total} marks</span>` : ''}
            </div>
            <p style="font-size:14px;font-weight:600;color:#111827;margin-bottom:12px;">${q.question}</p>
            ${q.passage ? `<div style="background:#f9fafb;border-left:3px solid #d1d5db;padding:12px 16px;border-radius:0 8px 8px 0;margin-bottom:12px;font-size:13px;color:#4b5563;line-height:1.6;">${q.passage}</div>` : ''}
            <div style="background:#eff6ff;border-radius:8px;padding:12px 16px;margin-bottom:12px;">
              <p style="font-size:11px;font-weight:700;color:#2563eb;text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px;">Your Answer</p>
              <p style="font-size:13px;color:#1e3a5f;line-height:1.6;white-space:pre-wrap;">${studentAnswer || '<em style="color:#9ca3af">No answer provided</em>'}</p>
            </div>
            ${criteriaRows ? `<table style="width:100%;border-collapse:collapse;margin-bottom:12px;font-size:13px;">
              <thead><tr style="background:#f9fafb;">
                <th style="padding:8px 12px;text-align:left;font-weight:600;color:#6b7280;font-size:11px;text-transform:uppercase;">Criterion</th>
                <th style="padding:8px 12px;text-align:center;font-weight:600;color:#6b7280;font-size:11px;text-transform:uppercase;">Met</th>
                <th style="padding:8px 12px;text-align:left;font-weight:600;color:#6b7280;font-size:11px;text-transform:uppercase;">Note</th>
              </tr></thead>
              <tbody>${criteriaRows}</tbody>
            </table>` : ''}
            ${gd?.general_feedback ? `<div style="background:#f0fdf4;border-radius:8px;padding:12px 16px;font-size:13px;color:#166534;line-height:1.5;"><strong>Feedback:</strong> ${gd.general_feedback}</div>` : ''}
          </div>`
      }

      const optionsHtml = (q.options ?? []).map((opt: string, oi: number) => {
        const isCorrect = oi === q.correct_answer
        const isChosen = String(oi) === String(studentAnswer) || oi === Number(studentAnswer)
        const bg = isCorrect ? '#f0fdf4' : isChosen && !isCorrect ? '#fef2f2' : '#f9fafb'
        const border = isCorrect ? '#86efac' : isChosen && !isCorrect ? '#fca5a5' : '#e5e7eb'
        return `<div style="background:${bg};border:1px solid ${border};border-radius:8px;padding:10px 14px;margin-bottom:6px;font-size:13px;color:#374151;">
          ${isCorrect ? '✅ ' : isChosen && !isCorrect ? '❌ ' : '&nbsp;&nbsp;&nbsp; '}${opt}
        </div>`
      }).join('')

      return `
        <div style="border:1px solid #e5e7eb;border-radius:12px;padding:20px;margin-bottom:16px;background:#fff;">
          <span style="font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.06em;display:block;margin-bottom:10px;">MCQ · Q${i + 1}</span>
          <p style="font-size:14px;font-weight:600;color:#111827;margin-bottom:14px;">${q.question}</p>
          ${optionsHtml}
          ${q.explanation ? `<div style="margin-top:12px;background:#fefce8;border-radius:8px;padding:10px 14px;font-size:13px;color:#713f12;"><strong>Explanation:</strong> ${q.explanation}</div>` : ''}
        </div>`
    }).join('')
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${subject} — Brain Ink Report</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Inter','Segoe UI',sans-serif;background:#f4f4f5;color:#111827;padding:32px 20px;line-height:1.6;-webkit-font-smoothing:antialiased;}
.wrap{max-width:720px;margin:0 auto}
</style>
</head>
<body>
<div class="wrap">
  <div style="background:linear-gradient(135deg,#1d4ed8 0%,#2563eb 60%,#4f46e5 100%);color:#fff;border-radius:16px;padding:28px 32px;margin-bottom:20px;">
    <p style="font-size:11px;font-weight:700;opacity:.65;text-transform:uppercase;letter-spacing:.1em;margin-bottom:10px;">Brain Ink · Assessment Report</p>
    <h1 style="font-size:24px;font-weight:800;margin-bottom:4px;">${subject}</h1>
    <p style="opacity:.8;font-size:14px;">${topic}</p>
    <div style="display:flex;gap:28px;margin-top:20px;flex-wrap:wrap;">
      <div><p style="font-size:10px;opacity:.6;text-transform:uppercase;letter-spacing:.06em;margin-bottom:3px;">Date</p><p style="font-size:15px;font-weight:700;">${date}</p></div>
      <div><p style="font-size:10px;opacity:.6;text-transform:uppercase;letter-spacing:.06em;margin-bottom:3px;">Grade</p><p style="font-size:15px;font-weight:700;">${grade}</p></div>
      <div><p style="font-size:10px;opacity:.6;text-transform:uppercase;letter-spacing:.06em;margin-bottom:3px;">Score</p><p style="font-size:15px;font-weight:700;">${percentage ?? score}%</p></div>
    </div>
  </div>

  <div style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:24px;margin-bottom:20px;">
    <h2 style="font-size:13px;font-weight:700;color:#111827;margin-bottom:14px;display:flex;align-items:center;gap:8px;">🏆 Performance Insights</h2>
    <div style="font-size:14px;color:#374151;line-height:1.7;white-space:pre-wrap;">${feedback}</div>
  </div>

  ${questionsHtml ? `<h2 style="font-size:13px;font-weight:700;color:#374151;margin-bottom:14px;text-transform:uppercase;letter-spacing:.05em;">Question Review</h2>${questionsHtml}` : ''}

  <p style="text-align:center;font-size:12px;color:#9ca3af;margin-top:28px;padding-top:20px;border-top:1px solid #f3f4f6;">Generated by Brain Ink AI · ${date}</p>
</div>
</body>
</html>`
}

export default function AssessmentCard({ assessment }: { assessment: Assessment }) {
  const [showFeedback, setShowFeedback] = useState(false)

  const gradeMeta = GRADE_META[assessment.grade] ?? GRADE_META['D']
  const pct = assessment.percentage ?? assessment.score

  function downloadReport() {
    const html = buildReportHtml(assessment)
    const blob = new Blob([html], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${assessment.subject.replace(/\s+/g, '_')}_${assessment.date.replace(/[\s,]+/g, '_')}_report.html`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="relative bg-white dark:bg-gray-900 border border-gray-200/80 dark:border-gray-800/80 rounded-2xl overflow-visible transition-all duration-200 hover:shadow-lg hover:shadow-black/5 dark:hover:shadow-black/30 hover:-translate-y-0.5 group">

      {/* Card body */}
      <div className="p-5">

        {/* Top row: subject icon + name + grade badge */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center flex-shrink-0">
              <BookOpen className="w-4 h-4 text-blue-500 dark:text-blue-400" />
            </div>
            <h3 className="text-sm font-bold text-gray-900 dark:text-white truncate leading-tight">
              {assessment.subject}
            </h3>
          </div>
          <span className={`flex-shrink-0 text-xs font-bold px-2.5 py-1 rounded-lg ${gradeMeta.color} ${gradeMeta.bg} ${gradeMeta.darkBg}`}>
            {assessment.grade}
          </span>
        </div>

        {/* Topic */}
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-4 line-clamp-1 pl-[42px]">
          {assessment.topic}
        </p>

        {/* Score bar */}
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <div className="flex-1 h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
              className={`h-full rounded-full ${SCORE_BAR_COLOR(pct)}`}
            />
          </div>
          <span className="text-xs font-bold tabular-nums text-gray-700 dark:text-gray-300 flex-shrink-0">
            {pct}%
          </span>
        </div>

        {/* Date */}
        <div className="flex items-center gap-1.5 mt-3">
          <Calendar className="w-3 h-3 text-gray-400" />
          <span className="text-[11px] text-gray-400">{assessment.date}</span>
        </div>
      </div>

      {/* Divider */}
      <div className="h-px mx-5 bg-gray-100 dark:bg-gray-800/60" />

      {/* Action row */}
      <div className="flex items-center justify-between px-5 py-3 gap-2">
        <button
          onClick={downloadReport}
          className="flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors py-1"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Download</span>
        </button>

        <button
          onClick={() => setShowFeedback(v => !v)}
          className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${
            showFeedback
              ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
              : 'bg-gray-50 text-gray-600 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700/60'
          }`}
        >
          <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${showFeedback ? 'rotate-180' : ''}`} />
          {showFeedback ? 'Hide' : 'Feedback'}
        </button>
      </div>

      {/* Feedback dropdown */}
      <AnimatePresence>
        {showFeedback && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="absolute top-full left-0 right-0 mt-2 z-20 bg-white dark:bg-gray-900 border border-gray-200/70 dark:border-gray-700/70 rounded-2xl shadow-xl shadow-black/10 dark:shadow-black/40 overflow-hidden"
          >
            <div className="px-5 py-4">
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-3">
                Performance Insights
              </p>
              <div className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed space-y-1.5">
                {assessment.feedback.split('\n').map((line, i) => {
                  if (!line.trim()) return <div key={i} className="h-1" />
                  const parts = line.split(/(\*\*.*?\*\*)/g)
                  return (
                    <p key={i}>
                      {parts.map((part, j) =>
                        part.startsWith('**') && part.endsWith('**')
                          ? <strong key={j} className="font-semibold text-gray-800 dark:text-gray-100">{part.slice(2, -2)}</strong>
                          : part
                      )}
                    </p>
                  )
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
