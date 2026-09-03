// lib/studylab/homework.ts
import type { LessonStep } from './lessonRun'
import type { StudyEdge, StudyNode } from './types'

/**
 * One question off a homework sheet, as read rather than as solved.
 *
 * `attempt` is the half that turns out to matter most. Both of the real sheets
 * this was built against were photographed with the student's own working
 * already on them — a full solution in one case, ending "B is better" — because
 * that is what someone asking for homework help usually has in front of them.
 * A tutor that opens with "let's start from the beginning" on a page that is
 * already three quarters done is not reading the room, or the page.
 */
export interface HomeworkQuestion {
  /** Ours, stable within a sheet: q1, q2, … */
  id: string
  /** As printed: "1", "Q3", "7.4-7". Shown to the learner. */
  label: string
  /** The question itself, transcribed. */
  text: string
  /** What a correct final answer is, where that can be told from the sheet. */
  answer: string | null
  /** What a good answer has to show. Carried into the step's check. */
  rubric: string | null
  /** The learner's own working, if the photo already has some on it. */
  attempt: string | null
}

export interface HomeworkSheet {
  /** Best guess, for naming and for pitching the help. */
  subject: string
  /**
   * Data every question on the sheet leans on: a table, the values off a
   * diagram, "take g = 9.81". Read once and carried into every turn, because
   * the photo itself is not sent again after this.
   */
  given: string[]
  questions: HomeworkQuestion[]
}

/** A sheet with nothing readable on it. Never a thrown error. */
export const EMPTY_SHEET: HomeworkSheet = { subject: '', given: [], questions: [] }

const MAX_QUESTIONS = 12
const MAX_TEXT = 1200
const MAX_GIVEN = 8

function str(v: unknown, max = MAX_TEXT): string {
  return typeof v === 'string' ? v.trim().slice(0, max) : ''
}

function orNull(v: unknown, max = MAX_TEXT): string | null {
  const s = str(v, max)
  return s.length > 0 ? s : null
}

/**
 * Narrows whatever the read returned into a sheet, without trusting its shape.
 *
 * A question with no text cannot be worked on, shown, or checked, so it is
 * dropped rather than carried as an empty step. Everything else is best-effort:
 * a missing answer or rubric is normal — plenty of questions have no single
 * right answer, and the marking reads the working in that case.
 */
export function parseHomeworkSheet(raw: unknown): HomeworkSheet {
  if (!raw || typeof raw !== 'object') return EMPTY_SHEET
  const r = raw as { subject?: unknown; given?: unknown; questions?: unknown }

  const given = (Array.isArray(r.given) ? r.given : [])
    .map((g) => str(g, 400))
    .filter((g) => g.length > 0)
    .slice(0, MAX_GIVEN)

  // Numbered after the unusable ones are dropped, not before: ids that skip
  // q1 because the first entry came back blank would be a puzzle for anything
  // reading them later, and they are the only handle the learner's choice has.
  const questions: HomeworkQuestion[] = (Array.isArray(r.questions) ? r.questions : [])
    .map((q) => {
      if (!q || typeof q !== 'object') return null
      const o = q as Record<string, unknown>
      const text = str(o.text)
      return text ? { o, text } : null
    })
    .filter((q): q is { o: Record<string, unknown>; text: string } => q !== null)
    .slice(0, MAX_QUESTIONS)
    .map(({ o, text }, i) => ({
      id: `q${i + 1}`,
      label: str(o.label, 12) || String(i + 1),
      text,
      answer: orNull(o.answer, 300),
      rubric: orNull(o.rubric, 400),
      attempt: orNull(o.attempt),
    }))

  return { subject: str(r.subject, 40), given, questions }
}

/**
 * A short name for a question, for the rail and the step title.
 *
 * The rail is narrow and a question is a paragraph, so it gets the first clause
 * of the first sentence — long enough to tell "Q1" from "Q2" at a glance, which
 * is the entire job.
 */
export function questionSummary(text: string): string {
  const firstSentence = (text.split(/(?<=[.?])\s/)[0] ?? text).trim()
  const clause = firstSentence.split(/,| — | – /)[0].trim()
  // A clause this short is not a name for anything: "Solve" and "Find x" tell
  // you nothing about which of four questions you are looking at.
  const short = clause.length >= 20 ? clause : firstSentence
  return short.length > 60 ? `${short.slice(0, 57).trimEnd()}…` : short
}

/**
 * The chosen questions, as the lesson's steps.
 *
 * This is what replaces drafting a syllabus. The questions on the sheet are
 * already an ordered plan the learner agreed to by being set it, so asking a
 * model to invent a different one was never going to beat reading the one they
 * have — and it produced a five-step course in Engineering Economics for
 * someone holding a single pump question.
 *
 * `goal` is the question in full: it is what the teaching turn needs in front
 * of it, and the rail already renders it under the title.
 */
export function stepsFromQuestions(
  sheet: HomeworkSheet,
  chosenIds: string[],
  /** Steps already in the plan, when a second page is being added to it. */
  stepOffset = 0,
): LessonStep[] {
  const wanted = new Set(chosenIds)
  return sheet.questions
    .filter((q) => wanted.has(q.id))
    .map((q, i) => ({
      id: q.id,
      // The rail numbers the steps itself, so a label that says the same thing
      // reads as "1. 1. An engineer must…". It is kept when it differs — which
      // is whenever the sheet numbers questions its own way ("7.4-7"), the
      // learner picked questions 3 and 5 off a page of eight, or this is page
      // two and its question 1 is the plan's step 4.
      title:
        q.label === String(stepOffset + i + 1)
          ? questionSummary(q.text)
          : `${q.label}. ${questionSummary(q.text)}`,
      goal: q.text,
      status: 'pending' as const,
      cardIds: [],
      homework: {
        label: q.label,
        answer: q.answer,
        rubric: q.rubric,
        attempt: q.attempt,
      },
    }))
}

/**
 * The chosen questions, as cards on the board.
 *
 * Built here rather than asked of the model: a question card is a transcription
 * of the learner's own sheet, not something a tutor writes, and nothing about
 * it should be able to drift. `question` is deliberately absent from
 * `CARD_KINDS` for the same reason — there is no `createCard` that can make one.
 *
 * Each hangs off the photo, so the board reads "this page, and this question
 * off it, and the working under that".
 */
export function questionCards(
  sheet: HomeworkSheet,
  chosenIds: string[],
  photoId: string | null,
  /** Steps already in the plan, when a second page is being added to it. */
  stepOffset = 0,
): { nodes: StudyNode[]; edges: StudyEdge[] } {
  const wanted = new Set(chosenIds)
  const chosen = sheet.questions.filter((q) => wanted.has(q.id))

  const nodes: StudyNode[] = chosen.map((q, i) => ({
    id: `hw-${q.id}`,
    type: 'question',
    position: { x: 0, y: 0 },
    data: {
      kind: 'question',
      title: `Question ${q.label}`,
      body: q.text,
      // The step it opens, 1-based like every other card on the board.
      step: stepOffset + i + 1,
    },
  }))

  const edges: StudyEdge[] = photoId
    ? chosen.map((q, i) => ({
        id: `e-${photoId}-hw-${q.id}`,
        source: photoId,
        target: `hw-${q.id}`,
        label: chosen.length > 1 ? q.label : undefined,
      }))
    : []

  return { nodes, edges }
}

/**
 * A second page, added to the sheet already being worked.
 *
 * The questions coming in are renumbered onto the end, because `q1` means
 * "the first question of this sheet" and page two starts its own numbering at
 * one — two `q1`s in a plan is two steps the run cannot tell apart. Their
 * printed labels are left exactly as they are: "1" on page two is question 1 on
 * page two, and pretending otherwise would not match the paper in front of them.
 *
 * `given` is concatenated because it is the data the tutor works from and the
 * photos are never looked at again. Exact repeats are dropped — two pages of
 * one assignment often reprint the same table.
 */
export function mergeSheets(existing: HomeworkSheet, incoming: HomeworkSheet): HomeworkSheet {
  const offset = existing.questions.length
  const added = incoming.questions.map((q, i) => ({ ...q, id: `q${offset + i + 1}` }))
  const given = [...existing.given]
  for (const g of incoming.given) if (!given.includes(g)) given.push(g)
  return {
    subject: existing.subject || incoming.subject,
    given: given.slice(0, MAX_GIVEN),
    questions: [...existing.questions, ...added].slice(0, MAX_QUESTIONS),
  }
}
