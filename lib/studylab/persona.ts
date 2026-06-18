import type { MasteryStatus } from '@/lib/studylab/types'

export interface WeakArea {
  kind: 'subtopic' | 'topic'
  label: string
  subjectName: string
  status: MasteryStatus
  accuracy: number | null
  textbook_id: number | null
  topic_id: number
  subtopic_id?: number
  last_assessed: string | null
}

export interface PersonaSnapshot {
  hasHistory: boolean
  weekQuizzes: number
  weekAvg: number | null
  weakAreas: WeakArea[]
  summary: {
    gaps: number
    developing: number
    mastered: number
    subjects: number
  }
  headline: string
  subline: string
}

interface GapAssessment {
  percentage: number | null
  created_at: string | null
}

interface GapSubtopic {
  id: number
  name: string
  status: MasteryStatus
  accuracy: number | null
  last_assessed: string | null
}

interface GapTopic {
  id: number
  name: string
  status: MasteryStatus
  accuracy: number | null
  last_assessed: string | null
  subtopics: GapSubtopic[]
}

interface GapSubject {
  id: number | null
  name: string
  status: MasteryStatus
  accuracy: number | null
  topics: GapTopic[]
  assessments: GapAssessment[]
}

interface GapTreeInput {
  textbooks: GapSubject[]
  summary: {
    gap: number
    developing: number
    mastered: number
    not_assessed: number
  }
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000

function isThisWeek(iso: string | null): boolean {
  if (!iso) return false
  const t = new Date(iso).getTime()
  return Number.isFinite(t) && Date.now() - t <= WEEK_MS
}

function statusRank(s: MasteryStatus): number {
  if (s === 'gap') return 0
  if (s === 'developing') return 1
  if (s === 'not_assessed') return 2
  return 3
}

export function buildPersonaFromGapTree(data: GapTreeInput): PersonaSnapshot {
  const subjects = data.textbooks ?? []
  const summary = data.summary ?? { gap: 0, developing: 0, mastered: 0, not_assessed: 0 }

  const weekScores: number[] = []
  for (const s of subjects) {
    for (const a of s.assessments ?? []) {
      if (isThisWeek(a.created_at) && typeof a.percentage === 'number') weekScores.push(a.percentage)
    }
  }
  const weekQuizzes = weekScores.length
  const weekAvg =
    weekScores.length > 0 ? Math.round(weekScores.reduce((a, b) => a + b, 0) / weekScores.length) : null

  const weakAreas: WeakArea[] = []
  for (const subject of subjects) {
    if (!subject.id) continue
    for (const topic of subject.topics ?? []) {
      for (const sub of topic.subtopics ?? []) {
        if (sub.status === 'gap' || sub.status === 'developing') {
          weakAreas.push({
            kind: 'subtopic',
            label: sub.name,
            subjectName: subject.name,
            status: sub.status,
            accuracy: sub.accuracy,
            textbook_id: subject.id,
            topic_id: topic.id,
            subtopic_id: sub.id,
            last_assessed: sub.last_assessed,
          })
        }
      }
      if (
        (topic.status === 'gap' || topic.status === 'developing') &&
        !topic.subtopics.some((s) => s.status === 'gap' || s.status === 'developing')
      ) {
        weakAreas.push({
          kind: 'topic',
          label: topic.name,
          subjectName: subject.name,
          status: topic.status,
          accuracy: topic.accuracy,
          textbook_id: subject.id,
          topic_id: topic.id,
          last_assessed: topic.last_assessed,
        })
      }
    }
  }

  weakAreas.sort((a, b) => {
    const sr = statusRank(a.status) - statusRank(b.status)
    if (sr !== 0) return sr
    return (a.accuracy ?? 100) - (b.accuracy ?? 100)
  })

  const topWeak = weakAreas.slice(0, 5)
  const hasHistory = subjects.some((s) => (s.assessments?.length ?? 0) > 0)

  let headline = 'Your learning snapshot'
  let subline = 'Take a few quizzes and your weak spots will show up here automatically.'

  if (hasHistory && weekQuizzes > 0) {
    headline = `This week: ${weekQuizzes} quiz${weekQuizzes > 1 ? 'zes' : ''}${weekAvg != null ? ` · ${weekAvg}% avg` : ''}`
    if (topWeak.length > 0) {
      subline = `${summary.gap} gap${summary.gap !== 1 ? 's' : ''} and ${summary.developing} developing area${summary.developing !== 1 ? 's' : ''} across ${subjects.length} subject${subjects.length !== 1 ? 's' : ''}.`
    } else {
      subline = 'No assessed weak spots yet — take topic-focused quizzes to map your gaps.'
    }
  } else if (hasHistory) {
    headline = 'Pick up where you left off'
    subline =
      topWeak.length > 0
        ? `${topWeak.length} area${topWeak.length > 1 ? 's' : ''} need attention from your past quizzes.`
        : 'Your quiz history is here — topic-level mapping fills in as you assess specific areas.'
  }

  return {
    hasHistory,
    weekQuizzes,
    weekAvg,
    weakAreas: topWeak,
    summary: {
      gaps: summary.gap,
      developing: summary.developing,
      mastered: summary.mastered,
      subjects: subjects.length,
    },
    headline,
    subline,
  }
}
