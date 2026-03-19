'use client'

import { motion } from 'framer-motion'
import { X, Send, Loader2, Plus, Trash2, Calendar } from 'lucide-react'
import { useState } from 'react'
import { useAuth } from './AuthProvider'

interface AssignModalProps {
  formData: {
    grade: number | null
    difficultyLevel: string
    curriculum: string
    subject: string
    topics: string[]
    count: number
    style: string
    questionType: string
  }
  onClose: () => void
}

export default function AssignModal({ formData, onClose }: AssignModalProps) {
  const { user } = useAuth()
  const [emails, setEmails] = useState<string[]>([''])
  const [deadline, setDeadline] = useState('')
  const [title, setTitle] = useState(`${formData.subject} Assessment`)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const addEmail = () => setEmails(prev => [...prev, ''])
  const removeEmail = (i: number) => setEmails(prev => prev.filter((_, idx) => idx !== i))
  const updateEmail = (i: number, val: string) => setEmails(prev => prev.map((e, idx) => idx === i ? val : e))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const validEmails = emails.map(e => e.trim()).filter(e => e.includes('@'))
    if (validEmails.length === 0) { setError('Add at least one valid student email'); return }

    setIsLoading(true)
    setError('')
    try {
      const res = await fetch('/api/assignments/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teacher_id: user?.id,
          teacher_name: user?.name,
          title,
          subject: formData.subject,
          topics: formData.topics,
          grade: formData.grade,
          curriculum: formData.curriculum,
          difficulty_level: formData.difficultyLevel,
          question_count: formData.count,
          style: formData.style,
          question_type: formData.questionType,
          student_emails: validEmails,
          deadline: deadline || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to send assignment')
      setSuccess(true)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  if (success) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.96, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          onClick={e => e.stopPropagation()}
          className="w-full max-w-sm bg-white dark:bg-gray-950 rounded-2xl p-8 text-center shadow-2xl border border-gray-200/60 dark:border-gray-800/60"
        >
          <div className="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mx-auto mb-4">
            <Send className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
          </div>
          <h3 className="text-base font-bold text-gray-900 dark:text-white mb-1">Assignment Sent!</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
            Students will see this in their dashboard.
          </p>
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors"
          >
            Done
          </button>
        </motion.div>
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.96, opacity: 0, y: 16 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        onClick={e => e.stopPropagation()}
        className="w-full max-w-md bg-white dark:bg-gray-950 rounded-2xl shadow-2xl border border-gray-200/60 dark:border-gray-800/60 flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100 dark:border-gray-800/60 flex-shrink-0">
          <div>
            <h2 className="text-base font-bold text-gray-900 dark:text-white">Assign to Students</h2>
            <p className="text-xs text-gray-400 mt-0.5">{formData.subject} · Grade {formData.grade}</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

          {/* Title */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wide">
              Assignment Title
            </label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              required
              className="w-full px-3 py-2.5 rounded-xl text-sm bg-gray-50 dark:bg-white/[0.05] border border-gray-200 dark:border-white/[0.08] focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all text-gray-900 dark:text-white"
            />
          </div>

          {/* Student emails */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wide">
              Student Emails
            </label>
            <div className="space-y-2">
              {emails.map((email, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="email"
                    value={email}
                    onChange={e => updateEmail(i, e.target.value)}
                    placeholder={`student${i + 1}@school.com`}
                    className="flex-1 px-3 py-2.5 rounded-xl text-sm bg-gray-50 dark:bg-white/[0.05] border border-gray-200 dark:border-white/[0.08] focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all text-gray-900 dark:text-white"
                  />
                  {emails.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeEmail(i)}
                      className="w-9 h-9 rounded-lg flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors flex-shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={addEmail}
                className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline mt-1"
              >
                <Plus className="w-3.5 h-3.5" />
                Add another student
              </button>
            </div>
          </div>

          {/* Deadline */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wide">
              Deadline <span className="normal-case font-normal text-gray-400">(optional)</span>
            </label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              <input
                type="datetime-local"
                value={deadline}
                onChange={e => setDeadline(e.target.value)}
                className="w-full pl-10 pr-3 py-2.5 rounded-xl text-sm bg-gray-50 dark:bg-white/[0.05] border border-gray-200 dark:border-white/[0.08] focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all text-gray-900 dark:text-white"
              />
            </div>
          </div>

          {/* Summary pill */}
          <div className="bg-gray-50 dark:bg-gray-900 rounded-xl px-4 py-3 text-xs text-gray-500 dark:text-gray-400 space-y-1 border border-gray-100 dark:border-gray-800">
            <p><span className="font-semibold text-gray-700 dark:text-gray-300">Subject:</span> {formData.subject}</p>
            <p><span className="font-semibold text-gray-700 dark:text-gray-300">Difficulty:</span> {formData.difficultyLevel}</p>
            <p><span className="font-semibold text-gray-700 dark:text-gray-300">Questions:</span> {formData.count} · {formData.questionType}</p>
          </div>

          {error && (
            <p className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/60 rounded-lg px-4 py-3">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-semibold py-3 rounded-xl transition-colors shadow-sm shadow-blue-900/20"
          >
            {isLoading ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Sending…</>
            ) : (
              <><Send className="w-4 h-4" /> Send Assignment</>
            )}
          </button>
        </form>
      </motion.div>
    </motion.div>
  )
}
