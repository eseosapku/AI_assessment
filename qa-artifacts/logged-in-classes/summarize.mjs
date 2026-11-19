/** Read-only summaries of class assignments and one saved quiz. No writes to the app. */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const OUT = path.dirname(fileURLToPath(import.meta.url))
const BASE = 'http://localhost:3000'
const userId = 'a14a382f-07f4-4c48-88d2-7d89d4c71606'
const email = 'b.sumba@alustudent.com'
const classroomId = '036417bd-7688-49a1-bfa3-de47956b7d09'
const resultId = '4995d5f1-2a25-418b-93ce-19bb0effe26c'

function clip(value, n = 280) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, n)
}

function flags(text) {
  const s = String(text ?? '')
  const hits = []
  if (/\\(?:frac|text|times|cdot|sqrt|sum|int|alpha|beta|theta|degree|left|right|mathrm|mathbf)/.test(s)) hits.push('latex-command')
  if (/\$[^$]+\$/.test(s)) hits.push('dollar-math')
  if (/<(?:p|div|br|span|img|sub|sup|ul|ol|li|table|b|i|strong|em)\b/i.test(s)) hits.push('html-tag')
  if (/&(?:amp|lt|gt|nbsp|#\d+);/.test(s)) hits.push('entity')
  if (/\bundefined\b|\bNaN\b|\[object Object\]/.test(s)) hits.push('placeholder')
  if (/_{2,}|\*\*|#{1,3}\s/.test(s)) hits.push('markdown')
  if (/Cambridge-IGCSE|MARRY-JONES|[_-]{2,}/.test(s)) hits.push('filename')
  if (/\s{3,}/.test(s)) hits.push('wide-gap')
  return hits
}

const assignmentsRes = await fetch(
  `${BASE}/api/assignments/student?student_id=${userId}&email=${encodeURIComponent(email)}&classroom_id=${classroomId}`,
)
const assignmentsJson = await assignmentsRes.json()
const rows = assignmentsJson.assignments ?? []
const assignmentSummary = rows.map((row) => ({
  id: row.assignment?.id,
  title: row.assignment?.title,
  subject: row.assignment?.subject,
  grade: row.assignment?.grade,
  status: row.status,
  result_id: row.result_id,
  attempt_count: row.attempt_count,
  max_attempts: row.assignment?.max_attempts,
  question_count: row.assignment?.question_count,
  question_type: row.assignment?.question_type,
  deadline: row.assignment?.deadline,
}))

const resultRes = await fetch(`${BASE}/api/results/${resultId}?user_id=${userId}`)
const resultJson = await resultRes.json()
const data = resultJson.data ?? {}
const questions = data.questions_data ?? data.assessments?.questions_data ?? []
const qSummary = (Array.isArray(questions) ? questions : []).map((q, i) => {
  const bits = [q.question, q.prompt, q.stem, q.text, ...(q.options || []), q.explanation, q.model_answer, q.passage]
  const joined = bits.filter(Boolean).join(' | ')
  return {
    i: i + 1,
    type: q.type || q.kind || 'mcq',
    marks: q.marks ?? null,
    correct: q.correct_answer ?? null,
    optionCount: Array.isArray(q.options) ? q.options.length : null,
    flags: flags(joined),
    question: clip(q.question || q.prompt || q.stem || q.text, 400),
    options: Array.isArray(q.options) ? q.options.map((o) => clip(typeof o === 'string' ? o : JSON.stringify(o), 160)) : null,
  }
})

fs.writeFileSync(path.join(OUT, 'assignment-summary.json'), JSON.stringify({
  status: assignmentsRes.status,
  error: assignmentsJson.error || null,
  count: assignmentSummary.length,
  assignments: assignmentSummary,
}, null, 2))

fs.writeFileSync(path.join(OUT, 'result-summary.json'), JSON.stringify({
  status: resultRes.status,
  error: resultJson.error || null,
  subject: data.assessments?.subject,
  resultSubject: data.subject ?? null,
  score: data.score,
  percentage: data.percentage,
  questionCount: qSummary.length,
  flagged: qSummary.filter((q) => q.flags.length),
  questions: qSummary,
}, null, 2))

console.log('assignments', assignmentsRes.status, assignmentSummary.length)
for (const a of assignmentSummary) console.log(a.status, a.title, a.subject, 'result', a.result_id ? 'yes' : 'no')
console.log('result', resultRes.status, 'subject', data.assessments?.subject, 'qs', qSummary.length, 'flagged', qSummary.filter((q) => q.flags.length).length)
for (const q of qSummary.filter((q) => q.flags.length)) console.log('Q'+q.i, q.flags.join(','), clip(q.question, 140))
