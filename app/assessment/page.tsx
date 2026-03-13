'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Clock, ChevronLeft, ChevronRight, Check, Image as ImageIcon } from 'lucide-react'
import 'katex/dist/katex.min.css'
import Latex from 'react-latex-next'

// Daily image credit allowance (Wikimedia Commons – free, but we're polite)
const DAILY_IMAGE_LIMIT = 20

interface ImageData {
  url: string | null
  alt: string | null
  credit: string | null
  creditUrl: string | null
}

interface Question {
  id: number
  question: string
  options: string[]
  correct_answer: number
  explanation: string
  image_search_query?: string
  image?: ImageData
}

interface Assessment {
  assessment_id: string
  estimated_time: number
  questions: Question[]
  subject: string
  topics: string[]
  curriculum?: string
}

// ----- Credit helpers (localStorage, resets daily) -----
function getImageCredits(): { used: number; date: string } {
  try {
    const stored = localStorage.getItem('imageCredits')
    if (stored) {
      const parsed = JSON.parse(stored)
      const today = new Date().toISOString().slice(0, 10)
      if (parsed.date === today) return parsed
    }
  } catch {}
  return { used: 0, date: new Date().toISOString().slice(0, 10) }
}

function consumeImageCredits(count: number): number {
  const credits = getImageCredits()
  const newUsed = credits.used + count
  localStorage.setItem('imageCredits', JSON.stringify({ ...credits, used: newUsed }))
  return newUsed
}

export default function AssessmentPage() {
  const router = useRouter()
  const [assessment, setAssessment] = useState<Assessment | null>(null)
  const [currentQuestion, setCurrentQuestion] = useState(0)
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({})
  const [timeRemaining, setTimeRemaining] = useState(0)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const [results, setResults] = useState<any>(null)
  const [feedback, setFeedback] = useState<string>('')
  const [isGeneratingFeedback, setIsGeneratingFeedback] = useState(false)

  // Fetch a single image from our API and attach it to the question
  const fetchImageForQuestion = useCallback(
    async (questions: Question[], idx: number): Promise<Question[]> => {
      const q = questions[idx]
      if (!q.image_search_query || q.image !== undefined) return questions

      try {
        const res = await fetch(
          `/api/fetch-image?query=${encodeURIComponent(q.image_search_query)}`
        )
        if (res.ok) {
          const data: ImageData = await res.json()
          const updated = [...questions]
          updated[idx] = { ...q, image: data }
          return updated
        }
      } catch {}

      // Mark as attempted even on failure so we don't retry
      const updated = [...questions]
      updated[idx] = { ...q, image: { url: null, alt: null, credit: null, creditUrl: null } }
      return updated
    },
    []
  )

  useEffect(() => {
    const data = sessionStorage.getItem('currentAssessment')
    if (data) {
      const assessmentData: Assessment = JSON.parse(data)
      setAssessment(assessmentData)
      setTimeRemaining(assessmentData.estimated_time * 60)

      // Count how many image queries the AI included
      const imageQueries = assessmentData.questions.filter((q) => q.image_search_query)
      if (imageQueries.length > 0) {
        const credits = getImageCredits()
        const canFetch = Math.min(imageQueries.length, DAILY_IMAGE_LIMIT - credits.used)
        if (canFetch > 0) {
          consumeImageCredits(canFetch)

          // Fetch images for the first question immediately, rest lazily
          let qs = assessmentData.questions
          let fetchedCount = 0

          const fetchAll = async () => {
            for (let i = 0; i < qs.length; i++) {
              if (qs[i].image_search_query && fetchedCount < canFetch) {
                qs = await fetchImageForQuestion(qs, i)
                fetchedCount++
                setAssessment((prev) => (prev ? { ...prev, questions: qs } : prev))
              }
            }
          }
          fetchAll()
        }
      }
    } else {
      router.push('/')
    }
  }, [router, fetchImageForQuestion])

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

  const getTimerColor = () => {
    if (timeRemaining < 120) return 'text-orange-500'
    return 'text-apple-blue'
  }

  const handleAnswerSelect = (optionIndex: number) => {
    setSelectedAnswers({ ...selectedAnswers, [currentQuestion]: optionIndex })
  }

  const handleSubmit = async () => {
    setIsSubmitted(true)

    let correct = 0
    assessment?.questions.forEach((q, idx) => {
      if (selectedAnswers[idx] === q.correct_answer) correct++
    })

    const score = Math.round((correct / (assessment?.questions.length || 1)) * 100)
    const grade =
      score >= 90 ? 'A+' : score >= 80 ? 'A' : score >= 70 ? 'B+' : score >= 60 ? 'B' : score >= 50 ? 'C' : 'D'

    const result = {
      assessment_id: assessment?.assessment_id,
      score,
      grade,
      answers: selectedAnswers,
      completed_at: new Date().toISOString(),
    }

    setResults(result)
    setShowResults(true)
    setIsGeneratingFeedback(true)

    let generatedFeedback = 'Great effort! Review the explanations below to improve your understanding.'
    const user = JSON.parse(localStorage.getItem('user') || '{}')

    try {
      const feedbackRes = await fetch('/api/generate-feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assessment, answers: selectedAnswers, score, grade, className: user.class }),
      })
      const feedbackData = await feedbackRes.json()
      if (feedbackData.feedback) generatedFeedback = feedbackData.feedback
      setFeedback(generatedFeedback)
    } catch {
      setFeedback(generatedFeedback)
    } finally {
      setIsGeneratingFeedback(false)
      setIsSubmitted(false)
    }

    if (user.id) {
      await fetch('/api/save-result', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.id,
          assessment_id: assessment?.assessment_id,
          answers: selectedAnswers,
          total_questions: assessment?.questions.length || 10,
          score,
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

  if (showResults && results) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] dark:bg-[#0A0A0A] py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto space-y-8">
          {/* Results Header */}
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

            {/* AI Feedback */}
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-2xl p-6 text-left border border-blue-100 dark:border-blue-800/30">
              <h3 className="font-semibold text-blue-800 dark:text-blue-300 mb-2 flex items-center gap-2">
                <span className="text-xl">✨</span> AI Feedback
              </h3>
              {isGeneratingFeedback ? (
                <div className="flex items-center gap-3 text-blue-600 dark:text-blue-400">
                  <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-current"></div>
                  <p className="text-sm">Analysing your performance...</p>
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
                    return (
                      <div key={i} className="text-blue-900 dark:text-blue-100 pl-1">
                        {line}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </motion.div>

          {/* Detailed Review */}
          <div className="space-y-6">
            <h2 className="text-2xl font-bold px-2">Detailed Review</h2>
            {assessment.questions.map((q, idx) => {
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
                      {/* Question image in review */}
                      {q.image?.url && (
                        <div className="mb-3">
                          <img
                            src={q.image.url}
                            alt={q.image.alt ?? ''}
                            className="max-h-48 rounded-xl object-contain border border-gray-200 dark:border-gray-700"
                          />
                          {q.image.credit && (
                            <p className="text-xs text-gray-400 mt-1">
                              {q.image.creditUrl ? (
                                <a href={q.image.creditUrl} target="_blank" rel="noopener noreferrer" className="underline hover:text-gray-600">
                                  {q.image.credit}
                                </a>
                              ) : q.image.credit}
                            </p>
                          )}
                        </div>
                      )}
                      <h3 className="text-lg font-medium">
                        <Latex>{q.question}</Latex>
                      </h3>
                    </div>
                  </div>

                  <div className="space-y-2 ml-12 mb-4">
                    {q.options.map((opt, optIdx) => {
                      let optionClass = 'p-3 rounded-xl text-sm sm:text-base border '
                      if (optIdx === q.correct_answer) {
                        optionClass += 'bg-green-50 border-green-200 text-green-800 dark:bg-green-900/20 dark:border-green-800/50 dark:text-green-200 font-medium'
                      } else if (optIdx === userAnswer && !isCorrect) {
                        optionClass += 'bg-red-50 border-red-200 text-red-800 dark:bg-red-900/20 dark:border-red-800/50 dark:text-red-200'
                      } else {
                        optionClass += 'bg-gray-50 border-transparent text-gray-600 dark:bg-gray-800/50 dark:text-gray-400'
                      }
                      return (
                        <div key={optIdx} className={optionClass}>
                          <Latex>{opt}</Latex>
                          {optIdx === q.correct_answer && (
                            <span className="ml-2 text-xs uppercase tracking-wider font-bold text-green-600 dark:text-green-400">
                              (Correct Answer)
                            </span>
                          )}
                          {optIdx === userAnswer && !isCorrect && (
                            <span className="ml-2 text-xs uppercase tracking-wider font-bold text-red-600 dark:text-red-400">
                              (Your Answer)
                            </span>
                          )}
                        </div>
                      )
                    })}
                  </div>

                  <div className="ml-12 bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 text-sm text-apple-dark-gray">
                    <span className="font-semibold text-gray-900 dark:text-gray-100">Explanation: </span>
                    <Latex>{q.explanation}</Latex>
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

  const question = assessment.questions[currentQuestion]
  const progress = ((currentQuestion + 1) / assessment.questions.length) * 100
  const credits = getImageCredits()
  const creditsRemaining = DAILY_IMAGE_LIMIT - credits.used

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

            <div className="flex items-center gap-2">
              {/* Image credits indicator */}
              {assessment.questions.some((q) => q.image_search_query) && (
                <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gray-50 dark:bg-gray-800/50 border border-gray-200/50 dark:border-gray-700/50 text-xs text-gray-500 dark:text-gray-400">
                  <ImageIcon className="w-3.5 h-3.5" />
                  <span>{creditsRemaining} img credits</span>
                </div>
              )}

              <motion.div
                className={`flex items-center gap-2 px-4 py-2 rounded-full bg-gray-50 dark:bg-gray-800/50 border border-gray-200/50 dark:border-gray-700/50 ${getTimerColor()}`}
                animate={timeRemaining < 120 ? { scale: [1, 1.05, 1] } : {}}
                transition={{ repeat: Infinity, duration: 1 }}
              >
                <Clock className="w-4 h-4 sm:w-5 sm:h-5" />
                <span className="font-mono font-bold text-sm sm:text-base tracking-tight">
                  {formatTime(timeRemaining)}
                </span>
              </motion.div>
            </div>
          </div>

          {/* Progress Bar */}
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

      {/* Question Content */}
      <div className="flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-8">
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
              {/* Question Number */}
              <div className="inline-flex items-center justify-center px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 text-xs sm:text-sm font-semibold mb-6">
                Question {currentQuestion + 1} of {assessment.questions.length}
              </div>

              {/* Question Image */}
              {question.image_search_query && (
                <div className="mb-6">
                  {question.image === undefined ? (
                    // Still loading
                    <div className="flex items-center gap-2 text-sm text-gray-400 py-4">
                      <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-gray-300"></div>
                      <span>Loading image...</span>
                    </div>
                  ) : question.image?.url ? (
                    <div>
                      <img
                        src={question.image.url}
                        alt={question.image.alt ?? question.image_search_query}
                        className="max-h-64 w-auto mx-auto rounded-2xl object-contain border border-gray-200 dark:border-gray-700 shadow-sm"
                      />
                      {question.image.credit && (
                        <p className="text-xs text-center text-gray-400 mt-2">
                          {question.image.creditUrl ? (
                            <a
                              href={question.image.creditUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="underline hover:text-gray-600"
                            >
                              {question.image.credit}
                            </a>
                          ) : (
                            question.image.credit
                          )}
                        </p>
                      )}
                    </div>
                  ) : null /* image not found – show nothing */}
                </div>
              )}

              {/* Question Text */}
              <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white mb-8 sm:mb-10 leading-relaxed tracking-tight">
                <Latex>{question.question}</Latex>
              </h2>

              {/* Options */}
              <div className="space-y-3 sm:space-y-4">
                {question.options.map((option, index) => (
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
                      <span className="flex-1 text-sm sm:text-base">
                        <Latex>{option}</Latex>
                      </span>
                    </div>
                  </motion.button>
                ))}
              </div>
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
                disabled={Object.keys(selectedAnswers).length !== assessment.questions.length}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base px-3 sm:px-6 py-2 sm:py-3"
              >
                <span className="hidden sm:inline">Submit Assessment</span>
                <span className="sm:hidden">Submit</span>
              </motion.button>
            ) : (
              <motion.button
                onClick={() =>
                  setCurrentQuestion(Math.min(assessment.questions.length - 1, currentQuestion + 1))
                }
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="btn-primary flex items-center gap-1 sm:gap-2 text-sm sm:text-base px-3 sm:px-6 py-2 sm:py-3"
              >
                <span>Next</span>
                <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />
              </motion.button>
            )}
          </div>

          {/* Answer Status */}
          <div className="flex gap-1 sm:gap-2 justify-center mt-4 sm:mt-6 flex-wrap">
            {assessment.questions.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentQuestion(idx)}
                className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full text-xs sm:text-sm font-medium transition-all ${
                  idx === currentQuestion
                    ? 'bg-apple-blue text-white'
                    : selectedAnswers[idx] !== undefined
                    ? 'bg-green-500 text-white'
                    : 'bg-gray-300 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                }`}
              >
                {idx + 1}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Submit Confirmation */}
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
            <p className="text-sm sm:text-base text-apple-dark-gray">Calculating your results...</p>
          </motion.div>
        </motion.div>
      )}
    </div>
  )
}
