'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Loader2, Save, Send, ChevronLeft, Trash2, Printer } from 'lucide-react'
import { useAuth } from '@/components/AuthProvider'

interface AssignmentData {
    id: string
    title: string
    subject: string
    topics: string[]
    grade: string
    curriculum: string
    difficulty_level: string
    question_count: number
    style: string
    question_type: string
    classroom_id: string | null
    classroom_ids?: string[]
    status: string
    max_attempts: number | null
    questions_data: any[]
    estimated_time: number | null
    deadline: string | null
}

interface ClassroomOption {
    id: string
    name: string
}

function toLocalInputValue(iso: string) {
    const date = new Date(iso)
    if (Number.isNaN(date.getTime())) return ''
    const offset = date.getTimezoneOffset() * 60000
    return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}

function toIsoInputValue(value: string) {
    if (!value) return null
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return null
    return date.toISOString()
}

function escapeHtml(value: unknown) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
}

function buildQuestionsPrintHtml(assignment: AssignmentData, questions: any[]) {
    const title = escapeHtml(assignment.title)
    const meta = [
        assignment.subject ? escapeHtml(assignment.subject) : null,
        assignment.grade ? `Grade ${escapeHtml(assignment.grade)}` : null,
        assignment.curriculum ? escapeHtml(assignment.curriculum) : null,
    ].filter(Boolean).join(' • ')

    const questionBlocks = (questions ?? []).map((q, idx) => {
        const questionText = escapeHtml(q?.question)
        const isLongForm = q?.type === 'longform'
        const marks = isLongForm ? `(${Number(q?.marks ?? 0)} marks)` : ''
        const options = Array.isArray(q?.options) ? q.options : []
        const optionsHtml = options.length > 0
            ? `<ol class="options">${options.map((opt: any) => `<li>${escapeHtml(opt)}</li>`).join('')}</ol>`
            : ''

        const passageHtml = q?.passage
            ? `<div class="passage">${escapeHtml(q.passage)}</div>`
            : ''

        return `
                <div class="qcard">
                    <div class="qheader">Question ${idx + 1} ${marks}</div>
                    ${passageHtml}
                    <div class="qtext">${questionText}</div>
                    ${optionsHtml}
                    ${isLongForm ? '<div class="answer-space">Answer:</div><div class="line"></div><div class="line"></div><div class="line"></div>' : ''}
                </div>
            `
    }).join('')

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${title} - Questions</title>
    <style>
        @page { size: A4; margin: 16mm; }
        * { box-sizing: border-box; }
        body { font-family: "Space Grotesk", Arial, sans-serif; color: #111827; background: #ffffff; margin: 0; }
        .page { max-width: 860px; margin: 0 auto; padding: 36px 28px 48px; }
        .header { margin-bottom: 24px; }
        .title { font-size: 24px; font-weight: 800; margin-bottom: 6px; }
        .meta { font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.08em; }
        .qcard { border: 1px solid #e5e7eb; border-radius: 12px; padding: 16px 18px; margin-bottom: 14px; }
        .qheader { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #6b7280; margin-bottom: 8px; }
        .qtext { font-size: 15px; font-weight: 600; margin-bottom: 10px; }
        .options { margin: 0 0 10px 18px; padding: 0; }
        .options li { margin: 4px 0; font-size: 14px; }
        .passage { background: #f8fafc; border-left: 3px solid #cbd5f5; padding: 10px 14px; margin-bottom: 10px; font-size: 13px; line-height: 1.6; }
        .answer-space { margin-top: 12px; font-size: 13px; font-weight: 600; }
        .line { border-bottom: 1px solid #e5e7eb; height: 18px; margin-top: 8px; }
    </style>
</head>
<body>
    <div class="page">
        <div class="header">
            <div class="title">${title}</div>
            <div class="meta">${meta}</div>
        </div>
        ${questionBlocks}
    </div>
</body>
</html>`
}

export default function AssignmentPreviewPage() {
    const params = useParams()
    const router = useRouter()
    const { user } = useAuth()
    const assignmentId = String(params?.id ?? '')

    const [assignment, setAssignment] = useState<AssignmentData | null>(null)
    const [questions, setQuestions] = useState<any[]>([])
    const [title, setTitle] = useState('')
    const [deadline, setDeadline] = useState('')
    const [maxAttempts, setMaxAttempts] = useState(1)
    const [classrooms, setClassrooms] = useState<ClassroomOption[]>([])
    const [selectedClassroomIds, setSelectedClassroomIds] = useState<string[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [isSaving, setIsSaving] = useState(false)
    const [isSending, setIsSending] = useState(false)
    const [error, setError] = useState('')
    const [success, setSuccess] = useState('')

    useEffect(() => {
        if (!assignmentId) return
        if (user?.role && user.role !== 'teacher') {
            router.push('/')
            return
        }

        const load = async () => {
            setIsLoading(true)
            setError('')
            try {
                const [assignmentRes, classroomsRes] = await Promise.all([
                    fetch(`/api/assignments/${assignmentId}`),
                    user?.id ? fetch(`/api/classrooms?teacher_id=${user.id}`) : Promise.resolve(null),
                ])

                if (assignmentRes) {
                    const assignmentJson = await assignmentRes.json()
                    if (!assignmentRes.ok) throw new Error(assignmentJson.error || 'Failed to load assignment')
                    const data = assignmentJson.data as AssignmentData
                    setAssignment(data)
                    setQuestions(Array.isArray(data.questions_data) ? data.questions_data : [])
                    setTitle(data.title ?? '')
                    setDeadline(data.deadline ? toLocalInputValue(data.deadline) : '')
                    const classroomIds = Array.isArray(data.classroom_ids)
                        ? data.classroom_ids
                        : (data.classroom_id ? [data.classroom_id] : [])
                    setSelectedClassroomIds(classroomIds)
                    setMaxAttempts(Number.isFinite(data.max_attempts) ? Number(data.max_attempts) : 1)
                }

                if (classroomsRes) {
                    const classroomsJson = await classroomsRes.json()
                    if (!classroomsRes.ok) throw new Error(classroomsJson.error || 'Failed to load classrooms')
                    setClassrooms(classroomsJson.data ?? [])
                }
            } catch (err: any) {
                setError(err?.message || 'Failed to load preview')
            } finally {
                setIsLoading(false)
            }
        }

        load()
    }, [assignmentId, user, router])

    const updateQuestion = (index: number, patch: Record<string, any>) => {
        setQuestions((prev) => prev.map((q, i) => (i === index ? { ...q, ...patch } : q)))
    }

    const updateOption = (qIndex: number, optionIndex: number, value: string) => {
        setQuestions((prev) =>
            prev.map((q, i) => {
                if (i !== qIndex) return q
                const options = Array.isArray(q.options) ? [...q.options] : []
                options[optionIndex] = value
                return { ...q, options }
            })
        )
    }

    const updateCriterion = (qIndex: number, criterionIndex: number, value: string) => {
        setQuestions((prev) =>
            prev.map((q, i) => {
                if (i !== qIndex) return q
                const criteria = Array.isArray(q.marking_criteria) ? [...q.marking_criteria] : []
                criteria[criterionIndex] = value
                return { ...q, marking_criteria: criteria }
            })
        )
    }

    const toggleClassroomSelection = (id: string) => {
        setSelectedClassroomIds((prev) =>
            prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
        )
    }

    const handleSave = async () => {
        if (!assignment) return
        setIsSaving(true)
        setError('')
        setSuccess('')
        try {
            const res = await fetch(`/api/assignments/${assignmentId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title,
                    deadline: toIsoInputValue(deadline),
                    max_attempts: maxAttempts,
                    questions_data: questions,
                }),
            })
            const json = await res.json()
            if (!res.ok) throw new Error(json.error || 'Failed to save draft')
            setSuccess('Draft saved.')
        } catch (err: any) {
            setError(err.message)
        } finally {
            setIsSaving(false)
        }
    }

    const handleDelete = async () => {
        if (!assignment) return
        const confirmed = window.confirm('Delete this assignment? This will remove all student results.')
        if (!confirmed) return

        setIsSaving(true)
        setError('')
        try {
            const res = await fetch(`/api/assignments/${assignmentId}`, { method: 'DELETE' })
            const json = await res.json()
            if (!res.ok) throw new Error(json.error || 'Failed to delete assignment')
            router.push('/')
        } catch (err: any) {
            setError(err.message)
        } finally {
            setIsSaving(false)
        }
    }

    const handleSend = async () => {
        if (!assignment) return
        if (selectedClassroomIds.length === 0) {
            setError('Select at least one classroom before sending.')
            return
        }

        setIsSending(true)
        setError('')
        setSuccess('')
        try {
            await handleSave()
            const res = await fetch(`/api/assignments/${assignmentId}/send`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    classroom_ids: selectedClassroomIds,
                    deadline: toIsoInputValue(deadline),
                }),
            })
            const json = await res.json()
            if (!res.ok) throw new Error(json.error || 'Failed to send assignment')
            router.push('/')
        } catch (err: any) {
            setError(err.message)
        } finally {
            setIsSending(false)
        }
    }

    const handlePrintQuestions = () => {
        if (!assignment) return
        const html = buildQuestionsPrintHtml(assignment, questions)
        const blob = new Blob([html], { type: 'text/html' })
        const url = URL.createObjectURL(blob)
        const win = window.open(url, '_blank')
        if (!win) {
            URL.revokeObjectURL(url)
            return
        }
        win.addEventListener('load', () => {
            try {
                win.document.title = `${assignment.title} - Questions`
                win.focus()
                win.print()
            } finally {
                setTimeout(() => URL.revokeObjectURL(url), 30000)
            }
        })
    }

    const summary = useMemo(() => {
        if (!assignment) return []
        return [
            { label: 'Subject', value: assignment.subject },
            { label: 'Grade', value: assignment.grade },
            { label: 'Difficulty', value: assignment.difficulty_level },
            { label: 'Curriculum', value: assignment.curriculum },
            { label: 'Questions', value: String(assignment.question_count) },
            { label: 'Type', value: assignment.question_type },
        ]
    }, [assignment])

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-violet-600" />
            </div>
        )
    }

    if (!assignment) {
        return (
            <div className="min-h-screen flex items-center justify-center text-gray-500">
                Assignment not found.
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-[#F3F4F6] dark:bg-[#0C0C0E] transition-colors">
            <div className="max-w-5xl mx-auto px-4 sm:px-8 py-6 space-y-6">
                <div className="flex items-center justify-between">
                    <button
                        onClick={() => router.push('/')}
                        className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                    >
                        <ChevronLeft className="w-4 h-4" />
                        Back to dashboard
                    </button>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleDelete}
                            disabled={isSaving}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 hover:border-red-300 hover:text-red-600 transition-colors"
                        >
                            <Trash2 className="w-4 h-4" />
                            Delete
                        </button>
                        <button
                            onClick={handlePrintQuestions}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 hover:border-[#1F7A7A] text-[#1F7A7A] transition-colors"
                        >
                            <Printer className="w-4 h-4" />
                            Print Questions
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={isSaving}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700 transition-colors"
                        >
                            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            Save Draft
                        </button>
                        <button
                            onClick={handleSend}
                            disabled={isSending}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-violet-600 hover:bg-violet-700 text-white transition-colors disabled:bg-violet-400"
                        >
                            {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                            Send to Classroom
                        </button>
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200/70 dark:border-gray-800/60 p-6 space-y-5">
                    <div>
                        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-gray-400 dark:text-gray-500">Draft Preview</p>
                        <h1 className="text-2xl font-black text-gray-900 dark:text-white mt-2">{assignment.title}</h1>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wide">Title</label>
                            <input
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                className="w-full px-3 py-2.5 rounded-xl text-sm bg-gray-50 dark:bg-white/[0.05] border border-gray-200 dark:border-white/[0.08] focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 outline-none transition-all text-gray-900 dark:text-white"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wide">Deadline (optional)</label>
                            <input
                                type="datetime-local"
                                value={deadline}
                                onChange={(e) => setDeadline(e.target.value)}
                                className="w-full px-3 py-2.5 rounded-xl text-sm bg-gray-50 dark:bg-white/[0.05] border border-gray-200 dark:border-white/[0.08] focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 outline-none transition-all text-gray-900 dark:text-white"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wide">Max attempts</label>
                            <input
                                type="number"
                                min={1}
                                value={maxAttempts}
                                onChange={(e) => setMaxAttempts(Math.max(1, Number(e.target.value) || 1))}
                                className="w-full px-3 py-2.5 rounded-xl text-sm bg-gray-50 dark:bg-white/[0.05] border border-gray-200 dark:border-white/[0.08] focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 outline-none transition-all text-gray-900 dark:text-white"
                            />
                        </div>
                        <div className="flex items-end">
                            <p className="text-xs text-gray-400">Students can retry up to this limit. Best score is kept.</p>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wide">Send to classroom(s)</label>
                        <div className="rounded-xl bg-gray-50 dark:bg-white/[0.05] border border-gray-200 dark:border-white/[0.08] p-3 space-y-2">
                            {classrooms.length === 0 ? (
                                <p className="text-xs text-gray-400">No classrooms available yet.</p>
                            ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    {classrooms.map((cls) => {
                                        const checked = selectedClassroomIds.includes(cls.id)
                                        return (
                                            <label
                                                key={cls.id}
                                                className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${checked
                                                    ? 'border-violet-300 bg-violet-50 dark:border-violet-700/60 dark:bg-violet-900/20'
                                                    : 'border-gray-200 dark:border-white/[0.08] bg-white/70 dark:bg-transparent'}`}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={checked}
                                                    onChange={() => toggleClassroomSelection(cls.id)}
                                                    className="h-4 w-4 rounded border-gray-300 text-violet-600 focus:ring-violet-500"
                                                />
                                                <span className="text-gray-800 dark:text-gray-200">{cls.name}</span>
                                            </label>
                                        )
                                    })}
                                </div>
                            )}
                        </div>
                        <p className="text-xs text-gray-400 mt-2">Select one or more classrooms.</p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {summary.map((row) => (
                            <div key={row.label} className="rounded-xl border border-gray-100 dark:border-gray-800/60 bg-gray-50 dark:bg-gray-950 px-3 py-2">
                                <p className="text-[10px] uppercase tracking-widest text-gray-400">{row.label}</p>
                                <p className="text-sm font-semibold text-gray-900 dark:text-gray-200">{row.value}</p>
                            </div>
                        ))}
                    </div>

                    {error && (
                        <div className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/60 rounded-lg px-4 py-3">
                            {error}
                        </div>
                    )}
                    {success && (
                        <div className="text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/60 rounded-lg px-4 py-3">
                            {success}
                        </div>
                    )}
                </div>

                <div className="space-y-4">
                    {questions.map((q, idx) => {
                        const isLongForm = q.type === 'longform'
                        return (
                            <div key={idx} className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200/70 dark:border-gray-800/60 p-6 space-y-4">
                                <div className="flex items-center justify-between">
                                    <p className="text-sm font-semibold text-gray-900 dark:text-white">Question {idx + 1}</p>
                                    <span className="text-[10px] uppercase tracking-widest text-gray-400">
                                        {isLongForm ? 'Long-form' : 'MCQ'}
                                    </span>
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wide">Question</label>
                                    <textarea
                                        value={q.question ?? ''}
                                        onChange={(e) => updateQuestion(idx, { question: e.target.value })}
                                        rows={3}
                                        className="w-full px-3 py-2.5 rounded-xl text-sm bg-gray-50 dark:bg-white/[0.05] border border-gray-200 dark:border-white/[0.08] focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 outline-none transition-all text-gray-900 dark:text-white"
                                    />
                                </div>

                                {!isLongForm && (
                                    <div className="space-y-3">
                                        <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Options</label>
                                        {(q.options ?? []).map((opt: string, optIdx: number) => (
                                            <input
                                                key={optIdx}
                                                value={opt}
                                                onChange={(e) => updateOption(idx, optIdx, e.target.value)}
                                                className="w-full px-3 py-2.5 rounded-xl text-sm bg-gray-50 dark:bg-white/[0.05] border border-gray-200 dark:border-white/[0.08] focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 outline-none transition-all text-gray-900 dark:text-white"
                                            />
                                        ))}
                                        <div>
                                            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wide">Correct answer</label>
                                            <select
                                                value={Number(q.correct_answer ?? 0)}
                                                onChange={(e) => updateQuestion(idx, { correct_answer: Number(e.target.value) })}
                                                className="w-full px-3 py-2.5 rounded-xl text-sm bg-gray-50 dark:bg-white/[0.05] border border-gray-200 dark:border-white/[0.08] focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 outline-none transition-all text-gray-900 dark:text-white"
                                            >
                                                {(q.options ?? []).map((opt: string, optIdx: number) => (
                                                    <option key={optIdx} value={optIdx}>{`Option ${optIdx + 1}`}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wide">Explanation</label>
                                            <textarea
                                                value={q.explanation ?? ''}
                                                onChange={(e) => updateQuestion(idx, { explanation: e.target.value })}
                                                rows={2}
                                                className="w-full px-3 py-2.5 rounded-xl text-sm bg-gray-50 dark:bg-white/[0.05] border border-gray-200 dark:border-white/[0.08] focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 outline-none transition-all text-gray-900 dark:text-white"
                                            />
                                        </div>
                                    </div>
                                )}

                                {isLongForm && (
                                    <div className="space-y-3">
                                        <div>
                                            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wide">Marks</label>
                                            <input
                                                type="number"
                                                min={1}
                                                value={Number(q.marks ?? 1)}
                                                onChange={(e) => updateQuestion(idx, { marks: Number(e.target.value) })}
                                                className="w-full px-3 py-2.5 rounded-xl text-sm bg-gray-50 dark:bg-white/[0.05] border border-gray-200 dark:border-white/[0.08] focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 outline-none transition-all text-gray-900 dark:text-white"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wide">Marking criteria</label>
                                            {(q.marking_criteria ?? []).map((crit: string, critIdx: number) => (
                                                <input
                                                    key={critIdx}
                                                    value={crit}
                                                    onChange={(e) => updateCriterion(idx, critIdx, e.target.value)}
                                                    className="w-full px-3 py-2.5 rounded-xl text-sm bg-gray-50 dark:bg-white/[0.05] border border-gray-200 dark:border-white/[0.08] focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 outline-none transition-all text-gray-900 dark:text-white mb-2"
                                                />
                                            ))}
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wide">Model answer</label>
                                            <textarea
                                                value={q.model_answer ?? ''}
                                                onChange={(e) => updateQuestion(idx, { model_answer: e.target.value })}
                                                rows={3}
                                                className="w-full px-3 py-2.5 rounded-xl text-sm bg-gray-50 dark:bg-white/[0.05] border border-gray-200 dark:border-white/[0.08] focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 outline-none transition-all text-gray-900 dark:text-white"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wide">Explanation</label>
                                            <textarea
                                                value={q.explanation ?? ''}
                                                onChange={(e) => updateQuestion(idx, { explanation: e.target.value })}
                                                rows={2}
                                                className="w-full px-3 py-2.5 rounded-xl text-sm bg-gray-50 dark:bg-white/[0.05] border border-gray-200 dark:border-white/[0.08] focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 outline-none transition-all text-gray-900 dark:text-white"
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            </div>
        </div>
    )
}
