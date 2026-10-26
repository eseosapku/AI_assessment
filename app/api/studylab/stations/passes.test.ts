// app/api/studylab/stations/passes.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/bedrock', () => ({
  callGemma: vi.fn(),
  parseJsonRobust: (t: string) => JSON.parse(t),
  fixLatexInRawJson: (t: string) => t,
  hasBedrockCredentials: () => true,
}))

import { callGemma } from '@/lib/bedrock'
import { runPass, type PassContext } from './passes'
import { modelForJob } from '@/lib/studylab/lessonJobs'

beforeEach(() => vi.mocked(callGemma).mockReset())

const sortSpec = {
  pattern: 'sort', prompt: 'Sort the elements',
  payload: {
    bins: [{ id: 'b1', label: 'Metal' }, { id: 'b2', label: 'Non-metal' }],
    items: [{ id: 'i1', label: 'Iron', binId: 'b1', imageUrl: 'iron' }, { id: 'i2', label: 'Sulfur', binId: 'b2', imageUrl: 'sulfur' }],
  },
  success: { kind: 'binAssignment', assign: { i1: 'b1', i2: 'b2' } },
}
const intent = { goal: 'Tell metals from non-metals.', isolates: 'category', apparatus: 'sorting-frame', why: 'Sorting is the decision.' }
const step = { id: 's1', title: 'Metals and non-metals', goal: 'Sort elements into metals and non-metals', status: 'pending' as const, cardIds: [] }
const ctx = (partial: PassContext['partial'] = {}): PassContext => ({ title: 'Elements', subject: 'Chemistry', step, stepNo: 1, plan: [step], version: 'v1', partial })
const explore = { opening: 'Watch which ones bend.', action: { type: 'createActivity', id: 's1-explore', spec: sortSpec, step: 1 }, intent, hints: ['Shiny?'] }
const card = (id: string) => ({ type: 'createCard', id, card: 'concept', title: `Card ${id}`, body: 'A real sentence with an example.', step: 1 })
const name = {
  solved: { say: 'You split them by behaviour.', actions: [card('s1-solved-1')] },
  helped: { say: 'Iron told you.', actions: [card('s1-helped-1')] },
  untried: { say: 'Here is the idea.', actions: [card('s1-untried-1')] },
}
const practice = { say: 'Same idea.', action: { type: 'createCard', id: 's1-practice', card: 'practice', title: 'Copper or carbon?', body: 'Which is a metal?', answer: 'Copper', rubric: 'Names copper', steps: ['Copper conducts'], step: 1 } }
const check = { say: 'Quick check.', questions: [{ id: 'q1', format: 'mcq', prompt: 'Which is a metal?', options: ['Sulfur', 'Iron'], answer: 1, optionFeedback: ['Sulfur is brittle.', 'Yes.'] }] }
const reply = (o: unknown) => vi.mocked(callGemma).mockResolvedValueOnce(JSON.stringify(o))
const call = (n = 0) => vi.mocked(callGemma).mock.calls[n]

describe('runPass: explore', () => {
  it('writes the explore item ahead, for this station, on the authoring model and within budget', async () => {
    reply({ opening: 'Watch which ones bend.', action: { type: 'createActivity', id: 'whatever', spec: sortSpec }, intent, hints: ['Shiny?'] })
    const out = await runPass('explore', ctx())
    expect(out.ok).toBe(true)
    if (!out.ok) return
    // Ids are the station's, whatever the model chose, so nothing collides on the board.
    expect((out.partial?.explore?.action as { id?: string }).id).toBe('s1-explore')
    const [prompt, opts] = call()
    expect(String(prompt)).toContain('WRITING AHEAD')
    expect(String(prompt)).toContain('STAGE: EXPLORE')
    expect(String(prompt)).toContain('Sort elements into metals and non-metals')
    expect(String(prompt)).toMatch(/cite where it comes from/i)
    expect(opts).toMatchObject({ model: modelForJob('author'), maxTokens: expect.any(Number) })
    expect((opts as { maxTokens: number }).maxTokens).toBeLessThanOrEqual(1500)
  })
  it('takes the intent from the material when the model puts it there, and keeps it off the action', async () => {
    reply({ opening: 'Watch which ones bend.', action: { type: 'createActivity', id: 'x', spec: sortSpec, intent }, hints: [] })
    const out = await runPass('explore', ctx())
    expect(out.ok).toBe(true)
    if (!out.ok) return
    expect(out.partial?.explore?.intent).toMatchObject({ isolates: 'category' })
    expect(out.partial?.explore?.action).not.toHaveProperty('intent')
  })

  it('refuses a reading card in place of something to handle', async () => {
    reply({ opening: 'Read this.', action: card('x'), hints: [] })
    expect((await runPass('explore', ctx())).ok).toBe(false)
  })
})

describe('runPass: name', () => {
  it('writes a cut for each outcome, pointing at the explore item it builds on', async () => {
    reply({
      solved: { say: 'You split them.', actions: [card('a'), { type: 'connect', from: 'whatever', to: 'a' }, { type: 'point', nodeId: 'whatever', part: 'piece-i1' }] },
      helped: { say: 'Iron told you.', actions: [card('b')] },
      untried: { say: 'Here is the idea.', actions: [card('c')] },
    })
    const out = await runPass('name', ctx({ explore: explore as never }))
    expect(out.ok).toBe(true)
    if (!out.ok) return
    const solved = out.partial!.name!.solved.actions as { type: string; id?: string; from?: string; to?: string; nodeId?: string }[]
    expect(solved[0].id).toBe('s1-solved-1')
    expect(solved[1]).toMatchObject({ from: 's1-explore', to: 's1-solved-1' })
    expect(solved[2]).toMatchObject({ nodeId: 's1-explore' })
    expect(String(call()[0])).toContain('Watch which ones bend.')
    expect(String(call()[0])).toMatch(/never describe a result they did not reach/i)
  })
  it('refuses a reply missing one of the outcomes', async () => {
    reply({ solved: name.solved, helped: name.helped })
    expect((await runPass('name', ctx({ explore: explore as never }))).ok).toBe(false)
  })
})

describe('runPass: practice_check', () => {
  it('refuses a check whose wrong option says nothing to whoever picks it', async () => {
    reply({ practice, check: { ...check, questions: [{ ...check.questions[0], optionFeedback: ['', 'Yes.'] }] } })
    expect((await runPass('practice_check', ctx({ explore: explore as never, name: name as never }))).ok).toBe(false)
  })
  it('writes a near-twin practice item and a hard check with feedback on every option', async () => {
    reply({ practice, check })
    const out = await runPass('practice_check', ctx({ explore: explore as never, name: name as never }))
    expect(out.ok).toBe(true)
    expect(String(call()[0])).toMatch(/optionFeedback/)
    expect(String(call()[0])).toMatch(/near-twin/i)
  })
})

describe('runPass: verify', () => {
  const whole = { explore: explore as never, name: name as never, practice: practice as never, check: check as never }
  it('runs the code checks first, and asks no judge about a station they refuse', async () => {
    const out = await runPass('verify', ctx({ ...whole, check: { say: '', questions: [] } as never }))
    expect(out).toMatchObject({ ok: false, redo: 'practice_check' })
    expect(callGemma).not.toHaveBeenCalled()
  })
  it('hands a judge failure back as the pass to write again, when it quotes the wrong text', async () => {
    reply({ ok: false, pass: 'name', quote: 'You split them by behaviour', reason: 'Not what the sort shows.' })
    expect(await runPass('verify', ctx(whole))).toMatchObject({ ok: false, redo: 'name' })
  })

  it('passes a station the judge fails without quoting anything actually in it -- a judge that invents an error', async () => {
    reply({ ok: false, pass: 'practice_check', quote: '3/9 does not match', reason: 'Wrong pattern.' })
    expect(await runPass('verify', ctx(whole))).toMatchObject({ ok: true })
    vi.mocked(callGemma).mockReset()
    reply({ ok: false, pass: 'explore', reason: 'The vary relationship is wrong.' })
    expect(await runPass('verify', ctx(whole))).toMatchObject({ ok: true })
  })

  it('finds the pass to write again from where the quote is, when the judge names none', async () => {
    reply({ ok: false, quote: 'Watch which ones bend', reason: 'Nothing bends in a sort.' })
    expect(await runPass('verify', ctx(whole))).toMatchObject({ ok: false, redo: 'explore' })
    vi.mocked(callGemma).mockReset()
    reply({ ok: false, pass: 'nonsense', quote: 'Sulfur is brittle', reason: 'It is.' })
    expect(await runPass('verify', ctx(whole))).toMatchObject({ ok: false, redo: 'practice_check' })
  })

  it('asks about a relationship only when the station has one', async () => {
    reply({ ok: true })
    await runPass('verify', ctx(whole))
    expect(String(call()[0])).not.toMatch(/relationship/i)
  })
  it('returns the whole bundle when the judge passes it, on the judging model', async () => {
    reply({ ok: true })
    const out = await runPass('verify', ctx(whole))
    expect(out).toMatchObject({ ok: true, bundle: { version: 'v1', stepId: 's1' } })
    expect(call()[1]).toMatchObject({ model: modelForJob('judge'), fallbackModel: modelForJob('plan') })
    expect((call()[1] as { maxTokens: number }).maxTokens).toBeLessThanOrEqual(400)
  })
})
