import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { pgErrorMessage } from '@/lib/pg-errors'
import { isExamPrepCurriculumNumeric, slugForTextbookCurriculum } from '@/lib/curriculum-registry'
import type { MasteryStatus } from '@/lib/studylab/types'
import { masteryNumber, sumAccuracies } from '@/lib/studylab/mastery-numbers'
import { unlinkedSummary } from '@/lib/studylab/wall'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

interface MasteryRow {
  topic_id: number | null
  subtopic_id: number | null
  attempts: number | null
  correct: number | null
  accuracy: number | null
  last_assessed: string | null
}

function classify(accuracy: number | null, attempts: number | null): MasteryStatus {
  if (!attempts || attempts <= 0 || accuracy === null) return 'not_assessed'
  if (accuracy >= 80) return 'mastered'
  if (accuracy >= 50) return 'developing'
  return 'gap'
}

interface SubtopicNode {
  id: number
  name: string
  status: MasteryStatus
  accuracy: number | null
  attempts: number
  last_assessed: string | null
}
interface TopicNode {
  id: number
  name: string
  status: MasteryStatus
  accuracy: number | null
  attempts: number
  last_assessed: string | null
  subtopics_assessed: number
  /** coloured from a single-topic quiz rather than subtopic-level evidence */
  topic_level_only: boolean
  subtopics: SubtopicNode[]
}
interface AssessmentResult {
  id: string
  label: string
  difficulty: string | null
  percentage: number | null
  score: number | null
  total_questions: number | null
  created_at: string | null
  status: MasteryStatus
  topic_count: number
}
interface SubjectNode {
  id: number | null
  name: string
  curriculum_slug: string
  status: MasteryStatus
  accuracy: number | null
  /** Overall average of the quizzes taken — context only, shown when topic-level
   *  mastery can't be rolled up yet. */
  overall_quiz_avg: number | null
  attempts: number
  last_assessed: string | null
  topics: TopicNode[]
  topics_assessed: number
  assessments: AssessmentResult[]
}

function normalizeName(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ')
}

// topic_ids / subtopic_ids may arrive as a Postgres int[] or a JSON string.
function toIdArray(value: unknown): number[] {
  if (Array.isArray(value)) return value.map((v) => Number(v)).filter((n) => Number.isFinite(n) && n > 0)
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      if (Array.isArray(parsed)) return parsed.map((v) => Number(v)).filter((n) => Number.isFinite(n) && n > 0)
    } catch {
      // "{1,2,3}" style array literal
      return value.replace(/[{}]/g, '').split(',').map((v) => Number(v.trim())).filter((n) => Number.isFinite(n) && n > 0)
    }
  }
  return []
}

function subjectKeyForBucket(b: { id: number | null; name: string }): string {
  return b.id !== null ? `tb-${b.id}` : `name-${normalizeName(b.name)}`
}

interface Agg { sum: number; n: number; last: string | null }
function pushAgg(map: Map<number, Agg>, id: number, pct: number, at: string | null) {
  const cur = map.get(id)
  if (cur) {
    cur.sum += pct
    cur.n += 1
    if (at && (!cur.last || new Date(at) > new Date(cur.last))) cur.last = at
  } else {
    map.set(id, { sum: pct, n: 1, last: at })
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = String(searchParams.get('user_id') ?? '').trim()

    if (!userId || !UUID_RE.test(userId)) {
      return NextResponse.json({ error: 'A valid user_id is required' }, { status: 400 })
    }

    // 1. The student's actual results (the assessments they've taken).
    const resultRowsRes = await db.query(
      `SELECT assessment_id, percentage, score, total_questions, created_at
       FROM results WHERE user_id = $1 AND assessment_id IS NOT NULL`,
      [userId]
    )
    const resultRows = resultRowsRes.rows

    // Results saved without a quiz behind them (teacher-set quizzes are saved
    // this way) can't be placed on a chapter, but they are the student's
    // results: counted and averaged so the page can say so, rather than
    // telling someone with a term of quizzes to go and take one.
    const unlinkedRes = await db.query(
      `SELECT percentage, created_at FROM results WHERE user_id = $1 AND assessment_id IS NULL`,
      [userId]
    )
    const unlinked = unlinkedSummary(unlinkedRes.rows ?? [])

    const results = (resultRows ?? []).filter((r: any) => r.assessment_id)
    if (results.length === 0) {
      return NextResponse.json({
        data: { textbooks: [], summary: emptySummary(), unlinked_results: unlinked },
        warning: unlinked ? null : 'No assessment history yet — take a few quizzes and your gap map will fill in automatically.',
      })
    }

    // 2. The assessments behind those results.
    const assessmentIds = [...new Set(results.map((r: any) => r.assessment_id))]
    const assessmentRowsRes = await db.query(
      `SELECT id, subject, difficulty, textbook_id, topic_ids, subtopic_ids
       FROM assessments WHERE id = ANY($1::uuid[])`,
      [assessmentIds]
    )
    const assessmentRows = assessmentRowsRes.rows

    const assessmentById = new Map<string, any>()
    for (const a of assessmentRows ?? []) assessmentById.set(String((a as any).id), a)

    // 3. Resolve each assessment to a "subject" bucket — prefer a real textbook,
    //    else fall back to the assessment's subject name.
    const textbookIdsFromAssessments = new Set<number>()
    const subjectNames = new Set<string>()
    for (const a of assessmentRows ?? []) {
      const tid = Number((a as any).textbook_id)
      if (Number.isFinite(tid) && tid > 0) textbookIdsFromAssessments.add(tid)
      else if ((a as any).subject) subjectNames.add(String((a as any).subject))
    }

    // Textbooks referenced directly by id (include curriculum for exam-prep exclusion).
    const textbookById = new Map<number, { id: number; name: string; curriculum: number | null }>()
    const examPrepTextbookIds = new Set<number>()
    if (textbookIdsFromAssessments.size > 0) {
      const tbRowsRes = await db.query(
        `SELECT textbook_id, textbook_name, curriculum FROM textbooks WHERE textbook_id = ANY($1::int[])`,
        [[...textbookIdsFromAssessments]]
      )
      const tbRows = tbRowsRes.rows
      for (const t of tbRows ?? []) {
        const id = Number((t as any).textbook_id)
        const curriculum = Number.isFinite(Number((t as any).curriculum)) ? Number((t as any).curriculum) : null
        textbookById.set(id, { id, name: String((t as any).textbook_name), curriculum })
        if (isExamPrepCurriculumNumeric(curriculum)) examPrepTextbookIds.add(id)
      }
    }

    // Drop WAEC/JAMB exam-prep results — those stay in Exam Prep, not Learning Gaps.
    const schoolResults = results.filter((r: any) => {
      const a = assessmentById.get(String(r.assessment_id))
      if (!a) return false
      const tid = Number(a.textbook_id)
      if (Number.isFinite(tid) && tid > 0 && examPrepTextbookIds.has(tid)) return false
      return true
    })
    if (schoolResults.length === 0) {
      return NextResponse.json({
        data: { textbooks: [], summary: emptySummary(), unlinked_results: unlinked },
        warning: unlinked ? null : 'No school assessment history yet — take a few quizzes and your gap map will fill in automatically.',
      })
    }

    // Textbooks matched by subject name (legacy assessments without textbook_id).
    const textbookByName = new Map<string, { id: number; name: string }>()
    if (subjectNames.size > 0) {
      const nameRowsRes = await db.query(
        `SELECT textbook_id, textbook_name FROM textbooks WHERE textbook_name = ANY($1::varchar[])`,
        [[...subjectNames]]
      )
      const nameRows = nameRowsRes.rows
      for (const t of nameRows ?? []) {
        textbookByName.set(normalizeName(String((t as any).textbook_name)), {
          id: Number((t as any).textbook_id),
          name: String((t as any).textbook_name),
        })
      }
    }

    // 4. Per-subtopic / per-topic mastery overlay for this user.
    const bySubtopic = new Map<number, MasteryRow>()
    const byTopic = new Map<number, MasteryRow>()
    const masteryRowsRes = await db.query(
      `SELECT textbook_id, topic_id, subtopic_id, attempts, correct, accuracy, last_assessed
       FROM topic_mastery WHERE user_id = $1`,
      [userId]
    )
    const masteryRows = masteryRowsRes.rows

    const masteryTextbookIds = new Set<number>()
    for (const m of masteryRows ?? []) {
      const tbId = Number((m as any).textbook_id)
      if (Number.isFinite(tbId) && tbId > 0 && !textbookById.has(tbId)) masteryTextbookIds.add(tbId)
    }
    if (masteryTextbookIds.size > 0) {
      const extraTbRes = await db.query(
        `SELECT textbook_id, curriculum FROM textbooks WHERE textbook_id = ANY($1::int[])`,
        [[...masteryTextbookIds]]
      )
      const extraTb = extraTbRes.rows
      for (const t of extraTb ?? []) {
        const id = Number((t as any).textbook_id)
        const curriculum = Number.isFinite(Number((t as any).curriculum)) ? Number((t as any).curriculum) : null
        if (isExamPrepCurriculumNumeric(curriculum)) examPrepTextbookIds.add(id)
      }
    }

    for (const m of (masteryRows ?? []) as MasteryRow[]) {
      const tbId = Number((m as any).textbook_id)
      if (Number.isFinite(tbId) && examPrepTextbookIds.has(tbId)) continue
      if (m.subtopic_id && m.subtopic_id > 0) bySubtopic.set(Number(m.subtopic_id), m)
      else if (m.topic_id && m.topic_id > 0) byTopic.set(Number(m.topic_id), m)
    }

    // 5. Aggregate the student's score per subject bucket from their results.
    interface Bucket {
      id: number | null
      name: string
      scoreSum: number
      attempts: number
      lastAt: string | null
    }
    const buckets = new Map<string, Bucket>()
    // Per-subject assessment breakdown + score attributed down to the topics /
    // subtopics each assessment actually covered (so the tree shows real mastery).
    const assessmentsByKey = new Map<string, AssessmentResult[]>()
    const topicAgg = new Map<number, Agg>()
    const subAgg = new Map<number, Agg>()
    // Quizzes that targeted exactly ONE topic (and no subtopics) — a legitimate
    // topic-level signal, never a cross-topic smear.
    const focusedTopicAgg = new Map<number, Agg>()

    for (const r of schoolResults) {
      const a = assessmentById.get(String((r as any).assessment_id))
      if (!a) continue
      const tid = Number(a.textbook_id)
      let resolved: { id: number | null; name: string }
      if (Number.isFinite(tid) && tid > 0 && textbookById.has(tid)) {
        resolved = textbookById.get(tid)!
      } else {
        const subjName = String(a.subject ?? 'Other')
        const match = textbookByName.get(normalizeName(subjName))
        resolved = match ?? { id: null, name: subjName }
      }
      const key = resolved.id !== null ? `tb-${resolved.id}` : `name-${normalizeName(resolved.name)}`
      const pct = Number((r as any).percentage ?? (r as any).score)
      const safePct = Number.isFinite(pct) ? pct : 0
      const createdAt = (r as any).created_at ?? null

      const existing = buckets.get(key)
      if (existing) {
        existing.scoreSum += safePct
        existing.attempts += 1
        if (createdAt && (!existing.lastAt || new Date(createdAt) > new Date(existing.lastAt))) existing.lastAt = createdAt
      } else {
        buckets.set(key, { id: resolved.id, name: resolved.name, scoreSum: safePct, attempts: 1, lastAt: createdAt })
      }

      // Attribute this result's score to the topics / subtopics it targeted.
      const topicIds = toIdArray(a.topic_ids)
      const subtopicIds = toIdArray(a.subtopic_ids)
      for (const t of topicIds) pushAgg(topicAgg, t, safePct, createdAt)
      for (const s of subtopicIds) pushAgg(subAgg, s, safePct, createdAt)
      if (topicIds.length === 1 && subtopicIds.length === 0) pushAgg(focusedTopicAgg, topicIds[0], safePct, createdAt)

      // Record the assessment in this subject's breakdown.
      const list = assessmentsByKey.get(key) ?? []
      list.push({
        id: String((r as any).assessment_id),
        label: String(a.subject ?? resolved.name),
        difficulty: a.difficulty ? String(a.difficulty) : null,
        percentage: Number.isFinite(pct) ? Math.round(pct) : null,
        score: Number.isFinite(Number((r as any).score)) ? Number((r as any).score) : null,
        total_questions: Number.isFinite(Number((r as any).total_questions)) ? Number((r as any).total_questions) : null,
        created_at: createdAt,
        status: classify(Number.isFinite(pct) ? pct : null, 1),
        topic_count: topicIds.length,
      })
      assessmentsByKey.set(key, list)
    }

    // 6. For subjects backed by a real textbook, load the topic/subtopic tree.
    const subjectTextbookIds = [...buckets.values()].map((b) => b.id).filter((x): x is number => x !== null)
    const topicsByTextbook = new Map<number, { id: number; name: string }[]>()
    const subtopicsByTopic = new Map<number, { id: number; name: string }[]>()
    if (subjectTextbookIds.length > 0) {
      const topicRowsRes = await db.query(
        `SELECT topic_id, topic, textbook_id FROM topics
         WHERE textbook_id = ANY($1::int[]) ORDER BY topic`,
        [subjectTextbookIds]
      )
      const topicRows = topicRowsRes.rows
      const allTopicIds: number[] = []
      for (const t of topicRows ?? []) {
        const tbId = Number((t as any).textbook_id)
        const arr = topicsByTextbook.get(tbId) ?? []
        arr.push({ id: Number((t as any).topic_id), name: String((t as any).topic) })
        topicsByTextbook.set(tbId, arr)
        allTopicIds.push(Number((t as any).topic_id))
      }
      if (allTopicIds.length > 0) {
        const subRowsRes = await db.query(
          `SELECT subtopic_id, subtopic, topic_id FROM subtopics
           WHERE topic_id = ANY($1::int[]) ORDER BY subtopic`,
          [allTopicIds]
        )
        const subRows = subRowsRes.rows
        for (const s of subRows ?? []) {
          const tId = Number((s as any).topic_id)
          const arr = subtopicsByTopic.get(tId) ?? []
          arr.push({ id: Number((s as any).subtopic_id), name: String((s as any).subtopic) })
          subtopicsByTopic.set(tId, arr)
        }
      }
    }

    // 7. Build the subject tree with mastery overlay.
    const counts = { mastered: 0, developing: 0, gap: 0, not_assessed: 0 }
    const subjects: SubjectNode[] = [...buckets.values()].map((b) => {
      const topicList = b.id !== null ? topicsByTextbook.get(b.id) ?? [] : []

      // ── Coverage-weighted bottom-up rollup ────────────────────────────────
      // Mastery is built from real subtopic evidence and weighted by coverage:
      //   topic mastery   = Σ(assessed subtopic score) / TOTAL subtopics
      //   subject mastery = Σ(assessed topic mastery)   / TOTAL topics
      // Unassessed children count as 0, so partial coverage can never read as
      // full mastery (e.g. 1 of 6 subtopics at 60% → topic ≈ 10%, not 60%).
      // We deliberately do NOT smear a whole-quiz score across the topics it
      // merely touched — only subtopic-level evidence colours the tree.
      const topicNodes: TopicNode[] = topicList.map((t) => {
        const subs = subtopicsByTopic.get(t.id) ?? []
        const subNodes: SubtopicNode[] = subs.map((s) => {
          const m = bySubtopic.get(s.id)
          const derived = subAgg.get(s.id)
          if (m && (m.attempts ?? 0) > 0) {
            const accuracy = masteryNumber(m.accuracy)
            return { id: s.id, name: s.name, status: classify(accuracy, m.attempts), accuracy, attempts: m.attempts ?? 0, last_assessed: m.last_assessed ?? null }
          }
          if (derived) {
            const acc = Math.round(derived.sum / derived.n)
            return { id: s.id, name: s.name, status: classify(acc, derived.n), accuracy: acc, attempts: derived.n, last_assessed: derived.last }
          }
          return { id: s.id, name: s.name, status: 'not_assessed', accuracy: null, attempts: 0, last_assessed: null }
        })

        const assessedSubs = subNodes.filter((s) => s.status !== 'not_assessed')
        let topicStatus: MasteryStatus = 'not_assessed'
        let topicAccuracy: number | null = null
        let topicAttempts = 0
        let topicLast: string | null = null
        let topicLevelOnly = false
        const focusedT = focusedTopicAgg.get(t.id)
        const topicMastery = byTopic.get(t.id)

        if (assessedSubs.length > 0) {
          // Best signal: coverage-weighted over the topic's full set of subtopics.
          const sum = sumAccuracies(assessedSubs.map((s) => s.accuracy))
          const denom = subs.length > 0 ? subs.length : assessedSubs.length
          topicAccuracy = Math.round((sum / denom) * 100) / 100
          topicStatus = classify(topicAccuracy, assessedSubs.length)
          topicAttempts = assessedSubs.reduce((acc, s) => acc + s.attempts, 0)
          topicLast = assessedSubs.reduce<string | null>((acc, s) => (s.last_assessed && (!acc || new Date(s.last_assessed) > new Date(acc)) ? s.last_assessed : acc), null)
        } else if (topicMastery && (topicMastery.attempts ?? 0) > 0) {
          // Persisted topic-level mastery (e.g. a quiz scored at topic grain).
          topicStatus = classify(masteryNumber(topicMastery.accuracy), topicMastery.attempts ?? null)
          topicAccuracy = masteryNumber(topicMastery.accuracy)
          topicAttempts = topicMastery.attempts ?? 0
          topicLast = topicMastery.last_assessed ?? null
          topicLevelOnly = subs.length > 0
        } else if (focusedT) {
          // A quiz that targeted only this topic — legitimate topic-level signal.
          topicAccuracy = Math.round((focusedT.sum / focusedT.n) * 100) / 100
          topicStatus = classify(topicAccuracy, focusedT.n)
          topicAttempts = focusedT.n
          topicLast = focusedT.last
          topicLevelOnly = subs.length > 0
        } else if (subs.length === 0) {
          // No subtopics in the curriculum — fall back to broad topic attribution.
          const derivedT = topicAgg.get(t.id)
          if (derivedT) {
            topicAccuracy = Math.round((derivedT.sum / derivedT.n) * 100) / 100
            topicStatus = classify(topicAccuracy, derivedT.n)
            topicAttempts = derivedT.n
            topicLast = derivedT.last
          }
        }

        return { id: t.id, name: t.name, status: topicStatus, accuracy: topicAccuracy, attempts: topicAttempts, last_assessed: topicLast, subtopics_assessed: assessedSubs.length, topic_level_only: topicLevelOnly, subtopics: subNodes }
      })

      // Subject mastery rolls up coverage-weighted from its assessed topics.
      const assessedTopics = topicNodes.filter((t) => t.status !== 'not_assessed')
      const rawAvg = b.attempts > 0 ? Math.round((b.scoreSum / b.attempts) * 100) / 100 : null
      let subjectAccuracy: number | null
      let subjectStatus: MasteryStatus
      if (topicNodes.length === 0) {
        // No curriculum tree to build from — the overall quiz average is the only
        // signal we have, so use it directly.
        subjectAccuracy = rawAvg
        subjectStatus = classify(rawAvg, b.attempts)
      } else if (assessedTopics.length > 0) {
        const sum = sumAccuracies(assessedTopics.map((t) => t.accuracy))
        subjectAccuracy = Math.round((sum / topicNodes.length) * 100) / 100
        subjectStatus = classify(subjectAccuracy, assessedTopics.length)
      } else {
        // The curriculum exists but no topic has real evidence yet. Don't claim a
        // mastery status — stay Not Assessed and surface the quiz average as context.
        subjectAccuracy = null
        subjectStatus = 'not_assessed'
      }

      const assessments = (assessmentsByKey.get(subjectKeyForBucket(b)) ?? []).sort((x, y) => {
        const dx = x.created_at ? new Date(x.created_at).getTime() : 0
        const dy = y.created_at ? new Date(y.created_at).getTime() : 0
        return dy - dx
      })

      counts[subjectStatus] += 1
      const tbMeta = b.id !== null ? textbookById.get(b.id) : null
      const curriculumSlug = slugForTextbookCurriculum(tbMeta?.curriculum ?? null)
      return {
        id: b.id,
        name: b.name,
        curriculum_slug: curriculumSlug,
        status: subjectStatus,
        accuracy: subjectAccuracy,
        overall_quiz_avg: rawAvg,
        attempts: b.attempts,
        last_assessed: b.lastAt,
        topics: topicNodes,
        topics_assessed: assessedTopics.length,
        assessments,
      }
    })

    // Sort weakest-first so the worst subjects surface at the top of the selector.
    const statusRank: Record<MasteryStatus, number> = { gap: 0, developing: 1, not_assessed: 2, mastered: 3 }
    subjects.sort((a, b) => {
      const s = statusRank[a.status] - statusRank[b.status]
      if (s !== 0) return s
      return (a.accuracy ?? 100) - (b.accuracy ?? 100)
    })

    const totalAssessed = counts.mastered + counts.developing + counts.gap
    const overallMastery = totalAssessed > 0 ? Math.round((counts.mastered / totalAssessed) * 100) : 0

    return NextResponse.json({
      data: {
        source: 'assessments',
        textbooks: subjects,
        summary: { ...counts, total_assessed: totalAssessed, overall_mastery: overallMastery },
        unlinked_results: unlinked,
      },
    })
  } catch (err) {
    console.error('Gap map error:', err)
    return NextResponse.json({ error: 'Failed to build the learning gap map' }, { status: 500 })
  }
}

function emptySummary() {
  return { mastered: 0, developing: 0, gap: 0, not_assessed: 0, total_assessed: 0, overall_mastery: 0 }
}
