/**
 * Holding a generated question to the slot that asked for it.
 *
 * `checkpoint-paper.ts` says, at the top of the file:
 *
 *   "Marks come from the slot, never from what the model claimed a question
 *    was worth -- the prompt asks for a 2-mark question and gets back
 *    "marks": 6 often enough that trusting it would make the totals
 *    meaningless. An instruction the model can ignore is not a rule, so the
 *    rule lives in code."
 *
 * The rule did not live in code. The Checkpoint route returned whatever came
 * back, so an ESL paper printed as 42 marks awarded 86 -- one "tick all the
 * correct statements" slot worth one mark came back worth five -- and every
 * "draw a ring around" slot came back as a written answer instead, because
 * nothing checked.
 *
 * Two different failures, so two different answers. Marks are STAMPED: the
 * slot is right by definition and the model's number is noise. Shape is
 * CHECKED and the batch re-asked: an MCQ with no options cannot be repaired
 * by renaming its type, and a question that is silently the wrong kind is how
 * a paper ends up all one thing.
 */
import { isWritingTask } from './passage-question-match'

export type SlotFormat = 'short' | 'select' | 'tick' | 'table' | 'written' | 'composition' | 'justify'

export interface SlotSpec {
  marks: number
  format: SlotFormat
}

/** What a question of this format has to look like once it comes back. */
function shapeIsRight(q: any, format: SlotFormat, slotMarks = 1): boolean {
  if (!q || typeof q !== 'object') return false
  switch (format) {
    case 'select':
      // "Draw a ring around the correct answer" -- four printed options.
      return q.type === 'mcq'
        && Array.isArray(q.options) && q.options.length >= 3
        && Number.isInteger(Number(q.correct_answer))
    case 'tick':
      return q.type === 'interactive' && q.kind === 'multi_select'
        && Array.isArray(q.options) && q.options.length >= 3
        && Array.isArray(q.correct_indices) && q.correct_indices.length > 0
    case 'table':
      return q.type === 'interactive' && q.kind === 'categorize'
        && Array.isArray(q.categories) && q.categories.length >= 2
        && Array.isArray(q.items) && q.items.length >= 2
    case 'short':
      // Marked by matching, so a key is not optional.
      return Boolean(q.short_answer)
    case 'composition':
      // A mark scheme is not enough. "Explain what is a fact in this
      // sentence." carried two marking points and shipped in a 25-mark
      // composition slot, because that was all this asked.
      return Array.isArray(q.marking_criteria) && q.marking_criteria.length > 0
        && isWritingTask(q.question)
    case 'justify':
    case 'written':
      // A point for every mark, or the marks cannot be earned. "[3 marks]
      // (1) ... (2) ..." was the commonest defect in review, and was never
      // re-asked because any scheme at all passed here.
      return Array.isArray(q.marking_criteria)
        && q.marking_criteria.filter((c: unknown) => String(c ?? '').trim()).length >= Math.max(1, Number(slotMarks) || 1)
  }
}

/**
 * Was this written for a composition slot?
 *
 * A composition is a writing task, not a question about a text, a figure or a
 * sum, and the guards written for those deleted it on word-level coincidences:
 * "Aim for about 400 words" read as a character named Aim who is not in the
 * passage; "the difference between a fact and an opinion ... 400 words" read
 * as arithmetic; "so a reader can picture it" read as a missing picture. The
 * stamp is the evidence -- the route wrote it for that slot. The wording is
 * the fallback for a question that arrived without one.
 */
export function isCompositionQuestion(q: unknown): boolean {
  if (!q || typeof q !== 'object') return false
  const o = q as Record<string, unknown>
  if (o.slot_format === 'composition') return true
  if (typeof o.slot_format === 'string') return false
  return isWritingTask(o.question)
}

export interface SlotCheck {
  /** Questions with the slot's marks stamped on. */
  questions: any[]
  /** Formats that came back as something else, for the retry's log. */
  wrong: { index: number; wanted: SlotFormat; got: string }[]
}

/**
 * Stamp the marks, and report any question whose shape is not what was asked.
 *
 * Order-aligned: batch N's question N is slot N, which is how the prompt asks
 * for them and how every other part of this route already reads them back.
 * A batch that returned a different NUMBER of questions is left alone here --
 * that is the retry loop's problem, not this one's.
 */
/**
 * Put each question's marks back on the slot it was written for.
 *
 * Special formats are generated first and the composition is moved to the
 * end, so the list is no longer in blueprint order. Stamping `slotPlan[i]`
 * onto question `i` then gave a one-word answer the essay's 25 marks and the
 * essay the last slot's 1. Questions remember `slot_format`; the first unused
 * slot of that format still has the right number.
 */
export function restampByFormat(
  questions: any[],
  slots: readonly { marks: number; format: string }[],
): number {
  const queues = new Map<string, number[]>()
  for (const slot of slots) {
    const list = queues.get(slot.format) ?? []
    list.push(Number(slot.marks) || 1)
    queues.set(slot.format, list)
  }
  const used = new Map<string, number>()
  let stamped = 0
  questions.forEach((q, i) => {
    if (!q || typeof q !== 'object') return
    const format = typeof q.slot_format === 'string' ? q.slot_format : ''
    const list = format ? queues.get(format) : undefined
    const at = used.get(format) ?? 0
    const want = list && at < list.length ? list[at] : slots[i] ? Number(slots[i].marks) || 1 : null
    if (list && at < list.length) used.set(format, at + 1)
    if (want == null) return
    if (Number(q.marks) !== want) stamped++
    q.marks = want
  })
  return stamped
}

export function enforceSlotShape(questions: unknown, slots: readonly SlotSpec[] | undefined): SlotCheck {
  const list = Array.isArray(questions) ? questions : []
  if (!slots?.length) return { questions: list, wrong: [] }

  const wrong: SlotCheck['wrong'] = []
  list.forEach((q: any, i) => {
    const slot = slots[i]
    if (!slot || !q || typeof q !== 'object') return

    // The slot is right by definition. The model's number is noise.
    q.marks = slot.marks
    if (shapeIsRight(q, slot.format, slot.marks)) {
      // And what it was written FOR, so the guards downstream can tell a
      // composition from a question about the text. Only when it IS that
      // shape: a one-liner kept in a composition slot after a retry must not
      // be waved past every guard as a composition.
      q.slot_format = slot.format
    } else {
      const got = q.type === 'interactive' ? `interactive:${q.kind ?? '?'}` : String(q.type ?? '?')
      wrong.push({ index: i, wanted: slot.format, got })
    }
  })

  return { questions: list, wrong }
}
