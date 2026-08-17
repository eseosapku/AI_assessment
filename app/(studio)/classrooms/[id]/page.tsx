'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Mail, Users, ArrowLeft, Download, ChevronRight, Search, Pencil } from 'lucide-react'
import { useAuth } from '@/components/AuthProvider'
import { gradeInteractiveQuestion } from '@/lib/grade-interactive'
import { normalizeInteractiveQuestion } from '@/lib/interactive-assessment-plan'
import { subjectArt } from '@/lib/studio/subjectArt'

interface ClassroomInfo {
    id: string
    name: string
    description: string | null
    teacher_id: string
    created_at: string
}

interface ClassroomAssignment {
    result_id: string | null
    status: 'pending' | 'started' | 'completed'
    started_at: string | null
    completed_at: string | null
    attempt_count: number | null
    assignment: {
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
        deadline: string | null
        created_at: string
        status: string
        classroom_id: string | null
        classroom_ids?: string[]
        classroom_name: string | null
        classroom_names?: string[]
        max_attempts?: number | null
        strict_mode?: boolean
    }
}

interface StudentDetail {
    student: {
        student_id: string | null
        student_email: string | null
        student_name: string | null
    }
    summary: {
        assignments_total: number
        completed: number
        started: number
        pending: number
        average_score: number | null
        last_completed_at: string | null
    }
    assignments: Array<{
        assignment_id: string
        title: string
        subject: string
        grade: string
        question_count: number
        deadline: string | null
        max_attempts: number
        status: string
        completed_at: string | null
        attempt_count: number
        last_attempt_at: string | null
        score: number | null
        result_id: string | null
        result: any | null
        submission_reason: string | null
        violation_count: number | null
    }>
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function isUuid(value: string | null | undefined) {
    return UUID_RE.test(String(value ?? ''))
}

function formatDate(value: string | null) {
    if (!value) return 'No deadline'
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return 'No deadline'
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function formatSeconds(totalSeconds: number) {
    const hours = Math.floor(totalSeconds / 3600)
    const mins = Math.floor((totalSeconds % 3600) / 60)
    if (hours > 0) return `${hours}h ${mins}m`
    return `${mins}m`
}

function getGradeFromScore(score: number | null) {
    if (score === null || !Number.isFinite(score)) return '—'
    if (score >= 90) return 'A+'
    if (score >= 80) return 'A'
    if (score >= 70) return 'B+'
    if (score >= 60) return 'B'
    if (score >= 50) return 'C'
    return 'D'
}

function normalizeFeedback(feedback: unknown): string {
    if (!feedback) return 'No feedback available.'
    if (typeof feedback === 'string') return feedback
    if (typeof feedback === 'object' && feedback && 'text' in feedback) {
        const text = (feedback as { text?: string }).text
        if (typeof text === 'string' && text.trim()) return text
    }
    return 'No feedback available.'
}

function buildFeedbackHtml(options: {
    studentName: string
    studentEmail: string
    assignmentTitle: string
    subject: string
    scoreLabel: string
    feedbackText: string
    completedAt: string | null
    questions: any[]
    answers: any
    longFormGrades: any
}) {
    const dateLabel = options.completedAt
        ? new Date(options.completedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
        : '—'

    const safe = (value: unknown) => String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')

    const mcqAnswers = options.answers?.mcq ?? options.answers ?? {}
    const longFormAnswers = options.answers?.longform ?? {}
    const interactiveAnswers = options.answers?.interactive ?? {}

    const questionBlocks = Array.isArray(options.questions)
        ? options.questions.map((q, idx) => {
            const isLongForm = q?.type === 'longform'
            const isInteractive = q?.type === 'interactive'
            const questionText = safe(q?.question)

            if (isLongForm) {
                const grade = options.longFormGrades?.[idx] ?? options.longFormGrades?.[String(idx)]
                const studentAnswer = safe(longFormAnswers?.[idx] ?? longFormAnswers?.[String(idx)] ?? '')
                const marksLabel = grade ? `${safe(grade.marks_awarded)}/${safe(grade.marks_total)}` : 'Marks pending'
                const criteria = Array.isArray(grade?.criteria_results)
                    ? grade.criteria_results.map((cr: any) => `
                                            <li><strong>${safe(cr.criterion)}</strong>: ${cr.met ? 'Met' : 'Not met'}${cr.note ? ` - ${safe(cr.note)}` : ''}</li>
                                        `).join('')
                    : ''

                return `
                                <div class="qcard">
                                    <div class="qhead">Q${idx + 1} - Long form <span class="marks">${safe(marksLabel)}</span></div>
                                    <div class="qtext">${questionText}</div>
                                    <div class="qsub">Student answer</div>
                                    <div class="answer">${studentAnswer || '<em>No answer provided.</em>'}</div>
                                    ${criteria ? `<div class="qsub">Marking criteria</div><ul class="criteria">${criteria}</ul>` : ''}
                                    ${grade?.general_feedback ? `<div class="qsub">AI feedback</div><div class="answer">${safe(grade.general_feedback)}</div>` : ''}
                                </div>
                            `
            }

            if (isInteractive) {
                const normalized = normalizeInteractiveQuestion(q)
                const ans = interactiveAnswers?.[idx] ?? interactiveAnswers?.[String(idx)]
                const grade = normalized ? gradeInteractiveQuestion(normalized, ans) : null
                const rows = grade?.item_results?.map((r: { label: string; correct: boolean }) =>
                    `<li>${r.correct ? '✓' : '✗'} ${safe(r.label)}</li>`
                ).join('') ?? ''
                return `
                                <div class="qcard">
                                    <div class="qhead">Q${idx + 1} - Interactive (${safe(q?.kind)}) <span class="marks">${grade ? `${safe(grade.marks_awarded)}/${safe(grade.marks_total)}` : '—'}</span></div>
                                    <div class="qtext">${questionText}</div>
                                    ${rows ? `<ul class="criteria">${rows}</ul>` : ''}
                                    ${q?.explanation ? `<div class="qsub">Explanation</div><div class="answer">${safe(q.explanation)}</div>` : ''}
                                </div>
                            `
            }

            const optionsList = Array.isArray(q?.options) ? q.options : []
            const studentAnswer = mcqAnswers?.[idx] ?? mcqAnswers?.[String(idx)]
            const correctIndex = Number(q?.correct_answer)
            const optionItems = optionsList.map((opt: any, optIdx: number) => {
                const label = optIdx === correctIndex ? 'Correct' : Number(studentAnswer) === optIdx ? 'Student' : ''
                return `
                                    <li class="option ${label ? 'marked' : ''}">${safe(opt)}${label ? ` <span class="tag">${label}</span>` : ''}</li>
                                `
            }).join('')

            return `
                        <div class="qcard">
                            <div class="qhead">Q${idx + 1} - MCQ</div>
                            <div class="qtext">${questionText}</div>
                            <ul class="options">${optionItems}</ul>
                            ${q?.explanation ? `<div class="qsub">Explanation</div><div class="answer">${safe(q.explanation)}</div>` : ''}
                        </div>
                    `
        }).join('')
        : ''

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Student Feedback – ${options.assignmentTitle}</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: "Space Grotesk", Arial, sans-serif; color: #1f2933; background: #f9f6f1; }
        .page { max-width: 880px; margin: 0 auto; padding: 48px; }
        .card { background: #ffffff; border-radius: 16px; padding: 24px; border: 1px solid #efe7dc; }
        .badge { display: inline-block; padding: 4px 10px; border-radius: 999px; background: #f1e6d6; color: #9c6644; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.12em; }
        .title { font-size: 28px; font-weight: 800; margin: 16px 0 8px; }
        .muted { color: #6b7280; font-size: 13px; }
        .score { font-size: 18px; font-weight: 700; margin-top: 6px; color: #1f7a7a; }
        .section { margin-top: 24px; }
        .label { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #9aa1a9; margin-bottom: 8px; }
        .feedback { background: #f8fafc; border-radius: 12px; padding: 16px; border: 1px solid #e5e7eb; font-size: 14px; line-height: 1.7; white-space: pre-wrap; }
        .qcard { margin-top: 18px; padding: 16px; border: 1px solid #e5e7eb; border-radius: 12px; background: #ffffff; }
        .qhead { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #9aa1a9; margin-bottom: 8px; display: flex; justify-content: space-between; }
        .qtext { font-size: 15px; font-weight: 600; color: #111827; margin-bottom: 10px; }
        .qsub { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #6b7280; margin: 12px 0 6px; }
        .answer { background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 10px; padding: 12px; font-size: 13px; line-height: 1.6; }
        .options { list-style: none; padding: 0; margin: 0; }
        .option { padding: 10px 12px; border-radius: 10px; border: 1px solid #e5e7eb; margin-bottom: 6px; font-size: 13px; }
        .option.marked { background: #f1f5f9; }
        .tag { font-size: 11px; font-weight: 700; color: #1f7a7a; margin-left: 6px; }
        .marks { font-size: 11px; font-weight: 700; color: #1f7a7a; }
        .criteria { margin: 0; padding-left: 18px; font-size: 13px; color: #1f2933; }
    </style>
</head>
<body>
    <div class="page">
        <div class="card">
            <span class="badge">Student feedback</span>
            <div class="title">${options.assignmentTitle}</div>
            <div class="muted">${options.subject} · Completed: ${dateLabel}</div>
            <div class="score">${options.scoreLabel}</div>
            <div class="section">
                <div class="label">Student</div>
                <div class="muted">${options.studentName} · ${options.studentEmail}</div>
            </div>
            <div class="section">
                <div class="label">Feedback</div>
                <div class="feedback">${options.feedbackText}</div>
            </div>
            ${questionBlocks ? `
            <div class="section">
                <div class="label">Question review</div>
                ${questionBlocks}
            </div>
            ` : ''}
        </div>
    </div>
</body>
</html>`
}

export default function ClassroomDetailPage() {
    const params = useParams()
    const router = useRouter()
    const { user } = useAuth()
    const classroomId = String(params?.id ?? '')

    const [classroom, setClassroom] = useState<ClassroomInfo | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState('')
    const [isEditing, setIsEditing] = useState(false)
    const [editName, setEditName] = useState('')
    const [editDescription, setEditDescription] = useState('')
    const [editError, setEditError] = useState('')
    const [isUpdating, setIsUpdating] = useState(false)
    const [isDeleting, setIsDeleting] = useState(false)
    const [deleteError, setDeleteError] = useState('')

    const isTeacher = user?.role === 'teacher'

    useEffect(() => {
        if (!classroomId) return
        const load = async () => {
            setIsLoading(true)
            setError('')
            try {
                const res = await fetch(`/api/classrooms/${classroomId}`)
                const json = await res.json()
                if (!res.ok) throw new Error(json.error || 'Failed to load classroom')
                setClassroom(json.data)
            } catch (err: any) {
                setError(err?.message || 'Failed to load classroom')
            } finally {
                setIsLoading(false)
            }
        }
        load()
    }, [classroomId])

    const startEdit = () => {
        if (!classroom) return
        setIsEditing(true)
        setEditName(classroom.name ?? '')
        setEditDescription(classroom.description ?? '')
        setEditError('')
    }

    const cancelEdit = () => {
        setIsEditing(false)
        setEditError('')
    }

    const handleUpdate = async () => {
        if (!classroomId) return
        const trimmedName = editName.trim()
        const trimmedDescription = editDescription.trim()
        if (!trimmedName) {
            setEditError('Classroom name is required')
            return
        }

        setIsUpdating(true)
        setEditError('')
        try {
            const res = await fetch(`/api/classrooms/${classroomId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: trimmedName,
                    description: trimmedDescription,
                }),
            })
            const json = await res.json()
            if (!res.ok) throw new Error(json.error || 'Failed to update classroom')

            setClassroom((prev) => prev
                ? {
                    ...prev,
                    name: trimmedName,
                    description: trimmedDescription || null,
                }
                : prev)
            setIsEditing(false)
        } catch (err: any) {
            setEditError(err?.message || 'Failed to update classroom')
        } finally {
            setIsUpdating(false)
        }
    }

    const handleDeleteClassroom = async () => {
        if (!classroomId) return
        if (!window.confirm('Delete this classroom? This will remove the classroom and its data.')) return

        setIsDeleting(true)
        setDeleteError('')
        try {
            const res = await fetch(`/api/classrooms/${classroomId}`, { method: 'DELETE' })
            const json = await res.json()
            if (!res.ok) throw new Error(json.error || 'Failed to delete classroom')
            router.push('/')
        } catch (err: any) {
            setDeleteError(err?.message || 'Failed to delete classroom')
        } finally {
            setIsDeleting(false)
        }
    }

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#E8EEF3] dark:bg-[#0C0F13]">
                <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            </div>
        )
    }

    if (!classroom || error) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#E8EEF3] dark:bg-[#0C0F13]">
                <div className="text-sm text-gray-500">{error || 'Classroom not found.'}</div>
            </div>
        )
    }

    return (
        <div>
            <div className="mx-auto max-w-6xl space-y-6">
                <div className="flex items-center justify-between">
                    <button
                        onClick={() => router.back()}
                        className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Back
                    </button>
                </div>

                <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-200/70 dark:border-gray-800/60 p-6 sm:p-8">
                    <div className="flex flex-col gap-4">
                        <div className="flex items-start justify-between gap-4">
                            <div className="flex flex-col gap-2">
                                <p className="text-[12px] font-bold uppercase tracking-[0.2em] text-ss-slate">Classroom</p>
                                <h1 className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white">{classroom.name}</h1>
                                {classroom.description && (
                                    <p className="text-sm text-gray-500 dark:text-gray-400 max-w-2xl">{classroom.description}</p>
                                )}
                            </div>
                            {isTeacher && !isEditing && (
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={startEdit}
                                        className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                                    >
                                        <Pencil className="w-3.5 h-3.5" />
                                        Edit
                                    </button>
                                    <button
                                        onClick={handleDeleteClassroom}
                                        disabled={isDeleting}
                                        className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold border border-red-200 text-red-600 hover:bg-red-50 disabled:text-red-300 disabled:border-red-100 dark:border-red-800/60 dark:text-red-300 dark:hover:bg-red-900/20"
                                    >
                                        {isDeleting ? 'Deleting...' : 'Delete'}
                                    </button>
                                </div>
                            )}
                        </div>

                        {deleteError && (
                            <div className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/60 rounded-lg px-3 py-2">
                                {deleteError}
                            </div>
                        )}

                        {isTeacher && isEditing && (
                            <div className="grid gap-4 sm:grid-cols-2">
                                <div className="sm:col-span-1">
                                    <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wide">
                                        Classroom name
                                    </label>
                                    <input
                                        value={editName}
                                        onChange={(e) => setEditName(e.target.value)}
                                        className="w-full px-3 py-2.5 rounded-xl text-sm bg-gray-50 dark:bg-white/[0.05] border border-gray-200 dark:border-white/[0.08] focus:border-[#0E8FD1] focus:ring-2 focus:ring-[#0E8FD1]/20 outline-none transition-all text-gray-900 dark:text-white"
                                    />
                                </div>
                                <div className="sm:col-span-1">
                                    <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wide">
                                        Description
                                    </label>
                                    <input
                                        value={editDescription}
                                        onChange={(e) => setEditDescription(e.target.value)}
                                        placeholder="Optional"
                                        className="w-full px-3 py-2.5 rounded-xl text-sm bg-gray-50 dark:bg-white/[0.05] border border-gray-200 dark:border-white/[0.08] focus:border-[#0E8FD1] focus:ring-2 focus:ring-[#0E8FD1]/20 outline-none transition-all text-gray-900 dark:text-white"
                                    />
                                </div>
                                {editError && (
                                    <div className="sm:col-span-2 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/60 rounded-lg px-3 py-2">
                                        {editError}
                                    </div>
                                )}
                                <div className="sm:col-span-2 flex flex-col sm:flex-row gap-2">
                                    <button
                                        onClick={handleUpdate}
                                        disabled={isUpdating}
                                        className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-[#0E8FD1] hover:bg-[#0C6FAE] disabled:bg-[#48D0FF] text-white text-sm font-semibold py-2.5"
                                    >
                                        {isUpdating ? 'Saving...' : 'Save changes'}
                                    </button>
                                    <button
                                        onClick={cancelEdit}
                                        className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-white/[0.08] dark:text-gray-300 dark:hover:bg-white/[0.05] text-sm font-semibold py-2.5"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {isTeacher ? (
                    <TeacherClassroomView classroomId={classroomId} />
                ) : (
                    <StudentClassroomView classroomId={classroomId} />
                )}
            </div>
        </div>
    )
}

function TeacherClassroomView({ classroomId }: { classroomId: string }) {
    const { user } = useAuth()
    const [members, setMembers] = useState<any[]>([])
    const [isLoadingMembers, setIsLoadingMembers] = useState(true)
    const [inviteInput, setInviteInput] = useState('')
    const [inviteError, setInviteError] = useState('')
    const [inviteSuccess, setInviteSuccess] = useState('')
    const [isInviting, setIsInviting] = useState(false)
    const [removeError, setRemoveError] = useState('')
    const [removingMemberId, setRemovingMemberId] = useState<string | null>(null)
    const [analytics, setAnalytics] = useState<any>(null)
    const [isLoadingAnalytics, setIsLoadingAnalytics] = useState(true)
    const [activityRange, setActivityRange] = useState<'all' | 'month' | 'week' | 'day'>('all')
    const [searchInput, setSearchInput] = useState('')
    const [studentSearch, setStudentSearch] = useState('')
    const [selectedStudent, setSelectedStudent] = useState<any | null>(null)
    const [studentDetail, setStudentDetail] = useState<StudentDetail | null>(null)
    const [isDetailOpen, setIsDetailOpen] = useState(false)
    const [isLoadingDetail, setIsLoadingDetail] = useState(false)
    const [detailError, setDetailError] = useState('')

    const acceptedMembers = members.filter((m) => m.status === 'accepted')
    const memberLookup = useMemo(() => {
        const map = new Map<string, string>()
        for (const row of members) {
            if (row.student_id) map.set(`id:${row.student_id}`, row.id)
            if (row.student_email) map.set(`email:${String(row.student_email).toLowerCase()}`, row.id)
        }
        return map
    }, [members])

    const loadMembers = async () => {
        setIsLoadingMembers(true)
        try {
            const res = await fetch(`/api/classrooms/${classroomId}/members`)
            const json = await res.json()
            if (!res.ok) throw new Error(json.error || 'Failed to load members')
            setMembers(json.data ?? [])
        } catch (err) {
            console.error('Members fetch error:', err)
            setMembers([])
        } finally {
            setIsLoadingMembers(false)
        }
    }

    const loadAnalytics = async (range: 'all' | 'month' | 'week' | 'day') => {
        setIsLoadingAnalytics(true)
        try {
            const res = await fetch(`/api/classrooms/${classroomId}/analytics?range=${range}`)
            const json = await res.json()
            if (!res.ok) throw new Error(json.error || 'Failed to load analytics')
            setAnalytics(json)
        } catch (err) {
            console.error('Analytics fetch error:', err)
            setAnalytics(null)
        } finally {
            setIsLoadingAnalytics(false)
        }
    }

    useEffect(() => {
        loadMembers()
    }, [classroomId])

    useEffect(() => {
        loadAnalytics(activityRange)
    }, [classroomId, activityRange])

    const handleSearch = () => {
        setStudentSearch(searchInput.trim())
    }

    const studentsForDisplay = useMemo(() => {
        const rows = analytics?.students ?? []
        const query = studentSearch.trim().toLowerCase()
        if (!query) return rows
        return rows.filter((row: any) => {
            const name = String(row.student_name ?? '').toLowerCase()
            const email = String(row.student_email ?? '').toLowerCase()
            const studentId = String(row.student_id ?? '').toLowerCase()
            return name.includes(query) || email.includes(query) || studentId.includes(query)
        })
    }, [analytics?.students, studentSearch])

    const activeTimeLabel = activityRange === 'all'
        ? 'All time'
        : activityRange === 'month'
            ? 'Last 30 days'
            : activityRange === 'week'
                ? 'Last 7 days'
                : 'Today'

    const openStudentDetail = async (row: any) => {
        setSelectedStudent(row)
        setIsDetailOpen(true)
        setIsLoadingDetail(true)
        setDetailError('')
        try {
            const params = new URLSearchParams()
            if (row?.student_id) params.set('student_id', row.student_id)
            if (row?.student_email) params.set('student_email', row.student_email)
            const res = await fetch(`/api/classrooms/${classroomId}/students?${params.toString()}`)
            const json = await res.json()
            if (!res.ok) throw new Error(json.error || 'Failed to load student details')
            setStudentDetail(json)
        } catch (err: any) {
            setDetailError(err?.message || 'Failed to load student details')
            setStudentDetail(null)
        } finally {
            setIsLoadingDetail(false)
        }
    }

    const closeStudentDetail = () => {
        setIsDetailOpen(false)
        setStudentDetail(null)
        setSelectedStudent(null)
        setDetailError('')
    }

    const handleDownloadFeedback = (row: StudentDetail['assignments'][number]) => {
        const studentName = studentDetail?.student?.student_name ?? selectedStudent?.student_name ?? 'Student'
        const studentEmail = studentDetail?.student?.student_email
            ?? selectedStudent?.student_email
            ?? selectedStudent?.student_id
            ?? 'unknown'
        const feedbackText = normalizeFeedback(row.result?.feedback)
        const scoreLabel = row.score !== null ? `Score: ${row.score}% (${getGradeFromScore(row.score)})` : 'Score: —'
        const html = buildFeedbackHtml({
            studentName,
            studentEmail,
            assignmentTitle: row.title,
            subject: row.subject,
            scoreLabel,
            feedbackText,
            completedAt: row.completed_at,
            questions: Array.isArray(row.result?.questions_data) ? row.result?.questions_data : [],
            answers: row.result?.answers ?? {},
            longFormGrades: row.result?.longform_grades ?? {},
        })
        const blob = new Blob([html], { type: 'text/html' })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        const safeTitle = row.title.replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '')
        const safeName = String(studentName || 'student').replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '')
        link.href = url
        link.download = `${safeName}_${safeTitle}_feedback.html`
        link.click()
        URL.revokeObjectURL(url)
    }

    const parseIdentifiers = (value: string) => {
        const parts = value
            .split(/[,\n]/g)
            .map((item) => item.trim())
            .filter(Boolean)

        const emails: string[] = []
        const studentIds: string[] = []

        for (const part of parts) {
            if (part.includes('@')) {
                emails.push(part.toLowerCase())
            } else {
                studentIds.push(part.toUpperCase())
            }
        }

        const unique = (list: string[]) => Array.from(new Set(list))
        const identifiers = unique([...emails, ...studentIds])

        return {
            emails: unique(emails),
            studentIds: unique(studentIds),
            identifiers,
        }
    }

    const handleInvite = async () => {
        if (!user?.id) return
        const { identifiers } = parseIdentifiers(inviteInput)
        if (identifiers.length === 0) {
            setInviteError('Add at least one email or student ID.')
            return
        }

        setIsInviting(true)
        setInviteError('')
        setInviteSuccess('')
        try {
            const res = await fetch(`/api/classrooms/${classroomId}/members`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ teacher_id: user.id, identifiers }),
            })
            const json = await res.json()
            if (!res.ok) throw new Error(json.error || 'Failed to invite students')
            setInviteInput('')
            const missing = Array.isArray(json.missing_student_ids) ? json.missing_student_ids : []
            if ((json.data ?? []).length === 0 && missing.length > 0) {
                setInviteError(`No student found for ID(s): ${missing.join(', ')}`)
            } else if (missing.length > 0) {
                setInviteSuccess(`Invitations sent. Missing IDs: ${missing.join(', ')}`)
            } else {
                setInviteSuccess('Invitations sent.')
            }
            await loadMembers()
            await loadAnalytics(activityRange)
        } catch (err: any) {
            setInviteError(err?.message || 'Failed to invite students')
        } finally {
            setIsInviting(false)
        }
    }

    const handleRemoveMember = async (memberId: string) => {
        if (!user?.id) return
        if (!window.confirm('Remove this student from the classroom?')) return

        setRemovingMemberId(memberId)
        setRemoveError('')

        try {
            const res = await fetch(`/api/classrooms/${classroomId}/members`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ member_id: memberId, teacher_id: user.id }),
            })
            const json = await res.json()
            if (!res.ok) throw new Error(json.error || 'Failed to remove student')
            await loadMembers()
            await loadAnalytics(activityRange)
        } catch (err: any) {
            setRemoveError(err?.message || 'Failed to remove student')
        } finally {
            setRemovingMemberId(null)
        }
    }

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200/70 dark:border-gray-800/60 p-5">
                    <p className="text-[12px] uppercase tracking-widest text-ss-slate">Students</p>
                    <p className="text-2xl font-black text-gray-900 dark:text-white mt-2">{acceptedMembers.length}</p>
                    <p className="text-xs text-ss-slate mt-1">Active in this classroom</p>
                </div>
                <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200/70 dark:border-gray-800/60 p-5">
                    <p className="text-[12px] uppercase tracking-widest text-ss-slate">Completion rate</p>
                    <p className="text-2xl font-black text-gray-900 dark:text-white mt-2">
                        {isLoadingAnalytics ? '—' : `${analytics?.summary?.completion_rate ?? 0}%`}
                    </p>
                    <p className="text-xs text-ss-slate mt-1">Assignments finished</p>
                </div>
                <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200/70 dark:border-gray-800/60 p-5">
                    <p className="text-[12px] uppercase tracking-widest text-ss-slate">Avg score</p>
                    <p className="text-2xl font-black text-gray-900 dark:text-white mt-2">
                        {isLoadingAnalytics
                            ? '—'
                            : Number.isFinite(analytics?.summary?.average_score)
                                ? `${analytics?.summary?.average_score}%`
                                : '—'}
                    </p>
                    <p className="text-xs text-ss-slate mt-1">Across completed work</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200/70 dark:border-gray-800/60 p-5 flex flex-col gap-3">
                    <p className="text-[12px] uppercase tracking-widest text-ss-slate">Invite students</p>
                    <div className="relative">
                        <Mail className="absolute left-3 top-3.5 w-4 h-4 text-ss-slate" />
                        <textarea
                            value={inviteInput}
                            onChange={(e) => setInviteInput(e.target.value)}
                            placeholder="Enter emails or student IDs separated by comma or new line"
                            rows={4}
                            className="w-full pl-10 pr-3 py-2.5 rounded-xl text-sm bg-gray-50 dark:bg-white/[0.05] border border-gray-200 dark:border-white/[0.08] focus:border-[#0E8FD1] focus:ring-2 focus:ring-[#0E8FD1]/20 outline-none transition-all text-gray-900 dark:text-white"
                        />
                    </div>
                    {inviteError && (
                        <p className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/60 rounded-lg px-3 py-2">
                            {inviteError}
                        </p>
                    )}
                    {inviteSuccess && (
                        <p className="text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/60 rounded-lg px-3 py-2">
                            {inviteSuccess}
                        </p>
                    )}
                    <button
                        onClick={handleInvite}
                        disabled={isInviting}
                        className="w-full inline-flex items-center justify-center gap-3 bg-[#0E8FD1] hover:bg-[#0C6FAE] disabled:bg-[#48D0FF] text-white text-base sm:text-lg font-bold py-3.5 rounded-xl"
                    >
                        <Users className="w-5 h-5" />
                        {isInviting ? 'Sending...' : 'Send invitations'}
                    </button>
                </div>

                <div className="lg:col-span-2 bg-white dark:bg-gray-900 rounded-2xl border border-gray-200/70 dark:border-gray-800/60 p-5">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-3">
                        <div>
                            <p className="text-[12px] uppercase tracking-widest text-ss-slate">Student analytics</p>
                            <p className="text-xs text-ss-slate mt-1">
                                {isLoadingAnalytics
                                    ? 'Loading...'
                                    : `Total active time (${activeTimeLabel}): ${formatSeconds(analytics?.summary?.seconds_active ?? 0)}`}
                            </p>
                        </div>
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                            <div className="relative">
                                <Search className="absolute left-3 top-2.5 w-4 h-4 text-ss-slate" />
                                <input
                                    value={searchInput}
                                    onChange={(e) => setSearchInput(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') handleSearch()
                                    }}
                                    placeholder="Search name, email, or ID"
                                    className="w-full sm:w-56 pl-9 pr-3 py-2 rounded-lg text-xs bg-gray-50 dark:bg-white/[0.05] border border-gray-200 dark:border-white/[0.08] focus:border-[#0E8FD1] focus:ring-2 focus:ring-[#0E8FD1]/20 outline-none transition-all text-gray-900 dark:text-white"
                                />
                            </div>
                            <button
                                onClick={handleSearch}
                                className="px-3 py-2 rounded-lg text-xs font-bold bg-[#0E8FD1] hover:bg-[#0C6FAE] text-white"
                            >
                                Search
                            </button>
                            <select
                                value={activityRange}
                                onChange={(e) => setActivityRange(e.target.value as 'all' | 'month' | 'week' | 'day')}
                                className="px-3 py-2 rounded-lg text-xs font-semibold bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-200"
                            >
                                <option value="all">All time</option>
                                <option value="month">Last 30 days</option>
                                <option value="week">Last 7 days</option>
                                <option value="day">Today</option>
                            </select>
                        </div>
                    </div>
                    {isLoadingAnalytics ? (
                        <div className="flex items-center justify-center py-10">
                            <div className="w-6 h-6 border-2 border-[#0E8FD1] border-t-transparent rounded-full animate-spin" />
                        </div>
                    ) : analytics?.students?.length > 0 ? (
                        studentsForDisplay.length > 0 ? (
                            <>
                                <div className="overflow-x-auto max-h-[360px] overflow-y-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="text-left text-[12px] uppercase tracking-widest text-ss-slate bg-white/90 dark:bg-gray-900/90 sticky top-0">
                                                <th className="py-2">Student</th>
                                                <th className="py-2">Completed</th>
                                                <th className="py-2">Open</th>
                                                <th className="py-2">Avg score</th>
                                                <th className="py-2">Active time</th>
                                                <th className="py-2 text-right">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                                            {studentsForDisplay.map((row: any) => {
                                                const memberId = row.student_id
                                                    ? memberLookup.get(`id:${row.student_id}`)
                                                    : row.student_email
                                                        ? memberLookup.get(`email:${String(row.student_email).toLowerCase()}`)
                                                        : undefined
                                                return (
                                                    <tr key={row.student_id ?? row.student_email} className="text-gray-700 dark:text-gray-300">
                                                        <td className="py-2">
                                                            <div className="font-semibold text-gray-900 dark:text-white">
                                                                {row.student_name ?? row.student_email ?? row.student_id}
                                                            </div>
                                                            <div className="text-xs text-ss-slate">{row.student_email ?? row.student_id ?? '—'}</div>
                                                        </td>
                                                        <td className="py-2">{row.completed}</td>
                                                        <td className="py-2">{row.started}</td>
                                                        <td className="py-2">
                                                            <div className="flex items-center gap-2">
                                                                <span>{Number.isFinite(row.avg_score) ? `${row.avg_score}%` : '—'}</span>
                                                                {Number.isFinite(row.avg_score) && (
                                                                    <span className="text-[12px] font-bold px-2 py-0.5 rounded-full bg-[#E6F6FD] text-[#0E8FD1] dark:bg-[#161B21] dark:text-[#9AD0C3]">
                                                                        {getGradeFromScore(row.avg_score)}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td className="py-2">{formatSeconds(row.seconds_active ?? 0)}</td>
                                                        <td className="py-2 text-right">
                                                            <div className="inline-flex items-center gap-2">
                                                                <button
                                                                    onClick={() => openStudentDetail(row)}
                                                                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#E6F6FD] text-[#0E8FD1] font-bold text-sm hover:bg-[#d7e7e0]"
                                                                >
                                                                    View
                                                                    <ChevronRight className="w-4 h-4" />
                                                                </button>
                                                                {memberId && (
                                                                    <button
                                                                        onClick={() => handleRemoveMember(memberId)}
                                                                        disabled={isLoadingMembers || removingMemberId === memberId}
                                                                        className="inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-bold border border-red-200 text-red-600 hover:bg-red-50 disabled:text-red-300 disabled:border-red-100 dark:border-red-800/60 dark:text-red-300 dark:hover:bg-red-900/20"
                                                                    >
                                                                        {removingMemberId === memberId ? 'Removing...' : 'Remove'}
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                                {removeError && (
                                    <p className="mt-3 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/60 rounded-lg px-3 py-2">
                                        {removeError}
                                    </p>
                                )}
                            </>
                        ) : (
                            <div className="text-sm text-ss-slate">No students match your search.</div>
                        )
                    ) : (
                        <div className="text-sm text-ss-slate">No analytics data yet.</div>
                    )}
                </div>
            </div>

            {isDetailOpen && (
                <div className="fixed inset-0 z-40">
                    <div
                        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                        onClick={closeStudentDetail}
                    />
                    <div className="absolute right-0 top-0 h-full w-full sm:max-w-xl bg-[#FFFDF9] dark:bg-[#12161D] border-l border-[#E8DED1] dark:border-white/10 shadow-2xl overflow-y-auto">
                        <div className="p-6 border-b border-[#E8DED1] dark:border-white/10 flex items-start justify-between gap-4">
                            <div>
                                <p className="text-[12px] uppercase tracking-[0.2em] text-[#9C6644]">Student detail</p>
                                <h3 className="text-xl font-black text-[#1F2933] dark:text-white font-display mt-2">
                                    {studentDetail?.student?.student_name || selectedStudent?.student_name || selectedStudent?.student_email || selectedStudent?.student_id || 'Student'}
                                </h3>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                    {studentDetail?.student?.student_email || selectedStudent?.student_email || selectedStudent?.student_id || '—'}
                                </p>
                            </div>
                            <button
                                onClick={closeStudentDetail}
                                className="text-sm font-bold px-4 py-2 rounded-full border border-[#E8DED1] dark:border-white/10 text-[#1F2933] dark:text-gray-200 hover:bg-[#F1E6D6] dark:hover:bg-white/5"
                            >
                                Close
                            </button>
                        </div>

                        <div className="p-6 space-y-6">
                            {isLoadingDetail ? (
                                <div className="flex items-center justify-center py-10">
                                    <div className="w-6 h-6 border-2 border-[#0E8FD1] border-t-transparent rounded-full animate-spin" />
                                </div>
                            ) : detailError ? (
                                <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                                    {detailError}
                                </div>
                            ) : studentDetail ? (
                                <>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="rounded-2xl border border-[#E8DED1] dark:border-white/10 bg-white dark:bg-[#161B21] p-4">
                                            <p className="text-[12px] uppercase tracking-widest text-ss-slate">Quizes</p>
                                            <p className="text-2xl font-black text-[#1F2933] dark:text-white mt-2">
                                                {studentDetail.summary.completed}
                                                <span className="text-sm text-ss-slate font-semibold">/{studentDetail.summary.assignments_total}</span>
                                            </p>
                                        </div>
                                        <div className="rounded-2xl border border-[#E8DED1] dark:border-white/10 bg-white dark:bg-[#161B21] p-4">
                                            <p className="text-[12px] uppercase tracking-widest text-ss-slate">Average score</p>
                                            <p className="text-2xl font-black text-[#1F2933] dark:text-white mt-2">
                                                {Number.isFinite(studentDetail.summary.average_score)
                                                    ? `${studentDetail.summary.average_score}%`
                                                    : '—'}
                                                {Number.isFinite(studentDetail.summary.average_score) && (
                                                    <span className="text-sm text-[#0E8FD1] font-semibold ml-2">
                                                        {getGradeFromScore(studentDetail.summary.average_score)}
                                                    </span>
                                                )}
                                            </p>
                                        </div>
                                        <div className="rounded-2xl border border-[#E8DED1] dark:border-white/10 bg-white dark:bg-[#161B21] p-4">
                                            <p className="text-[12px] uppercase tracking-widest text-ss-slate">Not completed</p>
                                            <p className="text-2xl font-black text-[#1F2933] dark:text-white mt-2">{studentDetail.summary.started}</p>
                                        </div>
                                        <div className="rounded-2xl border border-[#E8DED1] dark:border-white/10 bg-white dark:bg-[#161B21] p-4">
                                            <p className="text-[12px] uppercase tracking-widest text-ss-slate">Last completed</p>
                                            <p className="text-sm font-semibold text-[#1F2933] dark:text-white mt-3">
                                                {studentDetail.summary.last_completed_at
                                                    ? new Date(studentDetail.summary.last_completed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                                                    : '—'}
                                            </p>
                                        </div>
                                    </div>

                                    <div>
                                        <div className="flex items-center justify-between mb-3">
                                            <p className="text-[12px] uppercase tracking-widest text-ss-slate">Assignments</p>
                                            <p className="text-xs text-ss-slate">View or download feedback</p>
                                        </div>
                                        <div className="space-y-3">
                                            {studentDetail.assignments.map((row) => {
                                                const grade = getGradeFromScore(row.score)
                                                const scoreLabel = row.score !== null ? `${row.score}%` : '—'
                                                return (
                                                    <div key={row.assignment_id} className="rounded-2xl border border-[#E8DED1] dark:border-white/10 bg-white dark:bg-[#161B21] p-4">
                                                        <div className="flex items-start justify-between gap-4">
                                                            <div>
                                                                <p className="text-sm font-bold text-[#1F2933] dark:text-white">{row.title}</p>
                                                                <p className="text-xs text-ss-slate mt-1">
                                                                    {row.subject} · {row.question_count} questions
                                                                </p>
                                                            </div>
                                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                                <span className={`text-[12px] font-bold px-2 py-1 rounded-full ${row.status === 'completed'
                                                                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                                                                    : row.status === 'started'
                                                                        ? 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                                                                        : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-300'
                                                                    }`}>
                                                                    {row.status}
                                                                </span>
                                                                {row.submission_reason === 'violation' && (
                                                                    <span className="inline-flex items-center gap-1 text-[12px] font-bold px-2 py-1 rounded-full bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800/40">
                                                                        <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                                                                        Violation
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-gray-500">
                                                            <span className="font-semibold text-[#0E8FD1]">Score: {scoreLabel}</span>
                                                            <span className="px-2 py-0.5 rounded-full bg-[#E6F6FD] text-[#0E8FD1] dark:bg-[#161B21] dark:text-[#9AD0C3]">
                                                                {grade}
                                                            </span>
                                                            <span>Attempts: {row.attempt_count}/{row.max_attempts}</span>
                                                        </div>
                                                        <div className="mt-4 flex items-center justify-between">
                                                            <p className="text-[12px] text-ss-slate">
                                                                {row.completed_at
                                                                    ? `Completed ${new Date(row.completed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
                                                                    : 'Not completed yet'}
                                                            </p>
                                                            <div className="flex items-center gap-3">
                                                                {row.result_id ? (
                                                                    <button
                                                                        onClick={() => window.open(`/results/${row.result_id}`, '_blank')}
                                                                        className="inline-flex items-center gap-2 text-sm font-bold text-[#0E8FD1] hover:text-[#0C6FAE]"
                                                                    >
                                                                        View feedback
                                                                    </button>
                                                                ) : (
                                                                    <span className="text-[12px] text-ss-slate">Feedback unavailable</span>
                                                                )}
                                                                <button
                                                                    onClick={() => handleDownloadFeedback(row)}
                                                                    className="inline-flex items-center gap-2 text-sm font-bold text-[#0E8FD1] hover:text-[#0C6FAE]"
                                                                >
                                                                    <Download className="w-4 h-4" />
                                                                    Download feedback
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <div className="text-sm text-ss-slate">Select a student to view details.</div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

function StudentClassroomView({ classroomId }: { classroomId: string }) {
    const router = useRouter()
    const { user } = useAuth()
    const [assignments, setAssignments] = useState<ClassroomAssignment[]>([])
    const [isLoadingAssignments, setIsLoadingAssignments] = useState(true)

    useEffect(() => {
        const loadAssignments = async () => {
            if (!user?.id && !user?.email) return
            setIsLoadingAssignments(true)
            try {
                const params = new URLSearchParams()
                if (isUuid(user?.id)) {
                    params.set('student_id', user?.id ?? '')
                } else {
                    params.set('email', user?.email ?? '')
                }
                params.set('classroom_id', classroomId)
                const res = await fetch(`/api/assignments/student?${params.toString()}`)
                const json = await res.json()
                if (!res.ok) throw new Error(json.error || 'Failed to load assignments')
                setAssignments(json.assignments ?? [])
            } catch (err) {
                console.error('Assignments fetch error:', err)
                setAssignments([])
            } finally {
                setIsLoadingAssignments(false)
            }
        }
        loadAssignments()
    }, [classroomId, user])

    const grouped = useMemo(() => {
        const upcoming: ClassroomAssignment[] = []
        const open: ClassroomAssignment[] = []
        const finished: ClassroomAssignment[] = []
        const now = Date.now()

        for (const row of assignments) {
            const deadline = row.assignment.deadline
            const isExpired = deadline ? new Date(deadline).getTime() < now : false
            if (row.status === 'completed' || isExpired) {
                finished.push(row)
            } else if (row.status === 'started') {
                open.push(row)
            } else {
                upcoming.push(row)
            }
        }

        return { upcoming, open, finished }
    }, [assignments])

    const renderAssignments = (rows: ClassroomAssignment[], emptyLabel: string) => {
        if (rows.length === 0) {
            return <p className="text-sm text-ss-slate">{emptyLabel}</p>
        }

        return (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {rows.map((row) => {
                    const deadline = row.assignment.deadline
                    const isExpired = deadline ? new Date(deadline) < new Date() : false
                    const maxAttempts = Number(row.assignment.max_attempts ?? 1)
                    const attemptCount = Number(row.attempt_count ?? 0)
                    const attemptsLeft = Number.isFinite(maxAttempts)
                        ? Math.max(maxAttempts - attemptCount, 0)
                        : 0
                    const resultId = row.result_id

                    let buttonLabel = 'Start'
                    if (row.status === 'started') {
                        buttonLabel = 'Continue'
                    } else if (row.status === 'completed') {
                        buttonLabel = attemptsLeft > 0 ? 'Retry' : 'No attempts left'
                    } else if (attemptsLeft <= 0) {
                        buttonLabel = 'No attempts left'
                    }

                    const isAttemptLocked = attemptsLeft <= 0
                    const canViewFeedback = row.status === 'completed' && Boolean(resultId)
                    const canRetry = row.status === 'completed' && attemptsLeft > 0 && !isExpired
                    const canStart = (row.status !== 'completed' && !isAttemptLocked && !isExpired) || canRetry
                    const statusColor = isExpired ? 'var(--ss-bad)' : row.status === 'completed' ? 'var(--ss-good)' : 'var(--ss-accent)'
                    return (
                        <div key={row.assignment.id} className="relative flex flex-col overflow-hidden rounded-2xl border border-ss-line bg-ss-panel transition-all hover:shadow-ss-panel">
                            <span className="absolute inset-x-0 top-0 h-1" style={{ background: statusColor }} />
                            <div className="flex items-start gap-3 p-4 pt-5">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={subjectArt(row.assignment.subject)} alt="" aria-hidden className="h-11 w-11 shrink-0 object-contain" />
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-extrabold text-ss-ink">{row.assignment.title}</p>
                                    <p className="mt-0.5 truncate text-xs font-semibold text-ss-slate">{row.assignment.subject} · Grade {row.assignment.grade}</p>
                                </div>
                                {row.assignment.strict_mode && (
                                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[color:var(--ss-bad)]/10 px-2 py-0.5 text-[12px] font-bold text-ss-bad">
                                        <svg className="w-2.5 h-2.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                                        Strict
                                    </span>
                                )}
                            </div>
                            <div className="flex flex-wrap items-center gap-2 px-4 pb-3 text-[12px] font-semibold text-ss-slate">
                                <span className="rounded-md bg-ss-chip px-2 py-1">{row.assignment.question_count}q · {row.assignment.question_type}</span>
                                {deadline && (
                                    <span className={`rounded-md px-2 py-1 ${isExpired ? 'bg-[color:var(--ss-bad)]/10 text-ss-bad' : 'bg-ss-chip'}`}>Due {formatDate(deadline)}</span>
                                )}
                                <span className="ml-auto">{attemptsLeft} attempt{attemptsLeft !== 1 ? 's' : ''} left</span>
                            </div>
                            <div className="mt-auto p-4 pt-1">
                            {canViewFeedback ? (
                                <div className={`mt-auto grid gap-2 ${canRetry ? 'grid-cols-2' : 'grid-cols-1'}`}>
                                    <button
                                        onClick={() => router.push(`/results/${resultId}`)}
                                        className="w-full rounded-xl bg-ss-accent py-2 text-xs font-bold text-white transition-all hover:brightness-95"
                                    >
                                        View feedback
                                    </button>
                                    {canRetry && (
                                        <button
                                            onClick={() => router.push(`/assessment?assignment=${row.assignment.id}`)}
                                            className="w-full py-2 rounded-xl text-xs font-bold transition-colors bg-[#0E8FD1] hover:bg-[#0C6FAE] text-white"
                                        >
                                            Retry
                                        </button>
                                    )}
                                </div>
                            ) : (
                                <button
                                    disabled={!canStart}
                                    onClick={() => router.push(`/assessment?assignment=${row.assignment.id}`)}
                                    className="mt-auto w-full py-2 rounded-xl text-xs font-bold transition-colors disabled:opacity-60 disabled:cursor-not-allowed bg-[#0E8FD1] hover:bg-[#0C6FAE] text-white"
                                >
                                    {isExpired ? 'Deadline passed' : buttonLabel}
                                </button>
                            )}
                            </div>
                        </div>
                    )
                })}
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200/70 dark:border-gray-800/60 p-5">
                    <p className="text-[12px] uppercase tracking-widest text-ss-slate">Upcoming</p>
                    <p className="text-2xl font-black text-gray-900 dark:text-white mt-2">{grouped.upcoming.length}</p>
                </div>
                <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200/70 dark:border-gray-800/60 p-5">
                    <p className="text-[12px] uppercase tracking-widest text-ss-slate">Open</p>
                    <p className="text-2xl font-black text-gray-900 dark:text-white mt-2">{grouped.open.length}</p>
                </div>
                <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200/70 dark:border-gray-800/60 p-5">
                    <p className="text-[12px] uppercase tracking-widest text-ss-slate">Finished</p>
                    <p className="text-2xl font-black text-gray-900 dark:text-white mt-2">{grouped.finished.length}</p>
                </div>
            </div>

            <div className="space-y-4">
                <div>
                    <p className="text-[12px] uppercase tracking-widest text-ss-slate mb-3">Upcoming assignments</p>
                    {isLoadingAssignments ? (
                        <div className="flex items-center justify-center py-10">
                            <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                        </div>
                    ) : (
                        renderAssignments(grouped.upcoming, 'No upcoming assignments.')
                    )}
                </div>

                <div>
                    <p className="text-[12px] uppercase tracking-widest text-ss-slate mb-3">Open assignments</p>
                    {isLoadingAssignments ? (
                        <div className="flex items-center justify-center py-10">
                            <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                        </div>
                    ) : (
                        renderAssignments(grouped.open, 'No open assignments.')
                    )}
                </div>

                <div>
                    <p className="text-[12px] uppercase tracking-widest text-ss-slate mb-3">Finished assignments</p>
                    {isLoadingAssignments ? (
                        <div className="flex items-center justify-center py-10">
                            <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                        </div>
                    ) : (
                        renderAssignments(grouped.finished, 'No finished assignments yet.')
                    )}
                </div>
            </div>
        </div>
    )
}
