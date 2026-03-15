'use client'

import { motion } from 'framer-motion'
import { Eye, Calendar, BookOpen, Trophy, Download } from 'lucide-react'
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

interface AssessmentCardProps {
  assessment: Assessment
}

function getGradeColor(grade: string) {
  if (grade === 'A' || grade === 'A+') return 'text-green-500'
  if (grade === 'B' || grade === 'B+') return 'text-blue-500'
  if (grade === 'C') return 'text-yellow-500'
  return 'text-red-500'
}

function buildReportHtml(assessment: Assessment): string {
  const { subject, topic, date, grade, score, percentage, feedback, questions_data, answers, longform_grades } = assessment

  const gradeColorCss = grade === 'A' || grade === 'A+' ? '#22c55e'
    : grade === 'B' || grade === 'B+' ? '#3b82f6'
    : grade === 'C' ? '#eab308' : '#ef4444'

  let questionsHtml = ''
  if (questions_data && answers) {
    questionsHtml = questions_data.map((q: any, i: number) => {
      const idx = q.id ?? i
      const studentAnswer = answers[idx] ?? answers[String(idx)] ?? ''

      if (q.type === 'longform') {
        const grade_data = longform_grades?.[idx] ?? longform_grades?.[String(idx)]
        const criteriaRows = grade_data?.criteria_results?.map((c: any) => `
          <tr>
            <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;font-size:13px;">${c.criterion}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;text-align:center;font-size:13px;">${c.met ? '✅' : '❌'}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;font-size:13px;color:#6b7280;">${c.note ?? ''}</td>
          </tr>`).join('') ?? ''

        return `
          <div style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:20px;margin-bottom:20px;">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px;">
              <span style="font-size:12px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:.05em;">Long Form — Q${i + 1}</span>
              ${grade_data ? `<span style="font-weight:700;color:${gradeColorCss}">${grade_data.marks_awarded}/${grade_data.marks_total} marks</span>` : ''}
            </div>
            <p style="font-weight:600;margin-bottom:12px;">${q.question}</p>
            ${q.passage ? `<div style="background:#f8f9fa;border-left:3px solid #6b7280;padding:12px 16px;border-radius:0 8px 8px 0;margin-bottom:12px;font-size:13px;color:#374151;white-space:pre-wrap;">${q.passage}</div>` : ''}
            <div style="background:#f0f9ff;border-radius:8px;padding:12px 16px;margin-bottom:12px;">
              <p style="font-size:12px;font-weight:600;color:#0284c7;margin-bottom:4px;">Your Answer</p>
              <p style="font-size:13px;color:#1e3a5f;white-space:pre-wrap;">${studentAnswer || '<em>No answer provided</em>'}</p>
            </div>
            ${criteriaRows ? `
            <table style="width:100%;border-collapse:collapse;margin-bottom:12px;">
              <thead><tr style="background:#f9fafb;">
                <th style="padding:8px 12px;text-align:left;font-size:12px;color:#6b7280;font-weight:600;">Criterion</th>
                <th style="padding:8px 12px;text-align:center;font-size:12px;color:#6b7280;font-weight:600;">Met</th>
                <th style="padding:8px 12px;text-align:left;font-size:12px;color:#6b7280;font-weight:600;">Note</th>
              </tr></thead>
              <tbody>${criteriaRows}</tbody>
            </table>` : ''}
            ${grade_data?.general_feedback ? `<div style="background:#f0fdf4;border-radius:8px;padding:12px 16px;font-size:13px;color:#166534;"><strong>Feedback:</strong> ${grade_data.general_feedback}</div>` : ''}
          </div>`
      }

      // MCQ
      const optionsHtml = (q.options ?? []).map((opt: string, oi: number) => {
        const isCorrect = oi === q.correct_answer
        const isChosen = String(oi) === String(studentAnswer) || oi === Number(studentAnswer)
        const bg = isCorrect ? '#f0fdf4' : isChosen && !isCorrect ? '#fef2f2' : '#f9fafb'
        const border = isCorrect ? '#86efac' : isChosen && !isCorrect ? '#fca5a5' : '#e5e7eb'
        return `<div style="background:${bg};border:1px solid ${border};border-radius:8px;padding:10px 14px;margin-bottom:6px;font-size:13px;">
          ${isCorrect ? '✅ ' : isChosen && !isCorrect ? '❌ ' : ''}${opt}
        </div>`
      }).join('')

      return `
        <div style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:20px;margin-bottom:20px;">
          <span style="font-size:12px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:.05em;display:block;margin-bottom:10px;">MCQ — Q${i + 1}</span>
          <p style="font-weight:600;margin-bottom:14px;">${q.question}</p>
          ${optionsHtml}
          ${q.explanation ? `<div style="margin-top:12px;font-size:13px;color:#4b5563;background:#fefce8;border-radius:8px;padding:10px 14px;"><strong>Explanation:</strong> ${q.explanation}</div>` : ''}
        </div>`
    }).join('')
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Report — ${subject}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f8fafc;color:#111827;padding:32px 20px;line-height:1.6}
  .container{max-width:760px;margin:0 auto}
  h1{font-size:26px;font-weight:800;margin-bottom:4px}
  p{margin:0}
</style>
</head>
<body>
<div class="container">
  <!-- Header -->
  <div style="background:linear-gradient(135deg,#1d4ed8,#2563eb);color:#fff;border-radius:16px;padding:28px 32px;margin-bottom:24px;">
    <p style="font-size:12px;font-weight:600;opacity:.7;text-transform:uppercase;letter-spacing:.08em;margin-bottom:8px;">Brain Ink — Assessment Report</p>
    <h1>${subject}</h1>
    <p style="opacity:.85;margin-top:4px;">${topic}</p>
    <div style="display:flex;gap:24px;margin-top:20px;flex-wrap:wrap;">
      <div><p style="font-size:11px;opacity:.7;text-transform:uppercase;letter-spacing:.05em;">Date</p><p style="font-size:15px;font-weight:700;">${date}</p></div>
      <div><p style="font-size:11px;opacity:.7;text-transform:uppercase;letter-spacing:.05em;">Grade</p><p style="font-size:15px;font-weight:700;">${grade}</p></div>
      <div><p style="font-size:11px;opacity:.7;text-transform:uppercase;letter-spacing:.05em;">Score</p><p style="font-size:15px;font-weight:700;">${percentage ?? score}%</p></div>
    </div>
  </div>

  <!-- AI Feedback -->
  <div style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:24px;margin-bottom:24px;">
    <h2 style="font-size:15px;font-weight:700;margin-bottom:12px;display:flex;align-items:center;gap:8px;">🏆 Performance Insights</h2>
    <div style="font-size:14px;color:#374151;white-space:pre-wrap;">${feedback}</div>
  </div>

  ${questionsHtml ? `
  <!-- Questions -->
  <h2 style="font-size:15px;font-weight:700;margin-bottom:14px;">Question Review</h2>
  ${questionsHtml}` : ''}

  <p style="text-align:center;font-size:12px;color:#9ca3af;margin-top:32px;">Generated by Brain Ink AI • ${date}</p>
</div>
</body>
</html>`
}

export default function AssessmentCard({ assessment }: AssessmentCardProps) {
  const [showFeedback, setShowFeedback] = useState(false)

  function downloadReport() {
    const html = buildReportHtml(assessment)
    const blob = new Blob([html], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${assessment.subject.replace(/\s+/g, '_')}_${assessment.date.replace(/\s+/g, '_')}_report.html`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4 }}
      className="card p-5 sm:p-6 relative group"
    >
      <div className="flex justify-between items-start mb-5">
        <div className="flex-1 min-w-0 pr-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center">
              <BookOpen className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            </div>
            <h3 className="text-base sm:text-lg font-semibold truncate text-gray-900 dark:text-white">{assessment.subject}</h3>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 line-clamp-2 pl-10">{assessment.topic}</p>

          <div className="flex items-center gap-2 text-xs font-medium text-gray-400 dark:text-gray-500 pl-10">
            <Calendar className="w-3.5 h-3.5" />
            <span>{assessment.date}</span>
          </div>
        </div>

        <div className="flex flex-col items-end gap-1">
          <div className={`text-2xl sm:text-3xl font-bold tracking-tight ${getGradeColor(assessment.grade)}`}>
            {assessment.grade}
          </div>
          <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded-md">
            <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">{assessment.score}%</span>
          </div>
        </div>
      </div>

      {/* Divider */}
      <div className="h-px w-full bg-gray-100 dark:bg-gray-800/60 mb-4"></div>

      {/* Action Area */}
      <div className="flex justify-between items-center gap-2">
        <motion.button
          onClick={downloadReport}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          title="Download Report"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-gray-50 text-gray-600 hover:bg-blue-50 hover:text-blue-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-blue-900/20 dark:hover:text-blue-400 transition-colors"
        >
          <Download className="w-4 h-4" />
          <span className="hidden sm:inline">Download</span>
        </motion.button>

        <motion.button
          onClick={() => setShowFeedback(!showFeedback)}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
            showFeedback
              ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
              : 'bg-gray-50 text-gray-600 hover:bg-blue-50 hover:text-blue-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-blue-900/20 dark:hover:text-blue-400'
          }`}
        >
          <Eye className="w-4 h-4" />
          {showFeedback ? 'Hide' : 'View Feedback'}
        </motion.button>
      </div>

      {/* Glassmorphic Feedback Dropdown */}
      {showFeedback && (
        <motion.div
          initial={{ opacity: 0, y: -10, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -10, scale: 0.98 }}
          className="absolute top-full left-0 right-0 mt-3 p-5 glass dark:glass-dark rounded-2xl z-20 shadow-xl border border-gray-200/50 dark:border-gray-700/50"
        >
          <h4 className="font-semibold mb-3 flex items-center gap-2 text-gray-900 dark:text-white">
            <Trophy className="w-4 h-4 text-yellow-500" />
            Performance Insights
          </h4>
          <div className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed space-y-1">
            {assessment.feedback.split('\n').map((line, i) => {
              if (!line.trim()) return <div key={i} className="h-2"></div>
              const parts = line.split(/(\*\*.*?\*\*)/g)
              return (
                <div key={i}>
                  {parts.map((part, j) => {
                    if (part.startsWith('**') && part.endsWith('**')) {
                      return <strong key={j} className="font-bold text-gray-900 dark:text-white">{part.slice(2, -2)}</strong>
                    }
                    return part
                  })}
                </div>
              )
            })}
          </div>
        </motion.div>
      )}
    </motion.div>
  )
}
