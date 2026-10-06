/** Interactive Study question types — drag, match, order, categorize, fill-in. */

import type { FigureGroupMeta } from '@/lib/assessment-figure-groups'

export type InteractiveKind =
  | 'match'
  | 'order'
  | 'categorize'
  | 'fill_blank'
  | 'true_false'
  | 'multi_select'
  | 'odd_one_out'

export interface InteractiveQuestionBase {
  id: number
  type: 'interactive'
  kind: InteractiveKind
  question: string
  explanation: string
  marks: number
  image_url?: string
  /** What the figure shows, for a screen reader. */
  image_alt?: string
  diagram_svg?: string
  figureGroup?: FigureGroupMeta
}

/** Match terms on the left to descriptions on the right. */
export interface MatchInteractiveQuestion extends InteractiveQuestionBase {
  kind: 'match'
  left_items: string[]
  right_items: string[]
  /** Each pair: [leftIndex, rightIndex] */
  correct_pairs: [number, number][]
}

/** Put steps / events in the correct sequence. */
export interface OrderInteractiveQuestion extends InteractiveQuestionBase {
  kind: 'order'
  items: string[]
  /** Indices into `items` in correct order, e.g. [2,0,1,3] */
  correct_order: number[]
}

/** Sort items into 2–3 category bins. */
export interface CategorizeInteractiveQuestion extends InteractiveQuestionBase {
  kind: 'categorize'
  categories: string[]
  items: string[]
  /** For each item index, which category index (0-based) */
  correct_category: number[]
}

/** Fill gaps using a word bank (includes distractors). */
export interface FillBlankInteractiveQuestion extends InteractiveQuestionBase {
  kind: 'fill_blank'
  /** Text with {{0}}, {{1}} placeholders for blanks */
  template: string
  blanks: { id: string; correct: string }[]
  word_bank: string[]
}

/** Mark each statement true or false. */
export interface TrueFalseInteractiveQuestion extends InteractiveQuestionBase {
  kind: 'true_false'
  statements: string[]
  correct_answers: boolean[]
}

/** Select all correct options (tap to toggle). */
export interface MultiSelectInteractiveQuestion extends InteractiveQuestionBase {
  kind: 'multi_select'
  options: string[]
  correct_indices: number[]
}

/** Tap the one item that does not belong. */
export interface OddOneOutInteractiveQuestion extends InteractiveQuestionBase {
  kind: 'odd_one_out'
  items: string[]
  correct_index: number
}

export type InteractiveQuestion =
  | MatchInteractiveQuestion
  | OrderInteractiveQuestion
  | CategorizeInteractiveQuestion
  | FillBlankInteractiveQuestion
  | TrueFalseInteractiveQuestion
  | MultiSelectInteractiveQuestion
  | OddOneOutInteractiveQuestion

export type InteractiveAnswer =
  | { kind: 'match'; pairs: Record<number, number> }
  | { kind: 'order'; order: number[] }
  | { kind: 'categorize'; assignments: Record<number, number> }
  | { kind: 'fill_blank'; values: Record<string, string> }
  | { kind: 'true_false'; answers: Record<number, boolean> }
  | { kind: 'multi_select'; selected: number[] }
  | { kind: 'odd_one_out'; selected: number }

export interface InteractiveGrade {
  marks_awarded: number
  marks_total: number
  item_results: { label: string; correct: boolean }[]
}

export type AssessmentQuestionType =
  | 'mcq'
  | 'longform'
  | 'mixed'
  | 'interactive'
  | 'study_mixed'
