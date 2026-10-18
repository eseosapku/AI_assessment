import { describe, expect, it, vi } from 'vitest'
import {
  completeShortQuiz, mergeTopUp, parseTopUp, topUpAllowed, topUpBody,
  TOP_UP_MAX_MISSING, TOP_UP_MAX_TOTAL, TOP_UP_WINDOW_MS,
} from './quiz-top-up'

const q = (n: number, extra: Record<string, unknown> = {}) => ({ id: n, question: `Question number ${n}?`, ...extra })
const quiz = (have: number, extra: Record<string, unknown> = {}) => ({
  assessment_id: 'a1', estimated_time: 40, questions: Array.from({ length: have }, (_, i) => q(i + 1)), ...extra,
})
const payload = { user_id: 'u1', subject: 'Cambridge Primary Science 5', topics: ['States of matter'], count: 40, questionType: 'mcq' }

describe('the follow-up request for a short quiz', () => {
  it('asks for exactly what is missing, with the paper so far', () => {
    // Live: 40 asked for, 32 delivered -- one 30-second request has no time left for a second pass.
    const data = quiz(32, { questions: [...quiz(31).questions, q(32, { image_url: '/textbook-images/rwanda/2/page79-embedded-0.png' })] })
    const body = topUpBody(payload, data)!
    expect(body.count).toBe(8)
    expect(body.subject).toBe(payload.subject)
    expect(body.topUp.assessmentId).toBe('a1')
    expect(body.topUp.have).toHaveLength(32)
    expect(body.topUp.have[0]).toBe('Question number 1?')
    expect(body.topUp.images).toEqual(['/textbook-images/rwanda/2/page79-embedded-0.png'])
  })

  it('is not made for a full quiz, an unsaved one, or a Checkpoint paper', () => {
    expect(topUpBody(payload, quiz(40))).toBeNull()
    expect(topUpBody(payload, quiz(32, { assessment_id: undefined }))).toBeNull()
    expect(topUpBody(payload, quiz(32, { assessment_id: 'auto' }))).toBeNull()
    expect(topUpBody({ ...payload, curriculum: 'checkpoint' }, quiz(32))).toBeNull()
    expect(topUpBody({ ...payload, paperSlots: [] }, quiz(32))).toBeNull()
  })

  it('asks for no more than one request can write', () => {
    expect(topUpBody({ ...payload, count: 60 }, quiz(5))!.count).toBe(TOP_UP_MAX_MISSING)
  })
})

describe('adding the follow-up questions to the quiz', () => {
  it('appends them and numbers the whole quiz from 1', () => {
    const merged = mergeTopUp(quiz(3), [{ id: 1, question: 'A new question?' }, { id: 2, question: 'Another new one?' }])
    expect(merged.questions.map((x) => x.id)).toEqual([1, 2, 3, 4, 5])
    expect(merged.questions[3].question).toBe('A new question?')
    expect(merged.estimated_time).toBe(40)
  })

  it('leaves out a question already on the paper, however it is punctuated', () => {
    const merged = mergeTopUp(quiz(3), [{ question: 'QUESTION number 2' }, { question: 'Fresh?' }])
    expect(merged.questions).toHaveLength(4)
  })

  it('leaves out a figure already on the paper', () => {
    const data = quiz(2, { questions: [q(1, { image_url: '/f.png' }), q(2)] })
    const merged = mergeTopUp(data, [{ question: 'About the same figure?', image_url: '/f.png' }, { question: 'Other?' }])
    expect(merged.questions.map((x) => x.question)).toEqual(['Question number 1?', 'Question number 2?', 'Other?'])
  })

  it('survives junk', () => {
    expect(mergeTopUp(quiz(2), null as never).questions).toHaveLength(2)
    expect(mergeTopUp(quiz(2), [null, 'x', { question: '' }] as never).questions).toHaveLength(2)
  })
})

describe('topping up before the quiz starts', () => {
  it('fills the quiz in follow-up requests', async () => {
    const post = vi.fn()
      .mockResolvedValueOnce({ ok: true, data: { questions: Array.from({ length: 5 }, (_, i) => ({ question: `Top-up A${i}?` })) } })
      .mockResolvedValueOnce({ ok: true, data: { questions: Array.from({ length: 3 }, (_, i) => ({ question: `Top-up B${i}?` })) } })
    const seen: number[] = []
    const out = await completeShortQuiz(quiz(32), payload, { post, onTopUp: (n) => seen.push(n) })
    expect(out.questions).toHaveLength(40)
    expect(post).toHaveBeenCalledTimes(2)
    expect(post.mock.calls[1][0].count).toBe(3)
    expect(post.mock.calls[1][0].topUp.have).toHaveLength(37)
    expect(seen).toEqual([8, 3])
  })

  it('makes no request once the learner has cancelled', async () => {
    const post = vi.fn()
    const controller = new AbortController()
    controller.abort()
    expect((await completeShortQuiz(quiz(32), payload, { post, signal: controller.signal })).questions).toHaveLength(32)
    expect(post).not.toHaveBeenCalled()
  })

  it('makes no request for a full quiz', async () => {
    const post = vi.fn()
    expect((await completeShortQuiz(quiz(40), payload, { post })).questions).toHaveLength(40)
    expect(post).not.toHaveBeenCalled()
  })

  it('starts with what it has when a follow-up fails or adds nothing', async () => {
    const failing = vi.fn().mockRejectedValue(new Error('network'))
    expect((await completeShortQuiz(quiz(32), payload, { post: failing })).questions).toHaveLength(32)
    const refused = vi.fn().mockResolvedValue({ ok: false, data: { error: 'no' } })
    expect((await completeShortQuiz(quiz(32), payload, { post: refused })).questions).toHaveLength(32)
    const empty = vi.fn().mockResolvedValue({ ok: true, data: { questions: [] } })
    expect((await completeShortQuiz(quiz(32), payload, { post: empty })).questions).toHaveLength(32)
    expect(empty).toHaveBeenCalledTimes(1)
  })
})

describe('the server reading a follow-up request', () => {
  it('reads a well-formed one and caps what it carries', () => {
    const t = parseTopUp({ assessmentId: 42, have: Array.from({ length: 500 }, (_, i) => `q${i}`), images: ['/a.png', 7] })!
    expect(t.assessmentId).toBe('42')
    expect(t.have.length).toBeLessThanOrEqual(TOP_UP_MAX_TOTAL)
    expect(t.images).toEqual(['/a.png'])
  })

  it('reads nothing from junk', () => {
    for (const junk of [undefined, null, 'x', 3, {}, { assessmentId: '' }, { assessmentId: {} }]) {
      expect(parseTopUp(junk)).toBeNull()
    }
  })

  it('allows it only on the same learner\'s quiz, just made, with room left', () => {
    const now = Date.parse('2026-10-18T10:00:00Z')
    const row = { user_id: 'u1', created_at: new Date(now - 60_000).toISOString(), n: 32 }
    expect(topUpAllowed(row, 'u1', 8, now)).toBe(true)
    expect(topUpAllowed(row, 'u2', 8, now)).toBe(false)
    expect(topUpAllowed({ ...row, user_id: null }, '', 8, now)).toBe(true)
    expect(topUpAllowed({ ...row, user_id: null }, 'u1', 8, now)).toBe(false)
    expect(topUpAllowed({ ...row, created_at: new Date(now - TOP_UP_WINDOW_MS - 1).toISOString() }, 'u1', 8, now)).toBe(false)
    expect(topUpAllowed({ ...row, n: TOP_UP_MAX_TOTAL - 2 }, 'u1', 8, now)).toBe(false)
    expect(topUpAllowed(row, 'u1', TOP_UP_MAX_MISSING + 1, now)).toBe(false)
    expect(topUpAllowed(undefined, 'u1', 8, now)).toBe(false)
  })
})
