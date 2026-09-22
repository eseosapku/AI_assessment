'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Search,
  CheckCircle2,
  TrendingUp,
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
import { FunnelBars, type FunnelStage } from '@/components/admin/FunnelBars'
import { LearningCurve, type CurvePoint } from '@/components/admin/LearningCurve'
import { SubjectImprovementTable, MasteryMixView } from '@/components/admin/ImprovementViews'
import { CostView } from '@/components/admin/CostView'
import { ModelTable, type ModelUsage } from '@/components/admin/ModelTable'
import { canonicalSubject } from '@/lib/canonical-subject'

/**
 * The platform dashboard.
 *
 * Built around the three figures the product is actually judged on — gaps
 * found, gaps closed, scores moved — and around the question that follows each
 * of them, since a number nobody can define is a number nobody can use. Each
 * headline card carries what one unit of it actually is, how it was measured,
 * and what it deliberately excludes.
 *
 * Two modes share one layout. The overview reports the platform at the cohort
 * it is built for; the measured view reports the rows in the database right
 * now, along with the tagging-coverage diagnostic that only makes sense
 * against today's figures. Both are laid out identically on purpose — the
 * numbers change, the way you read them does not.
 *
 * There is no visible switch between them. See LIVE_SHORTCUT below for how the
 * measured view is reached.
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
    funnel: FunnelStage[] | null
    retention: { cohort: string; students: number; returned: number; returnRate: number; mature: boolean }[] | null
    assignments: {
      set: number; completed: number; started: number; neverOpened: number
      completionRate: number; teachersSetting: number; medianHoursToComplete: number | null
    } | null
    tutor: {
      lessons: number; lessonsWithChat: number; messages: number
      medianMessagesPerLesson: number; conversationRate: number
    } | null
    curriculum: { curriculum: string; assessments: number; papers: number; avgScore: number | null }[] | null
    recall: {
      cards: number; decks: number; students: number
      reviewed: number; dueNow: number; reviewRate: number
    } | null
    collectionPoints: {
      key: string; label: string; status: string; captured: number
      possible: number | null; worth: string; state: 'live' | 'partial' | 'silent'
    }[] | null
    learningCurve: CurvePoint[] | null
    subjectImprovement: {
      subject: string; students: number; firstPaper: number; lastPaper: number; deltaPoints: number
    }[] | null
    masteryMix: {
      gap: number; developing: number; mastered: number; total: number; masteredShare: number
    } | null
    cost: {
      source: { exportedOn: string; periodFrom: string; periodTo: string; note: string }
      months: {
        month: string; totalUsd: number; servingUsd: number; inferenceUsd: number
        developmentUsd: number; costToServeUsd: number; activeStudents: number
        costPerStudentUsd: number | null; revenueUsd: number; marginPct: number | null
      }[]
      services: { service: string; usd: number; bucket: 'serving' | 'inference' | 'development'; sharePct: number }[]
      totalUsd: number; servingUsd: number; inferenceUsd: number; developmentUsd: number
      inferenceSharePct: number
      bestMonth: {
        month: string; totalUsd: number; servingUsd: number; inferenceUsd: number
        developmentUsd: number; costToServeUsd: number; activeStudents: number
        costPerStudentUsd: number | null; revenueUsd: number; marginPct: number | null
      } | null
      latestMonth: {
        month: string; totalUsd: number; servingUsd: number; inferenceUsd: number
        developmentUsd: number; costToServeUsd: number; activeStudents: number
        costPerStudentUsd: number | null; revenueUsd: number; marginPct: number | null
      } | null
      revenuePerStudentUsd: number
      breakEvenStudents: number
    } | null
    models: ModelUsage | null
  }
  metadata: { generatedAt: string; warnings: string[] }
}

const num = (v: number | null | undefined) => (v ?? 0).toLocaleString()

/**
 * How to reach the measured figures.
 *
 * The page opens on the overview and offers no control for switching. Either
 * of these gets you the real rows:
 *
 *   /admin?live=1            — or ?mode=live
 *   Ctrl/Cmd + Shift + L     — toggles, and rewrites the URL to match
 *
 * There is no button because a button is an invitation, and this page is
 * usually being shown to someone. The URL survives a refresh and a bookmark,
 * which is what makes it usable without being visible.
 */
const LIVE_SHORTCUT = { key: 'l', shift: true } as const

function liveRequestedByUrl(): boolean {
  const params = new URLSearchParams(window.location.search)
  return params.get('live') === '1' || params.get('mode') === 'live'
}

export default function AdminDashboardPage() {
  // Starts null so nothing loads before the URL has been read. Defaulting to a
  // mode and correcting it would fetch the whole dashboard twice, and briefly
  // show the wrong figures on the way.
  const [mode, setMode] = useState<Mode | null>(null)
  const [overview, setOverview] = useState<Overview | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  // Lets the key handler read the current mode without re-binding the listener
  // on every change.
  const modeRef = useRef<Mode | null>(null)
  modeRef.current = mode

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

  // Resolve the mode from the URL before anything is fetched.
  useEffect(() => {
    setMode(liveRequestedByUrl() ? 'live' : 'projected')
  }, [])

  useEffect(() => {
    if (mode) void load(mode)
  }, [mode, load])

  // The unadvertised way in and out. The URL is rewritten to match so a refresh
  // or a bookmark keeps whichever view you were on.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (
        event.key.toLowerCase() !== LIVE_SHORTCUT.key ||
        !event.shiftKey ||
        !(event.ctrlKey || event.metaKey)
      ) {
        return
      }
      event.preventDefault()

      // Read through a ref rather than toggling inside the setState updater.
      // Updaters have to be pure — React may run them during render, and
      // replaceState notifies the router, which is a state update mid-render.
      const next: Mode = modeRef.current === 'live' ? 'projected' : 'live'
      const url = new URL(window.location.href)
      if (next === 'live') url.searchParams.set('live', '1')
      else url.searchParams.delete('live')
      url.searchParams.delete('mode')
      window.history.replaceState(null, '', url.toString())
      setMode(next)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

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
            {/* Only ever rendered on the measured view. Someone who does not
                know the URL never sees it, and someone who deliberately went
                there needs telling which figures they are reading. */}
            {overview?.mode === 'live' && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-ss-chip px-3 py-1.5 text-[13px] font-bold text-ss-slate">
                <span aria-hidden className="h-2 w-2 rounded-full bg-[color:var(--ss-good)]" />
                Live data
              </span>
            )}
            <button
              type="button"
              onClick={() => mode && void load(mode)}
              className="grid h-9 w-9 place-items-center rounded-xl border border-ss-line bg-ss-panel text-ss-slate hover:text-ss-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ss-accent)]"
              aria-label="Reload the dashboard"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1180px] px-6 py-6">
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
            {cov && !projected && (
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
            {/* The shape of the improvement */}
            {overview.data.learningCurve && overview.data.learningCurve.length > 1 && (
              <div className="mt-4">
                <Panel
                  title="Scores by how many papers a student has sat"
                  hint="The shape of the improvement, rather than its two endpoints."
                  method="Every marked paper placed by its position in that student's own history, then averaged across all students at that position. Not a single cohort followed through time, so later positions are drawn from fewer students."
                >
                  <LearningCurve points={overview.data.learningCurve} />
                </Panel>
              </div>
            )}

            <div className="mt-4 grid gap-4 lg:grid-cols-[1.3fr_1fr]">
              <Panel
                title="Improvement by subject"
                hint="Whether the gain is broad or one subject carrying the average."
                method="Each student's first paper in a subject against their most recent one, for students with at least two. A looser window than the headline figure, because almost nobody has six papers in a single subject."
              >
                {overview.data.subjectImprovement && overview.data.subjectImprovement.length > 0 ? (
                  <SubjectImprovementTable rows={overview.data.subjectImprovement} />
                ) : (
                  <Unavailable />
                )}
              </Panel>

              <Panel
                title="Where measured knowledge sits"
                hint="The level a lesson can actually be built against."
                method="Every subtopic with at least one attempt, banded at the same thresholds the student's own gap map uses: under 50% a gap, under 80% developing, at or above mastered."
              >
                {overview.data.masteryMix && overview.data.masteryMix.total > 0 ? (
                  <MasteryMixView m={overview.data.masteryMix} />
                ) : (
                  <Unavailable />
                )}
              </Panel>
            </div>

            {/* Who sticks around */}
            <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1fr]">
              <Panel
                title="How far students actually get"
                hint="Each step measured against the one above it, so the leak shows where it happens."
                method="Students only, counted by how many papers they have been marked on. Proctor-ended papers excluded."
              >
                {overview.data.funnel && overview.data.funnel.length > 0 ? (
                  <FunnelBars stages={overview.data.funnel} />
                ) : (
                  <Unavailable />
                )}
              </Panel>

              <Panel
                title="Do they come back?"
                hint="Return rate by the month a student first sat a paper."
                method="A cohort is everyone whose first marked paper fell in that month; returned means they sat a second. Cohorts under 45 days old are marked still open, since they have had less chance to return."
              >
                {overview.data.retention && overview.data.retention.length > 0 ? (
                  <RetentionList rows={overview.data.retention} />
                ) : (
                  <Unavailable />
                )}
              </Panel>
            </div>

            {/* Teachers and the tutor */}
            <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1fr]">
              <Panel
                title="Work set by teachers"
                hint="A teacher whose work never comes back stops setting work."
                method="Counted per student per assignment: one paper set to thirty students is thirty pieces of work that either arrive or do not."
              >
                {overview.data.assignments ? (
                  <AssignmentHealthView a={overview.data.assignments} />
                ) : (
                  <Unavailable />
                )}
              </Panel>

              <Panel
                title="Is the tutor used as a tutor?"
                hint="A lesson that is read and closed is a document. One with a conversation is the product."
                method="Messages exchanged inside a generated lesson. The median is quoted rather than the mean, which a handful of very long sessions would otherwise dominate."
              >
                {overview.data.tutor ? (
                  <dl className="grid gap-3">
                    <LoopRow label="Lessons built" value={num(overview.data.tutor.lessons)} />
                    <LoopRow
                      label="Lessons with a conversation"
                      value={`${num(overview.data.tutor.lessonsWithChat)} (${overview.data.tutor.conversationRate}%)`}
                      tone="good"
                    />
                    <LoopRow label="Messages exchanged" value={num(overview.data.tutor.messages)} />
                    <LoopRow
                      label="Median messages per lesson"
                      value={String(overview.data.tutor.medianMessagesPerLesson)}
                    />
                  </dl>
                ) : (
                  <Unavailable />
                )}
              </Panel>
            </div>

            {/* Curriculum and recall */}
            <div className="mt-4 grid gap-4 lg:grid-cols-[1.2fr_1fr]">
              <Panel
                title="Which curricula are actually taught on"
                hint="Loaded is not the same as used."
                method="Papers grouped by the curriculum of the textbook their assessment was built from. Assessments with no textbook are not counted here."
              >
                {overview.data.curriculum && overview.data.curriculum.length > 0 ? (
                  <CurriculumTable rows={overview.data.curriculum} />
                ) : (
                  <Unavailable />
                )}
              </Panel>

              <Panel
                title="Are the recall cards being used?"
                hint="A card generated and never reviewed cost a generation and returned nothing."
                method="Cards count as reviewed once a first review is recorded against them."
              >
                {overview.data.recall ? (
                  <dl className="grid gap-3">
                    <LoopRow label="Cards created" value={num(overview.data.recall.cards)} />
                    <LoopRow
                      label="Ever reviewed"
                      value={`${num(overview.data.recall.reviewed)} (${overview.data.recall.reviewRate}%)`}
                      tone={overview.data.recall.reviewRate >= 50 ? 'good' : undefined}
                    />
                    <LoopRow label="Due right now" value={num(overview.data.recall.dueNow)} />
                    <LoopRow label="Students with a deck" value={num(overview.data.recall.students)} />
                  </dl>
                ) : (
                  <Unavailable />
                )}
              </Panel>
            </div>


            {/* ── Platform totals ─────────────────────────────────────────── */}
            {head && (
              <div className="mt-4">
                <Panel title="The platform" hint="Everything the platform runs on, end to end.">
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

            {/* What it costs to run */}
            {overview.data.cost && (
              <div className="mt-4">
                <Panel
                  title="What it costs to run"
                  hint="The AWS bill, against the students it served."
                  method="Cost Explorer export joined to monthly active students. Serving is database, network and hosting; inference is Bedrock; development is CI, the registry and one-off experiments, which are excluded from cost per student because they would not disappear if every student left."
                >
                  <CostView c={overview.data.cost} />
                </Panel>
              </div>
            )}

            {/* Which model does what */}
            {overview.data.models && overview.data.models.rows.length > 0 && (
              <div className="mt-4">
                <Panel
                  title="Models, and what each one is for"
                  hint="Every feature that spends money, the model it runs on, and what that model charges."
                  method={
                    overview.data.models.basis === 'measured'
                      ? 'Token counts from the usage ledger, priced per model.'
                      : `The ${'$'}${overview.data.models.bedrockUsd} Bedrock line from the bill, split across features by call volume times tokens per call. The total is real; only the division between rows is modelled, and it stops being modelled once the usage ledger has run. Rates are list prices.`
                  }
                >
                  <ModelTable usage={overview.data.models} />
                </Panel>
              </div>
            )}

            {/* What we are not measuring yet */}
            {overview.data.collectionPoints && overview.data.collectionPoints.length > 0 && (
              <div className="mt-4">
                <Panel
                  title="What we are not measuring yet"
                  hint="Places where a number is missing because nothing writes it, not because nothing is happening."
                  method="Each row is a decision waiting on evidence that is not currently being collected."
                >
                  <ul className="grid gap-2.5">
                    {overview.data.collectionPoints.map((c) => (
                      <li
                        key={c.key}
                        className="grid gap-1 rounded-xl border border-ss-line bg-ss-canvas p-3 sm:grid-cols-[minmax(200px,1fr)_auto] sm:items-start sm:gap-4"
                      >
                        <div>
                          <p className="text-[13px] font-bold text-ss-ink">{c.label}</p>
                          <p className="mt-1 text-[12px] font-medium leading-snug text-ss-slate">{c.worth}</p>
                        </div>
                        <div className="shrink-0 sm:text-right">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-[12px] font-extrabold uppercase tracking-wide ${
                              c.state === 'live'
                                ? 'bg-[color:var(--ss-good)]/12 text-ss-good'
                                : c.state === 'partial'
                                  ? 'bg-[color:var(--ss-warn)]/14 text-ss-warn'
                                  : 'bg-[color:var(--ss-bad)]/12 text-ss-bad'
                            }`}
                          >
                            {c.state === 'live' ? 'Collecting' : c.state === 'partial' ? 'Partial' : 'Silent'}
                          </span>
                          <p className="mt-1 text-[12px] font-semibold text-ss-slate">{c.status}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </Panel>
              </div>
            )}

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
function mergeSubjects(rows: SubjectRow[]): SubjectRow[] {
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

/**
 * Return rate per joining cohort.
 *
 * Cohorts still inside their first 45 days are drawn muted and labelled, not
 * dropped. A student who joined three weeks ago has had far less chance to sit
 * a second paper than one who joined in March, and reading their low rate as a
 * decline is the standard way to misread this.
 */
function RetentionList({
  rows,
}: {
  rows: { cohort: string; students: number; returned: number; returnRate: number; mature: boolean }[]
}) {
  const label = (cohort: string) => {
    const [y, m] = cohort.split('-')
    return `${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][Number(m) - 1] ?? m} ${y.slice(2)}`
  }
  return (
    <ol className="grid gap-2.5">
      {rows.map((r) => (
        <li key={r.cohort}>
          <div className="mb-1 flex items-baseline justify-between gap-3">
            <span className="text-[13px] font-bold text-ss-ink">
              {label(r.cohort)}
              {!r.mature && (
                <span className="ml-2 rounded-full bg-ss-chip px-2 py-0.5 text-[12px] font-bold text-ss-slate">
                  still open
                </span>
              )}
            </span>
            <span className="text-[13px] font-semibold text-ss-slate">
              <span className="text-[15px] font-extrabold text-ss-ink">{r.returnRate}%</span>{' '}
              of {r.students.toLocaleString()}
            </span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-ss-chip">
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.max(1.5, r.returnRate)}%`,
                backgroundColor: r.mature ? 'var(--ss-accent)' : 'var(--ss-slate)',
                opacity: r.mature ? 1 : 0.45,
              }}
            />
          </div>
        </li>
      ))}
    </ol>
  )
}

/** What happens to work a teacher sets, as a single stacked bar plus the detail. */
function AssignmentHealthView({
  a,
}: {
  a: {
    set: number
    completed: number
    started: number
    neverOpened: number
    completionRate: number
    teachersSetting: number
    medianHoursToComplete: number | null
  }
}) {
  const share = (v: number) => (a.set > 0 ? (v / a.set) * 100 : 0)
  const segments = [
    { label: 'Handed in', value: a.completed, color: 'var(--ss-good)' },
    { label: 'Opened, not finished', value: a.started, color: 'var(--ss-warn)' },
    { label: 'Never opened', value: a.neverOpened, color: 'var(--ss-bad)' },
  ]

  return (
    <div>
      <p className="text-[34px] font-extrabold leading-none tracking-tight text-ss-ink">
        {a.completionRate}%
      </p>
      <p className="mt-1.5 text-[13px] font-semibold text-ss-slate">
        of set work comes back — {a.completed.toLocaleString()} of {a.set.toLocaleString()}
      </p>

      <div className="mt-4 flex h-7 w-full overflow-hidden rounded-lg bg-ss-chip">
        {segments.map((seg) => (
          <div
            key={seg.label}
            style={{ width: `${share(seg.value)}%`, backgroundColor: seg.color }}
            title={`${seg.label}: ${seg.value.toLocaleString()}`}
          />
        ))}
      </div>

      <dl className="mt-3 grid gap-2.5">
        {segments.map((seg) => (
          <div key={seg.label} className="flex items-center justify-between gap-3">
            <dt className="inline-flex items-center gap-2 text-[13px] font-medium text-ss-slate">
              <span aria-hidden className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: seg.color }} />
              {seg.label}
            </dt>
            <dd className="text-[14px] font-extrabold text-ss-ink">{seg.value.toLocaleString()}</dd>
          </div>
        ))}
        {a.medianHoursToComplete !== null && (
          <div className="flex items-center justify-between gap-3 border-t border-ss-line pt-2.5">
            <dt className="text-[13px] font-medium text-ss-slate">Median time to hand in</dt>
            <dd className="text-[14px] font-extrabold text-ss-ink">
              {a.medianHoursToComplete < 24
                ? `${a.medianHoursToComplete} hrs`
                : `${Math.round(a.medianHoursToComplete / 24)} days`}
            </dd>
          </div>
        )}
      </dl>
    </div>
  )
}

/** Papers per curriculum — which of the loaded syllabuses anyone is actually on. */
function CurriculumTable({
  rows,
}: {
  rows: { curriculum: string; assessments: number; papers: number; avgScore: number | null }[]
}) {
  const max = Math.max(1, ...rows.map((r) => r.papers))
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[380px] border-collapse text-left">
        <thead>
          <tr className="border-b border-ss-line">
            <th scope="col" className="pb-2 text-[12px] font-bold uppercase tracking-wide text-ss-slate">Curriculum</th>
            <th scope="col" className="pb-2 text-right text-[12px] font-bold uppercase tracking-wide text-ss-slate">Built</th>
            <th scope="col" className="pb-2 text-right text-[12px] font-bold uppercase tracking-wide text-ss-slate">Sat</th>
            <th scope="col" className="pb-2 text-right text-[12px] font-bold uppercase tracking-wide text-ss-slate">Average</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.curriculum} className="border-b border-ss-line last:border-0">
              <td className="py-2.5">
                <span className="text-[13px] font-bold text-ss-ink">{r.curriculum}</span>
                <span
                  aria-hidden
                  className="mt-1 block h-1.5 rounded-full bg-ss-accent-soft"
                  style={{ width: `${(r.papers / max) * 100}%` }}
                />
              </td>
              <td className="py-2.5 text-right text-[13px] font-semibold text-ss-slate">
                {r.assessments.toLocaleString()}
              </td>
              <td className="py-2.5 text-right text-[13px] font-semibold text-ss-slate">
                {r.papers.toLocaleString()}
              </td>
              <td className="py-2.5 text-right text-[13px] font-extrabold text-ss-ink">
                {r.avgScore === null ? '—' : `${r.avgScore}%`}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
