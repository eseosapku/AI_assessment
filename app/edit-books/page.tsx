'use client'

import { useEffect, useMemo, useState } from 'react'
import { BookOpen, ChevronDown, Layers, ListTree, Loader2, Pencil, Plus, Save, Search, Trash2, X } from 'lucide-react'

interface Textbook {
    id: number
    name: string
    filename?: string | null
    curriculum?: number | null
}

interface Topic {
    id: number
    textbook_id: number
    name: string
}

interface Subtopic {
    id: number
    textbook_id: number
    topic_id: number
    name: string
}

function curriculumLabel(curriculum?: number | null) {
    if (curriculum === 1) return 'Cambridge'
    return 'REB'
}

export default function EditBooksPage() {
    const [textbooks, setTextbooks] = useState<Textbook[]>([])
    const [topics, setTopics] = useState<Topic[]>([])
    const [subtopicTopics, setSubtopicTopics] = useState<Topic[]>([])
    const [subtopics, setSubtopics] = useState<Subtopic[]>([])

    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')

    const [isLoadingTopics, setIsLoadingTopics] = useState(false)
    const [isLoadingSubtopicTopics, setIsLoadingSubtopicTopics] = useState(false)
    const [isLoadingSubtopics, setIsLoadingSubtopics] = useState(false)

    const [textbookSearch, setTextbookSearch] = useState('')
    const [topicSearch, setTopicSearch] = useState('')
    const [subtopicSearch, setSubtopicSearch] = useState('')

    const [topicsTextbookId, setTopicsTextbookId] = useState<number | null>(null)
    const [subtopicsTextbookId, setSubtopicsTextbookId] = useState<number | null>(null)
    const [subtopicsTopicId, setSubtopicsTopicId] = useState<number | null>(null)

    const [createTextbookName, setCreateTextbookName] = useState('')
    const [createTextbookFilename, setCreateTextbookFilename] = useState('')
    const [createTextbookCurriculum, setCreateTextbookCurriculum] = useState('')
    const [isSavingTextbook, setIsSavingTextbook] = useState(false)
    const [isTextbooksOpen, setIsTextbooksOpen] = useState(true)

    const [editingTextbookId, setEditingTextbookId] = useState<number | null>(null)
    const [editTextbookName, setEditTextbookName] = useState('')
    const [editTextbookFilename, setEditTextbookFilename] = useState('')
    const [editTextbookCurriculum, setEditTextbookCurriculum] = useState('')
    const [isUpdatingTextbook, setIsUpdatingTextbook] = useState(false)

    const [createTopicName, setCreateTopicName] = useState('')
    const [isSavingTopic, setIsSavingTopic] = useState(false)
    const [isTopicsOpen, setIsTopicsOpen] = useState(true)

    const [editingTopicId, setEditingTopicId] = useState<number | null>(null)
    const [editTopicName, setEditTopicName] = useState('')
    const [editTopicTextbookId, setEditTopicTextbookId] = useState<number | null>(null)
    const [isUpdatingTopic, setIsUpdatingTopic] = useState(false)

    const [createSubtopicName, setCreateSubtopicName] = useState('')
    const [isSavingSubtopic, setIsSavingSubtopic] = useState(false)
    const [isSubtopicsOpen, setIsSubtopicsOpen] = useState(true)

    const [editingSubtopicId, setEditingSubtopicId] = useState<number | null>(null)
    const [editSubtopicName, setEditSubtopicName] = useState('')
    const [editSubtopicTopicId, setEditSubtopicTopicId] = useState<number | null>(null)
    const [isUpdatingSubtopic, setIsUpdatingSubtopic] = useState(false)

    const textbookMap = useMemo(() => new Map(textbooks.map((t) => [t.id, t])), [textbooks])
    const subtopicTopicMap = useMemo(() => new Map(subtopicTopics.map((t) => [t.id, t])), [subtopicTopics])

    const filteredTextbooks = useMemo(() => {
        const term = textbookSearch.trim().toLowerCase()
        if (!term) return textbooks
        return textbooks.filter((t) => t.name.toLowerCase().includes(term))
    }, [textbooks, textbookSearch])

    const filteredTopics = useMemo(() => {
        const term = topicSearch.trim().toLowerCase()
        if (!term) return topics
        return topics.filter((t) => t.name.toLowerCase().includes(term))
    }, [topics, topicSearch])

    const filteredSubtopics = useMemo(() => {
        const term = subtopicSearch.trim().toLowerCase()
        if (!term) return subtopics
        return subtopics.filter((t) => t.name.toLowerCase().includes(term))
    }, [subtopics, subtopicSearch])

    const loadTextbooks = async () => {
        setLoading(true)
        setError('')
        try {
            const res = await fetch('/api/textbooks')
            const json = await res.json()
            if (!res.ok) throw new Error(json.error || 'Failed to load textbooks')
            setTextbooks(json.data ?? [])
        } catch (err: any) {
            setError(err?.message || 'Failed to load textbooks')
        } finally {
            setLoading(false)
        }
    }

    const refreshTextbooks = async () => {
        try {
            const res = await fetch('/api/textbooks')
            const json = await res.json()
            if (!res.ok) throw new Error(json.error || 'Failed to load textbooks')
            setTextbooks(json.data ?? [])
        } catch (err: any) {
            setError(err?.message || 'Failed to load textbooks')
        }
    }

    const loadTopicsForTextbook = async (textbookId: number) => {
        setIsLoadingTopics(true)
        setError('')
        try {
            const res = await fetch(`/api/topics?textbook_id=${encodeURIComponent(textbookId)}`)
            const json = await res.json()
            if (!res.ok) throw new Error(json.error || 'Failed to load topics')
            setTopics(json.data ?? [])
        } catch (err: any) {
            setTopics([])
            setError(err?.message || 'Failed to load topics')
        } finally {
            setIsLoadingTopics(false)
        }
    }

    const loadSubtopicTopicsForTextbook = async (textbookId: number) => {
        setIsLoadingSubtopicTopics(true)
        setError('')
        try {
            const res = await fetch(`/api/topics?textbook_id=${encodeURIComponent(textbookId)}`)
            const json = await res.json()
            if (!res.ok) throw new Error(json.error || 'Failed to load topics')
            setSubtopicTopics(json.data ?? [])
        } catch (err: any) {
            setSubtopicTopics([])
            setError(err?.message || 'Failed to load topics')
        } finally {
            setIsLoadingSubtopicTopics(false)
        }
    }

    const loadSubtopicsForTopic = async (topicId: number, textbookId?: number | null) => {
        setIsLoadingSubtopics(true)
        setError('')
        try {
            const params = new URLSearchParams({ topic_id: String(topicId) })
            if (textbookId) params.append('textbook_id', String(textbookId))
            const res = await fetch(`/api/subtopics?${params.toString()}`)
            const json = await res.json()
            if (!res.ok) throw new Error(json.error || 'Failed to load subtopics')
            setSubtopics(json.data ?? [])
        } catch (err: any) {
            setSubtopics([])
            setError(err?.message || 'Failed to load subtopics')
        } finally {
            setIsLoadingSubtopics(false)
        }
    }

    useEffect(() => {
        loadTextbooks()
    }, [])

    useEffect(() => {
        if (textbooks.length === 0) {
            setTopicsTextbookId(null)
            setSubtopicsTextbookId(null)
            setSubtopicsTopicId(null)
            setTopics([])
            setSubtopicTopics([])
            setSubtopics([])
            return
        }

        setTopicsTextbookId((prev) => {
            if (prev && textbooks.some((t) => t.id === prev)) return prev
            return textbooks[0].id
        })

        setSubtopicsTextbookId((prev) => {
            if (prev && textbooks.some((t) => t.id === prev)) return prev
            return textbooks[0].id
        })
    }, [textbooks])

    useEffect(() => {
        if (topicsTextbookId === null) {
            setTopics([])
            return
        }
        loadTopicsForTextbook(topicsTextbookId)
    }, [topicsTextbookId])

    useEffect(() => {
        if (subtopicsTextbookId === null) {
            setSubtopicTopics([])
            setSubtopics([])
            setSubtopicsTopicId(null)
            return
        }
        loadSubtopicTopicsForTextbook(subtopicsTextbookId)
    }, [subtopicsTextbookId])

    useEffect(() => {
        if (subtopicTopics.length === 0) {
            setSubtopicsTopicId(null)
            setSubtopics([])
            return
        }

        setSubtopicsTopicId((prev) => {
            if (prev && subtopicTopics.some((t) => t.id === prev)) return prev
            return subtopicTopics[0].id
        })
    }, [subtopicTopics])

    useEffect(() => {
        if (subtopicsTopicId === null) {
            setSubtopics([])
            return
        }
        loadSubtopicsForTopic(subtopicsTopicId, subtopicsTextbookId)
    }, [subtopicsTopicId, subtopicsTextbookId])

    const handleCreateTextbook = async () => {
        const trimmed = createTextbookName.trim()
        if (!trimmed) {
            setError('Textbook name is required')
            return
        }

        setIsSavingTextbook(true)
        setError('')
        try {
            const payload: Record<string, unknown> = { name: trimmed }
            const filename = createTextbookFilename.trim()
            if (filename) payload.filename = filename
            if (createTextbookCurriculum !== '') {
                payload.curriculum = Number(createTextbookCurriculum)
            }

            const res = await fetch('/api/textbooks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            })
            const json = await res.json()
            if (!res.ok) throw new Error(json.error || 'Failed to create textbook')

            setCreateTextbookName('')
            setCreateTextbookFilename('')
            setCreateTextbookCurriculum('')
            await refreshTextbooks()
        } catch (err: any) {
            setError(err?.message || 'Failed to create textbook')
        } finally {
            setIsSavingTextbook(false)
        }
    }

    const startEditTextbook = (item: Textbook) => {
        setEditingTextbookId(item.id)
        setEditTextbookName(item.name)
        setEditTextbookFilename(item.filename ?? '')
        setEditTextbookCurriculum(item.curriculum !== null && item.curriculum !== undefined ? String(item.curriculum) : '')
        setError('')
    }

    const cancelEditTextbook = () => {
        setEditingTextbookId(null)
        setEditTextbookName('')
        setEditTextbookFilename('')
        setEditTextbookCurriculum('')
    }

    const handleUpdateTextbook = async () => {
        if (editingTextbookId === null) return
        const trimmed = editTextbookName.trim()
        if (!trimmed) {
            setError('Textbook name is required')
            return
        }

        setIsUpdatingTextbook(true)
        setError('')
        try {
            const payload: Record<string, unknown> = {
                name: trimmed,
                filename: editTextbookFilename.trim() || null,
            }
            if (editTextbookCurriculum !== '') {
                payload.curriculum = Number(editTextbookCurriculum)
            } else {
                payload.curriculum = null
            }

            const res = await fetch(`/api/textbooks/${editingTextbookId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            })
            const json = await res.json()
            if (!res.ok) throw new Error(json.error || 'Failed to update textbook')

            await refreshTextbooks()
            cancelEditTextbook()
        } catch (err: any) {
            setError(err?.message || 'Failed to update textbook')
        } finally {
            setIsUpdatingTextbook(false)
        }
    }

    const handleDeleteTextbook = async (id: number) => {
        const confirmed = window.confirm('Delete this textbook? This will remove related topics and subtopics.')
        if (!confirmed) return

        setError('')
        try {
            const res = await fetch(`/api/textbooks/${id}`, { method: 'DELETE' })
            const json = await res.json()
            if (!res.ok) throw new Error(json.error || 'Failed to delete textbook')

            if (editingTextbookId === id) cancelEditTextbook()
            await refreshTextbooks()
        } catch (err: any) {
            setError(err?.message || 'Failed to delete textbook')
        }
    }

    const handleCreateTopic = async () => {
        const trimmed = createTopicName.trim()
        if (!trimmed) {
            setError('Topic name is required')
            return
        }
        if (!topicsTextbookId) {
            setError('Select a textbook for this topic')
            return
        }

        setIsSavingTopic(true)
        setError('')
        try {
            const res = await fetch('/api/topics', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: trimmed, textbook_id: topicsTextbookId }),
            })
            const json = await res.json()
            if (!res.ok) throw new Error(json.error || 'Failed to create topic')

            setCreateTopicName('')
            await loadTopicsForTextbook(topicsTextbookId)
            if (subtopicsTextbookId === topicsTextbookId) {
                await loadSubtopicTopicsForTextbook(subtopicsTextbookId)
            }
        } catch (err: any) {
            setError(err?.message || 'Failed to create topic')
        } finally {
            setIsSavingTopic(false)
        }
    }

    const startEditTopic = (item: Topic) => {
        setEditingTopicId(item.id)
        setEditTopicName(item.name)
        setEditTopicTextbookId(item.textbook_id)
        setError('')
    }

    const cancelEditTopic = () => {
        setEditingTopicId(null)
        setEditTopicName('')
        setEditTopicTextbookId(null)
    }

    const handleUpdateTopic = async () => {
        if (editingTopicId === null) return
        const trimmed = editTopicName.trim()
        if (!trimmed) {
            setError('Topic name is required')
            return
        }
        if (!editTopicTextbookId) {
            setError('Select a textbook for this topic')
            return
        }

        setIsUpdatingTopic(true)
        setError('')
        try {
            const res = await fetch(`/api/topics/${editingTopicId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: trimmed, textbook_id: editTopicTextbookId }),
            })
            const json = await res.json()
            if (!res.ok) throw new Error(json.error || 'Failed to update topic')

            if (topicsTextbookId) {
                await loadTopicsForTextbook(topicsTextbookId)
            }
            if (subtopicsTextbookId) {
                await loadSubtopicTopicsForTextbook(subtopicsTextbookId)
            }
            cancelEditTopic()
        } catch (err: any) {
            setError(err?.message || 'Failed to update topic')
        } finally {
            setIsUpdatingTopic(false)
        }
    }

    const handleDeleteTopic = async (id: number) => {
        const confirmed = window.confirm('Delete this topic? This will remove related subtopics.')
        if (!confirmed) return

        setError('')
        try {
            const res = await fetch(`/api/topics/${id}`, { method: 'DELETE' })
            const json = await res.json()
            if (!res.ok) throw new Error(json.error || 'Failed to delete topic')

            if (editingTopicId === id) cancelEditTopic()
            if (topicsTextbookId) {
                await loadTopicsForTextbook(topicsTextbookId)
            }
            if (subtopicsTextbookId) {
                await loadSubtopicTopicsForTextbook(subtopicsTextbookId)
            }
        } catch (err: any) {
            setError(err?.message || 'Failed to delete topic')
        }
    }

    const handleCreateSubtopic = async () => {
        const trimmed = createSubtopicName.trim()
        if (!trimmed) {
            setError('Subtopic name is required')
            return
        }
        if (!subtopicsTextbookId) {
            setError('Select a textbook for this subtopic')
            return
        }
        if (!subtopicsTopicId) {
            setError('Select a topic for this subtopic')
            return
        }

        setIsSavingSubtopic(true)
        setError('')
        try {
            const res = await fetch('/api/subtopics', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: trimmed,
                    textbook_id: subtopicsTextbookId,
                    topic_id: subtopicsTopicId,
                }),
            })
            const json = await res.json()
            if (!res.ok) throw new Error(json.error || 'Failed to create subtopic')

            setCreateSubtopicName('')
            await loadSubtopicsForTopic(subtopicsTopicId, subtopicsTextbookId)
        } catch (err: any) {
            setError(err?.message || 'Failed to create subtopic')
        } finally {
            setIsSavingSubtopic(false)
        }
    }

    const startEditSubtopic = (item: Subtopic) => {
        setEditingSubtopicId(item.id)
        setEditSubtopicName(item.name)
        setEditSubtopicTopicId(item.topic_id)
        setError('')
    }

    const cancelEditSubtopic = () => {
        setEditingSubtopicId(null)
        setEditSubtopicName('')
        setEditSubtopicTopicId(null)
    }

    const handleUpdateSubtopic = async () => {
        if (editingSubtopicId === null) return
        const trimmed = editSubtopicName.trim()
        if (!trimmed) {
            setError('Subtopic name is required')
            return
        }
        if (!subtopicsTextbookId) {
            setError('Select a textbook for this subtopic')
            return
        }
        if (!editSubtopicTopicId) {
            setError('Select a topic for this subtopic')
            return
        }

        setIsUpdatingSubtopic(true)
        setError('')
        try {
            const res = await fetch(`/api/subtopics/${editingSubtopicId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: trimmed,
                    topic_id: editSubtopicTopicId,
                    textbook_id: subtopicsTextbookId,
                }),
            })
            const json = await res.json()
            if (!res.ok) throw new Error(json.error || 'Failed to update subtopic')

            if (subtopicsTopicId) {
                await loadSubtopicsForTopic(subtopicsTopicId, subtopicsTextbookId)
            }
            cancelEditSubtopic()
        } catch (err: any) {
            setError(err?.message || 'Failed to update subtopic')
        } finally {
            setIsUpdatingSubtopic(false)
        }
    }

    const handleDeleteSubtopic = async (id: number) => {
        const confirmed = window.confirm('Delete this subtopic? This cannot be undone.')
        if (!confirmed) return

        setError('')
        try {
            const res = await fetch(`/api/subtopics/${id}`, { method: 'DELETE' })
            const json = await res.json()
            if (!res.ok) throw new Error(json.error || 'Failed to delete subtopic')

            if (editingSubtopicId === id) cancelEditSubtopic()
            if (subtopicsTopicId) {
                await loadSubtopicsForTopic(subtopicsTopicId, subtopicsTextbookId)
            }
        } catch (err: any) {
            setError(err?.message || 'Failed to delete subtopic')
        }
    }

    return (
        <div className="min-h-screen bg-[#F3F4F6] dark:bg-[#0C0C0E] transition-colors duration-300">
            <div className="max-w-6xl mx-auto px-4 sm:px-8 py-8 space-y-8">
                <div className="flex flex-col gap-2">
                    <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-gray-400">Edit Books</p>
                    <h1 className="text-3xl sm:text-4xl font-black text-gray-900 dark:text-white">Manage textbooks, topics, and subtopics</h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400 max-w-2xl">
                        Add new textbooks, keep topics aligned to the right book, and refine subtopics without leaving the dashboard.
                    </p>
                </div>

                {error && (
                    <div className="border border-red-200 bg-red-50 text-red-700 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-300 rounded-xl px-4 py-3 text-sm">
                        {error}
                    </div>
                )}

                {loading ? (
                    <div className="flex items-center justify-center py-24">
                        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                    </div>
                ) : (
                    <div className="space-y-10">
                        <section className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <BookOpen className="w-5 h-5 text-blue-600" />
                                    <h2 className="text-lg font-bold text-gray-900 dark:text-white">Textbooks</h2>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-gray-400">{textbooks.length} total</span>
                                    <button
                                        type="button"
                                        onClick={() => setIsTextbooksOpen((prev) => !prev)}
                                        aria-expanded={isTextbooksOpen}
                                        aria-controls="textbooks-section"
                                        className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-white/[0.08] dark:text-gray-300 dark:hover:bg-white/[0.05]"
                                    >
                                        {isTextbooksOpen ? 'Collapse' : 'Expand'}
                                        <ChevronDown className={`w-4 h-4 transition-transform ${isTextbooksOpen ? 'rotate-180' : ''}`} />
                                    </button>
                                </div>
                            </div>

                            {isTextbooksOpen && (
                                <div id="textbooks-section" className="grid grid-cols-1 lg:grid-cols-[360px,1fr] gap-6">
                                    <div className="bg-white dark:bg-gray-950 rounded-2xl border border-gray-200/60 dark:border-white/[0.08] shadow-sm p-5 space-y-4">
                                        <div className="flex items-center gap-2 text-sm font-bold text-gray-900 dark:text-white">
                                            <Plus className="w-4 h-4 text-blue-600" />
                                            New Textbook
                                        </div>

                                        <div>
                                            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wide">
                                                Textbook name
                                            </label>
                                            <input
                                                type="text"
                                                value={createTextbookName}
                                                onChange={(e) => setCreateTextbookName(e.target.value)}
                                                placeholder="e.g. Mathematics S4"
                                                className="w-full px-3 py-2.5 rounded-xl text-sm bg-gray-50 dark:bg-white/[0.05] border border-gray-200 dark:border-white/[0.08] focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all text-gray-900 dark:text-white"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wide">
                                                Filename (optional)
                                            </label>
                                            <input
                                                type="text"
                                                value={createTextbookFilename}
                                                onChange={(e) => setCreateTextbookFilename(e.target.value)}
                                                placeholder="math_s4.pdf"
                                                className="w-full px-3 py-2.5 rounded-xl text-sm bg-gray-50 dark:bg-white/[0.05] border border-gray-200 dark:border-white/[0.08] focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all text-gray-900 dark:text-white"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wide">
                                                Curriculum
                                            </label>
                                            <select
                                                value={createTextbookCurriculum}
                                                onChange={(e) => setCreateTextbookCurriculum(e.target.value)}
                                                className="w-full px-3 py-2.5 rounded-xl text-sm bg-gray-50 dark:bg-white/[0.05] border border-gray-200 dark:border-white/[0.08] focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all text-gray-900 dark:text-white"
                                            >
                                                <option value="">Use default</option>
                                                <option value="0">REB</option>
                                                <option value="1">Cambridge</option>
                                            </select>
                                        </div>

                                        <button
                                            type="button"
                                            onClick={handleCreateTextbook}
                                            disabled={isSavingTextbook}
                                            className="w-full flex items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-semibold py-3 transition-colors"
                                        >
                                            {isSavingTextbook ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                            Save textbook
                                        </button>
                                    </div>

                                    <div className="space-y-4">
                                        <div className="relative">
                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                            <input
                                                type="text"
                                                value={textbookSearch}
                                                onChange={(e) => setTextbookSearch(e.target.value)}
                                                placeholder="Search textbooks"
                                                className="w-full pl-9 pr-3 py-2.5 rounded-xl text-sm bg-white dark:bg-gray-950 border border-gray-200 dark:border-white/[0.08] focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all text-gray-900 dark:text-white"
                                            />
                                        </div>

                                        {filteredTextbooks.length === 0 ? (
                                            <div className="bg-white dark:bg-gray-950 border border-dashed border-gray-200 dark:border-white/[0.08] rounded-2xl p-8 text-center text-sm text-gray-400">
                                                No textbooks yet. Create your first textbook on the left.
                                            </div>
                                        ) : (
                                            filteredTextbooks.map((item) => (
                                                <div
                                                    key={item.id}
                                                    className="bg-white dark:bg-gray-950 rounded-2xl border border-gray-200/60 dark:border-white/[0.08] shadow-sm p-5 space-y-3"
                                                >
                                                    <div className="flex items-start justify-between gap-3">
                                                        <div>
                                                            <h3 className="text-base font-bold text-gray-900 dark:text-white">{item.name}</h3>
                                                            <p className="text-xs text-gray-400">
                                                                {item.filename ? item.filename : 'No file attached'}
                                                            </p>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-600 dark:bg-gray-900 dark:text-gray-400">
                                                                {curriculumLabel(item.curriculum)}
                                                            </span>
                                                            <button
                                                                type="button"
                                                                onClick={() => startEditTextbook(item)}
                                                                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
                                                            >
                                                                <Pencil className="w-3.5 h-3.5" />
                                                                Edit
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleDeleteTextbook(item.id)}
                                                                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-300 dark:hover:bg-red-900/50"
                                                            >
                                                                <Trash2 className="w-3.5 h-3.5" />
                                                                Delete
                                                            </button>
                                                        </div>
                                                    </div>

                                                    {editingTextbookId === item.id && (
                                                        <div className="pt-4 border-t border-gray-100 dark:border-white/[0.08] space-y-4">
                                                            <div className="flex items-center justify-between">
                                                                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                                                                    Edit textbook
                                                                </p>
                                                                <button
                                                                    type="button"
                                                                    onClick={cancelEditTextbook}
                                                                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                                                                >
                                                                    <X className="w-4 h-4" />
                                                                </button>
                                                            </div>

                                                            <div>
                                                                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wide">
                                                                    Textbook name
                                                                </label>
                                                                <input
                                                                    type="text"
                                                                    value={editTextbookName}
                                                                    onChange={(e) => setEditTextbookName(e.target.value)}
                                                                    className="w-full px-3 py-2.5 rounded-xl text-sm bg-gray-50 dark:bg-white/[0.05] border border-gray-200 dark:border-white/[0.08] focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all text-gray-900 dark:text-white"
                                                                />
                                                            </div>

                                                            <div>
                                                                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wide">
                                                                    Filename
                                                                </label>
                                                                <input
                                                                    type="text"
                                                                    value={editTextbookFilename}
                                                                    onChange={(e) => setEditTextbookFilename(e.target.value)}
                                                                    className="w-full px-3 py-2.5 rounded-xl text-sm bg-gray-50 dark:bg-white/[0.05] border border-gray-200 dark:border-white/[0.08] focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all text-gray-900 dark:text-white"
                                                                />
                                                            </div>

                                                            <div>
                                                                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wide">
                                                                    Curriculum
                                                                </label>
                                                                <select
                                                                    value={editTextbookCurriculum}
                                                                    onChange={(e) => setEditTextbookCurriculum(e.target.value)}
                                                                    className="w-full px-3 py-2.5 rounded-xl text-sm bg-gray-50 dark:bg-white/[0.05] border border-gray-200 dark:border-white/[0.08] focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all text-gray-900 dark:text-white"
                                                                >
                                                                    <option value="">Use default</option>
                                                                    <option value="0">REB</option>
                                                                    <option value="1">Cambridge</option>
                                                                </select>
                                                            </div>

                                                            <div className="flex items-center gap-2">
                                                                <button
                                                                    type="button"
                                                                    onClick={handleUpdateTextbook}
                                                                    disabled={isUpdatingTextbook}
                                                                    className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-semibold py-3 transition-colors"
                                                                >
                                                                    {isUpdatingTextbook ? (
                                                                        <Loader2 className="w-4 h-4 animate-spin" />
                                                                    ) : (
                                                                        <Save className="w-4 h-4" />
                                                                    )}
                                                                    Save changes
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={cancelEditTextbook}
                                                                    className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-white/[0.08] dark:text-gray-300 dark:hover:bg-white/[0.05] text-sm font-semibold py-3 transition-colors"
                                                                >
                                                                    Cancel
                                                                </button>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            )}
                        </section>

                        <section className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Layers className="w-5 h-5 text-blue-600" />
                                    <h2 className="text-lg font-bold text-gray-900 dark:text-white">Topics</h2>
                                </div>
                                <div className="flex flex-wrap items-center gap-2 text-xs text-gray-400">
                                    <div className="flex items-center gap-2">
                                        <span>Textbook</span>
                                        <select
                                            value={topicsTextbookId?.toString() ?? ''}
                                            onChange={(e) => setTopicsTextbookId(e.target.value ? Number(e.target.value) : null)}
                                            className="px-2 py-1 rounded-lg bg-white dark:bg-gray-950 border border-gray-200 dark:border-white/[0.08] text-gray-700 dark:text-gray-300"
                                        >
                                            {textbooks.length === 0 && <option value="">No textbooks</option>}
                                            {textbooks.map((textbook) => (
                                                <option key={textbook.id} value={textbook.id}>
                                                    {textbook.name}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setIsTopicsOpen((prev) => !prev)}
                                        aria-expanded={isTopicsOpen}
                                        aria-controls="topics-section"
                                        className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-white/[0.08] dark:text-gray-300 dark:hover:bg-white/[0.05]"
                                    >
                                        {isTopicsOpen ? 'Collapse' : 'Expand'}
                                        <ChevronDown className={`w-4 h-4 transition-transform ${isTopicsOpen ? 'rotate-180' : ''}`} />
                                    </button>
                                </div>
                            </div>

                            {isTopicsOpen && (
                                <div id="topics-section" className="grid grid-cols-1 lg:grid-cols-[360px,1fr] gap-6">
                                    <div className="bg-white dark:bg-gray-950 rounded-2xl border border-gray-200/60 dark:border-white/[0.08] shadow-sm p-5 space-y-4">
                                        <div className="flex items-center gap-2 text-sm font-bold text-gray-900 dark:text-white">
                                            <Plus className="w-4 h-4 text-blue-600" />
                                            New Topic
                                        </div>

                                        <div>
                                            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wide">
                                                Textbook
                                            </label>
                                            <select
                                                value={topicsTextbookId?.toString() ?? ''}
                                                onChange={(e) => setTopicsTextbookId(e.target.value ? Number(e.target.value) : null)}
                                                className="w-full px-3 py-2.5 rounded-xl text-sm bg-gray-50 dark:bg-white/[0.05] border border-gray-200 dark:border-white/[0.08] focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all text-gray-900 dark:text-white"
                                            >
                                                {textbooks.length === 0 && <option value="">No textbooks</option>}
                                                {textbooks.map((textbook) => (
                                                    <option key={textbook.id} value={textbook.id}>
                                                        {textbook.name}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>

                                        <div>
                                            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wide">
                                                Topic name
                                            </label>
                                            <input
                                                type="text"
                                                value={createTopicName}
                                                onChange={(e) => setCreateTopicName(e.target.value)}
                                                placeholder="e.g. Algebra"
                                                className="w-full px-3 py-2.5 rounded-xl text-sm bg-gray-50 dark:bg-white/[0.05] border border-gray-200 dark:border-white/[0.08] focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all text-gray-900 dark:text-white"
                                            />
                                        </div>

                                        <button
                                            type="button"
                                            onClick={handleCreateTopic}
                                            disabled={isSavingTopic || !topicsTextbookId}
                                            className="w-full flex items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-semibold py-3 transition-colors"
                                        >
                                            {isSavingTopic ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                            Save topic
                                        </button>
                                    </div>

                                    <div className="space-y-4">
                                        <div className="relative">
                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                            <input
                                                type="text"
                                                value={topicSearch}
                                                onChange={(e) => setTopicSearch(e.target.value)}
                                                placeholder="Search topics"
                                                className="w-full pl-9 pr-3 py-2.5 rounded-xl text-sm bg-white dark:bg-gray-950 border border-gray-200 dark:border-white/[0.08] focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all text-gray-900 dark:text-white"
                                            />
                                        </div>

                                        {isLoadingTopics ? (
                                            <div className="flex items-center justify-center py-10">
                                                <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                                            </div>
                                        ) : filteredTopics.length === 0 ? (
                                            <div className="bg-white dark:bg-gray-950 border border-dashed border-gray-200 dark:border-white/[0.08] rounded-2xl p-8 text-center text-sm text-gray-400">
                                                No topics for this textbook yet.
                                            </div>
                                        ) : (
                                            filteredTopics.map((item) => (
                                                <div
                                                    key={item.id}
                                                    className="bg-white dark:bg-gray-950 rounded-2xl border border-gray-200/60 dark:border-white/[0.08] shadow-sm p-5 space-y-3"
                                                >
                                                    <div className="flex items-start justify-between gap-3">
                                                        <div>
                                                            <h3 className="text-base font-bold text-gray-900 dark:text-white">{item.name}</h3>
                                                            <p className="text-xs text-gray-400">
                                                                {textbookMap.get(item.textbook_id)?.name ?? 'Unknown textbook'}
                                                            </p>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <button
                                                                type="button"
                                                                onClick={() => startEditTopic(item)}
                                                                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
                                                            >
                                                                <Pencil className="w-3.5 h-3.5" />
                                                                Edit
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleDeleteTopic(item.id)}
                                                                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-300 dark:hover:bg-red-900/50"
                                                            >
                                                                <Trash2 className="w-3.5 h-3.5" />
                                                                Delete
                                                            </button>
                                                        </div>
                                                    </div>

                                                    {editingTopicId === item.id && (
                                                        <div className="pt-4 border-t border-gray-100 dark:border-white/[0.08] space-y-4">
                                                            <div className="flex items-center justify-between">
                                                                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                                                                    Edit topic
                                                                </p>
                                                                <button
                                                                    type="button"
                                                                    onClick={cancelEditTopic}
                                                                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                                                                >
                                                                    <X className="w-4 h-4" />
                                                                </button>
                                                            </div>

                                                            <div>
                                                                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wide">
                                                                    Topic name
                                                                </label>
                                                                <input
                                                                    type="text"
                                                                    value={editTopicName}
                                                                    onChange={(e) => setEditTopicName(e.target.value)}
                                                                    className="w-full px-3 py-2.5 rounded-xl text-sm bg-gray-50 dark:bg-white/[0.05] border border-gray-200 dark:border-white/[0.08] focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all text-gray-900 dark:text-white"
                                                                />
                                                            </div>

                                                            <div>
                                                                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wide">
                                                                    Textbook
                                                                </label>
                                                                <select
                                                                    value={editTopicTextbookId?.toString() ?? ''}
                                                                    onChange={(e) => setEditTopicTextbookId(e.target.value ? Number(e.target.value) : null)}
                                                                    className="w-full px-3 py-2.5 rounded-xl text-sm bg-gray-50 dark:bg-white/[0.05] border border-gray-200 dark:border-white/[0.08] focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all text-gray-900 dark:text-white"
                                                                >
                                                                    {textbooks.map((textbook) => (
                                                                        <option key={textbook.id} value={textbook.id}>
                                                                            {textbook.name}
                                                                        </option>
                                                                    ))}
                                                                </select>
                                                            </div>

                                                            <div className="flex items-center gap-2">
                                                                <button
                                                                    type="button"
                                                                    onClick={handleUpdateTopic}
                                                                    disabled={isUpdatingTopic}
                                                                    className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-semibold py-3 transition-colors"
                                                                >
                                                                    {isUpdatingTopic ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                                                    Save changes
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={cancelEditTopic}
                                                                    className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-white/[0.08] dark:text-gray-300 dark:hover:bg-white/[0.05] text-sm font-semibold py-3 transition-colors"
                                                                >
                                                                    Cancel
                                                                </button>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            )}
                        </section>

                        <section className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <ListTree className="w-5 h-5 text-blue-600" />
                                    <h2 className="text-lg font-bold text-gray-900 dark:text-white">Subtopics</h2>
                                </div>
                                <div className="flex flex-wrap items-center gap-2 text-xs text-gray-400">
                                    <div className="flex items-center gap-2">
                                        <span>Textbook</span>
                                        <select
                                            value={subtopicsTextbookId?.toString() ?? ''}
                                            onChange={(e) => setSubtopicsTextbookId(e.target.value ? Number(e.target.value) : null)}
                                            className="px-2 py-1 rounded-lg bg-white dark:bg-gray-950 border border-gray-200 dark:border-white/[0.08] text-gray-700 dark:text-gray-300"
                                        >
                                            {textbooks.length === 0 && <option value="">No textbooks</option>}
                                            {textbooks.map((textbook) => (
                                                <option key={textbook.id} value={textbook.id}>
                                                    {textbook.name}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <span>Topic</span>
                                        <select
                                            value={subtopicsTopicId?.toString() ?? ''}
                                            onChange={(e) => setSubtopicsTopicId(e.target.value ? Number(e.target.value) : null)}
                                            className="px-2 py-1 rounded-lg bg-white dark:bg-gray-950 border border-gray-200 dark:border-white/[0.08] text-gray-700 dark:text-gray-300"
                                        >
                                            {subtopicTopics.length === 0 && <option value="">No topics</option>}
                                            {subtopicTopics.map((topic) => (
                                                <option key={topic.id} value={topic.id}>
                                                    {topic.name}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={() => setIsSubtopicsOpen((prev) => !prev)}
                                        aria-expanded={isSubtopicsOpen}
                                        aria-controls="subtopics-section"
                                        className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-white/[0.08] dark:text-gray-300 dark:hover:bg-white/[0.05]"
                                    >
                                        {isSubtopicsOpen ? 'Collapse' : 'Expand'}
                                        <ChevronDown className={`w-4 h-4 transition-transform ${isSubtopicsOpen ? 'rotate-180' : ''}`} />
                                    </button>
                                </div>
                            </div>

                            {isSubtopicsOpen && (
                                <div id="subtopics-section" className="grid grid-cols-1 lg:grid-cols-[360px,1fr] gap-6">
                                    <div className="bg-white dark:bg-gray-950 rounded-2xl border border-gray-200/60 dark:border-white/[0.08] shadow-sm p-5 space-y-4">
                                        <div className="flex items-center gap-2 text-sm font-bold text-gray-900 dark:text-white">
                                            <Plus className="w-4 h-4 text-blue-600" />
                                            New Subtopic
                                        </div>

                                        <div>
                                            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wide">
                                                Textbook
                                            </label>
                                            <select
                                                value={subtopicsTextbookId?.toString() ?? ''}
                                                onChange={(e) => setSubtopicsTextbookId(e.target.value ? Number(e.target.value) : null)}
                                                className="w-full px-3 py-2.5 rounded-xl text-sm bg-gray-50 dark:bg-white/[0.05] border border-gray-200 dark:border-white/[0.08] focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all text-gray-900 dark:text-white"
                                            >
                                                {textbooks.length === 0 && <option value="">No textbooks</option>}
                                                {textbooks.map((textbook) => (
                                                    <option key={textbook.id} value={textbook.id}>
                                                        {textbook.name}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>

                                        <div>
                                            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wide">
                                                Topic
                                            </label>
                                            <select
                                                value={subtopicsTopicId?.toString() ?? ''}
                                                onChange={(e) => setSubtopicsTopicId(e.target.value ? Number(e.target.value) : null)}
                                                className="w-full px-3 py-2.5 rounded-xl text-sm bg-gray-50 dark:bg-white/[0.05] border border-gray-200 dark:border-white/[0.08] focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all text-gray-900 dark:text-white"
                                            >
                                                {subtopicTopics.length === 0 && <option value="">No topics</option>}
                                                {subtopicTopics.map((topic) => (
                                                    <option key={topic.id} value={topic.id}>
                                                        {topic.name}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>

                                        <div>
                                            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wide">
                                                Subtopic name
                                            </label>
                                            <input
                                                type="text"
                                                value={createSubtopicName}
                                                onChange={(e) => setCreateSubtopicName(e.target.value)}
                                                placeholder="e.g. Quadratic equations"
                                                className="w-full px-3 py-2.5 rounded-xl text-sm bg-gray-50 dark:bg-white/[0.05] border border-gray-200 dark:border-white/[0.08] focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all text-gray-900 dark:text-white"
                                            />
                                        </div>

                                        <button
                                            type="button"
                                            onClick={handleCreateSubtopic}
                                            disabled={isSavingSubtopic || !subtopicsTextbookId || !subtopicsTopicId}
                                            className="w-full flex items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-semibold py-3 transition-colors"
                                        >
                                            {isSavingSubtopic ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                            Save subtopic
                                        </button>
                                    </div>

                                    <div className="space-y-4">
                                        <div className="relative">
                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                            <input
                                                type="text"
                                                value={subtopicSearch}
                                                onChange={(e) => setSubtopicSearch(e.target.value)}
                                                placeholder="Search subtopics"
                                                className="w-full pl-9 pr-3 py-2.5 rounded-xl text-sm bg-white dark:bg-gray-950 border border-gray-200 dark:border-white/[0.08] focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all text-gray-900 dark:text-white"
                                            />
                                        </div>

                                        {isLoadingSubtopicTopics || isLoadingSubtopics ? (
                                            <div className="flex items-center justify-center py-10">
                                                <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                                            </div>
                                        ) : filteredSubtopics.length === 0 ? (
                                            <div className="bg-white dark:bg-gray-950 border border-dashed border-gray-200 dark:border-white/[0.08] rounded-2xl p-8 text-center text-sm text-gray-400">
                                                No subtopics for this topic yet.
                                            </div>
                                        ) : (
                                            filteredSubtopics.map((item) => (
                                                <div
                                                    key={item.id}
                                                    className="bg-white dark:bg-gray-950 rounded-2xl border border-gray-200/60 dark:border-white/[0.08] shadow-sm p-5 space-y-3"
                                                >
                                                    <div className="flex items-start justify-between gap-3">
                                                        <div>
                                                            <h3 className="text-base font-bold text-gray-900 dark:text-white">{item.name}</h3>
                                                            <p className="text-xs text-gray-400">
                                                                {subtopicTopicMap.get(item.topic_id)?.name ?? 'Unknown topic'}
                                                            </p>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <button
                                                                type="button"
                                                                onClick={() => startEditSubtopic(item)}
                                                                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
                                                            >
                                                                <Pencil className="w-3.5 h-3.5" />
                                                                Edit
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleDeleteSubtopic(item.id)}
                                                                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-300 dark:hover:bg-red-900/50"
                                                            >
                                                                <Trash2 className="w-3.5 h-3.5" />
                                                                Delete
                                                            </button>
                                                        </div>
                                                    </div>

                                                    {editingSubtopicId === item.id && (
                                                        <div className="pt-4 border-t border-gray-100 dark:border-white/[0.08] space-y-4">
                                                            <div className="flex items-center justify-between">
                                                                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                                                                    Edit subtopic
                                                                </p>
                                                                <button
                                                                    type="button"
                                                                    onClick={cancelEditSubtopic}
                                                                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                                                                >
                                                                    <X className="w-4 h-4" />
                                                                </button>
                                                            </div>

                                                            <div>
                                                                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wide">
                                                                    Subtopic name
                                                                </label>
                                                                <input
                                                                    type="text"
                                                                    value={editSubtopicName}
                                                                    onChange={(e) => setEditSubtopicName(e.target.value)}
                                                                    className="w-full px-3 py-2.5 rounded-xl text-sm bg-gray-50 dark:bg-white/[0.05] border border-gray-200 dark:border-white/[0.08] focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all text-gray-900 dark:text-white"
                                                                />
                                                            </div>

                                                            <div>
                                                                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wide">
                                                                    Topic
                                                                </label>
                                                                <select
                                                                    value={editSubtopicTopicId?.toString() ?? ''}
                                                                    onChange={(e) => setEditSubtopicTopicId(e.target.value ? Number(e.target.value) : null)}
                                                                    className="w-full px-3 py-2.5 rounded-xl text-sm bg-gray-50 dark:bg-white/[0.05] border border-gray-200 dark:border-white/[0.08] focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all text-gray-900 dark:text-white"
                                                                >
                                                                    {subtopicTopics.map((topic) => (
                                                                        <option key={topic.id} value={topic.id}>
                                                                            {topic.name}
                                                                        </option>
                                                                    ))}
                                                                </select>
                                                            </div>

                                                            <div className="flex items-center gap-2">
                                                                <button
                                                                    type="button"
                                                                    onClick={handleUpdateSubtopic}
                                                                    disabled={isUpdatingSubtopic}
                                                                    className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-semibold py-3 transition-colors"
                                                                >
                                                                    {isUpdatingSubtopic ? (
                                                                        <Loader2 className="w-4 h-4 animate-spin" />
                                                                    ) : (
                                                                        <Save className="w-4 h-4" />
                                                                    )}
                                                                    Save changes
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={cancelEditSubtopic}
                                                                    className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-white/[0.08] dark:text-gray-300 dark:hover:bg-white/[0.05] text-sm font-semibold py-3 transition-colors"
                                                                >
                                                                    Cancel
                                                                </button>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            )}
                        </section>
                    </div>
                )}
            </div>
        </div>
    )
}
