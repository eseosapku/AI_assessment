'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { User, Plus, Brain, Send, Calendar, BookOpen, ChevronDown, Users, Clock, ClipboardList } from 'lucide-react'
import { useState, useEffect } from 'react'
import Image from 'next/image'
import ThemeToggle from './ThemeToggle'
import ProfileSidebar from './ProfileSidebar'
import FlowForm from './FlowForm'
import AssignModal from './AssignModal'
import { useAuth } from './AuthProvider'

const DIFFICULTY_COLORS: Record<string, string> = {
  beginner:     'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20',
  average:      'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20',
  intermediate: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20',
  advanced:     'text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-900/20',
}

function formatDeadline(iso: string | null) {
  if (!iso) return 'No deadline'
  const d = new Date(iso)
  const now = new Date()
  const diff = d.getTime() - now.getTime()
  if (diff < 0) return 'Expired'
  const days = Math.floor(diff / 86400000)
  if (days === 0) return 'Due today'
  if (days === 1) return 'Due tomorrow'
  return `Due in ${days} days`
}

export default function TeacherDashboard() {
  const { user } = useAuth()
  const [isProfileOpen, setIsProfileOpen] = useState(false)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [assignData, setAssignData] = useState<{ formData: any } | null>(null)
  const [assignments, setAssignments] = useState<any[]>([])
  const [isLoadingAssignments, setIsLoadingAssignments] = useState(true)

  const firstName = user?.name?.split(' ')[0] || 'Teacher'

  useEffect(() => {
    if (!user?.id) return
    fetch(`/api/assignments/teacher?teacher_id=${user.id}`)
      .then(r => r.json())
      .then(d => setAssignments(d.assignments ?? []))
      .catch(console.error)
      .finally(() => setIsLoadingAssignments(false))
  }, [user])

  const handleAssign = (formData: any) => {
    setAssignData({ formData })
  }

  const activeCount = assignments.filter(a => !a.deadline || new Date(a.deadline) > new Date()).length
  const totalStudents = assignments.reduce((acc, a) => acc + (a.student_emails?.length ?? 0), 0)

  return (
    <div className="min-h-screen bg-[#F3F4F6] dark:bg-[#0C0C0E] transition-colors duration-300 flex flex-col">

      {/* Header */}
      <header className="sticky top-0 z-30 h-14 bg-white/75 dark:bg-[#0C0C0E]/80 backdrop-blur-xl border-b border-black/[0.06] dark:border-white/[0.06]">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 h-full flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Image src="/logo.png" alt="Brain Ink" width={120} height={68} className="h-8 w-auto object-contain" priority />
            <span className="text-xs font-bold text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-900/30 px-2 py-0.5 rounded-md">Teacher</span>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <div className="w-px h-4 bg-gray-200 dark:bg-gray-800 mx-1" />
            <button
              onClick={() => setIsProfileOpen(true)}
              className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
            >
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-600 to-blue-600 flex items-center justify-center">
                <User className="w-3.5 h-3.5 text-white" />
              </div>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300 hidden sm:block">{firstName}</span>
              <ChevronDown className="w-3.5 h-3.5 text-gray-400 hidden sm:block" />
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-6xl mx-auto px-4 sm:px-8 py-6 w-full space-y-4">

        {/* Hero panel */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-3xl bg-[#0F172A] dark:bg-[#080B14] p-7 sm:p-10"
        >
          <div className="absolute inset-0 pointer-events-none" style={{
            backgroundImage: 'linear-gradient(rgba(139,92,246,0.12) 1px, transparent 1px), linear-gradient(90deg, rgba(139,92,246,0.12) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }} />
          <div className="absolute -top-20 -right-20 w-72 h-72 bg-violet-600/20 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-10 left-20 w-48 h-48 bg-blue-600/15 rounded-full blur-3xl pointer-events-none" />

          <div className="relative">
            <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-violet-400 mb-3">Teacher Dashboard</p>
            <h1 className="text-4xl sm:text-5xl font-black text-white leading-none mb-8 tracking-tight">
              {firstName}<span className="text-violet-500">.</span>
            </h1>

            <div className="flex flex-wrap items-end gap-x-8 gap-y-5">
              <div>
                <p className="text-3xl sm:text-4xl font-black text-white tabular-nums leading-none">{assignments.length}</p>
                <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500 mt-1.5">Assignments sent</p>
              </div>
              <div className="w-px h-10 bg-white/10 hidden sm:block self-end mb-2" />
              <div>
                <p className="text-3xl sm:text-4xl font-black text-white tabular-nums leading-none">{activeCount}</p>
                <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500 mt-1.5">Active</p>
              </div>
              <div className="w-px h-10 bg-white/10 hidden sm:block self-end mb-2" />
              <div>
                <p className="text-3xl sm:text-4xl font-black text-white tabular-nums leading-none">{totalStudents}</p>
                <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500 mt-1.5">Students reached</p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* CTA */}
        <motion.button
          onClick={() => setIsFormOpen(true)}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
          whileHover={{ scale: 1.005 }}
          whileTap={{ scale: 0.997 }}
          className="w-full group relative overflow-hidden rounded-2xl flex items-center justify-between px-7 py-6 sm:py-7 bg-gradient-to-r from-violet-600 via-violet-700 to-blue-700 shadow-xl shadow-violet-900/30 text-white"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-in-out" />
          <div className="relative text-left">
            <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-violet-200/80 mb-1">AI-Powered</p>
            <h3 className="text-xl sm:text-2xl font-black leading-tight">Create & Send Assessment</h3>
          </div>
          <div className="relative flex items-center gap-3 flex-shrink-0">
            <div className="hidden sm:block">
              <p className="text-sm font-semibold text-violet-200">Generate</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-white/15 flex items-center justify-center group-hover:bg-white/25 transition-colors">
              <Plus className="w-5 h-5 text-white" />
            </div>
          </div>
        </motion.button>

        {/* Sent Assignments */}
        <div>
          <div className="flex items-center justify-between mb-4 px-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400 dark:text-gray-500 flex items-center gap-1.5">
              <ClipboardList className="w-3.5 h-3.5" />
              Sent Assignments
            </p>
          </div>

          {isLoadingAssignments ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-6 h-6 border-2 border-violet-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : assignments.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {assignments.map((a, i) => (
                <motion.div
                  key={a.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.04 * i }}
                  className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200/60 dark:border-gray-800/60 p-5 flex flex-col gap-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{a.title}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{a.subject} · Grade {a.grade}</p>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-1 rounded-lg capitalize flex-shrink-0 ${DIFFICULTY_COLORS[a.difficulty_level] ?? 'text-gray-500 bg-gray-100 dark:bg-gray-800'}`}>
                      {a.difficulty_level}
                    </span>
                  </div>

                  <div className="flex items-center gap-4 text-xs text-gray-400">
                    <span className="flex items-center gap-1">
                      <Users className="w-3.5 h-3.5" />
                      {a.student_emails?.length ?? 0} student{(a.student_emails?.length ?? 0) !== 1 ? 's' : ''}
                    </span>
                    <span className="flex items-center gap-1">
                      <BookOpen className="w-3.5 h-3.5" />
                      {a.question_count}q
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      {formatDeadline(a.deadline)}
                    </span>
                  </div>

                  {a.topics?.length > 0 && (
                    <p className="text-[11px] text-gray-400 truncate">{a.topics.slice(0, 3).join(' · ')}{a.topics.length > 3 ? ` +${a.topics.length - 3}` : ''}</p>
                  )}

                  <div className="pt-1 border-t border-gray-100 dark:border-gray-800/60">
                    <p className="text-[10px] text-gray-400">
                      Sent {new Date(a.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-800/60 bg-white/60 dark:bg-white/[0.02]">
              <div className="w-12 h-12 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-3">
                <Send className="w-5 h-5 text-gray-400" />
              </div>
              <p className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">No assignments sent yet</p>
              <p className="text-xs text-gray-400 text-center max-w-[200px] leading-relaxed">
                Create an assessment above and assign it to your students.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-6 border-t border-gray-200/60 dark:border-white/[0.04]">
          <div className="flex items-center gap-1.5 text-xs text-gray-400">
            <Brain className="w-3.5 h-3.5" />
            <span>Powered by Brain Ink AI</span>
          </div>
          <span className="text-xs text-gray-400">© {new Date().getFullYear()} Brain Ink</span>
        </div>

      </main>

      <ProfileSidebar isOpen={isProfileOpen} onClose={() => setIsProfileOpen(false)} />

      <AnimatePresence>
        {isFormOpen && (
          <FlowForm
            onClose={() => setIsFormOpen(false)}
            onAssign={(formData) => {
              setIsFormOpen(false)
              handleAssign(formData)
            }}
          />
        )}
        {assignData && (
          <AssignModal
            formData={assignData.formData}
            onClose={() => {
              setAssignData(null)
              // Refresh list
              if (user?.id) {
                fetch(`/api/assignments/teacher?teacher_id=${user.id}`)
                  .then(r => r.json())
                  .then(d => setAssignments(d.assignments ?? []))
                  .catch(console.error)
              }
            }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
