'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { X, ChevronRight, Check, Loader2, Send } from 'lucide-react'
import { useState, useRef, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from './AuthProvider'
import { createAiJob, triggerAiJobExecution, waitForAiJob } from '@/lib/client-ai-jobs'

type TextbookRow = { id: number; name: string; subjectName?: string; displayName?: string; curriculum: number; filename?: string | null }
type TopicRow = { id: number; textbook_id: number; name: string }
type SubtopicRow = { id: number; textbook_id: number; topic_id: number; name: string }
type ClassRow = { id: number; name: string; curricula: number[] }
type CurriculumOption = {
  id: string
  label: string
  shortLabel: string
  description: string
  badge: string
  numeric: number
}

interface FlowFormProps {
  onClose: () => void
}

const TOTAL_STEPS = 9

const CURRICULUM_BY_NUMERIC: Record<number, Omit<CurriculumOption, 'numeric'>> = Object.fromEntries(
  Object.values(CURRICULUM_REGISTRY)
    .filter((c) => c.schoolFlow)
    .map((c) => [c.numeric, {
      id: c.slug,
      label: c.label,
      shortLabel: c.shortLabel,
      description: c.description,
      badge: c.badge,
    }]),
) as Record<number, Omit<CurriculumOption, 'numeric'>>

function buildCurriculumOption(value: number): CurriculumOption {
  const meta = CURRICULUM_BY_NUMERIC[value]
  if (meta) return { ...meta, numeric: value }
  return {
    id: `curriculum-${value}`,
    label: `Curriculum ${value}`,
    shortLabel: `Curriculum ${value}`,
    description: 'Curriculum sourced from database.',
    badge: 'DB',
    numeric: value,
  }
}

function deriveGradeFromClassName(className: string): number | null {
  const name = String(className ?? '').trim()
  if (!name) return null

  // Prefer explicit "Grade 7" / "Grade7" style labels.
  const gradeMatch = name.match(/\bgrade\s*(\d{1,2})\b/i) || name.match(/^grade(\d{1,2})$/i)
  if (gradeMatch) {
    const n = Number(gradeMatch[1])
    return Number.isFinite(n) ? n : null
  }

  // Fallback: any standalone 1–2 digit number.
  const anyNum = name.match(/\b(\d{1,2})\b/)
  if (anyNum) {
    const n = Number(anyNum[1])
    return Number.isFinite(n) ? n : null
  }

  return null
}

function formatClassLabel(className: string, grade: number | null, curriculumId: string) {
  if (curriculumId === 'nigeria') {
    const m = className.match(/^(P\d|JSS\d|SS\d)$/i)
    if (m) {
      if (className.startsWith('P')) return `Primary ${className.slice(1)}`
      if (className.startsWith('JSS')) return `Junior Secondary ${className.slice(3)}`
      if (className.startsWith('SS')) return `Senior Secondary ${className.slice(2)}`
    }
    return className
  }
  if (curriculumId !== 'rwanda' || grade === null) return className
  if (grade >= 1 && grade <= 6) return `Primary ${grade}`
  if (grade >= 7 && grade <= 12) return `Senior ${grade - 6}`
  return className
}

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
  { id: 'mcq', label: 'Multiple Choice', description: 'Classic 4-option questions, auto-graded instantly', icon: '⊙' },
  { id: 'longform', label: 'Long-form Only', description: 'Extended written answers, AI-marked with per-mark criteria', icon: '✍' },
  { id: 'mixed', label: 'Mixed (MCQ + Long-form)', description: '~60% multiple choice + ~40% written questions', icon: '⚡' },
]

const AI_MODEL = { id: 'eu.google.gemma-3-27b-it-v1:0', label: 'Gemma 3 27B', badge: 'AWS' }
const USE_ASYNC_AI_JOBS = process.env.NEXT_PUBLIC_USE_ASYNC_AI_JOBS === 'true'

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
      className={`relative w-full text-left border rounded-xl px-4 py-3 text-sm transition-all duration-150 ${selected
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

export default function FlowForm({ onClose }: FlowFormProps) {
  const router = useRouter()
  const { user } = useAuth()
  const { canGenerateAssessment, handlePaymentRequired } = useSubscription()
  const userCountry = normalizeCountry(user?.country ?? 'RW')
  const allowedCurriculumNums = useMemo(
    () => new Set(curriculaForCountry(userCountry, { schoolOnly: true }).map((c) => c.numeric)),
    [userCountry],
  )
  const isTeacher = (user as any)?.role === 'teacher'
  const [flowMode, setFlowMode] = useState<'ai' | 'scratch' | ''>('')
  const [step, setStep] = useState(1)
  const [aiModel] = useState(AI_MODEL.id)
  const [customTime, setCustomTime] = useState<number | null>(null)
  const [showTimerInput, setShowTimerInput] = useState(false)
  const [formData, setFormData] = useState({
    class_id: null as number | null,
    class_name: '' as string,
    grade: null as number | null,
    difficultyLevel: '' as string,
    curriculum: '',
    subject: '',
    topics: [] as string[],
    textbook_id: null as number | null,
    topic_ids: [] as number[],
    subtopic_ids: [] as number[],
    count: 0,
    maxAttempts: 1,
    style: '',
    questionType: '' as 'mcq' | 'longform' | 'mixed' | '',
    time: 'Calculated by AI',
  })

  const [classes, setClasses] = useState<ClassRow[]>([])
  const [isLoadingClasses, setIsLoadingClasses] = useState(false)
  const [textbooks, setTextbooks] = useState<TextbookRow[]>([])
  const [topics, setTopics] = useState<TopicRow[]>([])
  const [subtopics, setSubtopics] = useState<SubtopicRow[]>([])
  const [isLoadingTextbooks, setIsLoadingTextbooks] = useState(false)
  const [isLoadingTopics, setIsLoadingTopics] = useState(false)
  const [isLoadingSubtopics, setIsLoadingSubtopics] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isSavingDraft, setIsSavingDraft] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [totalTime, setTotalTime] = useState<number | null>(null)
  const startTimeRef = useRef<number>(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [error, setError] = useState('')
  const [generatedData, setGeneratedData] = useState<any>(null)
  const [manualTopicInput, setManualTopicInput] = useState('')
  const [draftId, setDraftId] = useState<string | null>(null)

  useEffect(() => {
    if (isTeacher) {
      setFlowMode('')
    } else {
      setFlowMode('ai')
    }
  }, [isTeacher])

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current) }, [])

  // Load available classes from DB so the UI never shows non-existent grades.
  useEffect(() => {
    const load = async () => {
      setIsLoadingClasses(true)
      try {
        const res = await fetch(`/api/classes?country=${userCountry}`)
        const json = await res.json()
        if (!res.ok) throw new Error(json?.error || 'Failed to load classes')
        const rows = Array.isArray(json?.data) ? json.data : []
        const normalized: ClassRow[] = rows
          .map((r: any) => {
            const textbooks = Array.isArray(r?.textbooks) ? r.textbooks : []
            const curricula = Array.from(new Set(
              textbooks
                .map((tb: any) => Number(tb?.curriculum))
                .filter((value: number) => Number.isFinite(value)),
            ))
            return {
              id: Number(r?.id),
              name: String(r?.name ?? '').trim(),
              curricula,
            }
          })
          .filter((r: any) => Number.isFinite(r.id) && r.name)
        setClasses(normalized)

        // If the signed-in user already has a class, preselect it (students).
        if (!formData.class_name && user?.class) {
          const match = normalized.find((c) => c.name === user.class)
          if (match && match.curricula.length === 1) {
            const curriculumId = buildCurriculumOption(match.curricula[0]).id
            setFormData((prev) => ({
              ...prev,
              curriculum: curriculumId,
              class_id: match.id,
              class_name: match.name,
              grade: deriveGradeFromClassName(match.name),
            }))
            setTimeout(() => setStep(3), 250)
          }
        }
      } catch (e: any) {
        setClasses([])
        setError(e?.message || 'Failed to load classes')
      } finally {
        setIsLoadingClasses(false)
      }
    }
    load()
  }, [userCountry, user?.class])

  const curriculumOptions = useMemo(
    () => Array.from(allowedCurriculumNums)
      .sort((a, b) => a - b)
      .map((value) => buildCurriculumOption(value)),
    [allowedCurriculumNums],
  )

  const selectedCurriculum = curriculumOptions.find((c) => c.id === formData.curriculum)
  const selectedCurriculumNumeric = selectedCurriculum?.numeric ?? null

  const classOptions = useMemo(() => {
    const eligible = selectedCurriculumNumeric === null
      ? classes
      : classes.filter((cls) => cls.curricula.length === 0 || cls.curricula.includes(selectedCurriculumNumeric))

    return eligible
      .map((cls) => {
        const grade = deriveGradeFromClassName(cls.name)
        return {
          ...cls,
          grade,
          label: formatClassLabel(cls.name, grade, formData.curriculum),
        }
      })
      .sort((a, b) => {
        const aGrade = a.grade ?? Number.POSITIVE_INFINITY
        const bGrade = b.grade ?? Number.POSITIVE_INFINITY
        if (aGrade !== bGrade) return aGrade - bGrade
        return a.label.localeCompare(b.label)
      })
  }, [classes, formData.curriculum, selectedCurriculumNumeric])

  const selectedClassDisplayName = formData.class_name
    ? formatClassLabel(formData.class_name, deriveGradeFromClassName(formData.class_name), formData.curriculum)
    : ''

  const isCambridge = formData.curriculum === 'cambridge'
  const curriculumNumeric = selectedCurriculumNumeric ?? (isCambridge ? 1 : formData.curriculum === 'nigeria' ? 2 : 0)

  const classNameForTextbooks = formData.class_name

  const subjectTextbooks = useMemo(() => {
    return withDisplaySubjectNames(filterAliasTextbooks(textbooks)).sort((a, b) =>
      a.displayName.localeCompare(b.displayName)
    )
  }, [textbooks])

  // Load textbooks for the user's class (e.g. "Grade 7"), filtered by curriculum.
  useEffect(() => {
    const load = async () => {
      if (!formData.curriculum) return
      if (!classNameForTextbooks) {
        setTextbooks([])
        return
      }
      setIsLoadingTextbooks(true)
      try {
        const res = await fetch(`/api/class-textbooks?class_name=${encodeURIComponent(classNameForTextbooks)}&curriculum=${curriculumNumeric}`)
        const json = await res.json()
        if (!res.ok) throw new Error(json?.error || 'Failed to load textbooks')
        setTextbooks(Array.isArray(json?.data) ? json.data : [])
      } catch (e: any) {
        setTextbooks([])
        setError(e?.message || 'Failed to load textbooks')
      } finally {
        setIsLoadingTextbooks(false)
      }
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.curriculum, formData.class_name])

  // Load topics when a textbook is selected.
  useEffect(() => {
    const load = async () => {
      if (!formData.textbook_id) {
        setTopics([])
        return
      }
      setIsLoadingTopics(true)
      try {
        const res = await fetch(`/api/topics?textbook_id=${formData.textbook_id}`)
        const json = await res.json()
        if (!res.ok) throw new Error(json?.error || 'Failed to load topics')
        setTopics(Array.isArray(json?.data) ? json.data : [])
      } catch (e: any) {
        setTopics([])
        setError(e?.message || 'Failed to load topics')
      } finally {
        setIsLoadingTopics(false)
      }
    }
    load()
  }, [formData.textbook_id])

  // Load subtopics only when exactly one topic is selected.
  useEffect(() => {
    const load = async () => {
      if (!formData.textbook_id) {
        setSubtopics([])
        return
      }
      if (formData.topic_ids.length !== 1) {
        setSubtopics([])
        return
      }
      const topicId = formData.topic_ids[0]
      setIsLoadingSubtopics(true)
      try {
        const res = await fetch(`/api/subtopics?textbook_id=${formData.textbook_id}&topic_id=${topicId}`)
        const json = await res.json()
        if (!res.ok) throw new Error(json?.error || 'Failed to load subtopics')
        setSubtopics(Array.isArray(json?.data) ? json.data : [])
      } catch (e: any) {
        setSubtopics([])
        setError(e?.message || 'Failed to load subtopics')
      } finally {
        setIsLoadingSubtopics(false)
      }
    }
    load()
  }, [formData.textbook_id, formData.topic_ids])

  const handleClassSelect = (cls: ClassRow) => {
    setError('')
    setFormData((prev) => ({
      ...prev,
      class_id: cls.id,
      class_name: cls.name,
      grade: deriveGradeFromClassName(cls.name),
      difficultyLevel: '',
      subject: '',
      topics: [],
      textbook_id: null,
      topic_ids: [],
      subtopic_ids: [],
      count: 0,
      style: '',
      questionType: '',
    }))
    setTopics([])
    setSubtopics([])
    setTextbooks([])
    setTimeout(() => setStep(3), 250)
  }
  const handleDifficultySelect = (id: string) => {
    setFormData((prev) => ({ ...prev, difficultyLevel: id }))
    setTimeout(() => setStep(4), 250)
  }
  const handleCurriculumSelect = (id: string) => {
    setError('')
    setFormData((prev) => ({
      ...prev,
      curriculum: id,
      class_id: null,
      class_name: '',
      grade: null,
      difficultyLevel: '',
      subject: '',
      topics: [],
      textbook_id: null,
      topic_ids: [],
      subtopic_ids: [],
      count: 0,
      style: '',
      questionType: '',
    }))
    setTopics([])
    setSubtopics([])
    setTextbooks([])
    setTimeout(() => setStep(2), 250)
  }

  const handleSubjectSelect = (textbookName: string, textbookId: number, subjectLabel?: string) => {
    setError('')
    setManualTopicInput('')
    const subject = subjectLabel || subjectFromTextbookName(textbookName)
    setFormData({
      ...formData,
      subject,
      textbook_id: textbookId,
      topics: [],
      topic_ids: [],
      subtopic_ids: [],
    })
    setSubtopics([])
    setStep(5)
  }

  const handleManualTopicsContinue = () => {
    const names = manualTopicInput
      .split(/[,;\n]+/)
      .map((s) => s.trim())
      .filter(Boolean)
    if (names.length === 0) {
      setError('Enter at least one topic to cover.')
      return
    }
    setError('')
    setFormData((prev) => ({
      ...prev,
      topics: names,
      topic_ids: [],
      subtopic_ids: [],
    }))
    setTimeout(() => setStep(6), 250)
  }

  const handleTopicToggle = (topicId: number, topicName: string) => {
    const selected = formData.topic_ids.includes(topicId)
    const newTopicIds = selected ? formData.topic_ids.filter(id => id !== topicId) : [...formData.topic_ids, topicId]
    const newTopics = selected ? formData.topics.filter(t => t !== topicName) : [...formData.topics, topicName]
    const previousSingleTopic = formData.topic_ids.length === 1 ? formData.topic_ids[0] : null
    const nextSingleTopic = newTopicIds.length === 1 ? newTopicIds[0] : null
    const shouldClearSubtopics = nextSingleTopic !== previousSingleTopic

    setFormData({
      ...formData,
      topic_ids: newTopicIds,
      topics: newTopics,
      subtopic_ids: shouldClearSubtopics ? [] : formData.subtopic_ids,
    })
    if (newTopics.length > 0 && step === 5) setTimeout(() => setStep(6), 250)
  }

  const handleSubtopicToggle = (subtopicId: number | null) => {
    if (subtopicId === null) {
      setFormData({ ...formData, subtopic_ids: [] })
      return
    }
    const selected = formData.subtopic_ids.includes(subtopicId)
    const nextIds = selected
      ? formData.subtopic_ids.filter(id => id !== subtopicId)
      : [...formData.subtopic_ids, subtopicId]
    setFormData({ ...formData, subtopic_ids: nextIds })
  }
  const handleCountSelect = (count: number) => { setFormData({ ...formData, count }); setTimeout(() => setStep(7), 250) }
  const handleStyleSelect = (style: string) => { setFormData({ ...formData, style }); setTimeout(() => setStep(8), 250) }
  const handleQuestionTypeSelect = (qt: 'mcq' | 'longform' | 'mixed') => { setFormData({ ...formData, questionType: qt }); setTimeout(() => setStep(9), 250) }

  const buildDraftTitle = () => {
    const subject = formData.subject || 'Assessment'
    if (formData.class_name) return `${subject} — ${formData.class_name}`
    if (formData.grade) return `${subject} — Grade ${formData.grade}`
    return subject
  }

  const createDraft = async (data: any) => {
    if (!user?.id) return
    setIsSavingDraft(true)
    setError('')
    try {
      const res = await fetch('/api/assignments/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teacher_id: user.id,
          teacher_name: user.name,
          title: buildDraftTitle(),
          subject: formData.subject,
          topics: formData.topics,
          grade: formData.grade ? String(formData.grade) : formData.class_name,
          curriculum: formData.curriculum,
          difficulty_level: formData.difficultyLevel,
          question_count: formData.count,
          max_attempts: formData.maxAttempts,
          style: formData.style,
          question_type: formData.questionType,
          status: 'draft',
          questions_data: data?.questions ?? [],
          estimated_time: data?.estimated_time ?? null,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to save draft')
      setDraftId(json.assignment_id)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsSavingDraft(false)
    }
  }

  const handleStartAssessment = async () => {
    if (!canGenerateAssessment) {
      handlePaymentRequired('assessment')
      return
    }
    setIsLoading(true)
    setError('')
    setTotalTime(null)
    setElapsed(0)
    startTimeRef.current = Date.now()
    timerRef.current = setInterval(() => {
      setElapsed(Math.round((Date.now() - startTimeRef.current) / 1000))
    }, 1000)
    try {
      const requestPayload = { ...formData, className: formData.class_name || user?.class, user_id: user?.id, aiModel, customTime }
      let data: any = null

      if (USE_ASYNC_AI_JOBS) {
        const job = await createAiJob('generate_assessment', requestPayload)
        await triggerAiJobExecution(job.id)
        data = await waitForAiJob<any>(job.id, { timeoutMs: 210000, pollIntervalMs: 2500 })
      } else {
        const response = await fetch('/api/generate-assessment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestPayload),
        })
        const text = await response.text()
        if (!text) throw new Error('Server returned an empty response. Please try again.')
        data = JSON.parse(text)
        if (!response.ok) throw new Error(data.error || 'Failed to generate assessment')
      }

      if (isTeacher) {
        setGeneratedData(data)
        await createDraft(data)
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

  const selectedQuestionType = QUESTION_TYPES.find(qt => qt.id === formData.questionType)
  const selectedDifficulty = DIFFICULTY_LEVELS.find(d => d.id === formData.difficultyLevel)

  const selectedSubtopicNames = formData.subtopic_ids
    .map((id) => subtopics.find(s => s.id === id)?.name)
    .filter(Boolean) as string[]

  const subtopicSummary = formData.topic_ids.length === 1 && subtopics.length > 0
    ? (selectedSubtopicNames.length > 0 ? selectedSubtopicNames.join(', ') : 'Entire topic')
    : ''

  const summaryRows = [
    { label: 'Class', value: selectedClassDisplayName || formData.class_name },
    { label: 'Grade', value: formData.grade ? `Grade ${formData.grade}` : '' },
    { label: 'Difficulty', value: selectedDifficulty ? `${selectedDifficulty.label} (${selectedDifficulty.grade})` : '' },
    { label: 'Curriculum', value: selectedCurriculum?.label ?? formData.curriculum },
    { label: 'Subject', value: formData.subject },
    { label: 'Topics', value: formData.topics.join(', ') },
    { label: 'Subtopics', value: subtopicSummary },
    { label: 'Questions', value: String(formData.count) },
    { label: 'Max attempts', value: isTeacher ? String(formData.maxAttempts) : '' },
    { label: 'Style', value: formData.style },
    { label: 'Type', value: selectedQuestionType?.label ?? '' },
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
              <p className="text-xs text-gray-400 mt-0.5">
                {isTeacher && !flowMode
                  ? 'Choose how to create'
                  : `Step ${Math.min(step, TOTAL_STEPS)} of ${TOTAL_STEPS}`}
              </p>
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
                className={`h-1 flex-1 rounded-full transition-all duration-400 ${flowMode && s <= step ? 'bg-blue-600' : 'bg-gray-100 dark:bg-gray-800'}`}
              />
            ))}
          </div>

          {/* Scrollable content */}
          <div className="flex-1 px-6 pb-6 space-y-6 overflow-y-auto">

            {isTeacher && !flowMode && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <StepLabel label="Creation path" />
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">How do you want to build this assessment?</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <OptionButton selected={false} onClick={() => setFlowMode('ai')}>
                    <p className="font-semibold text-sm text-gray-900 dark:text-white">AI-generated</p>
                    <p className="text-[11px] text-gray-400 mt-0.5">Follow the guided flow and generate questions with AI.</p>
                  </OptionButton>
                  <OptionButton
                    selected={false}
                    onClick={() => {
                      onClose()
                      router.push('/assignments/from-pdf')
                    }}
                  >
                    <p className="font-semibold text-sm text-gray-900 dark:text-white">Generate from PDF</p>
                    <p className="text-[11px] text-gray-400 mt-0.5">Upload a PDF and generate questions from its content.</p>
                  </OptionButton>
                  <OptionButton
                    selected={false}
                    onClick={() => {
                      onClose()
                      router.push('/assignments/new')
                    }}
                  >
                    <p className="font-semibold text-sm text-gray-900 dark:text-white">Create from scratch</p>
                    <p className="text-[11px] text-gray-400 mt-0.5">Start with blank MCQ/longform templates and fill them in.</p>
                  </OptionButton>
                </div>
              </motion.div>
            )}

            {/* Step 1: Curriculum */}
            {flowMode === 'ai' && step >= 1 && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <StepLabel label="Curriculum" />
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Choose your curriculum</h3>
                <div className="flex flex-col gap-2">
                  {isLoadingClasses ? (
                    <div className="col-span-full flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Loading curricula...
                    </div>
                  ) : curriculumOptions.length === 0 ? (
                    <div className="col-span-full text-sm text-gray-500 dark:text-gray-400">
                      No curricula found in the database.
                    </div>
                  ) : (
                    curriculumOptions.map((c) => (
                      <OptionButton key={c.id} selected={formData.curriculum === c.id} onClick={() => handleCurriculumSelect(c.id)}>
                        <div className="flex items-center gap-3">
                          <span className="text-[11px] font-black px-2 py-0.5 rounded-md bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                            {c.badge}
                          </span>
                          <div>
                            <p className="font-semibold text-sm text-gray-900 dark:text-white">{c.label}</p>
                            <p className="text-[11px] text-gray-400">{c.description}</p>
                          </div>
                        </div>
                      </OptionButton>
                    ))
                  )}
                </div>
              </motion.div>
            )}

            {/* Step 2: Class */}
            {flowMode === 'ai' && step >= 2 && formData.curriculum && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <StepLabel label="Class" />
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Select class (from database)</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {isLoadingClasses ? (
                    <div className="col-span-full flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Loading classes...
                    </div>
                  ) : classOptions.length === 0 ? (
                    <div className="col-span-full text-sm text-gray-500 dark:text-gray-400">
                      No classes found in the database.
                    </div>
                  ) : (
                    classOptions.map((cls) => (
                      <OptionButton
                        key={cls.id}
                        selected={formData.class_id === cls.id}
                        onClick={() => handleClassSelect(cls)}
                      >
                        <span className="font-bold text-gray-900 dark:text-white block">{cls.label}</span>
                      </OptionButton>
                    ))
                  )}
                </div>
              </motion.div>
            )}

            {/* Step 3: Difficulty Level */}
            {flowMode === 'ai' && step >= 3 && formData.class_name && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <StepLabel label="Difficulty level" />
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">Select student level</h3>
                <p className="text-xs text-gray-400 mb-3">This shapes how challenging the questions will be</p>
                <div className="flex flex-col gap-2">
                  {DIFFICULTY_LEVELS.map(dl => (
                    <OptionButton key={dl.id} selected={formData.difficultyLevel === dl.id} onClick={() => handleDifficultySelect(dl.id)}>
                      <div className="flex items-center gap-3">
                        <span className={`text-[11px] font-black px-2 py-0.5 rounded-md flex-shrink-0 ${dl.badge}`}>
                          {dl.grade}
                        </span>
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
              </motion.div>
            )}

            {/* Step 4: Subject */}
            {flowMode === 'ai' && step >= 4 && formData.difficultyLevel && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <StepLabel label="Subject" />
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                  {selectedClassDisplayName || formData.class_name || 'Selected class'} · {selectedCurriculum?.shortLabel ?? (isCambridge ? 'Cambridge' : 'REB')} subjects
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {isLoadingTextbooks ? (
                    <div className="col-span-full flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Loading textbooks...
                    </div>
                  ) : subjectTextbooks.length === 0 ? (
                    <div className="col-span-full text-sm text-gray-500 dark:text-gray-400">
                      No subjects assigned for {selectedClassDisplayName || classNameForTextbooks || 'this class'}.
                    </div>
                  ) : (
                    subjectTextbooks.map(tb => (
                      <OptionButton
                        key={tb.id}
                        selected={formData.textbook_id === tb.id}
                        onClick={() => handleSubjectSelect(tb.name, tb.id, tb.displayName)}
                      >
                        <span className="font-medium text-gray-800 dark:text-gray-200">{tb.displayName}</span>
                      </OptionButton>
                    ))
                  )}
                </div>
              </motion.div>
            )}

            {/* Step 5: Topics */}
            {flowMode === 'ai' && step >= 5 && formData.subject && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <StepLabel label="Topics" />
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">Select topics to cover</h3>
                <p className="text-xs text-gray-400 mb-3">You can select multiple topics</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {isLoadingTopics ? (
                    <div className="col-span-full flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Loading topics...
                    </div>
                  ) : topics.length === 0 ? (
                    <div className="col-span-full space-y-3">
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        No syllabus topics are loaded for this textbook yet. Enter topics manually to generate anyway.
                      </p>
                      <textarea
                        value={manualTopicInput}
                        onChange={(e) => setManualTopicInput(e.target.value)}
                        placeholder="e.g. Kinematics, Forces, Energy (comma or line separated)"
                        rows={3}
                        className="w-full px-3 py-2.5 rounded-xl text-sm bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none text-gray-900 dark:text-white"
                      />
                      <button
                        type="button"
                        onClick={handleManualTopicsContinue}
                        className="w-full py-2.5 rounded-xl border border-blue-500 text-blue-600 dark:text-blue-400 text-sm font-semibold hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                      >
                        Continue with manual topics →
                      </button>
                    </div>
                  ) : (
                    topics.map(t => (
                      <OptionButton key={t.id} selected={formData.topic_ids.includes(t.id)} onClick={() => handleTopicToggle(t.id, t.name)}>
                        <span className="font-medium text-gray-800 dark:text-gray-200 text-sm pr-6">{t.name}</span>
                      </OptionButton>
                    ))
                  )}
                </div>

                {/* Optional subtopic */}
                {formData.topic_ids.length === 1 && step >= 5 && (
                  <div className="mt-4">
                    <StepLabel label="Subtopic (optional)" />
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">Focus on one or more subtopics</h3>
                    <p className="text-xs text-gray-400 mb-3">Leave blank to cover the entire topic</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <OptionButton selected={formData.subtopic_ids.length === 0} onClick={() => handleSubtopicToggle(null)}>
                        <span className="font-medium text-gray-800 dark:text-gray-200 text-sm pr-6">Entire topic</span>
                      </OptionButton>
                      {isLoadingSubtopics ? (
                        <div className="col-span-full flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Loading subtopics...
                        </div>
                      ) : (
                        subtopics.map(st => (
                          <OptionButton key={st.id} selected={formData.subtopic_ids.includes(st.id)} onClick={() => handleSubtopicToggle(st.id)}>
                            <span className="font-medium text-gray-800 dark:text-gray-200 text-sm pr-6">{st.name}</span>
                          </OptionButton>
                        ))
                      )}
                    </div>
                  </div>
                )}

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
            {flowMode === 'ai' && step >= 6 && formData.topics.length > 0 && (
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

                {isTeacher && formData.count > 0 && (
                  <div className="mt-4">
                    <StepLabel label="Attempts" />
                    <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 items-center">
                      <div>
                        <h4 className="text-sm font-semibold text-gray-900 dark:text-white">Max attempts per student</h4>
                        <p className="text-xs text-gray-400">Best score is kept across retries.</p>
                      </div>
                      <input
                        type="number"
                        min={1}
                        value={formData.maxAttempts}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            maxAttempts: Math.max(1, Number(e.target.value) || 1),
                          }))
                        }
                        className="w-full sm:w-28 px-3 py-2 rounded-xl text-sm bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none text-gray-900 dark:text-white"
                      />
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {/* Step 7: Style */}
            {flowMode === 'ai' && step >= 7 && formData.count > 0 && (
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
            {flowMode === 'ai' && step >= 8 && formData.style && (
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
            {flowMode === 'ai' && step >= 9 && formData.questionType && (
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
                    className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-semibold transition-colors ${customTime !== null
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                      : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 hover:border-gray-300'
                      }`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
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
                      Draft ready. Open the preview to edit and send to a classroom.
                    </p>
                    <button
                      onClick={() => {
                        if (!draftId) return
                        router.push(`/assignments/${draftId}/preview`)
                        onClose()
                      }}
                      disabled={!draftId || isSavingDraft}
                      className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-semibold py-3 px-6 rounded-xl transition-colors shadow-sm shadow-blue-900/20"
                    >
                      <Send className="w-4 h-4" />
                      {isSavingDraft ? 'Saving draft…' : 'Open Preview & Edit'}
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
