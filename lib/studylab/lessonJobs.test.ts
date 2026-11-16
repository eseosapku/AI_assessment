// lib/studylab/lessonJobs.test.ts
import { describe, it, expect } from 'vitest'
import { modelForJob, fallbackForJob, reasoningForJob, JOB_MODELS, type LessonJob } from './lessonJobs'

const JOBS: LessonJob[] = ['plan', 'teach_beat', 'check', 'grade', 'help']

const KIMI = 'global.moonshotai.kimi-k3.1'

describe('JOB_MODELS', () => {
  it('runs every lesson job but marking on Kimi K3.1', () => {
    for (const job of ['plan', 'teach_beat', 'check', 'help', 'author', 'judge'] as const) expect(JOB_MODELS[job], job).toBe(KIMI)
  })

  it('leaves grading where it was -- the grade route is frozen', () => {
    expect(JOB_MODELS.grade).toBe('amazon.nova-lite-v1:0')
  })

  it('names a model for every job', () => {
    for (const job of JOBS) expect(JOB_MODELS[job], job).toBeTruthy()
  })
})

describe('reasoningForJob', () => {
  it('sets thinking per job', () => {
    expect(reasoningForJob('plan', {} as never)).toBe('none')
    expect(reasoningForJob('check', {} as never)).toBe('none')
    for (const job of ['teach_beat', 'help', 'author', 'judge'] as const) expect(reasoningForJob(job, {} as never), job).toBe('low')
    expect(reasoningForJob('grade', {} as never)).toBeUndefined()
  })
  it('lets each job be overridden on its own, and ignores nonsense', () => {
    expect(reasoningForJob('help', { AWS_LESSON_HELP_REASONING: 'none' } as never)).toBe('none')
    expect(reasoningForJob('plan', { AWS_LESSON_PLAN_REASONING: 'high' } as never)).toBe('high')
    expect(reasoningForJob('judge', { AWS_LESSON_JUDGE_REASONING: 'loud' } as never)).toBe('low')
    expect(reasoningForJob('check', { AWS_LESSON_PLAN_REASONING: 'high' } as never)).toBe('none')
  })
})

describe('modelForJob', () => {
  it('lets each job be overridden on its own', () => {
    expect(modelForJob('plan', { AWS_LESSON_PLAN_MODEL_ID: 'amazon.nova-micro-v1:0' } as never))
      .toBe('amazon.nova-micro-v1:0')
    // Overriding one job must not move the others.
    expect(modelForJob('teach_beat', { AWS_LESSON_PLAN_MODEL_ID: 'amazon.nova-micro-v1:0' } as never))
      .toBe(KIMI)
    expect(modelForJob('help', { AWS_LESSON_HELP_MODEL_ID: 'amazon.nova-pro-v1:0' } as never)).toBe('amazon.nova-pro-v1:0')
  })

  it('strips a region prefix, which is routing rather than another model', () => {
    expect(modelForJob('grade', { AWS_LESSON_GRADE_MODEL_ID: 'eu.amazon.nova-lite-v1:0' } as never))
      .toBe('amazon.nova-lite-v1:0')
  })

  it('keeps the global. prefix, which names a different profile', () => {
    expect(modelForJob('plan', {} as never)).toBe(KIMI)
    expect(modelForJob('plan', { AWS_LESSON_PLAN_MODEL_ID: 'global.amazon.nova-2-lite-v1:0' } as never)).toBe('global.amazon.nova-2-lite-v1:0')
  })

  it('falls back to the table when nothing is set', () => {
    for (const job of JOBS) expect(modelForJob(job, {} as never)).toBe(JOB_MODELS[job])
  })

  it('ignores an override that is only whitespace', () => {
    expect(modelForJob('check', { AWS_LESSON_CHECK_MODEL_ID: '   ' } as never))
      .toBe(JOB_MODELS.check)
  })
})

describe('fallbackForJob', () => {
  it('hands the live jobs to Qwen3 Next when Kimi is busy', () => {
    for (const job of ['plan', 'teach_beat', 'check', 'help'] as const) expect(fallbackForJob(job, {} as never), job).toBe('qwen.qwen3-next-80b-a3b')
  })
  it('has none for authoring, judging or marking', () => {
    for (const job of ['author', 'judge', 'grade'] as const) expect(fallbackForJob(job, {} as never), job).toBeUndefined()
  })
  it('can be overridden', () => {
    expect(fallbackForJob('help', { AWS_LESSON_FALLBACK_MODEL_ID: 'openai.gpt-oss-120b-1:0' } as never)).toBe('openai.gpt-oss-120b-1:0')
  })
})
