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
  it('hands check to Qwen3 Next when Kimi is busy', () => {
    expect(fallbackForJob('check', {} as never)).toBe('qwen.qwen3-next-80b-a3b')
  })
  // Six-way blind Opus test, 2026-11-16: Mistral Large 3 taught 7 of 8 turns
  // acceptably (5.3/10, no factual errors) against Qwen3 Next's 5 of 8 (4.5),
  // in about 5 s. Nothing on Bedrock came near Kimi K3.1 (8 of 8, 7.8).
  it('hands teaching to Mistral Large 3', () => {
    expect(fallbackForJob('teach_beat', {} as never)).toBe('mistral.mistral-large-3-675b-instruct')
  })
  // Given room, Kimi K3's plans were the best of three in a blind Opus test
  // (7.9/10, against Qwen3 Next's 4.9 with a false fact), in 5-11 s.
  it('hands plan to Kimi K3', () => {
    expect(fallbackForJob('plan', {} as never)).toBe('global.moonshotai.kimi-k3')
  })
  // Blind Opus test, 2026-11-16: Kimi K3 hints 8/8 acceptable (7.9/10) against
  // Qwen3 Next 6/8 (4.9), in 4-8 s, and answered every time K3.1 was refused.
  it('hands help to Kimi K3, which answers when K3.1 is busy and gave the best hints', () => {
    expect(fallbackForJob('help', {} as never)).toBe('global.moonshotai.kimi-k3')
  })
  it('has none for authoring, judging or marking', () => {
    for (const job of ['author', 'judge', 'grade'] as const) expect(fallbackForJob(job, {} as never), job).toBeUndefined()
  })
  it('can be overridden', () => {
    expect(fallbackForJob('help', { AWS_LESSON_FALLBACK_MODEL_ID: 'openai.gpt-oss-120b-1:0' } as never)).toBe('openai.gpt-oss-120b-1:0')
  })
})
