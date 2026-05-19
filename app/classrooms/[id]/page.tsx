'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Mail, Users, ArrowLeft, Download, ChevronRight, Search } from 'lucide-react'
import { useAuth } from '@/components/AuthProvider'

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
        classroom_id: string
        classroom_name: string | null
        max_attempts?: number | null
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

    const questionBlocks = Array.isArray(options.questions)
        ? options.questions.map((q, idx) => {
            const isLongForm = q?.type === 'longform'
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

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#F6F1EA] dark:bg-[#0B0E12]">
                <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            </div>
        )
    }

    if (!classroom || error) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#F6F1EA] dark:bg-[#0B0E12]">
                <div className="text-sm text-gray-500">{error || 'Classroom not found.'}</div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-[#F6F1EA] dark:bg-[#0B0E12] transition-colors">
            <div className="max-w-6xl mx-auto px-4 sm:px-8 py-6 space-y-6">
                <div className="flex items-center justify-between">
                    <button
                        onClick={() => router.push('/')}
                        className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Back to dashboard
                    </button>
                </div>

                <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-200/70 dark:border-gray-800/60 p-6 sm:p-8">
                    <div className="flex flex-col gap-2">
                        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-gray-400">Classroom</p>
                        <h1 className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white">{classroom.name}</h1>
                        {classroom.description && (
                            <p className="text-sm text-gray-500 dark:text-gray-400 max-w-2xl">{classroom.description}</p>
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
    const router = useRouter()
    const { user } = useAuth()
    const [members, setMembers] = useState<any[]>([])
    const [isLoadingMembers, setIsLoadingMembers] = useState(true)
    const [inviteInput, setInviteInput] = useState('')
    const [inviteError, setInviteError] = useState('')
    const [inviteSuccess, setInviteSuccess] = useState('')
    const [isInviting, setIsInviting] = useState(false)
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
    const pendingMembers = members.filter((m) => m.status === 'pending')

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
            return name.includes(query) || email.includes(query)
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
        const studentEmail = studentDetail?.student?.student_email ?? selectedStudent?.student_email ?? 'unknown'
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

    const parseEmails = (value: string) => {
        const parts = value
            .split(/[,\n]/g)
            .map((item) => item.trim().toLowerCase())
            .filter((item) => item.includes('@'))
        return Array.from(new Set(parts))
    }

    const handleInvite = async () => {
        if (!user?.id) return
        const emails = parseEmails(inviteInput)
        if (emails.length === 0) {
            setInviteError('Add at least one valid email.')
            return
        }

        setIsInviting(true)
        setInviteError('')
        setInviteSuccess('')
        try {
            const res = await fetch(`/api/classrooms/${classroomId}/members`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ teacher_id: user.id, emails }),
            })
            const json = await res.json()
            if (!res.ok) throw new Error(json.error || 'Failed to invite students')
            setInviteInput('')
            setInviteSuccess('Invitations sent.')
            await loadMembers()
            await loadAnalytics(activityRange)
        } catch (err: any) {
            setInviteError(err?.message || 'Failed to invite students')
        } finally {
            setIsInviting(false)
        }
    }

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200/70 dark:border-gray-800/60 p-5">
                    <p className="text-[10px] uppercase tracking-widest text-gray-400">Students</p>
                    <p className="text-2xl font-black text-gray-900 dark:text-white mt-2">{acceptedMembers.length}</p>
                    <p className="text-xs text-gray-400 mt-1">{pendingMembers.length} pending invites</p>
                </div>
                <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200/70 dark:border-gray-800/60 p-5">
                    <p className="text-[10px] uppercase tracking-widest text-gray-400">Completion rate</p>
                    <p className="text-2xl font-black text-gray-900 dark:text-white mt-2">
                        {isLoadingAnalytics ? '—' : `${analytics?.summary?.completion_rate ?? 0}%`}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">Assignments finished</p>
                </div>
                <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200/70 dark:border-gray-800/60 p-5">
                    <p className="text-[10px] uppercase tracking-widest text-gray-400">Avg score</p>
                    <p className="text-2xl font-black text-gray-900 dark:text-white mt-2">
                        {isLoadingAnalytics
                            ? '—'
                            : Number.isFinite(analytics?.summary?.average_score)
                                ? `${analytics?.summary?.average_score}%`
                                : '—'}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">Across completed work</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200/70 dark:border-gray-800/60 p-5 flex flex-col gap-3">
                    <p className="text-[10px] uppercase tracking-widest text-gray-400">Invite students</p>
                    <div className="relative">
                        <Mail className="absolute left-3 top-3.5 w-4 h-4 text-gray-400" />
                        <textarea
                            value={inviteInput}
                            onChange={(e) => setInviteInput(e.target.value)}
                            placeholder="Enter emails separated by comma or new line"
                            rows={4}
                            className="w-full pl-10 pr-3 py-2.5 rounded-xl text-sm bg-gray-50 dark:bg-white/[0.05] border border-gray-200 dark:border-white/[0.08] focus:border-[#1F7A7A] focus:ring-2 focus:ring-[#1F7A7A]/20 outline-none transition-all text-gray-900 dark:text-white"
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
                        className="w-full inline-flex items-center justify-center gap-3 bg-[#1F7A7A] hover:bg-[#166463] disabled:bg-[#6FA9A9] text-white text-base sm:text-lg font-bold py-3.5 rounded-xl"
                    >
                        <Users className="w-5 h-5" />
                        {isInviting ? 'Sending...' : 'Send invitations'}
                    </button>
                </div>

                <div className="lg:col-span-2 bg-white dark:bg-gray-900 rounded-2xl border border-gray-200/70 dark:border-gray-800/60 p-5">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-3">
                        <div>
                            <p className="text-[10px] uppercase tracking-widest text-gray-400">Student analytics</p>
                            <p className="text-xs text-gray-400 mt-1">
                                {isLoadingAnalytics
                                    ? 'Loading...'
                                    : `Total active time (${activeTimeLabel}): ${formatSeconds(analytics?.summary?.seconds_active ?? 0)}`}
                            </p>
                        </div>
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                            <div className="relative">
                                <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                                <input
                                    value={searchInput}
                                    onChange={(e) => setSearchInput(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') handleSearch()
                                    }}
                                    placeholder="Search name or email"
                                    className="w-full sm:w-56 pl-9 pr-3 py-2 rounded-lg text-xs bg-gray-50 dark:bg-white/[0.05] border border-gray-200 dark:border-white/[0.08] focus:border-[#1F7A7A] focus:ring-2 focus:ring-[#1F7A7A]/20 outline-none transition-all text-gray-900 dark:text-white"
                                />
                            </div>
                            <button
                                onClick={handleSearch}
                                className="px-3 py-2 rounded-lg text-xs font-bold bg-[#1F7A7A] hover:bg-[#166463] text-white"
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
                            <div className="w-6 h-6 border-2 border-[#1F7A7A] border-t-transparent rounded-full animate-spin" />
                        </div>
                    ) : analytics?.students?.length > 0 ? (
                        studentsForDisplay.length > 0 ? (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="text-left text-[11px] uppercase tracking-widest text-gray-400">
                                            <th className="py-2">Student</th>
                                            <th className="py-2">Completed</th>
                                            <th className="py-2">Open</th>
                                            <th className="py-2">Avg score</th>
                                            <th className="py-2">Active time</th>
                                            <th className="py-2 text-right">Details</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                                        {studentsForDisplay.map((row: any) => (
                                            <tr key={row.student_id ?? row.student_email} className="text-gray-700 dark:text-gray-300">
                                                <td className="py-2">
                                                    <div className="font-semibold text-gray-900 dark:text-white">
                                                        {row.student_name ?? row.student_email}
                                                    </div>
                                                    <div className="text-xs text-gray-400">{row.student_email}</div>
                                                </td>
                                                <td className="py-2">{row.completed}</td>
                                                <td className="py-2">{row.started}</td>
                                                <td className="py-2">
                                                    <div className="flex items-center gap-2">
                                                        <span>{Number.isFinite(row.avg_score) ? `${row.avg_score}%` : '—'}</span>
                                                        {Number.isFinite(row.avg_score) && (
                                                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#E7EFEA] text-[#1F7A7A] dark:bg-[#142724] dark:text-[#9AD0C3]">
                                                                {getGradeFromScore(row.avg_score)}
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="py-2">{formatSeconds(row.seconds_active ?? 0)}</td>
                                                <td className="py-2 text-right">
                                                    <button
                                                        onClick={() => openStudentDetail(row)}
                                                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#E7EFEA] text-[#1F7A7A] font-bold text-sm hover:bg-[#d7e7e0]"
                                                    >
                                                        View
                                                        <ChevronRight className="w-4 h-4" />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="text-sm text-gray-400">No students match your search.</div>
                        )
                    ) : (
                        <div className="text-sm text-gray-400">No analytics data yet.</div>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200/70 dark:border-gray-800/60 p-5">
                    <p className="text-[10px] uppercase tracking-widest text-gray-400 mb-3">Accepted students</p>
                    {isLoadingMembers ? (
                        <div className="flex items-center justify-center py-8">
                            <div className="w-6 h-6 border-2 border-[#1F7A7A] border-t-transparent rounded-full animate-spin" />
                        </div>
                    ) : acceptedMembers.length > 0 ? (
                        <div className="space-y-2">
                            {acceptedMembers.map((row) => (
                                <div key={row.id} className="flex items-center justify-between text-sm text-gray-700 dark:text-gray-300">
                                    <div>
                                        <p className="font-semibold text-gray-900 dark:text-white">{row.student_name ?? row.student_email}</p>
                                        <p className="text-xs text-gray-400">{row.student_email}</p>
                                    </div>
                                    <span className="text-xs text-emerald-500 font-bold">Accepted</span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-sm text-gray-400">No students accepted yet.</p>
                    )}
                </div>

                <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200/70 dark:border-gray-800/60 p-5">
                    <p className="text-[10px] uppercase tracking-widest text-gray-400 mb-3">Pending invitations</p>
                    {isLoadingMembers ? (
                        <div className="flex items-center justify-center py-8">
                            <div className="w-6 h-6 border-2 border-violet-600 border-t-transparent rounded-full animate-spin" />
                        </div>
                    ) : pendingMembers.length > 0 ? (
                        <div className="space-y-2">
                            {pendingMembers.map((row) => (
                                <div key={row.id} className="flex items-center justify-between text-sm text-gray-700 dark:text-gray-300">
                                    <div>
                                        <p className="font-semibold text-gray-900 dark:text-white">{row.student_email}</p>
                                        <p className="text-xs text-gray-400">Invited {new Date(row.invited_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
                                    </div>
                                    <span className="text-xs text-amber-500 font-bold">Pending</span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-sm text-gray-400">No pending invites.</p>
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
                                <p className="text-[10px] uppercase tracking-[0.2em] text-[#9C6644]">Student detail</p>
                                <h3 className="text-xl font-black text-[#1F2933] dark:text-white font-display mt-2">
                                    {studentDetail?.student?.student_name || selectedStudent?.student_name || selectedStudent?.student_email || 'Student'}
                                </h3>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                    {studentDetail?.student?.student_email || selectedStudent?.student_email || '—'}
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
                                    <div className="w-6 h-6 border-2 border-[#1F7A7A] border-t-transparent rounded-full animate-spin" />
                                </div>
                            ) : detailError ? (
                                <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                                    {detailError}
                                </div>
                            ) : studentDetail ? (
                                <>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="rounded-2xl border border-[#E8DED1] dark:border-white/10 bg-white dark:bg-[#0F141B] p-4">
                                            <p className="text-[10px] uppercase tracking-widest text-gray-400">Quizes</p>
                                            <p className="text-2xl font-black text-[#1F2933] dark:text-white mt-2">
                                                {studentDetail.summary.completed}
                                                <span className="text-sm text-gray-400 font-semibold">/{studentDetail.summary.assignments_total}</span>
                                            </p>
                                        </div>
                                        <div className="rounded-2xl border border-[#E8DED1] dark:border-white/10 bg-white dark:bg-[#0F141B] p-4">
                                            <p className="text-[10px] uppercase tracking-widest text-gray-400">Average score</p>
                                            <p className="text-2xl font-black text-[#1F2933] dark:text-white mt-2">
                                                {Number.isFinite(studentDetail.summary.average_score)
                                                    ? `${studentDetail.summary.average_score}%`
                                                    : '—'}
                                                {Number.isFinite(studentDetail.summary.average_score) && (
                                                    <span className="text-sm text-[#1F7A7A] font-semibold ml-2">
                                                        {getGradeFromScore(studentDetail.summary.average_score)}
                                                    </span>
                                                )}
                                            </p>
                                        </div>
                                        <div className="rounded-2xl border border-[#E8DED1] dark:border-white/10 bg-white dark:bg-[#0F141B] p-4">
                                            <p className="text-[10px] uppercase tracking-widest text-gray-400">Not completed</p>
                                            <p className="text-2xl font-black text-[#1F2933] dark:text-white mt-2">{studentDetail.summary.started}</p>
                                        </div>
                                        <div className="rounded-2xl border border-[#E8DED1] dark:border-white/10 bg-white dark:bg-[#0F141B] p-4">
                                            <p className="text-[10px] uppercase tracking-widest text-gray-400">Last completed</p>
                                            <p className="text-sm font-semibold text-[#1F2933] dark:text-white mt-3">
                                                {studentDetail.summary.last_completed_at
                                                    ? new Date(studentDetail.summary.last_completed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                                                    : '—'}
                                            </p>
                                        </div>
                                    </div>

                                    <div>
                                        <div className="flex items-center justify-between mb-3">
                                            <p className="text-[10px] uppercase tracking-widest text-gray-400">Assignments</p>
                                            <p className="text-xs text-gray-400">View or download feedback</p>
                                        </div>
                                        <div className="space-y-3">
                                            {studentDetail.assignments.map((row) => {
                                                const grade = getGradeFromScore(row.score)
                                                const scoreLabel = row.score !== null ? `${row.score}%` : '—'
                                                return (
                                                    <div key={row.assignment_id} className="rounded-2xl border border-[#E8DED1] dark:border-white/10 bg-white dark:bg-[#0F141B] p-4">
                                                        <div className="flex items-start justify-between gap-4">
                                                            <div>
                                                                <p className="text-sm font-bold text-[#1F2933] dark:text-white">{row.title}</p>
                                                                <p className="text-xs text-gray-400 mt-1">
                                                                    {row.subject} · {row.question_count} questions
                                                                </p>
                                                            </div>
                                                            <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${row.status === 'completed'
                                                                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                                                                : row.status === 'started'
                                                                    ? 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                                                                    : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-300'
                                                                }`}>
                                                                {row.status}
                                                            </span>
                                                        </div>
                                                        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-gray-500">
                                                            <span className="font-semibold text-[#1F7A7A]">Score: {scoreLabel}</span>
                                                            <span className="px-2 py-0.5 rounded-full bg-[#E7EFEA] text-[#1F7A7A] dark:bg-[#142724] dark:text-[#9AD0C3]">
                                                                {grade}
                                                            </span>
                                                            <span>Attempts: {row.attempt_count}/{row.max_attempts}</span>
                                                        </div>
                                                        <div className="mt-4 flex items-center justify-between">
                                                            <p className="text-[11px] text-gray-400">
                                                                {row.completed_at
                                                                    ? `Completed ${new Date(row.completed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
                                                                    : 'Not completed yet'}
                                                            </p>
                                                            <div className="flex items-center gap-3">
                                                                {row.result_id ? (
                                                                    <button
                                                                        onClick={() => window.open(`/results/${row.result_id}`, '_blank')}
                                                                        className="inline-flex items-center gap-2 text-sm font-bold text-[#1F7A7A] hover:text-[#166463]"
                                                                    >
                                                                        View feedback
                                                                    </button>
                                                                ) : (
                                                                    <span className="text-[11px] text-gray-400">Feedback unavailable</span>
                                                                )}
                                                                <button
                                                                    onClick={() => handleDownloadFeedback(row)}
                                                                    className="inline-flex items-center gap-2 text-sm font-bold text-[#1F7A7A] hover:text-[#166463]"
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
                                <div className="text-sm text-gray-400">Select a student to view details.</div>
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
                const query = isUuid(user?.id)
                    ? `student_id=${user?.id}`
                    : `email=${encodeURIComponent(user?.email ?? '')}`
                const res = await fetch(`/api/assignments/student?${query}`)
                const json = await res.json()
                if (!res.ok) throw new Error(json.error || 'Failed to load assignments')
                const rows = (json.assignments ?? []).filter((row: ClassroomAssignment) => row.assignment?.classroom_id === classroomId)
                setAssignments(rows)
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
            return <p className="text-sm text-gray-400">{emptyLabel}</p>
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
                    return (
                        <div key={row.assignment.id} className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200/70 dark:border-gray-800/60 p-5 flex flex-col gap-3">
                            <div>
                                <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{row.assignment.title}</p>
                                <p className="text-xs text-gray-400 mt-0.5">{row.assignment.subject} · Grade {row.assignment.grade}</p>
                            </div>
                            <div className="flex items-center gap-3 text-xs text-gray-400">
                                <span>{row.assignment.question_count}q · {row.assignment.question_type}</span>
                                {deadline && (
                                    <span className={isExpired ? 'text-red-500' : ''}>Due {formatDate(deadline)}</span>
                                )}
                            </div>
                            <div className="text-[11px] text-gray-400">
                                Attempts left: {attemptsLeft}
                            </div>
                            {canViewFeedback ? (
                                <div className={`mt-auto grid gap-2 ${canRetry ? 'grid-cols-2' : 'grid-cols-1'}`}>
                                    <button
                                        onClick={() => router.push(`/results/${resultId}`)}
                                        className="w-full py-2 rounded-xl text-xs font-bold transition-colors bg-white dark:bg-gray-900 border border-[#1F7A7A] text-[#1F7A7A] hover:bg-[#1F7A7A] hover:text-white"
                                    >
                                        View feedback
                                    </button>
                                    {canRetry && (
                                        <button
                                            onClick={() => router.push(`/assessment?assignment=${row.assignment.id}`)}
                                            className="w-full py-2 rounded-xl text-xs font-bold transition-colors bg-[#1F7A7A] hover:bg-[#166463] text-white"
                                        >
                                            Retry
                                        </button>
                                    )}
                                </div>
                            ) : (
                                <button
                                    disabled={!canStart}
                                    onClick={() => router.push(`/assessment?assignment=${row.assignment.id}`)}
                                    className="mt-auto w-full py-2 rounded-xl text-xs font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-[#1F7A7A] hover:bg-[#166463] text-white"
                                >
                                    {isExpired ? 'Deadline passed' : buttonLabel}
                                </button>
                            )}
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
                    <p className="text-[10px] uppercase tracking-widest text-gray-400">Upcoming</p>
                    <p className="text-2xl font-black text-gray-900 dark:text-white mt-2">{grouped.upcoming.length}</p>
                </div>
                <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200/70 dark:border-gray-800/60 p-5">
                    <p className="text-[10px] uppercase tracking-widest text-gray-400">Open</p>
                    <p className="text-2xl font-black text-gray-900 dark:text-white mt-2">{grouped.open.length}</p>
                </div>
                <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200/70 dark:border-gray-800/60 p-5">
                    <p className="text-[10px] uppercase tracking-widest text-gray-400">Finished</p>
                    <p className="text-2xl font-black text-gray-900 dark:text-white mt-2">{grouped.finished.length}</p>
                </div>
            </div>

            <div className="space-y-4">
                <div>
                    <p className="text-[10px] uppercase tracking-widest text-gray-400 mb-3">Upcoming assignments</p>
                    {isLoadingAssignments ? (
                        <div className="flex items-center justify-center py-10">
                            <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                        </div>
                    ) : (
                        renderAssignments(grouped.upcoming, 'No upcoming assignments.')
                    )}
                </div>

                <div>
                    <p className="text-[10px] uppercase tracking-widest text-gray-400 mb-3">Open assignments</p>
                    {isLoadingAssignments ? (
                        <div className="flex items-center justify-center py-10">
                            <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                        </div>
                    ) : (
                        renderAssignments(grouped.open, 'No open assignments.')
                    )}
                </div>

                <div>
                    <p className="text-[10px] uppercase tracking-widest text-gray-400 mb-3">Finished assignments</p>
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
