'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { Calendar, Download, ChevronDown } from 'lucide-react'
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

const GRADE_CONFIG: Record<string, { bar: string; text: string; watermark: string; badge: string }> = {
  'A+': { bar: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-400', watermark: 'text-emerald-500/10 dark:text-emerald-400/[0.07]', badge: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/25 dark:text-emerald-400' },
  'A':  { bar: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-400', watermark: 'text-emerald-500/10 dark:text-emerald-400/[0.07]', badge: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/25 dark:text-emerald-400' },
  'B+': { bar: 'bg-blue-500',    text: 'text-blue-600 dark:text-blue-400',       watermark: 'text-blue-500/10 dark:text-blue-400/[0.07]',       badge: 'bg-blue-50 text-blue-700 dark:bg-blue-900/25 dark:text-blue-400' },
  'B':  { bar: 'bg-blue-500',    text: 'text-blue-600 dark:text-blue-400',       watermark: 'text-blue-500/10 dark:text-blue-400/[0.07]',       badge: 'bg-blue-50 text-blue-700 dark:bg-blue-900/25 dark:text-blue-400' },
  'C':  { bar: 'bg-amber-500',   text: 'text-amber-600 dark:text-amber-400',     watermark: 'text-amber-500/10 dark:text-amber-400/[0.07]',     badge: 'bg-amber-50 text-amber-700 dark:bg-amber-900/25 dark:text-amber-400' },
  'D':  { bar: 'bg-red-500',     text: 'text-red-600 dark:text-red-400',         watermark: 'text-red-500/10 dark:text-red-400/[0.07]',         badge: 'bg-red-50 text-red-700 dark:bg-red-900/25 dark:text-red-400' },
}

const SCORE_COLOR = (s: number) => s >= 70 ? 'bg-emerald-500' : s >= 50 ? 'bg-amber-500' : 'bg-red-500'

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
          <tr><td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;font-size:13px;">${c.criterion}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;text-align:center;">${c.met ? '✅' : '❌'}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;font-size:12px;color:#6b7280;">${c.note ?? ''}</td></tr>`).join('') ?? ''
        return `<div style="border:1px solid #e5e7eb;border-radius:12px;padding:20px;margin-bottom:16px;background:#fff;">
          <div style="display:flex;justify-content:space-between;margin-bottom:12px;">
            <span style="font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.06em;">Long Form · Q${i+1}</span>
            ${gd ? `<span style="font-weight:700;color:${accentColor}">${gd.marks_awarded}/${gd.marks_total} marks</span>` : ''}
          </div>
          <p style="font-size:14px;font-weight:600;color:#111827;margin-bottom:12px;">${q.question}</p>
          ${q.passage ? `<div style="background:#f9fafb;border-left:3px solid #d1d5db;padding:12px 16px;border-radius:0 8px 8px 0;margin-bottom:12px;font-size:13px;color:#4b5563;">${q.passage}</div>` : ''}
          <div style="background:#eff6ff;border-radius:8px;padding:12px 16px;margin-bottom:12px;">
            <p style="font-size:11px;font-weight:700;color:#2563eb;text-transform:uppercase;margin-bottom:6px;">Your Answer</p>
            <p style="font-size:13px;color:#1e3a5f;white-space:pre-wrap;">${studentAnswer || '<em style="color:#9ca3af">No answer provided</em>'}</p>
          </div>
          ${criteriaRows ? `<table style="width:100%;border-collapse:collapse;margin-bottom:12px;">
            <thead><tr style="background:#f9fafb;">
              <th style="padding:8px 12px;text-align:left;font-size:11px;color:#6b7280;font-weight:700;text-transform:uppercase;">Criterion</th>
              <th style="padding:8px 12px;text-align:center;font-size:11px;color:#6b7280;font-weight:700;text-transform:uppercase;">Met</th>
              <th style="padding:8px 12px;text-align:left;font-size:11px;color:#6b7280;font-weight:700;text-transform:uppercase;">Note</th>
            </tr></thead><tbody>${criteriaRows}</tbody></table>` : ''}
          ${gd?.general_feedback ? `<div style="background:#f0fdf4;border-radius:8px;padding:12px 16px;font-size:13px;color:#166534;"><strong>Feedback:</strong> ${gd.general_feedback}</div>` : ''}
        </div>`
      }
      const optionsHtml = (q.options ?? []).map((opt: string, oi: number) => {
        const isCorrect = oi === q.correct_answer
        const isChosen = String(oi) === String(studentAnswer) || oi === Number(studentAnswer)
        return `<div style="background:${isCorrect ? '#f0fdf4' : isChosen ? '#fef2f2' : '#f9fafb'};border:1px solid ${isCorrect ? '#86efac' : isChosen ? '#fca5a5' : '#e5e7eb'};border-radius:8px;padding:10px 14px;margin-bottom:6px;font-size:13px;">
          ${isCorrect ? '✅ ' : isChosen ? '❌ ' : '&nbsp;&nbsp;&nbsp; '}${opt}</div>`
      }).join('')
      return `<div style="border:1px solid #e5e7eb;border-radius:12px;padding:20px;margin-bottom:16px;background:#fff;">
        <span style="font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;display:block;margin-bottom:10px;">MCQ · Q${i+1}</span>
        <p style="font-size:14px;font-weight:600;color:#111827;margin-bottom:14px;">${q.question}</p>
        ${optionsHtml}
        ${q.explanation ? `<div style="margin-top:12px;background:#fefce8;border-radius:8px;padding:10px 14px;font-size:13px;color:#713f12;"><strong>Explanation:</strong> ${q.explanation}</div>` : ''}
      </div>`
    }).join('')
  }

  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${subject} — Brain Ink Report</title>
<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:-apple-system,BlinkMacSystemFont,'Inter',sans-serif;background:#f4f4f5;color:#111827;padding:32px 20px;-webkit-font-smoothing:antialiased;}.wrap{max-width:720px;margin:0 auto}</style>
</head><body><div class="wrap">
  <div style="background:linear-gradient(135deg,#1d4ed8,#4f46e5);color:#fff;border-radius:16px;padding:28px 32px;margin-bottom:20px;">
    <p style="font-size:10px;font-weight:700;opacity:.6;text-transform:uppercase;letter-spacing:.12em;margin-bottom:10px;">Brain Ink · Assessment Report</p>
    <h1 style="font-size:24px;font-weight:900;margin-bottom:4px;">${subject}</h1>
    <p style="opacity:.75;font-size:14px;">${topic}</p>
    <div style="display:flex;gap:28px;margin-top:20px;flex-wrap:wrap;">
      <div><p style="font-size:10px;opacity:.55;text-transform:uppercase;letter-spacing:.06em;margin-bottom:3px;">Date</p><p style="font-size:15px;font-weight:800;">${date}</p></div>
      <div><p style="font-size:10px;opacity:.55;text-transform:uppercase;letter-spacing:.06em;margin-bottom:3px;">Grade</p><p style="font-size:15px;font-weight:800;">${grade}</p></div>
      <div><p style="font-size:10px;opacity:.55;text-transform:uppercase;letter-spacing:.06em;margin-bottom:3px;">Score</p><p style="font-size:15px;font-weight:800;">${percentage ?? score}%</p></div>
    </div>
  </div>
  <div style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:24px;margin-bottom:20px;">
    <h2 style="font-size:13px;font-weight:700;margin-bottom:14px;">🏆 Performance Insights</h2>
    <div style="font-size:14px;color:#374151;line-height:1.7;white-space:pre-wrap;">${feedback}</div>
  </div>
  ${questionsHtml ? `<h2 style="font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.08em;margin-bottom:14px;">Question Review</h2>${questionsHtml}` : ''}
  <p style="text-align:center;font-size:12px;color:#9ca3af;margin-top:28px;padding-top:20px;border-top:1px solid #f3f4f6;">Generated by Brain Ink AI · ${date}</p>
</div></body></html>`
}

export default function AssessmentCard({ assessment }: { assessment: Assessment }) {
  const [showFeedback, setShowFeedback] = useState(false)
  const cfg = GRADE_CONFIG[assessment.grade] ?? GRADE_CONFIG['D']
  const pct = assessment.percentage ?? assessment.score

  function downloadReport() {
    const blob = new Blob([buildReportHtml(assessment)], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${assessment.subject.replace(/\s+/g, '_')}_${assessment.date.replace(/[\s,]+/g, '_')}_report.html`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="relative flex flex-col bg-white dark:bg-[#111115] border border-gray-200/70 dark:border-white/[0.07] rounded-2xl overflow-visible transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-black/8 dark:hover:shadow-black/40 hover:border-gray-300 dark:hover:border-white/10 group">

      {/* Grade accent bar — top */}
      <div className={`h-[3px] w-full rounded-t-2xl ${cfg.bar} flex-shrink-0`} />

      {/* Giant grade watermark */}
      <div className={`absolute right-3 top-1 text-[96px] font-black leading-none select-none pointer-events-none ${cfg.watermark}`}>
        {assessment.grade}
      </div>

      {/* Body */}
      <div className="p-5 flex-1 relative">
        {/* Topic label */}
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-gray-400 dark:text-gray-600 mb-1.5 truncate pr-14">
          {assessment.topic}
        </p>

        {/* Subject */}
        <h3 className="text-base font-black text-gray-900 dark:text-white leading-snug mb-5 pr-10">
          {assessment.subject}
        </h3>

        {/* Score + grade */}
        <div className="flex items-baseline gap-1.5 mb-2">
          <span className="text-3xl font-black tabular-nums text-gray-900 dark:text-white leading-none">{pct}</span>
          <span className="text-sm font-bold text-gray-400 dark:text-gray-600">%</span>
          <span className={`ml-auto text-xs font-black px-2 py-1 rounded-lg ${cfg.badge}`}>
            {assessment.grade}
          </span>
        </div>

        {/* Score bar */}
        <div className="h-1.5 bg-gray-100 dark:bg-white/[0.06] rounded-full overflow-hidden mb-4">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.9, ease: 'easeOut' }}
            className={`h-full rounded-full ${SCORE_COLOR(pct)}`}
          />
        </div>

        {/* Date */}
        <div className="flex items-center gap-1.5 text-[11px] text-gray-400 dark:text-gray-600">
          <Calendar className="w-3 h-3" />
          {assessment.date}
        </div>
      </div>

      {/* Action strip */}
      <div className="flex border-t border-gray-100 dark:border-white/[0.06]">
        <button
          onClick={downloadReport}
          className="flex-1 flex items-center justify-center gap-1.5 py-3 text-[11px] font-bold uppercase tracking-wide text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-50 dark:hover:bg-white/[0.03] transition-colors border-r border-gray-100 dark:border-white/[0.06]"
        >
          <Download className="w-3.5 h-3.5" />
          Download
        </button>
        <button
          onClick={() => setShowFeedback(v => !v)}
          className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-[11px] font-bold uppercase tracking-wide transition-colors ${
            showFeedback
              ? 'text-blue-600 dark:text-blue-400 bg-blue-50/60 dark:bg-blue-900/10'
              : 'text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-50 dark:hover:bg-white/[0.03]'
          }`}
        >
          <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${showFeedback ? 'rotate-180' : ''}`} />
          Feedback
        </button>
      </div>

      {/* Feedback dropdown */}
      <AnimatePresence>
        {showFeedback && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.99 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.99 }}
            transition={{ duration: 0.14 }}
            className="absolute top-full left-0 right-0 mt-2 z-20 bg-white dark:bg-[#111115] border border-gray-200/70 dark:border-white/[0.07] rounded-2xl shadow-2xl shadow-black/10 dark:shadow-black/50 overflow-hidden"
          >
            <div className={`h-[3px] w-full ${cfg.bar}`} />
            <div className="p-5">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-gray-400 dark:text-gray-600 mb-3">
                Performance Insights
              </p>
              <div className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed space-y-1.5">
                {assessment.feedback.split('\n').map((line, i) => {
                  if (!line.trim()) return <div key={i} className="h-1" />
                  return (
                    <p key={i}>
                      {line.split(/(\*\*.*?\*\*)/g).map((part, j) =>
                        part.startsWith('**') && part.endsWith('**')
                          ? <strong key={j} className="font-bold text-gray-800 dark:text-gray-200">{part.slice(2, -2)}</strong>
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
