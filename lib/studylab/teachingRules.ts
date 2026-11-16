// lib/studylab/teachingRules.ts

/**
 * Four teaching rules, one wording each, put into every prompt where they take
 * effect (the plan, the live teach turn, the station author passes). Kept in
 * one place so the plan and the teaching cannot drift apart on them.
 *
 * They came from a critique of a real lesson on a typed topic ("The Concept of
 * Sonder and Loneliness"): the student typed nothing in fifteen minutes, met
 * university terms, was told a coined word was settled psychology, and got
 * cards that only restated the answer key of each sort.
 */

/** Pitch and plain words. */
export const LEVEL_RULE =
  'PITCH: when the lesson comes from a textbook chapter or a year group, pitch to that. A typed topic with no level is for a secondary-school student of about 14 to 16: use plain words for ideas, and bring in a technical term only if their syllabus would use it or they ask for it.'

/** Where a coined or unusual word comes from. */
export const ORIGIN_RULE =
  'COINED WORDS: when the topic centres on a coined, borrowed or unusual word, say in one line, early, where it comes from (who made it up, and in what). Never present a coined word as established science.'

/** The plan must leave room for the student's own words. */
export const OWN_WORDS_PLAN_RULE =
  'At least one step must have the student answer in a sentence of their own words: a short question with no right answer, never multiple choice. Say so in that step\'s goal.'

/** The live turn: how that open moment is asked and answered. */
export const OWN_WORDS_TEACH_RULE =
  'OWN WORDS: at least once in the lesson, when the plan has a step that calls for it, ask the student ONE short question in "say" that they answer in a sentence of their own (no right answer, not marked, not multiple choice), with awaitUser true and no checkpoint that turn. When they reply, answer what they actually wrote, using their words.'

/** The card that names the idea after an activity. */
export const AFTER_ACTIVITY_RULE =
  'The card that names the idea after an activity must NOT list which item went where -- the student has just seen that. It names the idea and adds ONE new thing: a fresh example, a consequence, or a question that pushes further.'
