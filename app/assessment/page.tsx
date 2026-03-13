'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Clock, ChevronLeft, ChevronRight, Check } from 'lucide-react'
import 'katex/dist/katex.min.css'
import Latex from 'react-latex-next'

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
  diagram_svg?: string
}

interface LongFormQuestion {
  id: number
  type: 'longform'
  question: string
  marks: number
  marking_criteria: string[]
  model_answer: string
  explanation: string
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

interface Assessment {
  assessment_id: string
  estimated_time: number
  questions: Question[]
  subject: string
  topics: string[]
  curriculum?: string
  questionType?: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function isLongForm(q: Question): q is LongFormQuestion {
  return q.type === 'longform'
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
      className={`glass dark:glass-dark rounded-apple p-6 border-l-4 ${
        !isGraded
          ? 'border-l-gray-400'
          : overallPass
          ? 'border-l-green-500'
          : 'border-l-red-500'
      }`}
    >
      {/* Question header */}
      <div className="flex items-start gap-4 mb-4">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-1 text-sm font-bold ${
          !isGraded
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
              Long-form · {q.marks} marks
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
          <h3 className="text-lg font-medium text-gray-900 dark:text-white"><Latex>{q.question}</Latex></h3>
        </div>
      </div>

      {/* Student answer with annotation */}
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
            className={`mt-2 p-3 rounded-xl text-sm border ${
              activeCrit.met
                ? 'bg-green-50 border-green-200 text-green-800 dark:bg-green-900/20 dark:border-green-800/50 dark:text-green-200'
                : 'bg-red-50 border-red-200 text-red-800 dark:bg-red-900/20 dark:border-red-800/50 dark:text-red-200'
            }`}
          >
            <span className="font-semibold">{activeCrit.met ? '✓ Criterion met:' : '✗ Criterion missed:'}</span>{' '}
            {activeCrit.note}
            {activeCrit.met && activeCrit.relevant_quote && (
              <div className="mt-1 text-xs opacity-75">Highlighted in your answer above</div>
            )}
          </motion.div>
        )}
      </div>

      {/* Criteria checklist */}
      {isGraded && (
        <div className="ml-12 mb-4">
          <div className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">
            Marking Criteria — click any to see why
          </div>
          <div className="space-y-2">
            {grade.criteria_results.map((cr, crIdx) => (
              <motion.button
                key={crIdx}
                onClick={() => setActiveCriterion(activeCriterion === crIdx ? null : crIdx)}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                className={`w-full text-left flex items-start gap-2 p-2.5 rounded-xl border transition-all cursor-pointer ${
                  activeCriterion === crIdx
                    ? cr.met
                      ? 'border-green-400 bg-green-50 dark:bg-green-900/20 dark:border-green-700'
                      : 'border-red-400 bg-red-50 dark:bg-red-900/20 dark:border-red-700'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 bg-white dark:bg-gray-800/40'
                }`}
              >
                <span className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold mt-0.5 ${
                  cr.met
                    ? 'bg-green-500 text-white'
                    : 'bg-red-500 text-white'
                }`}>
                  {cr.met ? '✓' : '✗'}
                </span>
                <span className="text-sm text-gray-700 dark:text-gray-300 flex-1">{cr.criterion}</span>
                <span className="text-xs text-gray-400 flex-shrink-0 mt-0.5">tap</span>
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

// ── Main component ─────────────────────────────────────────────────────────────

export default function AssessmentPage() {
  const router = useRouter()
  const [assessment, setAssessment] = useState<Assessment | null>(null)
  const [currentQuestion, setCurrentQuestion] = useState(0)
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({})
  const [longFormAnswers, setLongFormAnswers] = useState<Record<number, string>>({})
  const [timeRemaining, setTimeRemaining] = useState(0)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const [results, setResults] = useState<any>(null)
  const [feedback, setFeedback] = useState<string>('')
  const [isGeneratingFeedback, setIsGeneratingFeedback] = useState(false)
  const [longFormGrades, setLongFormGrades] = useState<Record<number, LongFormGrade>>({})
  const [isGradingLongForm, setIsGradingLongForm] = useState(false)

  useEffect(() => {
    const data = sessionStorage.getItem('currentAssessment')
    if (data) {
      const assessmentData = JSON.parse(data)
      setAssessment(assessmentData)
      setTimeRemaining(assessmentData.estimated_time * 60)
    } else {
      router.push('/')
    }
  }, [router])

  useEffect(() => {
    if (timeRemaining > 0 && !isSubmitted) {
      const timer = setInterval(() => {
        setTimeRemaining((prev) => {
          if (prev <= 1) {
            handleSubmit()
            return 0
          }
          return prev - 1
        })
      }, 1000)
      return () => clearInterval(timer)
    }
  }, [timeRemaining, isSubmitted])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const handleAnswerSelect = (optionIndex: number) => {
    setSelectedAnswers({ ...selectedAnswers, [currentQuestion]: optionIndex })
  }

  const handleLongFormChange = (text: string) => {
    setLongFormAnswers({ ...longFormAnswers, [currentQuestion]: text })
  }

  const allAnswered = assessment?.questions.every((q, idx) => {
    if (isLongForm(q)) return (longFormAnswers[idx] || '').trim().length > 0
    return selectedAnswers[idx] !== undefined
  }) ?? false

  const handleSubmit = async () => {
    setIsSubmitted(true)

    const questions = assessment?.questions ?? []

    // Calculate MCQ marks
    let mcqCorrect = 0
    let mcqTotal = 0
    questions.forEach((q, idx) => {
      if (!isLongForm(q)) {
        mcqTotal++
        if (selectedAnswers[idx] === q.correct_answer) mcqCorrect++
      }
    })

    const hasLongForm = questions.some(isLongForm)
    const longFormTotal = questions.filter(isLongForm).reduce((sum, q) => sum + (q as LongFormQuestion).marks, 0)

    // Show results immediately (long-form grades come in async)
    const preliminaryResult = {
      assessment_id: assessment?.assessment_id,
      mcqCorrect,
      mcqTotal,
      longFormMarksEarned: 0,
      longFormTotal,
      score: mcqTotal > 0 && !hasLongForm ? Math.round((mcqCorrect / mcqTotal) * 100) : null,
      grade: '',
      answers: selectedAnswers,
      longFormAnswers,
      completed_at: new Date().toISOString(),
    }

    setResults(preliminaryResult)
    setShowResults(true)
    setIsSubmitted(false)

    // Grade long-form questions
    let longFormGradesResult: Record<number, LongFormGrade> = {}
    if (hasLongForm) {
      setIsGradingLongForm(true)
      try {
        const res = await fetch('/api/grade-longform', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            questions,
            answers: longFormAnswers,
            subject: assessment?.subject,
          }),
        })
        const data = await res.json()
        longFormGradesResult = data.grades ?? {}
        setLongFormGrades(longFormGradesResult)
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
    const totalEarned = mcqCorrect + longFormEarned
    const totalPossible = mcqTotal + longFormTotal
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
    const user = JSON.parse(localStorage.getItem('user') || '{}')

    try {
      const feedbackRes = await fetch('/api/generate-feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assessment,
          answers: selectedAnswers,
          longFormAnswers,
          longFormGrades: longFormGradesResult,
          score: finalScore,
          grade,
          className: user.class,
        }),
      })
      const feedbackData = await feedbackRes.json()
      if (feedbackData.feedback) generatedFeedback = feedbackData.feedback
    } catch {
      // keep fallback
    } finally {
      setFeedback(generatedFeedback)
      setIsGeneratingFeedback(false)
    }

    if (user.id) {
      await fetch('/api/save-result', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.id,
          assessment_id: assessment?.assessment_id,
          answers: { mcq: selectedAnswers, longform: longFormAnswers },
          total_questions: questions.length,
          score: finalScore,
          grade,
          feedback: generatedFeedback,
        }),
      })
    }
  }

  if (!assessment) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-apple-blue mx-auto mb-4"></div>
          <p className="text-apple-dark-gray">Loading assessment...</p>
        </div>
      </div>
    )
  }

  // ── Results view ────────────────────────────────────────────────────────────
  if (showResults && results) {
    const hasLongForm = assessment.questions.some(isLongForm)

    return (
      <div className="min-h-screen bg-[#FAFAFA] dark:bg-[#0A0A0A] py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto space-y-8">
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
            <p className="text-gray-500 dark:text-gray-400 mb-10 text-lg">
              {assessment.subject} — {assessment.topics.join(', ')}
            </p>

            {/* Score / Grade */}
            {results.score !== null ? (
              <div className="flex justify-center items-center gap-12 mb-10">
                <div className="text-center">
                  <div className="text-6xl font-bold text-blue-600 dark:text-blue-400 mb-2 tracking-tighter">
                    {results.score}%
                  </div>
                  <div className="text-sm font-medium text-gray-400 uppercase tracking-widest">Final Score</div>
                </div>
                <div className="w-px h-20 bg-gray-200 dark:bg-gray-800"></div>
                <div className="text-center">
                  <div className="text-6xl font-bold text-blue-600 dark:text-blue-400 mb-2 tracking-tighter">
                    {results.grade}
                  </div>
                  <div className="text-sm font-medium text-gray-400 uppercase tracking-widest">Grade</div>
                </div>
              </div>
            ) : (
              <div className="flex justify-center items-center gap-3 mb-10 text-blue-600 dark:text-blue-400">
                <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-current"></div>
                <span className="font-medium">Grading written answers…</span>
              </div>
            )}

            {/* Marks breakdown for mixed/longform */}
            {hasLongForm && results.score !== null && (
              <div className="flex justify-center gap-6 mb-8 text-sm text-gray-500 dark:text-gray-400">
                {results.mcqTotal > 0 && (
                  <span>MCQ: {results.mcqCorrect}/{results.mcqTotal}</span>
                )}
                {results.longFormTotal > 0 && (
                  <span>Written: {results.longFormMarksEarned}/{results.longFormTotal} marks</span>
                )}
              </div>
            )}

            {/* AI Feedback */}
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-2xl p-6 text-left border border-blue-100 dark:border-blue-800/30">
              <h3 className="font-semibold text-blue-800 dark:text-blue-300 mb-2 flex items-center gap-2">
                <span className="text-xl">✨</span> AI Feedback
              </h3>
              {isGeneratingFeedback || (isGradingLongForm && results.score === null) ? (
                <div className="flex items-center gap-3 text-blue-600 dark:text-blue-400">
                  <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-current"></div>
                  <p className="text-sm">
                    {isGradingLongForm ? 'Grading written answers…' : 'Analysing your performance…'}
                  </p>
                </div>
              ) : (
                <div className="text-sm sm:text-base leading-relaxed space-y-1">
                  {feedback.split('\n').map((line, i) => {
                    if (!line.trim()) return <div key={i} className="h-2"></div>
                    const isHeader = /^\*\*.*\*\*$/.test(line.trim())
                    if (isHeader) {
                      return (
                        <div key={i} className="flex items-center gap-2 mt-4 mb-1 pb-1 border-b border-blue-300 dark:border-blue-600">
                          <strong className="text-blue-700 dark:text-blue-300 font-bold text-base">
                            {line.trim().slice(2, -2)}
                          </strong>
                        </div>
                      )
                    }
                    return <div key={i} className="text-blue-900 dark:text-blue-100 pl-1">{line}</div>
                  })}
                </div>
              )}
            </div>
          </motion.div>

          {/* Detailed review */}
          <div className="space-y-6">
            <h2 className="text-2xl font-bold px-2">Detailed Review</h2>
            {assessment.questions.map((q, idx) => {
              if (isLongForm(q)) {
                return (
                  <LongFormResultCard
                    key={idx}
                    q={q}
                    idx={idx}
                    studentAnswer={longFormAnswers[idx] || ''}
                    grade={longFormGrades[idx]}
                  />
                )
              }

              // MCQ result card
              const userAnswer = results.answers[idx]
              const isCorrect = userAnswer === q.correct_answer
              return (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className={`glass dark:glass-dark rounded-apple p-6 border-l-4 ${
                    isCorrect ? 'border-l-green-500' : 'border-l-red-500'
                  }`}
                >
                  <div className="flex items-start gap-4 mb-4">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-1 ${
                      isCorrect
                        ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400'
                        : 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
                    }`}>
                      {isCorrect ? <Check className="w-5 h-5" /> : <span className="font-bold text-lg">×</span>}
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
                      <h3 className="text-lg font-medium"><Latex>{q.question}</Latex></h3>
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
                          <Latex>{opt}</Latex>
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

                  <div className="ml-12 bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 text-sm text-apple-dark-gray">
                    <span className="font-semibold text-gray-900 dark:text-gray-100">Explanation: </span>
                    <Latex>{q.explanation ?? ''}</Latex>
                  </div>
                </motion.div>
              )
            })}
          </div>

          <div className="flex justify-center pt-8 pb-12">
            <button onClick={() => router.push('/')} className="btn-primary px-8 py-3">
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
  const progress = ((currentQuestion + 1) / assessment.questions.length) * 100

  return (
    <div className="min-h-screen bg-[#FAFAFA] dark:bg-[#0A0A0A] flex flex-col font-sans">
      {/* Header */}
      <div className="bg-white/80 dark:bg-[#1c1c1e]/80 backdrop-blur-xl sticky top-0 z-30 border-b border-gray-200/50 dark:border-gray-800/50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 sm:py-5">
          <div className="flex justify-between items-center gap-4">
            <div className="flex-1 min-w-0">
              <h1 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white tracking-tight truncate">
                {assessment.subject}
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 truncate mt-0.5">
                {assessment.topics.join(', ')}
              </p>
            </div>

            <motion.div
              className={`flex items-center gap-2 px-4 py-2 rounded-full bg-gray-50 dark:bg-gray-800/50 border border-gray-200/50 dark:border-gray-700/50 ${
                timeRemaining < 120 ? 'text-orange-500' : 'text-apple-blue'
              }`}
              animate={timeRemaining < 120 ? { scale: [1, 1.05, 1] } : {}}
              transition={{ repeat: Infinity, duration: 1 }}
            >
              <Clock className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="font-mono font-bold text-sm sm:text-base tracking-tight">
                {formatTime(timeRemaining)}
              </span>
            </motion.div>
          </div>

          <div className="mt-5 h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-blue-600"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
            />
          </div>
        </div>
      </div>

      {/* Question content */}
      <div className="flex-1 flex items-start justify-center p-4 sm:p-6 lg:p-8">
        <div className="w-full max-w-3xl">
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
                    {(question as LongFormQuestion).marks} marks
                  </div>
                )}
              </div>

              {question.diagram_svg && (
                <div className="bg-gray-50 dark:bg-gray-900/60 rounded-2xl p-4 mb-6 border border-gray-200 dark:border-gray-700 overflow-x-auto">
                  <DiagramSvg svg={question.diagram_svg} />
                </div>
              )}

              {question.passage && (
                <PassageBox passage={question.passage} source={question.passage_source} />
              )}

              <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white mb-8 sm:mb-10 leading-relaxed tracking-tight">
                <Latex>{question.question}</Latex>
              </h2>

              {/* MCQ options */}
              {!isCurrentLongForm && (
                <div className="space-y-3 sm:space-y-4">
                  {(question as MCQQuestion).options.map((option, index) => (
                    <motion.button
                      key={index}
                      onClick={() => handleAnswerSelect(index)}
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.99 }}
                      className={`mcq-option w-full text-left ${
                        selectedAnswers[currentQuestion] === index ? 'selected' : ''
                      }`}
                    >
                      <div className="flex items-center gap-3 sm:gap-4">
                        <div className={`w-5 h-5 sm:w-6 sm:h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                          selectedAnswers[currentQuestion] === index
                            ? 'border-apple-blue bg-apple-blue'
                            : 'border-gray-300 dark:border-gray-600'
                        }`}>
                          {selectedAnswers[currentQuestion] === index && (
                            <Check className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
                          )}
                        </div>
                        <span className="flex-1 text-sm sm:text-base"><Latex>{option}</Latex></span>
                      </div>
                    </motion.button>
                  ))}
                </div>
              )}

              {/* Long-form textarea */}
              {isCurrentLongForm && (
                <div>
                  <div className="text-xs text-gray-400 mb-2">
                    Write a detailed answer. Each mark has a specific criterion — cover as much as you can.
                  </div>
                  <textarea
                    value={longFormAnswers[currentQuestion] || ''}
                    onChange={(e) => handleLongFormChange(e.target.value)}
                    placeholder={`Write your answer here… (${(question as LongFormQuestion).marks} marks available)`}
                    className="w-full min-h-[220px] p-4 rounded-2xl border-2 border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60 text-gray-900 dark:text-white resize-y focus:outline-none focus:border-blue-500 dark:focus:border-blue-400 transition-colors text-sm sm:text-base leading-relaxed"
                    rows={9}
                  />
                  <div className="mt-2 flex justify-between text-xs text-gray-400">
                    <span>
                      {(longFormAnswers[currentQuestion] || '').split(/\s+/).filter(Boolean).length} words
                    </span>
                    <span>
                      Aim for ~{(question as LongFormQuestion).marks * 25}–{(question as LongFormQuestion).marks * 40} words
                    </span>
                  </div>
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
              className="btn-secondary flex items-center gap-1 sm:gap-2 disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base px-3 sm:px-6 py-2 sm:py-3"
            >
              <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="hidden sm:inline">Previous</span>
              <span className="sm:hidden">Prev</span>
            </motion.button>

            {currentQuestion === assessment.questions.length - 1 ? (
              <motion.button
                onClick={handleSubmit}
                disabled={!allAnswered}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base px-3 sm:px-6 py-2 sm:py-3"
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

          {/* Question navigator */}
          <div className="flex gap-1 sm:gap-2 justify-center mt-4 sm:mt-6 flex-wrap">
            {assessment.questions.map((q, idx) => {
              const answered = isLongForm(q)
                ? (longFormAnswers[idx] || '').trim().length > 0
                : selectedAnswers[idx] !== undefined
              const isLF = isLongForm(q)

              return (
                <button
                  key={idx}
                  onClick={() => setCurrentQuestion(idx)}
                  title={isLF ? `Q${idx + 1} — Long-form (${(q as LongFormQuestion).marks} marks)` : `Q${idx + 1} — MCQ`}
                  className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                    idx === currentQuestion
                      ? 'bg-apple-blue text-white'
                      : answered
                      ? isLF
                        ? 'bg-purple-500 text-white'
                        : 'bg-green-500 text-white'
                      : 'bg-gray-300 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                  }`}
                >
                  {idx + 1}
                </button>
              )
            })}
          </div>

          {/* Legend for mixed */}
          {assessment.questions.some(isLongForm) && assessment.questions.some((q) => !isLongForm(q)) && (
            <div className="flex justify-center gap-4 mt-3 text-xs text-gray-400">
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded-sm bg-green-500 inline-block"></span> MCQ answered
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded-sm bg-purple-500 inline-block"></span> Written answered
              </span>
            </div>
          )}
        </div>
      </div>

      {isSubmitted && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
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
