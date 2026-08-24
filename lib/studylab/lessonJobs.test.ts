// lib/studylab/lessonJobs.test.ts
import { describe, it, expect } from 'vitest'
import { modelForJob, JOB_MODELS, type LessonJob } from './lessonJobs'

const JOBS: LessonJob[] = ['plan', 'teach_beat', 'check', 'grade']

describe('JOB_MODELS', () => {
  it('puts the jobs a student reads on the stronger model', () => {
    // Planning gets Gemma despite its short output: ordering a syllabus needs
    // the subject's dependency structure, and at one or two calls a lesson the
    // cost difference is about $0.0003.
    expect(JOB_MODELS.plan).toBe('google.gemma-3-27b-it')
    expect(JOB_MODELS.teach_beat).toBe('google.gemma-3-27b-it')
  })

  it('puts the bounded transforms on the fast model', () => {
    expect(JOB_MODELS.check).toBe('amazon.nova-lite-v1:0')
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
      .toBe('google.gemma-3-27b-it')
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
