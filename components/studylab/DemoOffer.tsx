'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { GraduationCap, ArrowRight } from 'lucide-react'
import { hasSeenDemo, markDemoSeen } from '@/lib/studylab/demoGate'

/**
 * The offer made before a learner's first lesson.
 *
 * A LearnSpace is an unusual thing to be handed with no explanation: an
 * infinite board, a plan that has to be agreed to, and a tutor that answers by
 * building rather than talking. Two minutes on a lesson that cannot go wrong is
 * a better introduction than working it out on the topic you actually cared
 * about.
 *
 * Shown once, and only once. Declining settles it as firmly as accepting —
 * being asked again at the start of every lesson is its own annoyance.
 *
 * `lessonId` travels with the offer so the demo can hand them back to the
 * lesson they were opening, rather than to a hub they never asked for.
 */
export default function DemoOffer({ lessonId, title }: { lessonId: string; title?: string | null }) {
  const router = useRouter()
  const [show, setShow] = useState(false)

  useEffect(() => {
    // Read after mount: `hasSeenDemo` touches localStorage, and rendering the
    // offer on the server would flash it at everyone.
    if (!hasSeenDemo()) setShow(true)
  }, [])

  if (!show) return null

  const decline = () => {
    markDemoSeen()
    setShow(false)
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/55 px-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="demo-offer-title"
        className="w-full max-w-md rounded-2xl border border-ss-line bg-ss-panel p-6 shadow-2xl"
      >
        <div
          className="grid h-11 w-11 place-items-center rounded-2xl"
          style={{ backgroundColor: 'var(--ss-accent-soft)' }}
        >
          <GraduationCap className="h-5 w-5 text-ss-accent" aria-hidden />
        </div>

        <h2 id="demo-offer-title" className="mt-3.5 text-[19px] font-extrabold leading-snug text-ss-ink">
          First time here? Take the two-minute tour
        </h2>
        <p className="mt-2 text-[13.5px] font-medium leading-relaxed text-ss-slate">
          A LearnSpace works differently from a chatbot — the tutor teaches by building cards on a
          board, and you steer it as it goes. The tour is a short pre-written lesson where you press
          every control yourself. Nothing in it is saved, and there is nothing you can break.
        </p>
        {title && (
          <p className="mt-2.5 rounded-xl bg-ss-chip px-3 py-2 text-[12.5px] font-semibold text-ss-ink">
            You will come straight back to “{title}” afterwards.
          </p>
        )}

        <div className="mt-5 flex flex-col gap-2">
          <button
            type="button"
            onClick={() => {
              markDemoSeen()
              router.push(`/studylab/demo?next=${encodeURIComponent(lessonId)}`)
            }}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-ss-accent px-4 py-2.5 text-[14px] font-extrabold text-white transition-opacity hover:opacity-90"
          >
            Show me how it works
            <ArrowRight className="h-4 w-4" aria-hidden />
          </button>
          <button
            type="button"
            onClick={decline}
            className="rounded-xl px-4 py-2.5 text-[13.5px] font-bold text-ss-slate transition-colors hover:text-ss-ink"
          >
            No thanks, go to my lesson
          </button>
        </div>
      </div>
    </div>
  )
}
