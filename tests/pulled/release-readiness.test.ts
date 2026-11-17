import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { JOB_MODELS, modelForJob, reasoningForJob, fallbackForJob, type LessonJob } from '@/lib/studylab/lessonJobs'
import { buildInvokeBody, buildModelCandidates, homeRegionFor, takesReasoningEffort, extractText, isModelIdError, resetWorkingModels } from '@/lib/bedrock'
import { isExamStyle, paperGroups } from '@/lib/exam-parts'

const root = path.resolve(__dirname, '..', '..')
const read = (rel: string) => fs.readFileSync(path.join(root, rel), 'utf8')
const JOBS = Object.keys(JOB_MODELS) as LessonJob[]

describe('migrations shipped with the pull', () => {
  it('add-mastery-latest only adds the four nullable/defaulted columns', () => {
    const sql = read('migrations/add-mastery-latest.sql')
    for (const col of ['last_accuracy', 'lowest_accuracy', 'pending_correct', 'pending_total']) {
      expect(sql).toMatch(new RegExp(`ADD COLUMN IF NOT EXISTS\\s+${col}`, 'i'))
    }
    expect(sql).not.toMatch(/\b(DROP|RENAME|TRUNCATE|DELETE)\b/i)
  })

  it('add-author-station-index is CONCURRENTLY and not wrapped in a transaction', () => {
    const sql = read('migrations/add-author-station-index.sql')
    expect(sql).toMatch(/CREATE INDEX CONCURRENTLY/i)
    expect(sql).not.toMatch(/^\s*BEGIN\b/im)
    expect(sql).toMatch(/IF NOT EXISTS/i)
  })
})

describe('lesson job models', () => {
  it('every job has a non-empty default model', () => {
    for (const job of JOBS) expect(JOB_MODELS[job].trim()).not.toBe('')
  })

  it('an env override wins and regional prefixes are stripped', () => {
    for (const job of JOBS) {
      const key = `AWS_LESSON_${job === 'teach_beat' ? 'TEACH' : job.toUpperCase()}_MODEL_ID`
      expect(modelForJob(job, { [key]: 'eu.amazon.nova-pro-v1:0' } as any)).toBe('amazon.nova-pro-v1:0')
    }
  })

  it('reasoning override accepts only known levels', () => {
    expect(reasoningForJob('plan', { AWS_LESSON_PLAN_REASONING: 'HIGH' } as any)).toBe('high')
    expect(reasoningForJob('plan', { AWS_LESSON_PLAN_REASONING: 'extreme' } as any)).toBe(reasoningForJob('plan', {} as any))
  })

  it('a fallback is never the same model as the primary', () => {
    for (const job of JOBS) {
      const fb = fallbackForJob(job, {} as any)
      if (fb) expect(fb).not.toBe(modelForJob(job, {} as any))
    }
    expect(fallbackForJob('author', {} as any)).toBeUndefined()
    expect(fallbackForJob('judge', {} as any)).toBeUndefined()
  })

  it('amplify.yml forwards the AWS_LESSON_* overrides to the server', () => {
    expect(read('amplify.yml')).toMatch(/AWS_LESSON_/)
  })
})

describe('bedrock request shapes', () => {
  it('Kimi gets reasoning_effort, Nova never does', () => {
    expect(takesReasoningEffort('global.moonshotai.kimi-k3.1')).toBe(true)
    expect(takesReasoningEffort('eu.amazon.nova-pro-v1:0')).toBe(false)
    const kimi = JSON.parse(buildInvokeBody('global.moonshotai.kimi-k3.1', 'hi', 500, 0.2, undefined, 'low'))
    expect(kimi.reasoning_effort).toBe('low')
    expect(kimi.max_tokens).toBeGreaterThan(500)
    const nova = JSON.parse(buildInvokeBody('eu.amazon.nova-pro-v1:0', 'hi', 500, 0.2, undefined, 'low'))
    expect(nova.reasoning_effort).toBeUndefined()
    expect(nova.inferenceConfig.maxTokens).toBe(500)
  })

  it('Mistral Large 3 is pinned to us-east-1 and called by its bare id', () => {
    resetWorkingModels()
    expect(homeRegionFor('mistral.mistral-large-3-675b-instruct')).toBe('us-east-1')
    expect(buildModelCandidates('mistral.mistral-large-3-675b-instruct')).toEqual(['mistral.mistral-large-3-675b-instruct'])
  })

  it('a global profile is never expanded into regional guesses', () => {
    resetWorkingModels()
    expect(buildModelCandidates('global.moonshotai.kimi-k3.1')).toEqual(['global.moonshotai.kimi-k3.1'])
  })

  it('reasoning text is never returned as the answer', () => {
    const payload = { choices: [{ message: { content: '<think>secret</think>{"ok":true}' } }] }
    expect(extractText('global.moonshotai.kimi-k3.1', payload)).toBe('{"ok":true}')
  })

  it('only model-id errors trigger the next candidate', () => {
    expect(isModelIdError({ name: 'ValidationException', message: 'The provided model identifier is invalid' })).toBe(true)
    expect(isModelIdError({ name: 'ValidationException', message: 'temperature must be <= 1' })).toBe(false)
  })
})

describe('quiz writer defaults (lib/assessment-generation.ts)', () => {
  const src = read('lib/assessment-generation.ts')
  it('writer and checker default to Kimi K3.1 with a different fallback', () => {
    expect(src).toMatch(/DEFAULT_QUIZ_WRITER_MODEL = 'global\.moonshotai\.kimi-k3\.1'/)
    expect(src).toMatch(/DEFAULT_CHECKER_MODEL = 'global\.moonshotai\.kimi-k3\.1'/)
    const fb = src.match(/QUIZ_FALLBACK_MODEL = '([^']+)'/)?.[1]
    expect(fb).toBeTruthy()
    expect(fb).not.toMatch(/kimi-k3\.1/)
  })
})

describe('exam-style papers', () => {
  it('the style label is recognised', () => {
    expect(isExamStyle('Exam Style (Past Papers)')).toBe(true)
    expect(isExamStyle('Multiple choice')).toBe(false)
  })

  it('parts of one numbered question stay on one screen', () => {
    const qs = [
      { part: 'a', exam_question_id: 'q1' }, { part: 'b', exam_question_id: 'q1' },
      { part: 'a', exam_question_id: 'q2' },
    ]
    expect(paperGroups(qs)).toEqual([{ start: 0, end: 2, number: 1 }, { start: 2, end: 3, number: 2 }])
  })

  it('the quiz page uses the smaller text only for exam-style questions', () => {
    const page = read('app/assessment/page.tsx')
    expect(page).toMatch(/const examPaper = 'exam_question_id' in question/)
    expect(page).toMatch(/className=\{stemClass\}/)
    expect(page).toMatch(/text-xl sm:text-2xl lg:text-3xl/)
  })
})

describe('routes that talk to a model or another student', () => {
  it('lost marks are loaded only for the user id on the request', () => {
    // Login does not issue session tokens yet (lib/auth/admin.ts), so this
    // route cannot check a cookie. It still has to refuse a bad id and bind
    // the query to the id it was given.
    const src = read('app/api/studylab/gap-map/lost-marks/route.ts')
    expect(src).toMatch(/UUID_RE\.test\(userId\)/)
    expect(src).toMatch(/WHERE user_id = \$1/)
  })

  it('studylab grade route passes an abort signal to the model call', () => {
    const src = read('app/api/studylab/grade/route.ts')
    expect(src).toMatch(/signal:\s*AbortSignal\.timeout/)
  })
})
