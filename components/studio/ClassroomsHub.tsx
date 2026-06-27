'use client'

import { useRouter } from 'next/navigation'
import { ArrowRight, BookOpen, Users } from 'lucide-react'
import { useAuth } from '@/components/AuthProvider'
import { useStudentDashboard } from '@/lib/hooks/useStudentDashboard'

export default function ClassroomsHub() {
  const { user } = useAuth()
  const router = useRouter()
  const { classrooms, loading } = useStudentDashboard(user)

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-8">
        <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-ss-accent">Classes</p>
        <h1 className="mt-2 text-[32px] font-extrabold tracking-tight text-ss-ink">
          Your <span className="text-ss-accent">classrooms</span>
        </h1>
        <p className="mt-2 max-w-xl text-sm font-semibold text-ss-slate">
          Assignments, deadlines, and teacher posts — one place for each class you&apos;re in.
        </p>
      </header>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-ss-accent border-t-transparent" />
        </div>
      ) : classrooms.length > 0 ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {classrooms.map((room: any) => (
            <button
              key={room.classroom_id}
              type="button"
              onClick={() => router.push(`/classrooms/${room.classroom_id}`)}
              className="group overflow-hidden rounded-[22px] border border-ss-line bg-ss-panel text-left transition-all hover:-translate-y-0.5 hover:shadow-ss-panel"
            >
              <div className="relative h-24 overflow-hidden" style={{ background: 'linear-gradient(120deg,#0C74B4,#1AA0DC 55%,#3ED3F5)' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/art/classroom.png" alt="" aria-hidden className="absolute right-3 top-1/2 h-[94%] -translate-y-1/2 object-contain drop-shadow-lg" />
                <div className="absolute left-4 top-4 grid h-9 w-9 place-items-center rounded-xl bg-white/25 text-white backdrop-blur-sm">
                  <BookOpen className="h-[18px] w-[18px]" strokeWidth={1.9} />
                </div>
                <ArrowRight className="absolute right-4 top-4 h-4 w-4 text-white transition-transform group-hover:translate-x-0.5" />
              </div>
              <div className="p-5">
                <p className="text-[18px] font-extrabold leading-tight text-ss-ink">{room.name}</p>
                {room.description && <p className="mt-1 line-clamp-2 text-sm font-semibold text-ss-slate">{room.description}</p>}
              </div>
              <div className="grid grid-cols-3 border-t border-ss-line">
                {[
                  { label: 'Upcoming', value: room.upcoming_count ?? 0, tone: 'text-ss-accent' },
                  { label: 'Open', value: room.open_count ?? 0, tone: 'text-ss-warn' },
                  { label: 'Done', value: room.finished_count ?? 0, tone: 'text-ss-good' },
                ].map((stat) => (
                  <div key={stat.label} className="px-4 py-4 text-center">
                    <p className={`text-2xl font-extrabold tabular-nums ${stat.tone}`}>{stat.value}</p>
                    <p className="mt-0.5 text-[10px] font-bold uppercase tracking-widest text-ss-slate">{stat.label}</p>
                  </div>
                ))}
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-[24px] border border-dashed border-ss-line bg-ss-panel py-20">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/art/empty-state.png" alt="" className="mb-4 h-24 w-auto" />
          <p className="text-lg font-extrabold text-ss-ink">No classes yet</p>
          <p className="mt-2 max-w-xs text-center text-sm font-semibold text-ss-slate">
            When your teacher adds you, your classrooms will show up here.
          </p>
        </div>
      )}
    </div>
  )
}
