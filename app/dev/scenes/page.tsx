'use client'
/**
 * Every scene on one page, live, for the owner to play and judge. Each example a
 * scene's catalogue entry gives the tutor is a real card here, and a verdict and
 * a note on it are saved to .superpowers/scene-notes.json for the next round of
 * fixes. Cards far from the screen are unmounted: sixty animating cards at once
 * would stop the page.
 *
 * Dev only, like /dev/render: there is no middleware gating /dev/*.
 */
import { notFound } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'
import { ReactFlowProvider } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import 'katex/dist/katex.min.css'
import { ActivityNode } from '@/components/studylab/activities/ActivityNode'
import { CanvasContext } from '@/components/studylab/canvasShared'
import { engines } from '@/lib/studylab/engines'
import { examplesOf, type SceneExample } from '@/lib/studylab/engines/examples'
import { subjectStyle } from '@/lib/studylab/subjectFamily'

type Verdict = 'good' | 'change' | 'redo'
type Note = { verdict?: Verdict; note?: string; prompt?: string }
type Notes = Record<string, Note>

const GROUPS: { name: string; subject: string; ids: string[] }[] = [
  { name: 'Physics', subject: 'Physics', ids: ['light', 'waves', 'forces', 'motion', 'energy-track', 'moments-machines', 'density-pressure', 'thermal-transfer', 'springs-oscillators', 'half-life', 'magnetism', 'circuit', 'orbit', 'particles'] },
  { name: 'Chemistry', subject: 'Chemistry', ids: ['atom', 'bonding', 'equation-balancer', 'rates-equilibrium', 'solutions-ph', 'lab-bench'] },
  { name: 'Biology', subject: 'Biology', ids: ['cell-lab', 'enzyme-rate', 'genetics', 'body-flow', 'food-web'] },
  { name: 'Mathematics', subject: 'Mathematics', ids: ['number-line', 'counters-place-value', 'bar-model', 'area-grid', 'algebra-tiles', 'function-machine', 'coordinate-plane', 'transformations', 'geometry-construction', 'measure-shape', 'solids-nets', 'trig-circle', 'calculus-grapher', 'probability-lab', 'stats-explorer', 'chart-builder'] },
  { name: 'Computing', subject: 'Computing', ids: ['algorithm-tracer', 'flowchart', 'logic-gates', 'data-representation', 'network-sim'] },
  { name: 'Geography', subject: 'Geography', ids: ['map-reader', 'tectonics', 'river-coast', 'climate-station', 'population-pyramid', 'stocks-flows'] },
  { name: 'History and arguing', subject: 'History', ids: ['timeline', 'cause-chain', 'claim-evidence'] },
  { name: 'Economics and business', subject: 'Economics', ids: ['supply-demand', 'macro-board', 'business-finance', 'ledger'] },
  { name: 'Science skills', subject: 'Science', ids: ['fair-test'] },
  { name: 'Arts', subject: 'Art', ids: ['music-staff', 'art-studio'] },
]

const OPUS_55 = ['light', 'network-sim', 'half-life', 'macro-board', 'moments-machines', 'enzyme-rate', 'music-staff', 'art-studio']
const OPUS_46 = ['magnetism', 'forces']
const OPUS_EARLY = ['orbit', 'particles', 'atom', 'bonding', 'coordinate-plane', 'lab-bench', 'body-flow', 'cause-chain', 'food-web', 'supply-demand', 'business-finance', 'ledger', 'algebra-tiles', 'counters-place-value']
const writerOf = (id: string) => (OPUS_55.includes(id) ? 'Opus 5.5' : OPUS_46.includes(id) ? 'Opus 4.6' : OPUS_EARLY.includes(id) ? 'Opus' : 'Sonnet 5.5')

const VERDICTS: { id: Verdict; label: string; colour: string }[] = [
  { id: 'good', label: 'Good', colour: '#15803D' },
  { id: 'change', label: 'Needs changes', colour: '#B45309' },
  { id: 'redo', label: 'Redo', colour: '#B91C1C' },
]

const Card = ActivityNode as unknown as React.ComponentType<{ id: string; data: unknown }>

const noop = { onToggleGroup: () => {}, onNodeDataChange: () => {}, onDeleteNode: () => {}, onAskTutor: () => {}, onNodeResize: () => {} }

/** Mounted only while near the screen, holding its height when it is not. */
function Live({ children }: { children: React.ReactNode }) {
  const box = useRef<HTMLDivElement>(null)
  const [near, setNear] = useState(false)
  const height = useRef(420)
  useEffect(() => {
    const el = box.current
    if (!el) return
    const seen = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) height.current = Math.max(el.offsetHeight, 200)
      setNear(entry.isIntersecting)
    }, { rootMargin: '500px 0px' })
    seen.observe(el)
    return () => seen.disconnect()
  }, [])
  return <div ref={box} style={near ? undefined : { minHeight: height.current }}>{near ? children : null}</div>
}

function SceneCard({ id, index, example, subject, note, onNote }: {
  id: string; index: number; example: SceneExample; subject: string; note: Note; onNote: (n: Note) => void
}) {
  const [run, setRun] = useState(0)
  const spec = useMemo(() => ({
    pattern: 'scene', prompt: example.prompt, payload: { engine: id, config: example.config }, success: { kind: 'scene' },
    intent: { goal: 'x', isolates: 'position', apparatus: `scene:${id}`, why: 'x' },
  }), [id, example])
  const [draft, setDraft] = useState(note.note ?? '')
  return (
    <section id={`${id}-${index + 1}`} className="flex w-full max-w-[460px] flex-col gap-2">
      <div style={subjectStyle(subject)}>
        <Live>
          <ReactFlowProvider key={run}>
            <Card id={`${id}-${index}`} data={{ spec }} />
          </ReactFlowProvider>
        </Live>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {VERDICTS.map((v) => {
          const on = note.verdict === v.id
          return (
            <button
              key={v.id}
              type="button"
              aria-pressed={on}
              onClick={() => onNote({ ...note, verdict: on ? undefined : v.id, note: draft })}
              className="rounded-lg border-2 px-2.5 py-1 text-[13px] font-bold"
              style={on ? { background: v.colour, borderColor: v.colour, color: '#FFFFFF' } : { borderColor: 'var(--ss-line)', color: 'var(--ss-slate)' }}
            >
              {v.label}
            </button>
          )
        })}
        <button type="button" onClick={() => setRun((r) => r + 1)} className="ml-auto rounded-lg px-2 py-1 text-[13px] font-bold text-ss-slate underline">
          Start again
        </button>
      </div>
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => { if (draft !== (note.note ?? '')) onNote({ ...note, note: draft }) }}
        rows={2}
        placeholder="What's wrong, or what should change?"
        aria-label={`Note on ${id}, example ${index + 1}`}
        className="w-full rounded-lg border-2 border-ss-line bg-ss-panel px-2.5 py-1.5 text-[13px] text-ss-ink"
      />
    </section>
  )
}

function Scenes() {
  const [notes, setNotes] = useState<Notes>({})
  const [loaded, setLoaded] = useState(false)
  const [saved, setSaved] = useState(true)
  const [onlyOpen, setOnlyOpen] = useState(false)
  useEffect(() => {
    fetch('/api/dev/scene-notes').then((r) => r.json()).then((n: Notes) => { setNotes(n); setLoaded(true) }).catch(() => setLoaded(true))
  }, [])

  const all = useMemo(() => engines(), [])
  const known = new Set(GROUPS.flatMap((g) => g.ids))
  const groups = useMemo(() => [
    ...GROUPS,
    { name: 'Others', subject: 'Science', ids: all.map((e) => e.id).filter((id) => !known.has(id)) },
  ].map((g) => ({
    ...g,
    scenes: g.ids.map((id) => all.find((e) => e.id === id)).filter((e): e is NonNullable<typeof e> => !!e).map((e) => ({ id: e.id, examples: examplesOf(e) })),
  })).filter((g) => g.scenes.length > 0), [all]) // eslint-disable-line react-hooks/exhaustive-deps

  const total = groups.reduce((n, g) => n + g.scenes.reduce((m, s) => m + s.examples.length, 0), 0)
  const judged = Object.values(notes).filter((n) => n.verdict).length

  const save = (key: string, prompt: string, note: Note) => {
    const next = { ...notes, [key]: { ...note, prompt } }
    setNotes(next)
    setSaved(false)
    fetch('/api/dev/scene-notes', { method: 'POST', body: JSON.stringify(next) }).then(() => setSaved(true)).catch(() => {})
  }

  return (
    <CanvasContext.Provider value={noop}>
      <div className="ss-lesson min-h-screen bg-ss-canvas pb-24">
        <style>{'nextjs-portal{display:none!important}'}</style>
        <header className="sticky top-0 z-20 border-b border-ss-line bg-ss-panel px-5 py-3">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <h1 className="text-[17px] font-extrabold text-ss-ink">All scenes</h1>
            <p className="text-[13px] font-bold text-ss-slate">{judged} of {total} cards marked{saved ? '' : ', saving...'}</p>
            <label className="ml-auto flex items-center gap-1.5 text-[13px] font-bold text-ss-slate">
              <input type="checkbox" checked={onlyOpen} onChange={(e) => setOnlyOpen(e.target.checked)} />
              Hide cards marked Good
            </label>
          </div>
          <nav className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
            {groups.map((g) => <a key={g.name} href={`#${g.name}`} className="text-[13px] font-bold text-ss-slate underline">{g.name}</a>)}
          </nav>
        </header>

        {loaded && groups.map((g) => (
          <div key={g.name} id={g.name} className="scroll-mt-24 px-5 pt-8">
            <h2 className="mb-4 text-[20px] font-extrabold text-ss-ink">{g.name}</h2>
            {g.scenes.map((s) => (
              <div key={s.id} id={s.id} className="mb-8 scroll-mt-24">
                <p className="mb-2 flex items-baseline gap-2 text-[15px] font-extrabold text-ss-ink">
                  {s.id}
                  <span className="text-[12px] font-bold text-ss-slate">written by {writerOf(s.id)}</span>
                </p>
                {s.examples.length === 0 && <p className="text-[13px] font-bold text-ss-slate">No example could be read from this scene&apos;s catalogue entry.</p>}
                <div className="flex flex-wrap items-start gap-6">
                  {s.examples.map((example, i) => {
                    const key = `${s.id}#${i + 1}`
                    const note = notes[key] ?? {}
                    if (onlyOpen && note.verdict === 'good') return null
                    return <SceneCard key={key} id={s.id} index={i} example={example} subject={g.subject} note={note} onNote={(n) => save(key, example.prompt, n)} />
                  })}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </CanvasContext.Provider>
  )
}

export default function DevScenesPage() {
  if (process.env.NODE_ENV === 'production') notFound()
  return <Scenes />
}
