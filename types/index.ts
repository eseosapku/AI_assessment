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

export interface Question {
  id: number
  question: string
  options: string[]
  correct_answer: number
  feedback_text: string
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
}

export interface StudentProfile {
  name: string
  id: string
  class: string
  subjects: string[]
}
