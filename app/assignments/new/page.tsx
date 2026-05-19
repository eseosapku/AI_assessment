'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, Loader2, Plus, Save, Send, Trash2 } from 'lucide-react'
import { useAuth } from '@/components/AuthProvider'

interface ClassroomOption {
  id: string
  name: string
}

interface ClassOption {
  id: number
  name: string
  grade: number | null
}

type QuestionType = 'mcq' | 'longform'

type McqQuestion = {
  id: number
  type: 'mcq'
  question: string
  options: string[]
  correct_answer: number
  explanation: string
}

type LongformQuestion = {
  id: number
  type: 'longform'
  question: string
  marks: number
  marking_criteria: string[]
  model_answer: string
  explanation: string
}

type Question = McqQuestion | LongformQuestion

const DIFFICULTY_OPTIONS = [
  { id: 'beginner', label: 'Beginner' },
  { id: 'average', label: 'Average' },
  { id: 'intermediate', label: 'Intermediate' },
  { id: 'advanced', label: 'Advanced' },
]

const CURRICULUM_OPTIONS = [
  { id: 'rwanda', label: 'Rwanda National Curriculum (REB)' },
  { id: 'cambridge', label: 'Cambridge International (CAIE)' },
]

function toIsoInputValue(value: string) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString()
}

function parseTopics(value: string) {
  return value
    .split(/[\n,]/g)
    .map((item) => item.trim())
    .filter(Boolean)
}

function deriveGradeFromClassName(className: string) {
  const name = String(className ?? '').trim()
  if (!name) return null

  const gradeMatch = name.match(/\bgrade\s*(\d{1,2})\b/i)
  if (gradeMatch) {
    const n = Number(gradeMatch[1])
    return Number.isFinite(n) ? n : null
  }

  const anyNum = name.match(/\b(\d{1,2})\b/)
  if (anyNum) {
    const n = Number(anyNum[1])
    return Number.isFinite(n) ? n : null
  }

  return null
}

function buildQuestionTemplate(id: number, type: QuestionType, base?: Partial<Question>) {
  if (type === 'longform') {
    return {
      id,
      type: 'longform',
      question: String(base?.question ?? ''),
      marks: Number((base as LongformQuestion | undefined)?.marks ?? 4),
      marking_criteria: Array.isArray((base as LongformQuestion | undefined)?.marking_criteria)
        ? (base as LongformQuestion).marking_criteria
        : ['', '', ''],
      model_answer: String((base as LongformQuestion | undefined)?.model_answer ?? ''),
      explanation: String(base?.explanation ?? ''),
    } satisfies LongformQuestion
  }

  return {
    id,
    type: 'mcq',
    question: String(base?.question ?? ''),
    options: Array.isArray((base as McqQuestion | undefined)?.options)
      ? (base as McqQuestion).options
      : ['', '', '', ''],
    correct_answer: Number((base as McqQuestion | undefined)?.correct_answer ?? 0),
    explanation: String(base?.explanation ?? ''),
  } satisfies McqQuestion
}

export default function NewAssignmentPage() {
  const router = useRouter()
  const { user } = useAuth()

  const [title, setTitle] = useState('')
  const [subject, setSubject] = useState('')
  const [topicsInput, setTopicsInput] = useState('')
  const [curriculum, setCurriculum] = useState('')
  const [difficulty, setDifficulty] = useState('')
  const [style, setStyle] = useState('Teacher authored')
  const [maxAttempts, setMaxAttempts] = useState(1)
  const [deadline, setDeadline] = useState('')

  const [templateType, setTemplateType] = useState<QuestionType | ''>('')
  const [questions, setQuestions] = useState<Question[]>([])
  const [nextId, setNextId] = useState(1)

  const [classOptions, setClassOptions] = useState<ClassOption[]>([])
  const [selectedClassId, setSelectedClassId] = useState('')
  const [isLoadingClasses, setIsLoadingClasses] = useState(false)

  const [classrooms, setClassrooms] = useState<ClassroomOption[]>([])
  const [selectedClassroom, setSelectedClassroom] = useState('')
  const [isLoadingClassrooms, setIsLoadingClassrooms] = useState(false)

  const [isSaving, setIsSaving] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [activeQuestionIndex, setActiveQuestionIndex] = useState(0)

  useEffect(() => {
    if (!user?.role) return
    if (user.role !== 'teacher') {
      router.push('/')
    }
  }, [user, router])

  useEffect(() => {
    if (!user?.id) return
    const loadClassrooms = async () => {
      setIsLoadingClassrooms(true)
      try {
        const res = await fetch(`/api/classrooms?teacher_id=${user.id}`)
        const json = await res.json()
        if (!res.ok) throw new Error(json.error || 'Failed to load classrooms')
        setClassrooms(json.data ?? [])
      } catch (err) {
        console.error('Classrooms fetch error:', err)
        setClassrooms([])
      } finally {
        setIsLoadingClassrooms(false)
      }
    }
    loadClassrooms()
  }, [user])

  useEffect(() => {
    const loadClasses = async () => {
      setIsLoadingClasses(true)
      try {
        const res = await fetch('/api/classes')
        const json = await res.json()
        if (!res.ok) throw new Error(json?.error || 'Failed to load classes')
        const rows = Array.isArray(json?.data) ? json.data : []
        const normalized = rows
          .map((row: any) => ({
            id: Number(row?.id),
            name: String(row?.name ?? '').trim(),
          }))
          .filter((row: any) => Number.isFinite(row.id) && row.name)
          .map((row: any) => ({
            ...row,
            grade: deriveGradeFromClassName(row.name),
          }))
        setClassOptions(normalized)
        if (normalized.length === 1) {
          setSelectedClassId(String(normalized[0].id))
        }
      } catch (err) {
        console.error('Classes fetch error:', err)
        setClassOptions([])
      } finally {
        setIsLoadingClasses(false)
      }
    }
    loadClasses()
  }, [])

  useEffect(() => {
    if (!templateType) return
    if (questions.length === 0) {
      setQuestions([buildQuestionTemplate(1, templateType)])
      setNextId(2)
      setActiveQuestionIndex(0)
    }
  }, [templateType, questions.length])

  useEffect(() => {
    if (questions.length === 0) {
      setActiveQuestionIndex(0)
      return
    }
    if (activeQuestionIndex > questions.length - 1) {
      setActiveQuestionIndex(questions.length - 1)
    }
  }, [questions.length, activeQuestionIndex])

  const topics = useMemo(() => parseTopics(topicsInput), [topicsInput])

  const questionType = useMemo(() => {
    const types = new Set(questions.map((q) => q.type))
    if (types.size === 1 && types.has('mcq')) return 'mcq'
    if (types.size === 1 && types.has('longform')) return 'longform'
    return types.size === 0 ? '' : 'mixed'
  }, [questions])

  const selectedClass = useMemo(
    () => classOptions.find((cls) => String(cls.id) === selectedClassId) ?? null,
    [classOptions, selectedClassId]
  )
  const selectedGrade = selectedClass?.grade ?? null

  const updateQuestion = (index: number, patch: Partial<Question>) => {
    setQuestions((prev) =>
      prev.map((q, i) => {
        if (i !== index) return q
        if (q.type === 'mcq') return { ...q, ...patch } as McqQuestion
        return { ...q, ...patch } as LongformQuestion
      })
    )
  }

  const updateOption = (qIndex: number, optionIndex: number, value: string) => {
    setQuestions((prev) =>
      prev.map((q, i) => {
        if (i !== qIndex || q.type !== 'mcq') return q
        const options = Array.isArray(q.options) ? [...q.options] : []
        options[optionIndex] = value
        return { ...q, options }
      })
    )
  }

  const updateCriterion = (qIndex: number, criterionIndex: number, value: string) => {
    setQuestions((prev) =>
      prev.map((q, i) => {
        if (i !== qIndex || q.type !== 'longform') return q
        const criteria = Array.isArray(q.marking_criteria) ? [...q.marking_criteria] : []
        criteria[criterionIndex] = value
        return { ...q, marking_criteria: criteria }
      })
    )
  }

  const handleTypeChange = (index: number, type: QuestionType) => {
    setQuestions((prev) =>
      prev.map((q, i) => {
        if (i !== index) return q
        return buildQuestionTemplate(q.id, type, q)
      })
    )
  }

  const handleAddQuestion = () => {
    const type = templateType || 'mcq'
    setQuestions((prev) => {
      const next = [...prev, buildQuestionTemplate(nextId, type)]
      setActiveQuestionIndex(next.length - 1)
      return next
    })
    setNextId((prev) => prev + 1)
  }

  const handleRemoveQuestion = (index: number) => {
    setQuestions((prev) => {
      if (prev.length <= 1) return prev
      const next = prev.filter((_, i) => i !== index)
      setActiveQuestionIndex(Math.min(index, next.length - 1))
      return next
    })
  }

  const validatePayload = (status: 'draft' | 'sent') => {
    if (!user?.id) return 'Missing teacher account.'
    if (!templateType) return 'Choose a question template to start.'
    if (!subject.trim()) return 'Subject is required.'
    if (topics.length === 0) return 'Add at least one topic.'
    if (!selectedClassId) return 'Select a class.'
    if (!Number.isFinite(selectedGrade)) return 'Selected class must include a grade number.'
    if (!curriculum) return 'Choose a curriculum.'
    if (!difficulty) return 'Choose a difficulty level.'
    if (!style.trim()) return 'Style is required.'
    if (questions.length === 0) return 'Add at least one question.'
    if (!questionType) return 'Question types are missing.'
    if (status === 'sent' && !selectedClassroom) return 'Select a classroom to send this assignment.'
    return ''
  }

  const createAssignment = async (status: 'draft' | 'sent') => {
    const validationError = validatePayload(status)
    if (validationError) {
      setError(validationError)
      return null
    }

    setError('')
    setSuccess('')

    const payload = {
      teacher_id: user?.id,
      teacher_name: user?.name,
      title: title.trim(),
      subject: subject.trim(),
      topics,
      grade: String(selectedGrade ?? ''),
      curriculum,
      difficulty_level: difficulty,
      question_count: questions.length,
      style: style.trim(),
      question_type: questionType,
      max_attempts: maxAttempts,
      classroom_id: status === 'sent' ? selectedClassroom : null,
      status,
      questions_data: questions,
      estimated_time: null,
      deadline: deadline ? toIsoInputValue(deadline) : null,
    }

    const res = await fetch('/api/assignments/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const json = await res.json()
    if (!res.ok) throw new Error(json.error || 'Failed to create assignment')
    return String(json.assignment_id)
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const assignmentId = await createAssignment('draft')
      if (!assignmentId) return
      setSuccess('Draft created. Opening preview...')
      router.push(`/assignments/${assignmentId}/preview`)
    } catch (err: any) {
      setError(err?.message || 'Failed to save draft')
    } finally {
      setIsSaving(false)
    }
  }

  const handleSend = async () => {
    setIsSending(true)
    try {
      const assignmentId = await createAssignment('sent')
      if (!assignmentId) return
      setSuccess('Assignment sent. Opening preview...')
      router.push(`/assignments/${assignmentId}/preview`)
    } catch (err: any) {
      setError(err?.message || 'Failed to send assignment')
    } finally {
      setIsSending(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#F3F4F6] dark:bg-[#0C0C0E] transition-colors text-[15px] sm:text-base font-semibold text-gray-900 dark:text-gray-100">
      <div className="max-w-5xl mx-auto px-4 sm:px-8 py-6 space-y-6">
        <div className="flex items-center justify-between">
          <button
            onClick={() => router.push('/')}
            className="flex items-center gap-2 text-base font-bold text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <ChevronLeft className="w-4 h-4" />
            Back to dashboard
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-base font-bold bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700 transition-colors"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save Draft
            </button>
            <button
              onClick={handleSend}
              disabled={isSending}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-base font-bold bg-violet-600 hover:bg-violet-700 text-white transition-colors disabled:bg-violet-400"
            >
              {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Send to Classroom
            </button>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200/70 dark:border-gray-800/60 p-6 space-y-5">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-gray-400 dark:text-gray-500">Create from scratch</p>
            <h1 className="text-2xl font-black text-gray-900 dark:text-white mt-2">New Assignment</h1>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wide">Title</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Assignment title"
                className="w-full px-3 py-2.5 rounded-xl text-base font-semibold bg-gray-50 dark:bg-white/[0.05] border border-gray-200 dark:border-white/[0.08] focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 outline-none transition-all text-gray-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wide">Deadline (optional)</label>
              <input
                type="datetime-local"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl text-base font-semibold bg-gray-50 dark:bg-white/[0.05] border border-gray-200 dark:border-white/[0.08] focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 outline-none transition-all text-gray-900 dark:text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wide">Subject</label>
              <input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="e.g. Mathematics"
                className="w-full px-3 py-2.5 rounded-xl text-base font-semibold bg-gray-50 dark:bg-white/[0.05] border border-gray-200 dark:border-white/[0.08] focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 outline-none transition-all text-gray-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wide">Grade / Class</label>
              <select
                value={selectedClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl text-base font-semibold bg-gray-50 dark:bg-white/[0.05] border border-gray-200 dark:border-white/[0.08] focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 outline-none transition-all text-gray-900 dark:text-white"
              >
                <option value="">Select a class</option>
                {isLoadingClasses ? (
                  <option value="" disabled>Loading classes...</option>
                ) : (
                  classOptions.map((cls) => (
                    <option key={cls.id} value={String(cls.id)}>{cls.name}</option>
                  ))
                )}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wide">Topics (comma or line separated)</label>
            <textarea
              value={topicsInput}
              onChange={(e) => setTopicsInput(e.target.value)}
              rows={2}
              placeholder="e.g. Fractions, Algebra"
              className="w-full px-3 py-2.5 rounded-xl text-base font-semibold bg-gray-50 dark:bg-white/[0.05] border border-gray-200 dark:border-white/[0.08] focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 outline-none transition-all text-gray-900 dark:text-white"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-bold text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wide">Curriculum</label>
              <select
                value={curriculum}
                onChange={(e) => setCurriculum(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl text-base font-semibold bg-gray-50 dark:bg-white/[0.05] border border-gray-200 dark:border-white/[0.08] focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 outline-none transition-all text-gray-900 dark:text-white"
              >
                <option value="">Select curriculum</option>
                {CURRICULUM_OPTIONS.map((opt) => (
                  <option key={opt.id} value={opt.id}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wide">Difficulty</label>
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl text-base font-semibold bg-gray-50 dark:bg-white/[0.05] border border-gray-200 dark:border-white/[0.08] focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 outline-none transition-all text-gray-900 dark:text-white"
              >
                <option value="">Select level</option>
                {DIFFICULTY_OPTIONS.map((opt) => (
                  <option key={opt.id} value={opt.id}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wide">Style</label>
              <input
                value={style}
                onChange={(e) => setStyle(e.target.value)}
                placeholder="Exam Style, Practice, etc."
                className="w-full px-3 py-2.5 rounded-xl text-base font-semibold bg-gray-50 dark:bg-white/[0.05] border border-gray-200 dark:border-white/[0.08] focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 outline-none transition-all text-gray-900 dark:text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wide">Max attempts</label>
              <input
                type="number"
                min={1}
                value={maxAttempts}
                onChange={(e) => setMaxAttempts(Math.max(1, Number(e.target.value) || 1))}
                className="w-full px-3 py-2.5 rounded-xl text-base font-semibold bg-gray-50 dark:bg-white/[0.05] border border-gray-200 dark:border-white/[0.08] focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 outline-none transition-all text-gray-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wide">Send to classroom</label>
              <select
                value={selectedClassroom}
                onChange={(e) => setSelectedClassroom(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl text-base font-semibold bg-gray-50 dark:bg-white/[0.05] border border-gray-200 dark:border-white/[0.08] focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 outline-none transition-all text-gray-900 dark:text-white"
              >
                <option value="">Select a classroom</option>
                {isLoadingClassrooms ? (
                  <option value="" disabled>Loading classrooms...</option>
                ) : (
                  classrooms.map((cls) => (
                    <option key={cls.id} value={cls.id}>{cls.name}</option>
                  ))
                )}
              </select>
            </div>
          </div>

          {error && (
            <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/60 rounded-lg px-4 py-3">
              {error}
            </div>
          )}
          {success && (
            <div className="text-sm text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/60 rounded-lg px-4 py-3">
              {success}
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200/70 dark:border-gray-800/60 p-6 space-y-4">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-gray-400 dark:text-gray-500">Question templates</p>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mt-2">Choose a starter template</h2>
            <p className="text-sm text-gray-400 mt-1">You can change each question type later.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setTemplateType('mcq')}
              className={`text-left border rounded-xl px-4 py-3 text-base font-semibold transition-all ${templateType === 'mcq'
                ? 'border-violet-500 bg-violet-50 dark:bg-violet-900/20'
                : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 hover:border-gray-300 dark:hover:border-gray-700'}
              `}
            >
              <p className="font-semibold text-gray-900 dark:text-white">MCQ Template</p>
              <p className="text-sm text-gray-400 mt-0.5">4 options, correct answer, and explanation.</p>
            </button>
            <button
              type="button"
              onClick={() => setTemplateType('longform')}
              className={`text-left border rounded-xl px-4 py-3 text-base font-semibold transition-all ${templateType === 'longform'
                ? 'border-violet-500 bg-violet-50 dark:bg-violet-900/20'
                : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 hover:border-gray-300 dark:hover:border-gray-700'}
              `}
            >
              <p className="font-semibold text-gray-900 dark:text-white">Long-form Template</p>
              <p className="text-sm text-gray-400 mt-0.5">Marks, marking criteria, and model answer.</p>
            </button>
          </div>
        </div>

        {templateType && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold uppercase tracking-[0.2em] text-gray-400 dark:text-gray-500">Questions</p>
                <p className="text-base font-bold text-gray-900 dark:text-white mt-1">
                  Question {Math.min(activeQuestionIndex + 1, Math.max(questions.length, 1))} of {Math.max(questions.length, 1)}
                </p>
              </div>
            </div>

            {questions.length > 0 && (
              <div className="flex gap-3">
                <div className="flex-1 bg-white dark:bg-gray-900 rounded-2xl border border-gray-200/70 dark:border-gray-800/60 p-6 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-base font-bold text-gray-900 dark:text-white">Question {activeQuestionIndex + 1}</p>
                    <div className="flex items-center gap-2">
                      <select
                        value={questions[activeQuestionIndex]?.type}
                        onChange={(e) => handleTypeChange(activeQuestionIndex, e.target.value as QuestionType)}
                        className="px-3 py-2 rounded-lg text-sm font-bold bg-gray-50 dark:bg-white/[0.05] border border-gray-200 dark:border-white/[0.08] text-gray-700 dark:text-gray-200"
                      >
                        <option value="mcq">MCQ</option>
                        <option value="longform">Long-form</option>
                      </select>
                      <button
                        type="button"
                        onClick={() => handleRemoveQuestion(activeQuestionIndex)}
                        className="inline-flex items-center gap-1 text-sm font-bold text-red-500 hover:text-red-600"
                      >
                        <Trash2 className="w-4 h-4" />
                        Remove
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wide">Question</label>
                    <textarea
                      value={questions[activeQuestionIndex]?.question ?? ''}
                      onChange={(e) => updateQuestion(activeQuestionIndex, { question: e.target.value })}
                      rows={3}
                      className="w-full px-3 py-2.5 rounded-xl text-base font-semibold bg-gray-50 dark:bg-white/[0.05] border border-gray-200 dark:border-white/[0.08] focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 outline-none transition-all text-gray-900 dark:text-white"
                    />
                  </div>

                  {questions[activeQuestionIndex]?.type === 'mcq' && (
                    <div className="space-y-3">
                      <label className="block text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Options</label>
                      {(questions[activeQuestionIndex] as McqQuestion)?.options?.map((opt, optIdx) => (
                        <input
                          key={`active-opt-${optIdx}`}
                          value={opt}
                          onChange={(e) => updateOption(activeQuestionIndex, optIdx, e.target.value)}
                          className="w-full px-3 py-2.5 rounded-xl text-base font-semibold bg-gray-50 dark:bg-white/[0.05] border border-gray-200 dark:border-white/[0.08] focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 outline-none transition-all text-gray-900 dark:text-white"
                        />
                      ))}
                      <div>
                        <label className="block text-sm font-bold text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wide">Correct answer</label>
                        <select
                          value={Number((questions[activeQuestionIndex] as McqQuestion)?.correct_answer ?? 0)}
                          onChange={(e) => updateQuestion(activeQuestionIndex, { correct_answer: Number(e.target.value) })}
                          className="w-full px-3 py-2.5 rounded-xl text-base font-semibold bg-gray-50 dark:bg-white/[0.05] border border-gray-200 dark:border-white/[0.08] focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 outline-none transition-all text-gray-900 dark:text-white"
                        >
                          {(questions[activeQuestionIndex] as McqQuestion)?.options?.map((_, optIdx) => (
                            <option key={`active-ans-${optIdx}`} value={optIdx}>{`Option ${optIdx + 1}`}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wide">Explanation</label>
                        <textarea
                          value={(questions[activeQuestionIndex] as McqQuestion)?.explanation ?? ''}
                          onChange={(e) => updateQuestion(activeQuestionIndex, { explanation: e.target.value })}
                          rows={2}
                          className="w-full px-3 py-2.5 rounded-xl text-base font-semibold bg-gray-50 dark:bg-white/[0.05] border border-gray-200 dark:border-white/[0.08] focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 outline-none transition-all text-gray-900 dark:text-white"
                        />
                      </div>
                    </div>
                  )}

                  {questions[activeQuestionIndex]?.type === 'longform' && (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm font-bold text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wide">Marks</label>
                        <input
                          type="number"
                          min={1}
                          value={Number((questions[activeQuestionIndex] as LongformQuestion)?.marks ?? 4)}
                          onChange={(e) => updateQuestion(activeQuestionIndex, { marks: Number(e.target.value) })}
                          className="w-full px-3 py-2.5 rounded-xl text-base font-semibold bg-gray-50 dark:bg-white/[0.05] border border-gray-200 dark:border-white/[0.08] focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 outline-none transition-all text-gray-900 dark:text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wide">Marking criteria</label>
                        {(questions[activeQuestionIndex] as LongformQuestion)?.marking_criteria?.map((crit, critIdx) => (
                          <input
                            key={`active-crit-${critIdx}`}
                            value={crit}
                            onChange={(e) => updateCriterion(activeQuestionIndex, critIdx, e.target.value)}
                            className="w-full px-3 py-2.5 rounded-xl text-base font-semibold bg-gray-50 dark:bg-white/[0.05] border border-gray-200 dark:border-white/[0.08] focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 outline-none transition-all text-gray-900 dark:text-white mb-2"
                          />
                        ))}
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wide">Model answer</label>
                        <textarea
                          value={(questions[activeQuestionIndex] as LongformQuestion)?.model_answer ?? ''}
                          onChange={(e) => updateQuestion(activeQuestionIndex, { model_answer: e.target.value })}
                          rows={3}
                          className="w-full px-3 py-2.5 rounded-xl text-base font-semibold bg-gray-50 dark:bg-white/[0.05] border border-gray-200 dark:border-white/[0.08] focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 outline-none transition-all text-gray-900 dark:text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wide">Explanation</label>
                        <textarea
                          value={(questions[activeQuestionIndex] as LongformQuestion)?.explanation ?? ''}
                          onChange={(e) => updateQuestion(activeQuestionIndex, { explanation: e.target.value })}
                          rows={2}
                          className="w-full px-3 py-2.5 rounded-xl text-base font-semibold bg-gray-50 dark:bg-white/[0.05] border border-gray-200 dark:border-white/[0.08] focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 outline-none transition-all text-gray-900 dark:text-white"
                        />
                      </div>
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={handleAddQuestion}
                  className="flex-shrink-0 h-full min-h-[120px] w-12 rounded-2xl border border-violet-500 text-violet-600 dark:text-violet-400 flex flex-col items-center justify-center gap-2 font-bold hover:bg-violet-50 dark:hover:bg-violet-900/20 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  <span className="text-[10px] uppercase tracking-widest">Add</span>
                </button>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-center gap-2">
              {questions.map((_, idx) => (
                <button
                  key={`qnav-${idx}`}
                  type="button"
                  onClick={() => setActiveQuestionIndex(idx)}
                  className={`w-9 h-9 rounded-lg text-sm font-bold transition-colors ${idx === activeQuestionIndex
                    ? 'bg-violet-600 text-white'
                    : 'bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-300 hover:border-violet-400'}
                  `}
                >
                  {idx + 1}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
