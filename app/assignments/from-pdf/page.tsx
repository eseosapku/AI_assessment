'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, Loader2 } from 'lucide-react'
import { useAuth } from '@/components/AuthProvider'
import { normalizeCountry } from '@/lib/countries'

interface ClassOption {
    id: number
    name: string
    grade: number | null
}

type QuestionType = 'mcq' | 'longform' | 'mixed'

const DIFFICULTY_OPTIONS = [
    { id: 'beginner', label: 'Beginner' },
    { id: 'average', label: 'Average' },
    { id: 'intermediate', label: 'Intermediate' },
    { id: 'advanced', label: 'Advanced' },
]

const QUESTION_TYPE_OPTIONS: Array<{ id: QuestionType; label: string }> = [
    { id: 'mcq', label: 'Multiple Choice' },
    { id: 'longform', label: 'Long-form Only' },
    { id: 'mixed', label: 'Mixed (MCQ + Long-form)' },
]

const CURRICULUM_OPTIONS = [
    { id: 'rwanda', label: 'Rwanda National Curriculum (REB)' },
    { id: 'cambridge', label: 'Cambridge International (CAIE)' },
]

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

function stripPdfExtension(name: string) {
    return name.replace(/\.[^/.]+$/, '')
}

export default function PdfAssignmentPage() {
    const router = useRouter()
    const { user } = useAuth()
    const userCountry = normalizeCountry(user?.country)

    const [title, setTitle] = useState('')
    const [subject, setSubject] = useState('')
    const [topicsInput, setTopicsInput] = useState('')
    const [curriculum, setCurriculum] = useState('rwanda')
    const [difficulty, setDifficulty] = useState('average')
    const [style, setStyle] = useState('PDF-based')
    const [questionType, setQuestionType] = useState<QuestionType>('mixed')
    const [count, setCount] = useState(10)
    const [maxAttempts, setMaxAttempts] = useState(1)

    const [classOptions, setClassOptions] = useState<ClassOption[]>([])
    const [selectedClassId, setSelectedClassId] = useState('')
    const [isLoadingClasses, setIsLoadingClasses] = useState(false)

    const [pdfFile, setPdfFile] = useState<File | null>(null)
    const [pdfMeta, setPdfMeta] = useState<{ truncated: boolean; pageCount: number | null } | null>(null)

    const [isGenerating, setIsGenerating] = useState(false)
    const [stage, setStage] = useState('')
    const [error, setError] = useState('')
    const [success, setSuccess] = useState('')

    useEffect(() => {
        if (!user?.role) return
        if (user.role !== 'teacher') {
            router.push('/')
        }
    }, [user, router])

    useEffect(() => {
        setCurriculum(userCountry === 'NG' ? 'nigeria' : 'rwanda')
    }, [userCountry])

    useEffect(() => {
        const loadClasses = async () => {
            setIsLoadingClasses(true)
            try {
                const res = await fetch(`/api/classes?country=${userCountry}`)
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
    }, [userCountry])

    const topics = useMemo(() => parseTopics(topicsInput), [topicsInput])

    const selectedClass = useMemo(
        () => classOptions.find((cls) => String(cls.id) === selectedClassId) ?? null,
        [classOptions, selectedClassId]
    )

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0] ?? null
        setPdfMeta(null)
        setError('')
        setPdfFile(file)
    }

    const handleGenerate = async () => {
        if (!user?.id) {
            setError('Missing teacher account.')
            return
        }
        if (!pdfFile) {
            setError('Upload a PDF file to continue.')
            return
        }
        if (!title.trim()) {
            setError('Assignment name is required.')
            return
        }
        if (!selectedClassId || !selectedClass?.name) {
            setError('Select a class to set the grade.')
            return
        }
        if (!curriculum) {
            setError('Choose a curriculum.')
            return
        }
        if (!difficulty) {
            setError('Choose a difficulty level.')
            return
        }
        if (!style.trim()) {
            setError('Style is required.')
            return
        }

        const fileBaseName = stripPdfExtension(pdfFile.name || 'PDF material')
        const subjectValue = subject.trim() || fileBaseName
        const topicsValue = topics.length > 0 ? topics : [subjectValue]
        const gradeValue = Number.isFinite(selectedClass?.grade) ? String(selectedClass?.grade) : selectedClass?.name

        if (!subjectValue) {
            setError('Subject is required.')
            return
        }
        if (!topicsValue.length) {
            setError('Add at least one topic.')
            return
        }
        if (!gradeValue) {
            setError('Select a class to continue.')
            return
        }

        setIsGenerating(true)
        setStage('Extracting PDF')
        setError('')
        setSuccess('')

        try {
            const formData = new FormData()
            formData.append('file', pdfFile)

            const extractRes = await fetch('/api/extract-pdf', {
                method: 'POST',
                body: formData,
            })
            const extractJson = await extractRes.json()
            if (!extractRes.ok) {
                throw new Error(extractJson.error || 'Failed to read PDF')
            }

            setPdfMeta({
                truncated: Boolean(extractJson?.truncated),
                pageCount: Number.isFinite(extractJson?.pageCount) ? extractJson.pageCount : null,
            })

            setStage('Generating questions')
            const genRes = await fetch('/api/generate-assessment', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    subject: subjectValue,
                    topics: topicsValue,
                    count,
                    style,
                    className: selectedClass?.name,
                    grade: gradeValue,
                    curriculum,
                    user_id: user.id,
                    questionType,
                    difficultyLevel: difficulty,
                    sourceText: extractJson.text,
                    sourceName: extractJson.filename || pdfFile.name,
                }),
            })

            const genText = await genRes.text()
            if (!genText) throw new Error('Server returned an empty response. Please try again.')
            const data = JSON.parse(genText)
            if (!genRes.ok) throw new Error(data.error || 'Failed to generate assessment')

            setStage('Saving draft')
            const draftRes = await fetch('/api/assignments/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    teacher_id: user.id,
                    teacher_name: user.name,
                    title: title.trim(),
                    subject: subjectValue,
                    topics: topicsValue,
                    grade: gradeValue,
                    curriculum,
                    difficulty_level: difficulty,
                    question_count: Array.isArray(data?.questions) ? data.questions.length : count,
                    max_attempts: maxAttempts,
                    style: style.trim(),
                    question_type: questionType,
                    status: 'draft',
                    questions_data: data?.questions ?? [],
                    estimated_time: data?.estimated_time ?? null,
                }),
            })

            const draftJson = await draftRes.json()
            if (!draftRes.ok) throw new Error(draftJson.error || 'Failed to save draft')

            const assignmentId = String(draftJson.assignment_id)
            setSuccess('Draft created. Opening preview...')
            router.push(`/assignments/${assignmentId}/preview`)
        } catch (err: any) {
            setError(err?.message || 'Failed to generate assignment')
        } finally {
            setIsGenerating(false)
            setStage('')
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
                </div>

                <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200/70 dark:border-gray-800/60 p-6 space-y-5">
                    <div>
                        <p className="text-sm font-bold uppercase tracking-[0.2em] text-gray-400 dark:text-gray-500">Generate from PDF</p>
                        <h1 className="text-2xl font-black text-gray-900 dark:text-white mt-2">New Assignment</h1>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-bold text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wide">Assignment name</label>
                            <input
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder="Assignment title"
                                className="w-full px-3 py-2.5 rounded-xl text-base font-semibold bg-gray-50 dark:bg-white/[0.05] border border-gray-200 dark:border-white/[0.08] focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 outline-none transition-all text-gray-900 dark:text-white"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wide">Upload PDF</label>
                            <input
                                type="file"
                                accept="application/pdf"
                                onChange={handleFileChange}
                                className="w-full px-3 py-2.5 rounded-xl text-base font-semibold bg-gray-50 dark:bg-white/[0.05] border border-gray-200 dark:border-white/[0.08] focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 outline-none transition-all text-gray-700 dark:text-gray-200"
                            />
                            {pdfFile && (
                                <p className="text-xs text-gray-400 mt-1">Selected: {pdfFile.name}</p>
                            )}
                            {pdfMeta?.truncated && (
                                <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">PDF text was truncated for processing.</p>
                            )}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-bold text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wide">Subject (optional)</label>
                            <input
                                value={subject}
                                onChange={(e) => setSubject(e.target.value)}
                                placeholder="e.g. Biology"
                                className="w-full px-3 py-2.5 rounded-xl text-base font-semibold bg-gray-50 dark:bg-white/[0.05] border border-gray-200 dark:border-white/[0.08] focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 outline-none transition-all text-gray-900 dark:text-white"
                            />
                            <p className="text-xs text-gray-400 mt-1">If left blank, we use the PDF filename.</p>
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
                            placeholder="e.g. Cell structure, Photosynthesis"
                            className="w-full px-3 py-2.5 rounded-xl text-base font-semibold bg-gray-50 dark:bg-white/[0.05] border border-gray-200 dark:border-white/[0.08] focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 outline-none transition-all text-gray-900 dark:text-white"
                        />
                        <p className="text-xs text-gray-400 mt-1">Leave blank to use the subject as the default topic.</p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-sm font-bold text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wide">Curriculum</label>
                            <select
                                value={curriculum}
                                onChange={(e) => setCurriculum(e.target.value)}
                                className="w-full px-3 py-2.5 rounded-xl text-base font-semibold bg-gray-50 dark:bg-white/[0.05] border border-gray-200 dark:border-white/[0.08] focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 outline-none transition-all text-gray-900 dark:text-white"
                            >
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
                                {DIFFICULTY_OPTIONS.map((opt) => (
                                    <option key={opt.id} value={opt.id}>{opt.label}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wide">Question count</label>
                            <select
                                value={String(count)}
                                onChange={(e) => setCount(Number(e.target.value))}
                                className="w-full px-3 py-2.5 rounded-xl text-base font-semibold bg-gray-50 dark:bg-white/[0.05] border border-gray-200 dark:border-white/[0.08] focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 outline-none transition-all text-gray-900 dark:text-white"
                            >
                                {[10, 20, 40].map((value) => (
                                    <option key={value} value={String(value)}>{value}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-sm font-bold text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wide">Question type</label>
                            <select
                                value={questionType}
                                onChange={(e) => setQuestionType(e.target.value as QuestionType)}
                                className="w-full px-3 py-2.5 rounded-xl text-base font-semibold bg-gray-50 dark:bg-white/[0.05] border border-gray-200 dark:border-white/[0.08] focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 outline-none transition-all text-gray-900 dark:text-white"
                            >
                                {QUESTION_TYPE_OPTIONS.map((opt) => (
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

                    <button
                        onClick={handleGenerate}
                        disabled={isGenerating}
                        className="w-full flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-700 disabled:bg-violet-400 text-white text-sm font-semibold py-3 px-6 rounded-xl transition-colors shadow-sm shadow-violet-900/20"
                    >
                        {isGenerating ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                {stage || 'Working...'}
                            </>
                        ) : (
                            'Generate from PDF'
                        )}
                    </button>
                </div>
            </div>
        </div>
    )
}
