'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { X, ChevronRight, Check, Loader2, Send } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import { useAuth } from './AuthProvider'
import { useAppRouter } from './AppPathProvider'
import {
  AVAILABLE_CURRICULA,
  RWANDAN_CURRICULUM,
  getSubjectsForGrade,
  getTopicsForGradeAndSubject,
  type GradeLevel,
} from '@/lib/rwanda-curriculum'
import {
  CAMBRIDGE_CURRICULUM,
  getCambridgeSubjectsForGrade,
  getCambridgeTopicsForGradeAndSubject,
  type CambridgeGrade,
} from '@/lib/cambridge-curriculum'
import {
  UNIVERSITY_COURSES,
  getUniversityCourseNames,
  getUniversityYearsForCourse,
  getUniversityTopicsForCourseAndYear,
  getUniversityYearLabel,
} from '@/lib/university-curriculum'

interface FlowFormProps {
  onClose: () => void
  onAssign?: (formData: any, assessmentId: string) => void
}

const GRADES: GradeLevel[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
const TOTAL_STEPS = 9

const DIFFICULTY_LEVELS = [
  {
    id: 'beginner',
    label: 'Beginner',
    grade: 'D Level',
    bloom: 'Remember · Understand',
    description: 'Recall facts, define terms, identify concepts — Bloom\'s Level 1–2',
    color: 'text-emerald-600 dark:text-emerald-400',
    bg: 'bg-emerald-50 dark:bg-emerald-900/20',
    border: 'border-emerald-500',
    badge: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300',
  },
  {
    id: 'average',
    label: 'Average',
    grade: 'C Level',
    bloom: 'Understand · Apply',
    description: 'Explain ideas, classify, solve routine problems — Bloom\'s Level 2–3',
    color: 'text-blue-600 dark:text-blue-400',
    bg: 'bg-blue-50 dark:bg-blue-900/20',
    border: 'border-blue-500',
    badge: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300',
  },
  {
    id: 'intermediate',
    label: 'Intermediate',
    grade: 'B Level',
    bloom: 'Apply · Analyse',
    description: 'Use knowledge in new contexts, break down problems — Bloom\'s Level 3–4',
    color: 'text-amber-600 dark:text-amber-400',
    bg: 'bg-amber-50 dark:bg-amber-900/20',
    border: 'border-amber-500',
    badge: 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300',
  },
  {
    id: 'advanced',
    label: 'Advanced',
    grade: 'A Level',
    bloom: 'Evaluate · Create',
    description: 'Justify, critique, design & synthesise — Bloom\'s Level 5–6. No recall questions.',
    color: 'text-violet-600 dark:text-violet-400',
    bg: 'bg-violet-50 dark:bg-violet-900/20',
    border: 'border-violet-500',
    badge: 'bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300',
  },
]

const QUESTION_TYPES = [
  { id: 'mcq',      label: 'Multiple Choice',        description: 'Classic 4-option questions, auto-graded instantly',             icon: '⊙' },
  { id: 'longform', label: 'Long-form Only',          description: 'Extended written answers, AI-marked with per-mark criteria',    icon: '✍' },
  { id: 'mixed',    label: 'Mixed (MCQ + Long-form)', description: '~60% multiple choice + ~40% written questions',                 icon: '⚡' },
]

const AI_MODEL = { id: 'eu.google.gemma-3-27b-it', label: 'Gemma 3 27B', badge: 'AWS' }

// Shared pill button: highlighted when selected, clean when not
function OptionButton({
  selected,
  onClick,
  children,
  className = '',
}: {
  selected: boolean
  onClick: () => void
  children: React.ReactNode
  className?: string
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={{ scale: 0.98 }}
      className={`relative w-full text-left border rounded-xl px-4 py-3 text-sm transition-all duration-150 ${
        selected
          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-500'
          : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 hover:border-gray-300 dark:hover:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/60'
      } ${className}`}
    >
      {selected && (
        <span className="absolute top-2.5 right-2.5 w-4 h-4 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
          <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />
        </span>
      )}
      {children}
    </motion.button>
  )
}

function StepLabel({ label }: { label: string }) {
  return (
    <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-1">{label}</p>
  )
}

export default function FlowForm({ onClose, onAssign }: FlowFormProps) {
  const router = useAppRouter()
  const { user } = useAuth()
  const isTeacher = (user as any)?.role === 'teacher'
  const [step, setStep] = useState(1)
  const [aiModel] = useState(AI_MODEL.id)
  const [customTime, setCustomTime] = useState<number | null>(null)
  const [showTimerInput, setShowTimerInput] = useState(false)
  const [formData, setFormData] = useState({
    grade: null as GradeLevel | null,
    difficultyLevel: '' as string,
    curriculum: '',
    subject: '',
    topics: [] as string[],
    count: 0,
    style: '',
    questionType: '' as 'mcq' | 'longform' | 'mixed' | '',
    time: 'Calculated by AI',
  })
  const [isLoading, setIsLoading] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [totalTime, setTotalTime] = useState<number | null>(null)
  const startTimeRef = useRef<number>(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [error, setError] = useState('')
  const [generatedData, setGeneratedData] = useState<any>(null)

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current) }, [])

  const isCambridge = formData.curriculum === 'cambridge'
  const isUniversity = formData.curriculum === 'university'
  const subjects = formData.curriculum
    ? isUniversity
      ? getUniversityCourseNames()
      : formData.grade
        ? isCambridge
          ? getCambridgeSubjectsForGrade(formData.grade as CambridgeGrade)
          : getSubjectsForGrade(formData.grade)
        : []
    : []
  const universityYears = isUniversity && formData.subject
    ? getUniversityYearsForCourse(formData.subject)
    : []
  const availableTopics = formData.grade && formData.subject
    ? isCambridge
      ? getCambridgeTopicsForGradeAndSubject(formData.grade as CambridgeGrade, formData.subject)
      : isUniversity
        ? getUniversityTopicsForCourseAndYear(formData.subject, Number(formData.grade))
        : getTopicsForGradeAndSubject(formData.grade, formData.subject)
    : []

  const handleCurriculumSelect = (id: string) => { setFormData({ ...formData, curriculum: id, grade: null, subject: '', topics: [], difficultyLevel: '' }); setTimeout(() => setStep(2), 250) }
  // University: step 2 = course, step 3 = year; Non-university: step 2 = grade, step 3 = difficulty
  const handleSubjectSelect = (subject: string) => { setFormData({ ...formData, subject, topics: [] }); setStep(isUniversity ? 3 : 5) }
  const handleGradeSelect = (grade: GradeLevel) => { setFormData({ ...formData, grade, difficultyLevel: '', subject: isUniversity ? formData.subject : '', topics: [] }); setTimeout(() => setStep(isUniversity ? 4 : 3), 250) }
  const handleDifficultySelect = (id: string) => { setFormData({ ...formData, difficultyLevel: id }); setTimeout(() => setStep(isUniversity ? 5 : 4), 250) }
  const handleTopicToggle = (topic: string) => {
    const newTopics = formData.topics.includes(topic) ? formData.topics.filter(t => t !== topic) : [...formData.topics, topic]
    setFormData({ ...formData, topics: newTopics })
    if (newTopics.length > 0 && step === 5) setTimeout(() => setStep(6), 250)
  }
  const handleCountSelect = (count: number) => { setFormData({ ...formData, count }); setTimeout(() => setStep(7), 250) }
  const handleStyleSelect = (style: string) => { setFormData({ ...formData, style }); setTimeout(() => setStep(8), 250) }
  const handleQuestionTypeSelect = (qt: 'mcq' | 'longform' | 'mixed') => { setFormData({ ...formData, questionType: qt }); setTimeout(() => setStep(9), 250) }

  const handleStartAssessment = async () => {
    setIsLoading(true)
    setError('')
    setTotalTime(null)
    setElapsed(0)
    startTimeRef.current = Date.now()
    timerRef.current = setInterval(() => {
      setElapsed(Math.round((Date.now() - startTimeRef.current) / 1000))
    }, 1000)
    try {
      const response = await fetch('/api/generate-assessment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, className: user?.class, user_id: user?.id, aiModel, customTime }),
      })
      const text = await response.text()
      if (!text) throw new Error('Server returned an empty response. Please try again.')
      const data = JSON.parse(text)
      if (!response.ok) throw new Error(data.error || 'Failed to generate assessment')
      if (isTeacher) {
        setGeneratedData(data)
      } else {
        sessionStorage.setItem('currentAssessment', JSON.stringify(data))
        router.push('/assessment')
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
      setTotalTime(Math.round((Date.now() - startTimeRef.current) / 1000))
      setIsLoading(false)
    }
  }

  const selectedCurriculum = AVAILABLE_CURRICULA.find(c => c.id === formData.curriculum)
  const selectedQuestionType = QUESTION_TYPES.find(qt => qt.id === formData.questionType)
  const selectedDifficulty = DIFFICULTY_LEVELS.find(d => d.id === formData.difficultyLevel)
  const gradeLevelStr = formData.grade
    ? isCambridge
      ? CAMBRIDGE_CURRICULUM[formData.grade as CambridgeGrade]?.cambridgeLevel
      : isUniversity
        ? getUniversityYearLabel(formData.subject, Number(formData.grade))
        : `${RWANDAN_CURRICULUM[formData.grade]?.rwandaLevel}`
    : ''

  const summaryRows = [
    { label: 'Curriculum', value: selectedCurriculum?.name ?? formData.curriculum },
    ...(isUniversity ? [
      { label: 'Course', value: formData.subject },
      { label: 'Year',   value: gradeLevelStr },
    ] : [
      { label: 'Grade',   value: `Grade ${formData.grade} · ${gradeLevelStr}` },
      { label: 'Subject', value: formData.subject },
    ]),
    { label: 'Difficulty', value: selectedDifficulty ? `${selectedDifficulty.label} (${selectedDifficulty.grade})` : '' },
    { label: 'Topics',     value: formData.topics.join(', ') },
    { label: 'Questions',  value: String(formData.count) },
    { label: 'Style',      value: formData.style },
    { label: 'Type',       value: selectedQuestionType?.label ?? '' },
  ]

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 sm:p-6"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.96, opacity: 0, y: 16 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.96, opacity: 0, y: 16 }}
          transition={{ duration: 0.2 }}
          onClick={e => e.stopPropagation()}
          className="w-full max-w-xl bg-white dark:bg-gray-950 rounded-2xl max-h-[90vh] overflow-y-auto shadow-2xl shadow-black/20 border border-gray-200/60 dark:border-gray-800/60 flex flex-col"
        >
          {/* Modal header */}
          <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100 dark:border-gray-800/60 flex-shrink-0">
            <div>
              <h2 className="text-base font-bold text-gray-900 dark:text-white">New Assessment</h2>
              <p className="text-xs text-gray-400 mt-0.5">Step {Math.min(step, TOTAL_STEPS)} of {TOTAL_STEPS}</p>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Progress bar */}
          <div className="flex gap-1 px-6 py-3 flex-shrink-0">
            {Array.from({ length: TOTAL_STEPS }, (_, i) => i + 1).map(s => (
              <div
                key={s}
                className={`h-1 flex-1 rounded-full transition-all duration-400 ${s <= step ? 'bg-blue-600' : 'bg-gray-100 dark:bg-gray-800'}`}
              />
            ))}
          </div>

          {/* Scrollable content */}
          <div className="flex-1 px-6 pb-6 space-y-6 overflow-y-auto">

            {/* Step 1: Curriculum */}
            {step >= 1 && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <StepLabel label="Curriculum" />
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Choose your curriculum</h3>
                <div className="flex flex-col gap-2">
                  {AVAILABLE_CURRICULA.map(c => (
                    <OptionButton key={c.id} selected={formData.curriculum === c.id} onClick={() => handleCurriculumSelect(c.id)}>
                      <div className="flex items-center gap-3">
                        <span className="text-xl">{c.flag}</span>
                        <div>
                          <p className="font-semibold text-sm text-gray-900 dark:text-white">{c.name}</p>
                          <p className="text-[11px] text-gray-400">{c.description}</p>
                        </div>
                      </div>
                    </OptionButton>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Step 2: University = Course selector / Non-university = Grade selector */}
            {step >= 2 && formData.curriculum && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                {isUniversity ? (
                  <>
                    <StepLabel label="University course" />
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Select your course</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {subjects.map(subject => (
                        <OptionButton key={subject} selected={formData.subject === subject} onClick={() => handleSubjectSelect(subject)}>
                          <span className="font-medium text-gray-800 dark:text-gray-200">{subject}</span>
                        </OptionButton>
                      ))}
                    </div>
                  </>
                ) : (
                  <>
                    <StepLabel label="Grade level" />
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Select your grade</h3>
                    <div className="grid grid-cols-3 gap-2">
                      {GRADES.map(grade => (
                        <OptionButton key={grade} selected={formData.grade === grade} onClick={() => handleGradeSelect(grade)}>
                          <span className="font-bold text-gray-900 dark:text-white block">Grade {grade}</span>
                          <span className="text-[11px] text-gray-400 mt-0.5 block">
                            {grade <= 6 ? `P${grade} / Primary` : grade <= 9 ? `S${grade - 6} / Yr ${grade}` : grade <= 11 ? `S${grade - 6} / IGCSE` : 'S6 / AS Level'}
                          </span>
                        </OptionButton>
                      ))}
                    </div>
                  </>
                )}
              </motion.div>
            )}

            {/* Step 3: University = Year selector / Non-university = Difficulty */}
            {step >= 3 && (isUniversity ? formData.subject : formData.grade) && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                {isUniversity ? (
                  <>
                    <StepLabel label="University year" />
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">{`${formData.subject} · Select your year`}</h3>
                    <div className="grid grid-cols-3 gap-2">
                      {universityYears.map(year => (
                        <OptionButton key={year} selected={formData.grade === year} onClick={() => handleGradeSelect(year as GradeLevel)}>
                          <span className="font-bold text-gray-900 dark:text-white block">Year {year}</span>
                          <span className="text-[11px] text-gray-400 mt-0.5 block">
                            {UNIVERSITY_COURSES[formData.subject]?.years[year]?.description ?? ''}
                          </span>
                        </OptionButton>
                      ))}
                    </div>
                  </>
                ) : (
                  <>
                    <StepLabel label="Difficulty level" />
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">Select student level</h3>
                    <p className="text-xs text-gray-400 mb-3">This shapes how challenging the questions will be</p>
                    <div className="flex flex-col gap-2">
                      {DIFFICULTY_LEVELS.map(dl => (
                        <OptionButton key={dl.id} selected={formData.difficultyLevel === dl.id} onClick={() => handleDifficultySelect(dl.id)}>
                          <div className="flex items-center gap-3">
                            <span className={`text-[11px] font-black px-2 py-0.5 rounded-md flex-shrink-0 ${dl.badge}`}>{dl.grade}</span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className={`font-bold text-sm ${dl.color}`}>{dl.label}</p>
                                <span className="text-[10px] font-semibold text-gray-400 dark:text-gray-500">{dl.bloom}</span>
                              </div>
                              <p className="text-[11px] text-gray-400 mt-0.5">{dl.description}</p>
                            </div>
                          </div>
                        </OptionButton>
                      ))}
                    </div>
                  </>
                )}
              </motion.div>
            )}

            {/* Step 4: University = Difficulty / Non-university = Subject */}
            {step >= 4 && (isUniversity ? formData.grade : formData.difficultyLevel) && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                {isUniversity ? (
                  <>
                    <StepLabel label="Difficulty level" />
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">Select student level</h3>
                    <p className="text-xs text-gray-400 mb-3">This shapes how challenging the questions will be</p>
                    <div className="flex flex-col gap-2">
                      {DIFFICULTY_LEVELS.map(dl => (
                        <OptionButton key={dl.id} selected={formData.difficultyLevel === dl.id} onClick={() => handleDifficultySelect(dl.id)}>
                          <div className="flex items-center gap-3">
                            <span className={`text-[11px] font-black px-2 py-0.5 rounded-md flex-shrink-0 ${dl.badge}`}>{dl.grade}</span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className={`font-bold text-sm ${dl.color}`}>{dl.label}</p>
                                <span className="text-[10px] font-semibold text-gray-400 dark:text-gray-500">{dl.bloom}</span>
                              </div>
                              <p className="text-[11px] text-gray-400 mt-0.5">{dl.description}</p>
                            </div>
                          </div>
                        </OptionButton>
                      ))}
                    </div>
                  </>
                ) : (
                  <>
                    <StepLabel label="Subject" />
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                      {`Grade ${formData.grade} · ${isCambridge ? 'Cambridge' : 'REB'} subjects`}
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {subjects.map(subject => (
                        <OptionButton key={subject} selected={formData.subject === subject} onClick={() => handleSubjectSelect(subject)}>
                          <span className="font-medium text-gray-800 dark:text-gray-200">{subject}</span>
                        </OptionButton>
                      ))}
                    </div>
                  </>
                )}
              </motion.div>
            )}

            {/* Step 5: Topics */}
            {step >= 5 && formData.subject && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <StepLabel label="Topics" />
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">Select topics to cover</h3>
                <p className="text-xs text-gray-400 mb-3">You can select multiple topics</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {availableTopics.map(topic => (
                    <OptionButton key={topic} selected={formData.topics.includes(topic)} onClick={() => handleTopicToggle(topic)}>
                      <span className="font-medium text-gray-800 dark:text-gray-200 text-sm pr-6">{topic}</span>
                    </OptionButton>
                  ))}
                </div>
                {formData.topics.length > 0 && step === 5 && (
                  <motion.button
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    onClick={() => setStep(6)}
                    className="mt-3 w-full py-2.5 rounded-xl border border-blue-500 text-blue-600 dark:text-blue-400 text-sm font-semibold hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                  >
                    Continue with {formData.topics.length} topic{formData.topics.length > 1 ? 's' : ''} →
                  </motion.button>
                )}
              </motion.div>
            )}

            {/* Step 6: Count */}
            {step >= 6 && formData.topics.length > 0 && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <StepLabel label="Question count" />
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">How many questions?</h3>
                <div className="grid grid-cols-3 gap-2">
                  {[10, 20, 40].map(count => (
                    <OptionButton key={count} selected={formData.count === count} onClick={() => handleCountSelect(count)} className="text-center">
                      <span className="text-2xl font-bold text-gray-900 dark:text-white block">{count}</span>
                      <span className="text-[11px] text-gray-400">
                        {count === 10 ? '~15 min' : count === 20 ? '~30 min' : '~60 min'}
                      </span>
                    </OptionButton>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Step 7: Style */}
            {step >= 7 && formData.count > 0 && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <StepLabel label="Assessment style" />
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Choose a question style</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {[
                    { label: 'Exam Style', sub: 'Past paper format, timed conditions', value: 'Exam Style (Past Papers)' },
                    { label: 'Test Style', sub: 'Textbook exercises & practice questions', value: 'Test Style (Textbooks)' },
                  ].map(s => (
                    <OptionButton key={s.value} selected={formData.style === s.value} onClick={() => handleStyleSelect(s.value)}>
                      <p className="font-semibold text-sm text-gray-900 dark:text-white">{s.label}</p>
                      <p className="text-[11px] text-gray-400 mt-0.5">{s.sub}</p>
                    </OptionButton>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Step 8: Question Type */}
            {step >= 8 && formData.style && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <StepLabel label="Question type" />
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">How should questions be presented?</h3>
                <div className="flex flex-col gap-2">
                  {QUESTION_TYPES.map(qt => (
                    <OptionButton key={qt.id} selected={formData.questionType === qt.id} onClick={() => handleQuestionTypeSelect(qt.id as 'mcq' | 'longform' | 'mixed')}>
                      <div className="flex items-start gap-3">
                        <span className="text-lg mt-0.5 w-6 text-center flex-shrink-0">{qt.icon}</span>
                        <div>
                          <p className="font-semibold text-sm text-gray-900 dark:text-white">{qt.label}</p>
                          <p className="text-[11px] text-gray-400 mt-0.5">{qt.description}</p>
                        </div>
                      </div>
                    </OptionButton>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Step 9: Summary & Generate */}
            {step >= 9 && formData.questionType && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <StepLabel label="Summary" />
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Review your assessment</h3>

                <div className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden mb-4">
                  {summaryRows.filter(r => r.value).map((row, i) => (
                    <div key={row.label} className={`flex items-start gap-3 px-4 py-3 ${i !== 0 ? 'border-t border-gray-100 dark:border-gray-800/60' : ''}`}>
                      <span className="text-xs text-gray-400 w-24 flex-shrink-0 pt-0.5">{row.label}</span>
                      <span className="text-xs font-semibold text-gray-800 dark:text-gray-200 flex-1">{row.value}</span>
                    </div>
                  ))}
                </div>

                {/* Timer button */}
                <div className="mb-4">
                  <button
                    type="button"
                    onClick={() => setShowTimerInput(p => !p)}
                    className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-semibold transition-colors ${
                      customTime !== null
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                        : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 hover:border-gray-300'
                    }`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                    {customTime !== null ? `Timer: ${customTime} min` : 'Set custom timer'}
                  </button>
                </div>
                {showTimerInput && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                    className="mb-4 flex items-center gap-2 px-3 py-2.5 rounded-xl border border-blue-200 dark:border-blue-800/60 bg-blue-50/50 dark:bg-blue-900/10"
                  >
                    <span className="text-xs text-gray-600 dark:text-gray-400 flex-shrink-0">Minutes:</span>
                    <input
                      type="number"
                      min={1}
                      max={300}
                      value={customTime ?? ''}
                      placeholder="e.g. 45"
                      onChange={e => setCustomTime(e.target.value ? Math.max(1, parseInt(e.target.value)) : null)}
                      className="flex-1 bg-transparent text-xs font-bold text-gray-900 dark:text-white outline-none"
                    />
                    {customTime !== null && (
                      <button type="button" onClick={() => { setCustomTime(null); setShowTimerInput(false) }}
                        className="text-[10px] text-gray-400 hover:text-red-500 transition-colors">clear</button>
                    )}
                  </motion.div>
                )}

                {error && (
                  <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/60 rounded-lg px-4 py-3 mb-4">
                    {error}
                  </motion.p>
                )}

                {/* Teacher: generated — show assign / take options */}
                {isTeacher && generatedData ? (
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-2">
                    <p className="text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/60 rounded-lg px-4 py-3 font-semibold">
                      Assessment generated successfully!
                    </p>
                    <button
                      onClick={() => { onAssign?.(formData, generatedData.assessment_id); onClose() }}
                      className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold py-3 px-6 rounded-xl transition-colors shadow-sm shadow-blue-900/20"
                    >
                      <Send className="w-4 h-4" />
                      Assign to Students
                    </button>
                    <button
                      onClick={() => { sessionStorage.setItem('currentAssessment', JSON.stringify(generatedData)); router.push('/assessment') }}
                      className="w-full flex items-center justify-center gap-2 border border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-300 text-sm font-semibold py-2.5 px-6 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"
                    >
                      Preview Assessment
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </motion.div>
                ) : (
                  <button
                    onClick={handleStartAssessment}
                    disabled={isLoading}
                    className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-semibold py-3 px-6 rounded-xl transition-colors shadow-sm shadow-blue-900/20"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Generating… <span className="font-mono tabular-nums">{elapsed}s</span></span>
                      </>
                    ) : (
                      <>
                        {totalTime !== null ? (
                          <span className="flex items-center gap-2">
                            <Check className="w-4 h-4" />
                            {isTeacher ? 'Generate Assessment' : 'Generate & Start'}
                            <span className="text-blue-200 font-normal text-xs">({totalTime}s)</span>
                          </span>
                        ) : (
                          <>
                            {isTeacher ? 'Generate Assessment' : 'Generate & Start'}
                            <ChevronRight className="w-4 h-4" />
                          </>
                        )}
                      </>
                    )}
                  </button>
                )}
              </motion.div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
