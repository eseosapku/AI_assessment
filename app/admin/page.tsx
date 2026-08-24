'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  Search,
  CheckCircle2,
  TrendingUp,
  Sparkles,
  RefreshCw,
  Users,
  GraduationCap,
  FileText,
  School,
  BookOpen,
  Layers,
  Clock,
} from 'lucide-react'
import { Panel } from '@/components/admin/Panel'
import { HeadlineStat } from '@/components/admin/HeadlineStat'
import { GapFlowChart, type GapFlowPoint } from '@/components/admin/GapFlowChart'
import { MethodChain, type ChainStep } from '@/components/admin/MethodChain'
import { canonicalSubject } from '@/lib/canonical-subject'

/**
 * The platform dashboard.
 *
 * Built around the three figures the product is actually judged on — gaps
 * found, gaps closed, scores moved — and around the question that follows each
 * of them. Every headline carries its definition in the card, and in projected
 * mode the multiplication that produced it is on the page, factor by factor,
 * marked for whether each link was measured or assumed.
 *
 * The mode switch is deliberately prominent and the projected state is banded
 * across the top, because a screenshot of this page will outlive the session
 * that produced it, and a modelled figure mistaken for a measured one is the
 * only failure here that would really cost anything.
 */

type Mode = 'live' | 'projected'

interface GapLifecycle {
  identified: number
  closed: number
  stillOpen: number
  closureRate: number
  medianDaysToClose: number | null
  studentsWithGaps: number
  subtopicsAffected: number
  identifiedChain?: ChainStep[]
  closedChain?: ChainStep[]
}

interface Lift {
  students: number
  firstThreeAvg: number
  lastThreeAvg: number
  deltaPoints: number
  deltaRelative: number
}

interface Overview {
  mode: Mode
  data: {
    gaps: GapLifecycle | null
    gapTimeline: GapFlowPoint[] | null
    lift: Lift | null
    taggingCoverage: { assessments: number; tagged: number; coverage: number; gapsPerTaggedPaper: number } | null
    headline: {
      students: number
      teachers: number
      newStudents30d: number
      quizzes: number
      quizzes30d: number
      classrooms: number
      assignments: number
      lessons: number
      recallCards: number
    } | null
    activity: { month: string; activeStudents: number; quizzes: number; avgScore: number }[] | null
    subjects: { subject: string; attempts: number; avgScore: number; students: number }[] | null
    engagement: { daysWithActivity: number; activeStudents: number; totalHours: number; medianMinutesPerActiveDay: number } | null
    studyLoop: { lessonsFromGaps: number; lessonsFromScratch: number; provenLessons: number } | null
  }
  metadata: { generatedAt: string; warnings: string[] }
}

const num = (v: number | null | undefined) => (v ?? 0).toLocaleString()

export default function AdminDashboardPage() {
  const [mode, setMode] = useState<Mode>('projected')
  const [overview, setOverview] = useState<Overview | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async (which: Mode) => {
    setLoading(true)
    setError(null)
    try {
      let userId = ''
      try {
        userId = JSON.parse(localStorage.getItem('user') ?? '{}')?.id ?? ''
      } catch {
        // A malformed stored user is the same situation as no user: the request
        // goes out unauthenticated and the API says so plainly.
      }
      const params = new URLSearchParams({ mode: which })
      if (userId) params.set('user_id', userId)

      const res = await fetch(`/api/admin/overview?${params}`, { cache: 'no-store' })
      const body = await res.json()
      if (!res.ok) throw new Error(body?.error ?? 'Could not load the dashboard')
      setOverview(body as Overview)
    } catch (e) {
      setError((e as Error).message)
      setOverview(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load(mode)
  }, [mode, load])

  const gaps = overview?.data.gaps ?? null
  const lift = overview?.data.lift ?? null
  const head = overview?.data.headline ?? null
  const cov = overview?.data.taggingCoverage ?? null
  const projected = overview?.mode === 'projected'

  return (
    <div className="min-h-screen bg-ss-canvas">
      <header className="border-b border-ss-line bg-ss-panel">
        <div className="mx-auto flex max-w-[1180px] flex-wrap items-center justify-between gap-4 px-6 py-5">
          <div>
            <h1 className="text-[22px] font-extrabold tracking-tight text-ss-ink">StudySquare — Platform</h1>
            <p className="mt-0.5 text-[13px] font-medium text-ss-slate">
              What the platform found, what it fixed, and whether students got better.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div
              role="group"
              aria-label="Data mode"
              className="inline-flex rounded-xl border border-ss-line bg-ss-canvas p-1"
            >
              {(['live', 'projected'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  aria-pressed={mode === m}
                  className={`rounded-lg px-3 py-1.5 text-[13px] font-bold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ss-accent)] ${
                    mode === m ? 'bg-ss-panel text-ss-ink shadow-sm' : 'text-ss-slate hover:text-ss-ink'
                  }`}
                >
                  {m === 'live' ? 'Today' : 'At scale'}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => void load(mode)}
              className="grid h-9 w-9 place-items-center rounded-xl border border-ss-line bg-ss-panel text-ss-slate hover:text-ss-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ss-accent)]"
              aria-label="Reload the dashboard"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1180px] px-6 py-6">
        {projected && (
          <div className="mb-6 flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl border border-ss-line bg-ss-panel px-4 py-3">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-ss-accent-soft px-2.5 py-1 text-[12px] font-extrabold uppercase tracking-wide text-ss-accent">
              <Sparkles className="h-3.5 w-3.5" aria-hidden />
              Forecast
            </span>
            <p className="text-[13px] font-semibold text-ss-ink">
              A 6,040-student cohort, projected from measured rates.
            </p>
            <p className="text-[13px] font-medium text-ss-slate">
              Every factor is shown below. Switch to{' '}
              <span className="font-bold text-ss-ink">Today</span> for figures to date.
            </p>
          </div>
        )}

        {error && (
          <div className="mb-6 rounded-2xl border border-[color:var(--ss-bad)]/40 bg-[color:var(--ss-bad)]/10 p-4">
            <p className="text-[14px] font-extrabold text-ss-ink">{error}</p>
            <p className="mt-1 text-[13px] font-medium text-ss-slate">
              This dashboard is limited to platform administrators. Sign in with an admin account and
              reload.
            </p>
          </div>
        )}

        {loading && !overview && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-[230px] animate-pulse rounded-2xl border border-ss-line bg-ss-panel" />
            ))}
          </div>
        )}

        {overview && gaps && lift && (
          <>
            {/* ── The three ───────────────────────────────────────────────── */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <HeadlineStat
                icon={Search}
                tone="accent"
                label="Learning gaps identified"
                value={num(gaps.identified)}
                sub={`${num(gaps.subtopicsAffected)} distinct subtopics, ${num(gaps.studentsWithGaps)} students`}
                definition={{
                  unit: 'gap',
                  method:
                    'one student measured below 50% on one curriculum subtopic. Every marked paper is tagged with the subtopics it covers, and each question outcome is attributed back to its subtopic.',
                  notCounted:
                    'Not wrong answers. A student who misses four questions on photosynthesis has one gap in photosynthesis, not four. Not low quiz scores either — a score of 38% says a paper went badly, not which part of the syllabus is missing. Papers ended by the proctor are excluded entirely, because an auto-submitted paper measures nothing about what anyone knows.',
                }}
              />
              <HeadlineStat
                icon={CheckCircle2}
                tone="good"
                label="Learning gaps closed"
                value={num(gaps.closed)}
                sub={`${gaps.closureRate}% closure rate · ${num(gaps.stillOpen)} still open`}
                definition={{
                  unit: 'closure',
                  method:
                    'the same student, re-tested on the same subtopic on a later paper, scoring 50% or better. Closure is proven by re-measurement, never by the student saying so.',
                  notCounted:
                    'Studying does not close a gap and neither does time passing. Reading a generated lesson on a subtopic leaves it open until a later paper covering that same subtopic comes back at or above the line. That is why this number is harder to move than the one beside it — and why it is worth more.',
                }}
              />
              <HeadlineStat
                icon={TrendingUp}
                tone="warn"
                label="Performance increase"
                value={`+${lift.deltaPoints}`}
                suffix="pts"
                sub={`${lift.firstThreeAvg}% → ${lift.lastThreeAvg}% across ${num(lift.students)} students`}
                definition={{
                  unit: 'student',
                  method:
                    'the average of their first three papers against the average of their last three, in percentage points. Counted only for students with at least six papers.',
                  notCounted:
                    'Not a comparison between different students, which would measure who joined rather than who improved. The six-paper floor matters: below six, the first-three and last-three windows share papers, which compares a student against themselves and reports no movement however much they improved.',
                }}
              />
            </div>

            {/* ── Showing the working ─────────────────────────────────────── */}
            {projected && gaps.identifiedChain && gaps.closedChain && (
              <div className="mt-4 grid gap-4">
                <Panel
                  title="How 21,436 gaps is arrived at"
                  hint="Each factor, its value, and whether the live database measured it or the model assumes it."
                >
                  <MethodChain steps={gaps.identifiedChain} result={gaps.identified} resultLabel="Gaps identified" />
                </Panel>
                <Panel
                  title="And how many of them close"
                  hint="Closure depends on a student coming back to the subtopic and clearing it on re-test."
                >
                  <MethodChain steps={gaps.closedChain} result={gaps.closed} resultLabel="Gaps closed" />
                </Panel>
              </div>
            )}

            {/* ── Flow ────────────────────────────────────────────────────── */}
            {overview.data.gapTimeline && overview.data.gapTimeline.length > 0 && (
              <div className="mt-4">
                <Panel
                  title="Gaps found against gaps closed"
                  hint="Closed is drawn inside identified, because a gap has to be found before it can be fixed. The space between them is the open backlog."
                  method="A gap is dated to the paper that first put the student below 50% on that subtopic, and its closure to the first later paper that brought them back to 50% or above."
                >
                  <GapFlowChart points={overview.data.gapTimeline} />
                </Panel>
              </div>
            )}

            {/* ── Lift + loop ─────────────────────────────────────────────── */}
            <div className="mt-4 grid gap-4 lg:grid-cols-[1.15fr_1fr]">
              <Panel
                title="Where students start and where they finish"
                hint={`Across ${num(lift.students)} students with six or more papers.`}
                method="Each student's first three papers averaged against their last three. Students below six papers are excluded, because the two windows would overlap and compare a student against themselves."
              >
                <LiftBars lift={lift} />
              </Panel>

              <Panel
                title="Does the loop actually close?"
                hint="A lesson built from a gap and never re-tested is a loop left open."
                method="Counts lessons by origin, and how many gap-built lessons were followed by a later paper covering that same subtopic."
              >
                {overview.data.studyLoop ? (
                  <dl className="grid gap-3">
                    <LoopRow
                      label="Lessons built from a measured gap"
                      value={num(overview.data.studyLoop.lessonsFromGaps)}
                    />
                    <LoopRow
                      label="Lessons built from scratch"
                      value={num(overview.data.studyLoop.lessonsFromScratch)}
                    />
                    <LoopRow
                      label="Gap lessons later re-tested"
                      value={num(overview.data.studyLoop.provenLessons)}
                      tone="good"
                    />
                    {gaps.medianDaysToClose !== null && (
                      <LoopRow
                        label="Median time from gap to close"
                        value={
                          gaps.medianDaysToClose < 1
                            ? `${Math.round(gaps.medianDaysToClose * 24 * 60)} min`
                            : `${gaps.medianDaysToClose} days`
                        }
                      />
                    )}
                  </dl>
                ) : (
                  <Unavailable />
                )}
              </Panel>
            </div>

            {/* ── The ceiling ─────────────────────────────────────────────── */}
            {cov && (
              <div className="mt-4">
                <Panel
                  title="The biggest lever we have"
                  hint="Gap detection reads the subtopics a paper is tagged with. Tagging more of them raises every figure above it."
                  method={`${num(cov.tagged)} of ${num(cov.assessments)} papers carry subtopic tags. Those papers surfaced ${cov.gapsPerTaggedPaper} gaps each — the rate the projection is built on.`}
                >
                  <div className="grid gap-5 md:grid-cols-[220px_1fr] md:items-start">
                    <div>
                      <p className="text-[38px] font-extrabold leading-none tracking-tight text-ss-ink">
                        {cov.coverage}%
                      </p>
                      <p className="mt-1.5 text-[13px] font-semibold text-ss-slate">
                        of papers tagged to subtopic
                      </p>
                      <div className="mt-3 h-3 w-full overflow-hidden rounded-full bg-ss-chip">
                        <div
                          className="h-full rounded-full bg-[color:var(--ss-accent)]"
                          style={{ width: `${Math.max(1.5, cov.coverage)}%` }}
                        />
                      </div>
                      <p className="mt-2 text-[12px] font-medium text-ss-slate">
                        {num(cov.tagged)} of {num(cov.assessments)} papers
                      </p>
                    </div>
                    <p className="text-[13px] font-medium leading-relaxed text-ss-slate">
                      Tagging began in June 2026, so every paper marked before then is outside the gap
                      engine&rsquo;s reach — the single largest reason the measured count is smaller than
                      the marking volume suggests. The engine is not underperforming; it has barely been
                      fed. Raising this figure is the cheapest way to move the two numbers at the top of
                      this page, because it costs no new students and no new papers — only tags on the
                      papers already being marked.
                    </p>
                  </div>
                </Panel>
              </div>
            )}

            {/* ── Platform totals ─────────────────────────────────────────── */}
            {head && (
              <div className="mt-4">
                <Panel title="The platform" hint="Measured in both modes — these are real counts either way.">
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                    <Tile icon={Users} label="Students" value={num(head.students)} foot={`+${num(head.newStudents30d)} in 30d`} />
                    <Tile icon={GraduationCap} label="Teachers" value={num(head.teachers)} />
                    <Tile icon={FileText} label="Papers marked" value={num(head.quizzes)} foot={`${num(head.quizzes30d)} in 30d`} />
                    <Tile icon={School} label="Classrooms" value={num(head.classrooms)} />
                    <Tile icon={BookOpen} label="Lessons built" value={num(head.lessons)} />
                    <Tile icon={Layers} label="Recall cards" value={num(head.recallCards)} />
                  </div>
                </Panel>
              </div>
            )}

            {/* ── Subjects + engagement ───────────────────────────────────── */}
            <div className="mt-4 grid gap-4 lg:grid-cols-[1.3fr_1fr]">
              <Panel
                title="Performance by subject"
                hint="Where the platform is strong and where it is not."
                method="Every marked paper grouped by its subject, with teacher-set work recovered from the assignment it belongs to. Proctor-ended papers excluded."
              >
                {overview.data.subjects && overview.data.subjects.length > 0 ? (
                  <SubjectTable rows={overview.data.subjects} />
                ) : (
                  <Unavailable />
                )}
              </Panel>

              <Panel
                title="Time on task"
                hint="Real minutes, not sessions opened."
                method="From the per-day activity ledger, counting only days a student was actually active."
              >
                {overview.data.engagement ? (
                  <dl className="grid gap-3">
                    <LoopRow label="Total hours studied" value={num(overview.data.engagement.totalHours)} />
                    <LoopRow label="Active students" value={num(overview.data.engagement.activeStudents)} />
                    <LoopRow label="Student-days with activity" value={num(overview.data.engagement.daysWithActivity)} />
                    <LoopRow
                      label="Median minutes per active day"
                      value={`${overview.data.engagement.medianMinutesPerActiveDay} min`}
                    />
                  </dl>
                ) : (
                  <Unavailable />
                )}
              </Panel>
            </div>

            <footer className="mt-6 flex flex-wrap items-center gap-2 text-[12px] font-medium text-ss-slate">
              <Clock className="h-3.5 w-3.5" aria-hidden />
              Generated {new Date(overview.metadata.generatedAt).toLocaleString()}
              {overview.metadata.warnings.length > 0 && (
                <span className="ml-2 rounded-full bg-[color:var(--ss-warn)]/14 px-2.5 py-1 font-bold text-ss-warn">
                  {overview.metadata.warnings.length} metric
                  {overview.metadata.warnings.length === 1 ? '' : 's'} unavailable:{' '}
                  {overview.metadata.warnings.join(', ')}
                </span>
              )}
            </footer>
          </>
        )}
      </main>
    </div>
  )
}

/** Where students start against where they finish, as two bars on one scale. */
function LiftBars({ lift }: { lift: Lift }) {
  const max = Math.max(lift.firstThreeAvg, lift.lastThreeAvg, 100)
  // The fill colour is set inline rather than through a Tailwind class. The
  // ss-* tokens are CSS variables, and the alpha shorthand — `bg-ss-slate/40`
  // and `bg-[color:var(--ss-slate)]/40` alike — emits nothing for them, which
  // renders the bar invisible rather than faint. Naming the variable directly
  // sidesteps the whole question.
  const bar = (value: number, color: string) => (
    <div className="h-9 w-full overflow-hidden rounded-lg bg-ss-chip">
      <div className="h-full rounded-lg" style={{ width: `${(value / max) * 100}%`, backgroundColor: color }} />
    </div>
  )
  return (
    <div className="grid gap-4">
      <div>
        <div className="mb-1.5 flex items-baseline justify-between">
          <span className="text-[13px] font-bold text-ss-ink">First three papers</span>
          <span className="text-[15px] font-extrabold text-ss-ink">{lift.firstThreeAvg}%</span>
        </div>
        {bar(lift.firstThreeAvg, 'var(--ss-slate)')}
      </div>
      <div>
        <div className="mb-1.5 flex items-baseline justify-between">
          <span className="text-[13px] font-bold text-ss-ink">Last three papers</span>
          <span className="text-[15px] font-extrabold text-ss-ink">{lift.lastThreeAvg}%</span>
        </div>
        {bar(lift.lastThreeAvg, 'var(--ss-good)')}
      </div>
      <p className="rounded-xl bg-ss-chip p-3 text-[13px] font-semibold text-ss-ink">
        <span className="text-ss-good">+{lift.deltaPoints} percentage points</span> — a{' '}
        {lift.deltaRelative}% improvement on where they started.
      </p>
    </div>
  )
}

function LoopRow({ label, value, tone }: { label: string; value: string; tone?: 'good' }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-ss-line pb-2.5 last:border-0 last:pb-0">
      <dt className="text-[13px] font-medium text-ss-slate">{label}</dt>
      <dd className={`text-[16px] font-extrabold ${tone === 'good' ? 'text-ss-good' : 'text-ss-ink'}`}>{value}</dd>
    </div>
  )
}

function Tile({
  icon: Icon,
  label,
  value,
  foot,
}: {
  icon: typeof Users
  label: string
  value: string
  foot?: string
}) {
  return (
    <div className="rounded-xl border border-ss-line bg-ss-canvas p-3">
      <Icon className="h-4 w-4 text-ss-slate" aria-hidden />
      <p className="mt-2 text-[20px] font-extrabold leading-none tracking-tight text-ss-ink">{value}</p>
      <p className="mt-1 text-[12px] font-bold text-ss-slate">{label}</p>
      {foot && <p className="mt-0.5 text-[12px] font-medium text-ss-slate">{foot}</p>}
    </div>
  )
}

interface SubjectRow {
  subject: string
  attempts: number
  avgScore: number
  students: number
}

/**
 * Collapses the stored subject values into the names people use.
 *
 * Subjects are stored as textbook titles — "Physics S4 SB", "Physics for
 * Rwandan Schools" — so several rows canonicalise to the same subject and have
 * to be merged rather than listed twice. The average is re-weighted by paper
 * count, because averaging two averages would let a subject with four papers
 * pull as hard as one with four hundred.
 */
export function mergeSubjects(rows: SubjectRow[]): SubjectRow[] {
  const byName = new Map<string, { attempts: number; weighted: number; students: number }>()
  for (const row of rows) {
    const name = canonicalSubject(row.subject)
    const acc = byName.get(name) ?? { attempts: 0, weighted: 0, students: 0 }
    acc.attempts += row.attempts
    acc.weighted += row.avgScore * row.attempts
    // Students are counted per stored subject, so this over-counts anyone who
    // sat papers under two spellings of the same subject. Summing is still
    // closer than taking a single row's figure and calling it the total.
    acc.students += row.students
    byName.set(name, acc)
  }
  return [...byName.entries()]
    .map(([subject, a]) => ({
      subject,
      attempts: a.attempts,
      students: a.students,
      avgScore: a.attempts > 0 ? Math.round(a.weighted / a.attempts) : 0,
    }))
    .sort((a, b) => b.attempts - a.attempts)
}

function SubjectTable({ rows }: { rows: SubjectRow[] }) {
  const cleaned = mergeSubjects(rows).slice(0, 10)
  const max = Math.max(1, ...cleaned.map((r) => r.attempts))

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[420px] border-collapse text-left">
        <thead>
          <tr className="border-b border-ss-line">
            <th scope="col" className="pb-2 text-[12px] font-bold uppercase tracking-wide text-ss-slate">Subject</th>
            <th scope="col" className="pb-2 text-right text-[12px] font-bold uppercase tracking-wide text-ss-slate">Papers</th>
            <th scope="col" className="pb-2 text-right text-[12px] font-bold uppercase tracking-wide text-ss-slate">Students</th>
            <th scope="col" className="pb-2 text-right text-[12px] font-bold uppercase tracking-wide text-ss-slate">Average</th>
          </tr>
        </thead>
        <tbody>
          {cleaned.map((r) => (
            <tr key={r.subject} className="border-b border-ss-line last:border-0">
              <td className="py-2.5">
                <span className="text-[13px] font-bold text-ss-ink">{r.subject}</span>
                <span aria-hidden className="mt-1 block h-1.5 rounded-full bg-ss-accent-soft" style={{ width: `${(r.attempts / max) * 100}%` }} />
              </td>
              <td className="py-2.5 text-right text-[13px] font-semibold text-ss-slate">{r.attempts.toLocaleString()}</td>
              <td className="py-2.5 text-right text-[13px] font-semibold text-ss-slate">{r.students.toLocaleString()}</td>
              <td className="py-2.5 text-right">
                <span
                  className={`text-[13px] font-extrabold ${
                    r.avgScore >= 80 ? 'text-ss-good' : r.avgScore >= 50 ? 'text-ss-ink' : 'text-ss-bad'
                  }`}
                >
                  {r.avgScore}%
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Unavailable() {
  return (
    <p className="rounded-xl bg-ss-chip p-3 text-[13px] font-medium text-ss-slate">
      This metric could not be loaded. The rest of the page is unaffected.
    </p>
  )
}
