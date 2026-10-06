// Type definitions for the application

export interface Assessment {
  id: string
  date: string
  subject: string
  topic: string
  grade: string
  score: number
  feedback: string
}

import type { InteractiveQuestion } from '@/types/interactive'

export interface MCQQuestion {
  id: number
  type?: 'mcq'
  question: string
  options: string[]
  correct_answer: number
  feedback_text?: string
  explanation?: string
  diagram_svg?: string
  image_url?: string
  /** What the figure shows, for a screen reader. */
  image_alt?: string
}

export interface LongFormQuestion {
  id: number
  type: 'longform'
  question: string
  marks: number
  marking_criteria: string[]
  /** One comprehensive student-facing hint for the whole question. Never the mark itself. */
  hints?: string[]
  model_answer: string
  explanation: string
  passage?: string          // source text / extract for the student to read
  passage_source?: string   // e.g. "Charles Dickens, Great Expectations (1861)"
  diagram_svg?: string
  image_url?: string
  /** What the figure shows, for a screen reader. */
  image_alt?: string
}

export type Question = MCQQuestion | LongFormQuestion | InteractiveQuestion

export interface CriterionResult {
  criterion: string
  met: boolean
  relevant_quote: string | null
  note: string
}

export interface LongFormGrade {
  marks_awarded: number
  marks_total: number
  criteria_results: CriterionResult[]
  general_feedback: string
}

export interface AssessmentData {
  assessment_id: string
  estimated_time: number
  questions_array: Question[]
  subject: string
  topics: string[]
}

export interface FormData {
  subject: string
  topics: string[]
  count: number
  style: string
  time: string
  questionType?: 'mcq' | 'longform' | 'mixed' | 'interactive' | 'study_mixed'
}

export interface StudentProfile {
  name: string
  id: string
  class: string
  subjects: string[]
}
