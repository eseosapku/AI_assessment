'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ClipboardList, GraduationCap, Plus, Send, Users } from 'lucide-react'
import { useEffect, useState } from 'react'
import FlowForm from '@/components/FlowForm'
import { Marker } from '@/components/StudioPrimitives'
import { useAuth } from '@/components/AuthProvider'

export default function TeacherStudioHome() {
  const { user } = useAuth()
  const router = useRouter()
  const [formOpen, setFormOpen] = useState(false)
  const [assignments, setAssignments] = useState<any[]>([])
  const [classrooms, setClassrooms] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const firstName = user?.name?.split(' ')[0] ?? 'Teacher'

  useEffect(() => {
    if (!user?.id) return
    Promise.all([
      fetch(`/api/assignments/teacher?teacher_id=${user.id}`).then(r => r.json()),
      fetch(`/api/classrooms?teacher_id=${user.id}`).then(r => r.json()),
    ])
      .then(([a, c]) => {
        setAssignments(a.assignments ?? [])
        setClassrooms(c.data ?? [])
      })
      .finally(() => setLoading(false))
  }, [user])

  const openCount = assignments.filter((a: any) => a.status === 'open').length

  return (
    <div className="relative mx-auto max-w-[88rem] px-4 py-6 sm:px-8 sm:py-10">
      <div className="grid grid-cols-12 gap-4">
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="col-span-12 lg:col-span-7 rounded-[2rem] bg-brand-ink p-8 sm:p-10 text-white shadow-studio"
        >
          <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-brand-lime">Teacher studio</p>
          <h1 className="mt-3 font-display text-4xl font-black tracking-[-0.04em] sm:text-5xl">
            Hello, <Marker tone="lime">{firstName}</Marker>
          </h1>
          <p className="mt-4 max-w-md text-sm font-semibold text-white/60">
            Assign work, manage classes, and track submissions — from a dedicated teaching desk, not a student dashboard.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/assignments/new"
              className="inline-flex items-center gap-2 rounded-full bg-brand-lime px-6 py-3 text-sm font-black text-brand-ink"
            >
              <Send className="h-4 w-4" />
              New assignment
            </Link>
            <button
              type="button"
              onClick={() => setFormOpen(true)}
              className="inline-flex items-center gap-2 rounded-full border border-white/20 px-6 py-3 text-sm font-black text-white"
            >
              <Plus className="h-4 w-4" />
              AI assessment
            </button>
          </div>
        </motion.section>

        <div className="col-span-12 lg:col-span-5 grid grid-cols-2 gap-4">
          <div className="rounded-[1.5rem] bg-brand-orange p-5 shadow-studio rotate-1">
            <p className="text-[10px] font-bold uppercase tracking-widest opacity-70">Classes</p>
            <p className="mt-2 font-display text-4xl font-black">{loading ? '—' : classrooms.length}</p>
          </div>
          <div className="rounded-[1.5rem] bg-brand-sky p-5 shadow-studio -rotate-1">
            <p className="text-[10px] font-bold uppercase tracking-widest opacity-70">Open assigns</p>
            <p className="mt-2 font-display text-4xl font-black">{loading ? '—' : openCount}</p>
          </div>
          <Link
            href="/manage-classes"
            className="col-span-2 flex items-center justify-between rounded-[1.5rem] border-2 border-brand-ink bg-white p-5"
          >
            <div>
              <p className="text-sm font-black text-brand-ink">Manage classrooms</p>
              <p className="text-xs font-semibold text-brand-slate">Roster, invites, settings</p>
            </div>
            <GraduationCap className="h-8 w-8 text-brand-ink" />
          </Link>
        </div>

        <section className="col-span-12">
          <p className="mb-4 text-[10px] font-bold uppercase tracking-[0.25em] text-brand-slate">Recent assignments</p>
          {assignments.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {assignments.slice(0, 6).map((a: any, i) => (
                <motion.button
                  key={a.id}
                  type="button"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.04 * i }}
                  onClick={() => router.push(`/assignments/${a.id}`)}
                  className="rounded-2xl border border-black/10 bg-white p-5 text-left shadow-sm hover:border-brand-blue"
                >
                  <p className="truncate font-display text-lg font-black text-brand-ink">{a.title}</p>
                  <p className="mt-1 text-xs font-semibold text-brand-slate">{a.subject ?? 'General'}</p>
                  <span className="mt-3 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-brand-blue">
                    <ClipboardList className="h-3 w-3" />
                    {a.status ?? 'draft'}
                  </span>
                </motion.button>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center rounded-[1.5rem] border-2 border-dashed border-black/10 py-14">
              <Users className="mb-3 h-8 w-8 text-brand-slate" />
              <p className="text-sm font-black">No assignments yet</p>
              <Link href="/assignments/new" className="mt-2 text-xs font-black text-brand-blue underline">
                Create your first
              </Link>
            </div>
          )}
        </section>
      </div>

      {formOpen && <FlowForm onClose={() => setFormOpen(false)} />}
    </div>
  )
}
