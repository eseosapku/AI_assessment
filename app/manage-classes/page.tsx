'use client'

import { useEffect, useMemo, useState } from 'react'
import { Loader2, Plus, Save, Search, Trash2, X, Pencil } from 'lucide-react'
import { useAuth } from '@/components/AuthProvider'
import { normalizeCountry } from '@/lib/countries'
import { curriculumShortLabel, isExamPrepCurriculumNumeric } from '@/lib/curriculum-registry'

interface Textbook {
    id: number
    name: string
    filename?: string | null
    curriculum?: number | null
}

interface ClassItem {
    id: number
    name: string
    textbooks: Textbook[]
    textbook_ids: number[]
}

function TextbookSelector({
    textbooks,
    selectedIds,
    onToggle,
    search,
    onSearch,
}: {
    textbooks: Textbook[]
    selectedIds: number[]
    onToggle: (id: number) => void
    search: string
    onSearch: (value: string) => void
}) {
    const filtered = useMemo(() => {
        const term = search.trim().toLowerCase()
        if (!term) return textbooks
        return textbooks.filter((t) => t.name.toLowerCase().includes(term))
    }, [textbooks, search])

    return (
        <div className="space-y-3">
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                    type="text"
                    value={search}
                    onChange={(e) => onSearch(e.target.value)}
                    placeholder="Search textbooks"
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl text-sm bg-gray-50 dark:bg-white/[0.05] border border-gray-200 dark:border-white/[0.08] focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all text-gray-900 dark:text-white"
                />
            </div>

            <div className="flex items-center justify-between text-[11px] text-gray-400">
                <span>{filtered.length} results</span>
                <span>{selectedIds.length} selected</span>
            </div>

            <div className="max-h-56 overflow-auto rounded-xl border border-gray-200 dark:border-white/[0.08] bg-white dark:bg-gray-950 p-2">
                <div className="grid grid-cols-1 gap-2">
                    {filtered.map((textbook) => {
                        const selected = selectedIds.includes(textbook.id)
                        return (
                            <button
                                key={textbook.id}
                                type="button"
                                onClick={() => onToggle(textbook.id)}
                                className={`flex items-center justify-between gap-3 px-3 py-2 rounded-lg border text-xs text-left transition-all ${selected
                                        ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300'
                                        : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 dark:border-white/[0.08] dark:bg-gray-950 dark:text-gray-300 dark:hover:border-white/[0.2]'
                                    }`}
                            >
                                <span className="font-semibold truncate">{textbook.name}</span>
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${selected ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
                                    }`}
                                >
                                    {curriculumShortLabel(textbook.curriculum)}
                                </span>
                            </button>
                        )
                    })}

                    {filtered.length === 0 && (
                        <div className="py-6 text-center text-xs text-gray-400">No textbooks match this search.</div>
                    )}
                </div>
            </div>
        </div>
    )
}

export default function ManageClassesPage() {
    const { user } = useAuth()
    const userCountry = normalizeCountry(user?.country)
    const [textbooks, setTextbooks] = useState<Textbook[]>([])
    const [classes, setClasses] = useState<ClassItem[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')

    const [createName, setCreateName] = useState('')
    const [createSelectedIds, setCreateSelectedIds] = useState<number[]>([])
    const [createSearch, setCreateSearch] = useState('')
    const [isSaving, setIsSaving] = useState(false)

    const [editingId, setEditingId] = useState<number | null>(null)
    const [editName, setEditName] = useState('')
    const [editSelectedIds, setEditSelectedIds] = useState<number[]>([])
    const [editSearch, setEditSearch] = useState('')
    const [isUpdating, setIsUpdating] = useState(false)

    const textbookMap = useMemo(() => new Map(textbooks.map((t) => [t.id, t])), [textbooks])

    const schoolTextbooks = useMemo(
        () => textbooks.filter((t) => !isExamPrepCurriculumNumeric(t.curriculum)),
        [textbooks],
    )

    const loadData = async () => {
        setLoading(true)
        setError('')
        try {
            const [textbookRes, classRes] = await Promise.all([
                fetch('/api/textbooks'),
                fetch(`/api/classes?country=${userCountry}`),
            ])

            const textbookJson = await textbookRes.json()
            const classJson = await classRes.json()

            if (!textbookRes.ok) throw new Error(textbookJson.error || 'Failed to load textbooks')
            if (!classRes.ok) throw new Error(classJson.error || 'Failed to load classes')

            setTextbooks(textbookJson.data ?? [])
            setClasses(classJson.data ?? [])
        } catch (err: any) {
            setError(err?.message || 'Failed to load data')
        } finally {
            setLoading(false)
        }
    }

    const refreshClasses = async () => {
        try {
            const res = await fetch(`/api/classes?country=${userCountry}`)
            const json = await res.json()
            if (!res.ok) throw new Error(json.error || 'Failed to load classes')
            setClasses(json.data ?? [])
        } catch (err: any) {
            setError(err?.message || 'Failed to load classes')
        }
    }

    useEffect(() => {
        if (!user) return
        loadData()
    }, [userCountry, user?.id])

    const toggleCreateTextbook = (id: number) => {
        setCreateSelectedIds((prev) =>
            prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
        )
    }

    const toggleEditTextbook = (id: number) => {
        setEditSelectedIds((prev) =>
            prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
        )
    }

    const handleCreate = async () => {
        const trimmed = createName.trim()
        if (!trimmed) {
            setError('Class name is required')
            return
        }

        setIsSaving(true)
        setError('')
        try {
            const res = await fetch('/api/classes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: trimmed, textbook_ids: createSelectedIds, country: userCountry }),
            })
            const json = await res.json()
            if (!res.ok) throw new Error(json.error || 'Failed to create class')

            setCreateName('')
            setCreateSelectedIds([])
            setCreateSearch('')
            await refreshClasses()
        } catch (err: any) {
            setError(err?.message || 'Failed to create class')
        } finally {
            setIsSaving(false)
        }
    }

    const startEdit = (item: ClassItem) => {
        setEditingId(item.id)
        setEditName(item.name)
        setEditSelectedIds(item.textbook_ids ?? item.textbooks.map((t) => t.id))
        setEditSearch('')
        setError('')
    }

    const cancelEdit = () => {
        setEditingId(null)
        setEditName('')
        setEditSelectedIds([])
        setEditSearch('')
    }

    const handleUpdate = async () => {
        if (editingId === null) return
        const trimmed = editName.trim()
        if (!trimmed) {
            setError('Class name is required')
            return
        }

        setIsUpdating(true)
        setError('')
        try {
            const res = await fetch(`/api/classes/${editingId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: trimmed, textbook_ids: editSelectedIds }),
            })
            const json = await res.json()
            if (!res.ok) throw new Error(json.error || 'Failed to update class')

            await refreshClasses()
            cancelEdit()
        } catch (err: any) {
            setError(err?.message || 'Failed to update class')
        } finally {
            setIsUpdating(false)
        }
    }

    const handleDelete = async (id: number) => {
        const confirmed = window.confirm('Delete this class? This cannot be undone.')
        if (!confirmed) return

        setError('')
        try {
            const res = await fetch(`/api/classes/${id}`, { method: 'DELETE' })
            const json = await res.json()
            if (!res.ok) throw new Error(json.error || 'Failed to delete class')

            if (editingId === id) cancelEdit()
            await refreshClasses()
        } catch (err: any) {
            setError(err?.message || 'Failed to delete class')
        }
    }

    const renderSelectedTextbooks = (ids: number[]) => {
        if (ids.length === 0) {
            return <span className="text-xs text-gray-400">No textbooks selected yet.</span>
        }

        return (
            <div className="flex flex-wrap gap-2">
                {ids.map((id) => {
                    const textbook = textbookMap.get(id)
                    if (!textbook) return null
                    return (
                        <span
                            key={id}
                            className="px-2.5 py-1 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-600 dark:bg-gray-900 dark:text-gray-400"
                        >
                            {textbook.name}
                        </span>
                    )
                })}
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-[#F3F4F6] dark:bg-[#0C0C0E] transition-colors duration-300">
            <div className="max-w-6xl mx-auto px-4 sm:px-8 py-8 space-y-6">
                <div className="flex flex-col gap-2">
                    <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-gray-400">Manage Classes</p>
                    <h1 className="text-3xl sm:text-4xl font-black text-gray-900 dark:text-white">Create and assign textbooks</h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400 max-w-2xl">
                        Add classes, choose which textbooks (subjects) belong to each class, and update them anytime.
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
                    <div className="grid grid-cols-1 lg:grid-cols-[360px,1fr] gap-6">
                        <div className="bg-white dark:bg-gray-950 rounded-2xl border border-gray-200/60 dark:border-white/[0.08] shadow-sm p-5 space-y-5">
                            <div className="flex items-center gap-2 text-sm font-bold text-gray-900 dark:text-white">
                                <Plus className="w-4 h-4 text-blue-600" />
                                New Class
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wide">
                                    Class name
                                </label>
                                <input
                                    type="text"
                                    value={createName}
                                    onChange={(e) => setCreateName(e.target.value)}
                                    placeholder="e.g. S4 A"
                                    className="w-full px-3 py-2.5 rounded-xl text-sm bg-gray-50 dark:bg-white/[0.05] border border-gray-200 dark:border-white/[0.08] focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all text-gray-900 dark:text-white"
                                />
                            </div>

                            <div className="space-y-3">
                                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                                    Textbooks
                                </label>
                                <TextbookSelector
                                    textbooks={schoolTextbooks}
                                    selectedIds={createSelectedIds}
                                    onToggle={toggleCreateTextbook}
                                    search={createSearch}
                                    onSearch={setCreateSearch}
                                />
                                {renderSelectedTextbooks(createSelectedIds)}
                            </div>

                            <button
                                type="button"
                                onClick={handleCreate}
                                disabled={isSaving}
                                className="w-full flex items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-semibold py-3 transition-colors"
                            >
                                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                Save class
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-gray-400">Classes</p>
                                <span className="text-xs text-gray-400">{classes.length} total</span>
                            </div>

                            {classes.length === 0 ? (
                                <div className="bg-white dark:bg-gray-950 border border-dashed border-gray-200 dark:border-white/[0.08] rounded-2xl p-8 text-center text-sm text-gray-400">
                                    No classes yet. Create your first class on the left.
                                </div>
                            ) : (
                                classes.map((item) => (
                                    <div
                                        key={item.id}
                                        className="bg-white dark:bg-gray-950 rounded-2xl border border-gray-200/60 dark:border-white/[0.08] shadow-sm p-5 space-y-3"
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div>
                                                <h3 className="text-base font-bold text-gray-900 dark:text-white">{item.name}</h3>
                                                <p className="text-xs text-gray-400">{item.textbooks?.length ?? 0} textbooks</p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => startEdit(item)}
                                                    className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
                                                >
                                                    <Pencil className="w-3.5 h-3.5" />
                                                    Edit
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleDelete(item.id)}
                                                    className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-300 dark:hover:bg-red-900/50"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                    Delete
                                                </button>
                                            </div>
                                        </div>

                                        <div className="flex flex-wrap gap-2">
                                            {item.textbooks?.slice(0, 6).map((textbook) => (
                                                <span
                                                    key={textbook.id}
                                                    className="px-2.5 py-1 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-600 dark:bg-gray-900 dark:text-gray-400"
                                                >
                                                    {textbook.name}
                                                </span>
                                            ))}
                                            {item.textbooks?.length > 6 && (
                                                <span className="text-[10px] text-gray-400">+{item.textbooks.length - 6} more</span>
                                            )}
                                        </div>

                                        {editingId === item.id && (
                                            <div className="pt-4 border-t border-gray-100 dark:border-white/[0.08] space-y-4">
                                                <div className="flex items-center justify-between">
                                                    <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                                                        Edit class
                                                    </p>
                                                    <button
                                                        type="button"
                                                        onClick={cancelEdit}
                                                        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                                                    >
                                                        <X className="w-4 h-4" />
                                                    </button>
                                                </div>

                                                <div>
                                                    <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wide">
                                                        Class name
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={editName}
                                                        onChange={(e) => setEditName(e.target.value)}
                                                        className="w-full px-3 py-2.5 rounded-xl text-sm bg-gray-50 dark:bg-white/[0.05] border border-gray-200 dark:border-white/[0.08] focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all text-gray-900 dark:text-white"
                                                    />
                                                </div>

                                                <TextbookSelector
                                                    textbooks={schoolTextbooks}
                                                    selectedIds={editSelectedIds}
                                                    onToggle={toggleEditTextbook}
                                                    search={editSearch}
                                                    onSearch={setEditSearch}
                                                />

                                                {renderSelectedTextbooks(editSelectedIds)}

                                                <div className="flex items-center gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={handleUpdate}
                                                        disabled={isUpdating}
                                                        className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-semibold py-3 transition-colors"
                                                    >
                                                        {isUpdating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                                        Save changes
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={cancelEdit}
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
            </div>
        </div>
    )
}
