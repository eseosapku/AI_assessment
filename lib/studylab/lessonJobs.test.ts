// lib/studylab/lessonJobs.test.ts
import { describe, it, expect } from 'vitest'
import { modelForJob, JOB_MODELS, type LessonJob } from './lessonJobs'

const JOBS: LessonJob[] = ['plan', 'teach_beat', 'check', 'grade', 'help']

const SONNET = 'anthropic.claude-sonnet-4-5-20250929-v1:0'
const HAIKU = 'anthropic.claude-haiku-4-5-20251001-v1:0'

describe('JOB_MODELS', () => {
  it('plans on Sonnet: one or two short calls a lesson, and the shape of everything after', () => {
    expect(JOB_MODELS.plan).toBe(SONNET)
  })

  it('teaches, checks and helps on Haiku: fast enough for a live turn, and keys a check right', () => {
    expect(JOB_MODELS.teach_beat).toBe(HAIKU)
    expect(JOB_MODELS.check).toBe(HAIKU)
    expect(JOB_MODELS.help).toBe(HAIKU)
  })

  it('leaves grading where it was -- the grade route is frozen', () => {
    expect(JOB_MODELS.grade).toBe('amazon.nova-lite-v1:0')
  })

  it('names a model for every job', () => {
    for (const job of JOBS) expect(JOB_MODELS[job], job).toBeTruthy()
  })
})

describe('modelForJob', () => {
  it('lets each job be overridden on its own', () => {
    expect(modelForJob('plan', { AWS_LESSON_PLAN_MODEL_ID: 'amazon.nova-micro-v1:0' } as never))
      .toBe('amazon.nova-micro-v1:0')
    // Overriding one job must not move the others.
    expect(modelForJob('teach_beat', { AWS_LESSON_PLAN_MODEL_ID: 'amazon.nova-micro-v1:0' } as never))
      .toBe(HAIKU)
    expect(modelForJob('help', { AWS_LESSON_HELP_MODEL_ID: 'amazon.nova-pro-v1:0' } as never)).toBe('amazon.nova-pro-v1:0')
  })

  it('strips a region prefix, which is routing rather than another model', () => {
    expect(modelForJob('grade', { AWS_LESSON_GRADE_MODEL_ID: 'eu.amazon.nova-lite-v1:0' } as never))
      .toBe('amazon.nova-lite-v1:0')
  })

  it('falls back to the table when nothing is set', () => {
    for (const job of JOBS) expect(modelForJob(job, {} as never)).toBe(JOB_MODELS[job])
  })

  it('ignores an override that is only whitespace', () => {
    expect(modelForJob('check', { AWS_LESSON_CHECK_MODEL_ID: '   ' } as never))
      .toBe(JOB_MODELS.check)
  })
})
