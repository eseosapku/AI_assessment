'use client'

import { motion } from 'framer-motion'
import { User, Plus, Brain, Send, Calendar, BookOpen, ChevronDown, Users, Clock, ClipboardList, FileText } from 'lucide-react'
import { useState, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import ThemeToggle from './ThemeToggle'
import ProfileSidebar from './ProfileSidebar'
import FlowForm from './FlowForm'
import { useAuth } from './AuthProvider'

const DIFFICULTY_COLORS: Record<string, string> = {
  beginner: 'text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-900/20 ring-1 ring-emerald-200/60 dark:ring-emerald-800/40',
  average: 'text-sky-700 dark:text-sky-300 bg-sky-50 dark:bg-sky-900/20 ring-1 ring-sky-200/60 dark:ring-sky-800/40',
  intermediate: 'text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 ring-1 ring-amber-200/60 dark:ring-amber-800/40',
  advanced: 'text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-900/20 ring-1 ring-rose-200/60 dark:ring-rose-800/40',
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

function formatClassroomLabel(assignment: any) {
  const names = Array.isArray(assignment?.classroom_names)
    ? assignment.classroom_names.map((name: any) => String(name ?? '').trim()).filter(Boolean)
    : []
  if (names.length === 0) return assignment?.classroom_name ?? ''
  if (names.length === 1) return names[0]
  return `${names[0]} +${names.length - 1}`
}

export default function TeacherDashboard() {
  const { user } = useAuth()
  const [isProfileOpen, setIsProfileOpen] = useState(false)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [assignments, setAssignments] = useState<any[]>([])
  const [isLoadingAssignments, setIsLoadingAssignments] = useState(true)
  const [classrooms, setClassrooms] = useState<any[]>([])
  const [isLoadingClassrooms, setIsLoadingClassrooms] = useState(true)
  const [classroomName, setClassroomName] = useState('')
  const [classroomDescription, setClassroomDescription] = useState('')
  const [classroomError, setClassroomError] = useState('')
  const [isCreatingClassroom, setIsCreatingClassroom] = useState(false)

  const firstName = user?.name?.split(' ')[0] || 'Teacher'

  useEffect(() => {
    if (!user?.id) return
    fetch(`/api/assignments/teacher?teacher_id=${user.id}`)
      .then(r => r.json())
      .then(d => setAssignments(d.assignments ?? []))
      .catch(console.error)
      .finally(() => setIsLoadingAssignments(false))
  }, [user])

  const refreshClassrooms = async () => {
    if (!user?.id) return
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

  useEffect(() => {
    refreshClassrooms()
  }, [user])

  const handleCreateClassroom = async () => {
    if (!user?.id) return
    const name = classroomName.trim()
    if (!name) {
      setClassroomError('Classroom name is required')
      return
    }

    setIsCreatingClassroom(true)
    setClassroomError('')
    try {
      const res = await fetch('/api/classrooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teacher_id: user.id,
          name,
          description: classroomDescription.trim() || null,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to create classroom')
      setClassroomName('')
      setClassroomDescription('')
      await refreshClassrooms()
    } catch (err: any) {
      setClassroomError(err?.message || 'Failed to create classroom')
    } finally {
      setIsCreatingClassroom(false)
    }
  }

  const drafts = assignments.filter(a => a.status === 'draft')
  const sentAssignments = assignments.filter(a => a.status !== 'draft')
  const activeCount = sentAssignments.filter(a => !a.deadline || new Date(a.deadline) > new Date()).length
  const totalStudents = sentAssignments.reduce((acc, a) => acc + (a.assigned_count ?? 0), 0)

  const handleDeleteAssignment = async (assignmentId: string) => {
    const confirmed = window.confirm('Delete this assignment? This will remove all student results.')
    if (!confirmed) return

    try {
      const res = await fetch(`/api/assignments/${assignmentId}`, { method: 'DELETE' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to delete assignment')
      setAssignments((prev) => prev.filter((item) => item.id !== assignmentId))
    } catch (err) {
      console.error('Assignment delete error:', err)
    }
  }

  return (
    <div className="min-h-screen bg-[#F6F1EA] dark:bg-[#0B0E12] transition-colors duration-300 flex flex-col">

      {/* Header */}
      <header className="sticky top-0 z-30 h-16 bg-[#F6F1EA]/80 dark:bg-[#0B0E12]/80 backdrop-blur-xl header-fade">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 h-full flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Image src="/logo2.png" alt="Brain Ink" width={140} height={80} className="h-10 w-auto object-contain" priority />
            <span className="text-[12px] font-bold uppercase tracking-[0.2em] text-[#9C6644] bg-[#F1E6D6] dark:bg-[#2B1E16] dark:text-[#E6C7A8] px-2.5 py-1 rounded-full">Teacher</span>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <div className="w-px h-4 bg-black/10 dark:bg-white/10 mx-1" />
            <button
              onClick={() => setIsProfileOpen(true)}
              className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
            >
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#1F7A7A] to-[#E07A5F] flex items-center justify-center">
                <User className="w-3.5 h-3.5 text-white" />
              </div>
              <span className="text-sm font-semibold text-[#1F2933] dark:text-gray-200 hidden sm:block">{firstName}</span>
              <ChevronDown className="w-3.5 h-3.5 text-[#9AA1A9] hidden sm:block" />
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-6xl mx-auto px-4 sm:px-8 py-6 w-full space-y-4">

        {/* Hero panel */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-3xl bg-[#121821] dark:bg-[#0B0F14] p-7 sm:p-10"
        >
          <div
            className="absolute inset-0 pointer-events-none opacity-70"
            style={{
              backgroundImage: 'radial-gradient(circle at 15% 20%, rgba(224,122,95,0.35), transparent 45%), radial-gradient(circle at 85% 15%, rgba(31,122,122,0.35), transparent 40%), linear-gradient(120deg, rgba(255,255,255,0.06), transparent 60%)',
            }}
          />
          <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/40 to-transparent" />

          <div className="relative">
            <p className="text-[12px] font-bold uppercase tracking-[0.32em] text-[#F1C8A8] mb-3">Teacher Dashboard</p>
            <h1 className="text-4xl sm:text-5xl font-black text-white leading-none mb-8 tracking-tight font-display">
              {firstName}<span className="text-[#E07A5F]">.</span>
            </h1>

            <div className="flex flex-wrap items-end gap-x-8 gap-y-5">
              <div>
                <p className="text-3xl sm:text-4xl font-black text-white tabular-nums leading-none">{sentAssignments.length}</p>
                <p className="text-[12px] font-semibold uppercase tracking-widest text-[#9AA1A9] mt-1.5">Assignments sent</p>
              </div>
              <div className="w-px h-10 bg-white/10 hidden sm:block self-end mb-2" />
              <div>
                <p className="text-3xl sm:text-4xl font-black text-white tabular-nums leading-none">{activeCount}</p>
                <p className="text-[12px] font-semibold uppercase tracking-widest text-[#9AA1A9] mt-1.5">Active</p>
              </div>
              <div className="w-px h-10 bg-white/10 hidden sm:block self-end mb-2" />
              <div>
                <p className="text-3xl sm:text-4xl font-black text-white tabular-nums leading-none">{totalStudents}</p>
                <p className="text-[12px] font-semibold uppercase tracking-widest text-[#9AA1A9] mt-1.5">Students reached</p>
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
          className="w-full group relative overflow-hidden rounded-2xl flex items-center justify-between px-8 py-7 sm:py-8 bg-gradient-to-r from-[#E07A5F] via-[#C86B4D] to-[#3D405B] shadow-xl shadow-[#C86B4D]/30 text-white"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-in-out" />
          <div className="relative text-left">
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-white/70 mb-1">AI-Powered</p>
            <h3 className="text-2xl sm:text-3xl font-black leading-tight font-display">Create & Send Assessment</h3>
          </div>
          <div className="relative flex items-center gap-3 flex-shrink-0">
            <div className="hidden sm:block">
              <p className="text-base font-bold text-white/70">Generate</p>
            </div>
            <div className="w-12 h-12 rounded-full bg-white/15 flex items-center justify-center group-hover:bg-white/25 transition-colors">
              <Plus className="w-6 h-6 text-white" />
            </div>
          </div>
        </motion.button>

        <Link
          href="/report-card"
          className="w-full group relative overflow-hidden rounded-2xl flex items-center justify-between px-8 py-6 bg-white dark:bg-gray-900 border border-gray-200 dark:border-white/5 shadow-sm text-gray-800 dark:text-white"
        >
          <div className="relative text-left">
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-[#1F7A7A] mb-1">Student Reports</p>
            <h3 className="text-xl sm:text-2xl font-black leading-tight">Generate Report Card</h3>
            <p className="text-sm text-ss-slate dark:text-gray-500 mt-0.5">Use class assignments to build student report cards</p>
          </div>
          <div className="relative flex items-center gap-3 flex-shrink-0">
            <div className="w-12 h-12 rounded-full bg-[#E7EFEA] dark:bg-[#142724] flex items-center justify-center group-hover:bg-[#d7e7e0] dark:group-hover:bg-[#1a2f2c] transition-colors">
              <FileText className="w-6 h-6 text-[#1F7A7A]" />
            </div>
          </div>
        </Link>

        {/* Classrooms */}
        <div>
          <div className="flex items-center justify-between mb-4 px-1">
            <p className="text-[12px] font-bold uppercase tracking-[0.2em] text-ss-slate dark:text-gray-500 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5" />
              Classrooms
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200/60 dark:border-gray-800/60 p-5 flex flex-col gap-3">
              <p className="text-xs font-bold uppercase tracking-widest text-ss-slate">Create classroom</p>
              <input
                value={classroomName}
                onChange={(e) => setClassroomName(e.target.value)}
                placeholder="Classroom name"
                className="w-full px-3 py-2.5 rounded-xl text-sm bg-gray-50 dark:bg-white/[0.05] border border-gray-200 dark:border-white/[0.08] focus:border-[#1F7A7A] focus:ring-2 focus:ring-[#1F7A7A]/20 outline-none transition-all text-gray-900 dark:text-white"
              />
              <textarea
                value={classroomDescription}
                onChange={(e) => setClassroomDescription(e.target.value)}
                placeholder="Description (optional)"
                rows={3}
                className="w-full px-3 py-2.5 rounded-xl text-sm bg-gray-50 dark:bg-white/[0.05] border border-gray-200 dark:border-white/[0.08] focus:border-[#1F7A7A] focus:ring-2 focus:ring-[#1F7A7A]/20 outline-none transition-all text-gray-900 dark:text-white"
              />
              {classroomError && (
                <p className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/60 rounded-lg px-3 py-2">
                  {classroomError}
                </p>
              )}
              <button
                onClick={handleCreateClassroom}
                disabled={isCreatingClassroom}
                className="w-full flex items-center justify-center gap-2 bg-[#1F7A7A] hover:bg-[#166463] disabled:bg-[#6FA9A9] text-white text-base font-bold py-3 rounded-xl transition-colors"
              >
                <Plus className="w-5 h-5" />
                {isCreatingClassroom ? 'Creating...' : 'Create classroom'}
              </button>
            </div>

            {isLoadingClassrooms ? (
              <div className="col-span-1 lg:col-span-2 flex items-center justify-center rounded-2xl border border-gray-200/60 dark:border-gray-800/60 bg-white dark:bg-gray-900 p-10">
                <div className="w-6 h-6 border-2 border-[#1F7A7A] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : classrooms.length > 0 ? (
              classrooms.map((room) => (
                <div key={room.id} className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200/60 dark:border-gray-800/60 p-5 flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{room.name}</p>
                      {room.description && (
                        <p className="text-xs text-ss-slate mt-0.5 line-clamp-2">{room.description}</p>
                      )}
                    </div>
                    <span className="text-[12px] font-bold px-2 py-1 rounded-lg capitalize flex-shrink-0 bg-[#E7EFEA] text-[#1F7A7A] dark:bg-[#142724] dark:text-[#9AD0C3]">
                      {room.member_count ?? 0} students
                    </span>
                  </div>

                  <div className="flex items-center gap-3 text-xs text-ss-slate">
                    <span className="flex items-center gap-1">
                      <Users className="w-3.5 h-3.5" />
                      {room.member_count ?? 0} accepted
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      {room.pending_count ?? 0} pending
                    </span>
                  </div>

                  <Link
                    href={`/classrooms/${room.id}`}
                    className="mt-auto w-full py-2.5 rounded-xl text-sm font-bold transition-colors bg-[#1F7A7A] hover:bg-[#166463] text-white text-center"
                  >
                    Manage classroom
                  </Link>
                </div>
              ))
            ) : (
              <div className="col-span-1 lg:col-span-2 flex flex-col items-center justify-center py-16 rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-800/60 bg-white/60 dark:bg-white/[0.02]">
                <div className="w-12 h-12 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-3">
                  <Users className="w-5 h-5 text-ss-slate" />
                </div>
                <p className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">No classrooms yet</p>
                <p className="text-xs text-ss-slate text-center max-w-[220px] leading-relaxed">
                  Create your first classroom to invite students and assign assessments.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Drafts */}
        {drafts.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-4 px-1">
              <p className="text-[12px] font-bold uppercase tracking-[0.2em] text-ss-slate dark:text-gray-500 flex items-center gap-1.5">
                <ClipboardList className="w-3.5 h-3.5" />
                Drafts
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {drafts.map((a, i) => (
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
                      <p className="text-xs text-ss-slate mt-0.5">{a.subject} · Grade {a.grade}</p>
                    </div>
                    <span className="text-[12px] font-bold px-2 py-1 rounded-lg capitalize flex-shrink-0 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                      Draft
                    </span>
                  </div>

                  <div className="flex items-center gap-4 text-xs text-ss-slate">
                    <span className="flex items-center gap-1">
                      <BookOpen className="w-3.5 h-3.5" />
                      {a.question_count}q · {a.question_type}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      Not sent
                    </span>
                  </div>

                  {a.topics?.length > 0 && (
                    <p className="text-[12px] text-ss-slate truncate">{a.topics.slice(0, 3).join(' · ')}{a.topics.length > 3 ? ` +${a.topics.length - 3}` : ''}</p>
                  )}

                  <div className="mt-auto grid grid-cols-2 gap-2">
                    <Link
                      href={`/assignments/${a.id}/preview`}
                      className="py-2.5 rounded-xl text-sm font-bold transition-colors bg-[#1F7A7A] hover:bg-[#166463] text-white text-center"
                    >
                      Edit
                    </Link>
                    <button
                      onClick={() => handleDeleteAssignment(a.id)}
                      className="py-2.5 rounded-xl text-sm font-bold transition-colors border border-gray-200 dark:border-gray-800 hover:border-red-300 hover:text-red-500 text-gray-500"
                    >
                      Delete
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* Sent Assignments */}
        <div>
          <div className="flex items-center justify-between mb-4 px-1">
            <p className="text-[12px] font-bold uppercase tracking-[0.2em] text-ss-slate dark:text-gray-500 flex items-center gap-1.5">
              <ClipboardList className="w-3.5 h-3.5" />
              Sent Assignments
            </p>
          </div>

          {isLoadingAssignments ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-6 h-6 border-2 border-[#1F7A7A] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : sentAssignments.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {sentAssignments.map((a, i) => {
                const classroomLabel = formatClassroomLabel(a)
                return (
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
                        <p className="text-xs text-ss-slate mt-0.5">
                          {a.subject} · Grade {a.grade}{classroomLabel ? ` · ${classroomLabel}` : ''}
                        </p>
                      </div>
                      <span className={`text-[12px] font-bold px-2 py-1 rounded-lg capitalize flex-shrink-0 ${DIFFICULTY_COLORS[a.difficulty_level] ?? 'text-gray-500 bg-gray-100 dark:bg-gray-800'}`}>
                        {a.difficulty_level}
                      </span>
                    </div>

                    <div className="flex items-center gap-4 text-xs text-ss-slate">
                      <span className="flex items-center gap-1">
                        <Users className="w-3.5 h-3.5" />
                        {a.assigned_count ?? 0} student{(a.assigned_count ?? 0) !== 1 ? 's' : ''}
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

                    <div className="flex items-center gap-2 flex-wrap text-[12px] text-ss-slate">
                      <span className="px-2 py-1 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-500">
                        Attempts: {a.max_attempts ?? 1}
                      </span>
                      {a.strict_mode && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/40 text-red-600 dark:text-red-400 font-semibold">
                          <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                          Strict
                        </span>
                      )}
                    </div>

                    {a.topics?.length > 0 && (
                      <p className="text-[12px] text-ss-slate truncate">{a.topics.slice(0, 3).join(' · ')}{a.topics.length > 3 ? ` +${a.topics.length - 3}` : ''}</p>
                    )}

                    <div className="pt-1 border-t border-gray-100 dark:border-gray-800/60">
                      <p className="text-[12px] text-ss-slate">
                        Sent {new Date(a.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <Link
                        href={`/assignments/${a.id}/preview`}
                        className="py-2.5 rounded-xl text-sm font-bold transition-colors bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 hover:border-[#1F7A7A] text-[#1F7A7A] text-center"
                      >
                        Edit
                      </Link>
                      <button
                        onClick={() => handleDeleteAssignment(a.id)}
                        className="py-2.5 rounded-xl text-sm font-bold transition-colors border border-gray-200 dark:border-gray-800 hover:border-red-300 hover:text-red-500 text-gray-500"
                      >
                        Delete
                      </button>
                    </div>
                  </motion.div>
                )
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-800/60 bg-white/60 dark:bg-white/[0.02]">
              <div className="w-12 h-12 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-3">
                <Send className="w-5 h-5 text-ss-slate" />
              </div>
              <p className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">No assignments sent yet</p>
              <p className="text-xs text-ss-slate text-center max-w-[200px] leading-relaxed">
                Create an assessment above and send it to a classroom.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-6 border-t border-gray-200/60 dark:border-white/[0.04]">
          <div className="flex items-center gap-1.5 text-xs text-ss-slate">
            <Brain className="w-3.5 h-3.5" />
            <span>Powered by Brain Ink AI</span>
          </div>
          <span className="text-xs text-ss-slate">© {new Date().getFullYear()} Brain Ink</span>
        </div>

      </main>

      <ProfileSidebar isOpen={isProfileOpen} onClose={() => setIsProfileOpen(false)} />

      {isFormOpen && (
        <FlowForm onClose={() => setIsFormOpen(false)} />
      )}
    </div>
  )
}
